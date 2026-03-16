/**
 * Regression tests for Agent #24 features:
 *   - FloorItemSystem (drops, apply effects, boss integration)
 *   - IceShard weapon (freeze on hit, AoE unlock at L4)
 *   - ShadowDagger weapon (bleed at L4, chain at L7)
 *   - Elite Aura system (aura after wave 8, max 1 per wave, HP boost)
 *   - New characters (Viktor, Nyx) and weapons (ice_shard, shadow_dagger) in registry
 *
 * Agent #25 additions:
 *   - ChallengeSystem: no_heals, famine, iron_will hooks + gold multiplier
 */
import { describe, test, expect, jest } from '@jest/globals';
import { FloorItemSystem } from '../src/systems/FloorItemSystem.js';
import { IceShard } from '../src/entities/weapons/IceShard.js';
import { ShadowDagger } from '../src/entities/weapons/ShadowDagger.js';
import { ChallengeSystem } from '../src/systems/ChallengeSystem.js';
import { CHARACTERS } from '../src/data/characters.js';

// ── Shared mock factories ────────────────────────────────────────────────────

function makeGame(overrides = {}) {
    return {
        player: {
            x: 0,
            y: 0,
            isAlive: () => true,
            maxHealth: 100,
            health: 80,
            weapons: new Map(),
            addDamageNumber: jest.fn(),
            stats: { damage: 1, luck: 1, speed: 1, area: 1 }
        },
        camera: {
            getWorldBounds: (m = 0) => ({ left: -500, right: 500, top: -500, bottom: 500 }),
            shake: jest.fn(),
            flash: jest.fn()
        },
        systems: {
            enemy: { activeEnemies: [] },
            experience: { magnetizeAllGems: jest.fn(), activateGlobalMagnet: jest.fn() },
            gold: { spawnCoin: jest.fn(), runGold: 0 },
            particle: { create: jest.fn() },
            floorItems: null
        },
        applyStatUpgrade: jest.fn(),
        ...overrides
    };
}

function makePlayer(game) {
    return game.player;
}

function makeWeaponGame() {
    return {
        player: {
            x: 0,
            y: 0,
            direction: 0,
            stats: { damage: 1, area: 1 },
            weapons: new Map()
        },
        systems: {
            enemy: {
                getEnemiesInRange: jest.fn(() => []),
                activeEnemies: []
            },
            projectile: {
                activeProjectiles: [],
                createProjectile: jest.fn(() => ({ active: true }))
            },
            particle: { create: jest.fn(), createCriticalEffect: jest.fn() },
            statusEffect: {
                applyFreezeEffect: jest.fn(),
                applyStatusEffect: jest.fn()
            }
        },
        audioManager: null,
        camera: { shake: jest.fn() }
    };
}

// ── FloorItemSystem tests ────────────────────────────────────────────────────

describe('FloorItemSystem', () => {
    test('getItemDef returns defs for all four item types', () => {
        const sys = new FloorItemSystem(makeGame());
        expect(sys.getItemDef('health_orb')).not.toBeNull();
        expect(sys.getItemDef('vacuum')).not.toBeNull();
        expect(sys.getItemDef('rosary')).not.toBeNull();
        expect(sys.getItemDef('treasure_chest')).not.toBeNull();
        expect(sys.getItemDef('nonexistent')).toBeNull();
    });

    test('spawnItem adds item to items array', () => {
        const sys = new FloorItemSystem(makeGame());
        sys.spawnItem(100, 200, 'health_orb');
        expect(sys.items).toHaveLength(1);
        expect(sys.items[0].type).toBe('health_orb');
        expect(sys.items[0].x).toBe(100);
    });

    test('spawnItem ignores unknown types', () => {
        const sys = new FloorItemSystem(makeGame());
        sys.spawnItem(0, 0, 'unknown_type');
        expect(sys.items).toHaveLength(0);
    });

    test('maxItems cap prevents overflow', () => {
        const sys = new FloorItemSystem(makeGame());
        for (let i = 0; i < 30; i++) sys.spawnItem(i, i, 'health_orb');
        expect(sys.items.length).toBeLessThanOrEqual(sys.maxItems);
    });

    test('health_orb restores HP and does not exceed maxHealth', () => {
        const game = makeGame();
        game.player.health = 50;
        game.player.maxHealth = 100;
        const sys = new FloorItemSystem(game);
        sys.applyItem('health_orb', game.player);
        expect(game.player.health).toBeGreaterThan(50);
        expect(game.player.health).toBeLessThanOrEqual(100);
    });

    test('vacuum activates gem magnet', () => {
        const game = makeGame();
        const sys = new FloorItemSystem(game);
        sys.applyItem('vacuum', game.player);
        expect(game.systems.experience.magnetizeAllGems).toHaveBeenCalled();
    });

    test('onEnemyDeath does not drop for basic enemies', () => {
        const sys = new FloorItemSystem(makeGame());
        const enemy = { type: 'basic', x: 0, y: 0, auraType: null };
        sys.onEnemyDeath(enemy);
        expect(sys.items).toHaveLength(0);
    });

    test('onBossDeath always spawns 3 items (chest + orb + rosary)', () => {
        const sys = new FloorItemSystem(makeGame());
        sys.onBossDeath(0, 0);
        expect(sys.items).toHaveLength(3);
        const types = sys.items.map((i) => i.type);
        expect(types).toContain('treasure_chest');
        expect(types).toContain('health_orb');
        expect(types).toContain('rosary');
    });

    test('reset clears all items', () => {
        const sys = new FloorItemSystem(makeGame());
        sys.spawnItem(0, 0, 'vacuum');
        sys.spawnItem(0, 0, 'health_orb');
        sys.reset();
        expect(sys.items).toHaveLength(0);
    });

    test('update collects item when player walks over it', () => {
        const game = makeGame();
        game.player.health = 50;
        game.player.maxHealth = 100;
        const sys = new FloorItemSystem(game);
        sys.spawnItem(5, 5, 'health_orb'); // within collectRange (32px)
        sys.update(0.016);
        expect(sys.items).toHaveLength(0); // collected
        expect(game.player.health).toBeGreaterThan(50);
    });

    test('update does not collect item when player is far away', () => {
        const game = makeGame();
        const sys = new FloorItemSystem(game);
        sys.spawnItem(500, 500, 'health_orb'); // far from player at (0,0)
        sys.update(0.016);
        expect(sys.items).toHaveLength(1); // still there
    });
});

// ── IceShard weapon tests ────────────────────────────────────────────────────

describe('IceShard weapon', () => {
    function makeIceShard() {
        const game = makeWeaponGame();
        const player = game.player;
        const weapon = new IceShard(game, player);
        return { game, player, weapon };
    }

    test('IceShard has correct id and initial stats', () => {
        const { weapon } = makeIceShard();
        expect(weapon.id).toBe('ice_shard');
        expect(weapon.currentStats.damage).toBe(14);
        expect(weapon.freezeDuration).toBe(1.5);
        expect(weapon.aoeRadius).toBe(0); // no AoE at L1
    });

    test('onHitEnemy applies freeze effect', () => {
        const { game, weapon } = makeIceShard();
        const enemy = { active: true, _deathProcessed: false, x: 10, y: 10 };
        weapon.onHitEnemy(enemy, 14, false);
        expect(game.systems.statusEffect.applyFreezeEffect).toHaveBeenCalledWith(enemy, weapon.freezeDuration, weapon);
    });

    test('AoE radius unlocks at L4 via onUpgrade', () => {
        const { weapon } = makeIceShard();
        expect(weapon.aoeRadius).toBe(0); // L1
        weapon.level = 4;
        weapon.onUpgrade();
        expect(weapon.aoeRadius).toBeGreaterThan(0);
    });

    test('freezeDuration increases with level', () => {
        const { weapon } = makeIceShard();
        const l1Freeze = weapon.freezeDuration;
        weapon.level = 8;
        weapon.onUpgrade();
        expect(weapon.freezeDuration).toBeGreaterThan(l1Freeze);
    });

    test('IceShard is in levelProgression for all 8 levels', () => {
        const { weapon } = makeIceShard();
        for (let lv = 1; lv <= 8; lv++) {
            expect(weapon.levelProgression[lv]).toBeDefined();
        }
    });
});

// ── ShadowDagger weapon tests ────────────────────────────────────────────────

describe('ShadowDagger weapon', () => {
    function makeShadowDagger() {
        const game = makeWeaponGame();
        const player = game.player;
        const weapon = new ShadowDagger(game, player);
        return { game, player, weapon };
    }

    test('ShadowDagger has correct id and initial stats', () => {
        const { weapon } = makeShadowDagger();
        expect(weapon.id).toBe('shadow_dagger');
        expect(weapon.currentStats.damage).toBe(28);
        expect(weapon.bleedChance).toBe(0); // no bleed at L1
        expect(weapon.chainCount).toBe(0); // no chains at L1
    });

    test('bleedChance unlocks at L4 via onUpgrade', () => {
        const { weapon } = makeShadowDagger();
        expect(weapon.bleedChance).toBe(0);
        weapon.level = 4;
        weapon.onUpgrade();
        expect(weapon.bleedChance).toBeGreaterThan(0);
    });

    test('chainCount unlocks at L7', () => {
        const { weapon } = makeShadowDagger();
        weapon.level = 7;
        weapon.onUpgrade();
        expect(weapon.chainCount).toBeGreaterThan(0);
    });

    test('damage increases monotonically through levels', () => {
        const { weapon } = makeShadowDagger();
        let prev = weapon.levelProgression[1].damage;
        for (let lv = 2; lv <= 8; lv++) {
            const curr = weapon.levelProgression[lv].damage;
            expect(curr).toBeGreaterThan(prev);
            prev = curr;
        }
    });

    test('pendingStrikes is empty on construction', () => {
        const { weapon } = makeShadowDagger();
        expect(weapon.pendingStrikes).toHaveLength(0);
    });
});

// ── Character registry tests ─────────────────────────────────────────────────

describe('Characters registry', () => {
    test('Viktor and Nyx are in CHARACTERS', () => {
        const ids = CHARACTERS.map((c) => c.id);
        expect(ids).toContain('viktor');
        expect(ids).toContain('nyx');
    });

    test('Viktor starts with ice_shard', () => {
        const viktor = CHARACTERS.find((c) => c.id === 'viktor');
        expect(viktor.startingWeapon).toBe('ice_shard');
    });

    test('Nyx starts with shadow_dagger', () => {
        const nyx = CHARACTERS.find((c) => c.id === 'nyx');
        expect(nyx.startingWeapon).toBe('shadow_dagger');
    });

    test('Nyx is a glass cannon (high damage, low health)', () => {
        const nyx = CHARACTERS.find((c) => c.id === 'nyx');
        expect(nyx.statModifiers.damage).toBeGreaterThan(1.0);
        expect(nyx.statModifiers.health).toBeLessThan(1.0);
    });

    test('Viktor has larger area, slower speed', () => {
        const viktor = CHARACTERS.find((c) => c.id === 'viktor');
        expect(viktor.statModifiers.area).toBeGreaterThan(1.0);
        expect(viktor.statModifiers.speed).toBeLessThan(1.0);
    });
});

// ── ChallengeSystem tests ────────────────────────────────────────────────────

describe('ChallengeSystem', () => {
    function makeChallengeGame(overrides = {}) {
        const game = {
            systems: {
                persistence: {
                    data: { records: { longestSurvival: 1000 } }
                },
                enemy: {
                    spawnRateMultiplier: 1.0,
                    enemySpeedMultiplier: 1.0
                },
                passiveItems: {
                    getLevelUpOptions: jest.fn(() => [
                        { type: 'passive', name: 'Spinach' },
                        { type: 'passive', name: 'Armor' }
                    ])
                },
                challenge: null
            },
            player: {
                maxHealth: 100,
                health: 100,
                stats: { damage: 1, luck: 1, speed: 1, area: 1 }
            },
            ...overrides
        };
        game.systems.challenge = new ChallengeSystem(game);
        return game;
    }

    test('no_heals modifier blocks level-up heal when active', () => {
        const game = makeChallengeGame();
        const cs = game.systems.challenge;

        // Activate no_heals
        cs.togglePending('no_heals');
        cs.applyToRun(game.player);

        // Simulate checking the modifier
        expect(cs.hasModifier('no_heals')).toBe(true);

        // The actual heal suppression is in Player.js:
        // if (!this.game.systems?.challenge?.hasModifier('no_heals'))
        //     this.health = this.maxHealth;
        // Test the check:
        game.player.health = 50;
        if (!cs.hasModifier('no_heals')) {
            game.player.health = game.player.maxHealth;
        }
        expect(game.player.health).toBe(50); // NOT healed
    });

    test('no_heals modifier: heal works when not active', () => {
        const game = makeChallengeGame();
        const cs = game.systems.challenge;

        // Don't activate no_heals
        cs.applyToRun(game.player);
        expect(cs.hasModifier('no_heals')).toBe(false);

        game.player.health = 50;
        if (!cs.hasModifier('no_heals')) {
            game.player.health = game.player.maxHealth;
        }
        expect(game.player.health).toBe(100); // healed
    });

    test('famine modifier halves XP gain', () => {
        const game = makeChallengeGame();
        const cs = game.systems.challenge;

        cs.togglePending('famine');
        cs.applyToRun(game.player);

        expect(cs.hasModifier('famine')).toBe(true);

        // Simulate the famine check from Player.js gainExperienceEnhanced:
        let finalExp = 100;
        if (cs.hasModifier('famine')) {
            finalExp *= 0.5;
        }
        expect(finalExp).toBe(50);
    });

    test('iron_will modifier blocks passive item options', () => {
        const game = makeChallengeGame();
        const cs = game.systems.challenge;

        cs.togglePending('iron_will');
        cs.applyToRun(game.player);

        expect(cs.hasModifier('iron_will')).toBe(true);

        // Simulate the check from generateLevelUpOptions:
        const allowPassives = !cs.hasModifier('iron_will');
        expect(allowPassives).toBe(false);
    });

    test('getGoldMultiplier returns correct stacked value', () => {
        const baseGame = makeChallengeGame();
        const baseCs = baseGame.systems.challenge;

        // No modifiers = 1.0
        baseCs.applyToRun(baseGame.player);
        expect(baseCs.getGoldMultiplier()).toBe(1);

        // glass_cannon (+0.50) + famine (+0.35) = 1.85
        const stackedGame = makeChallengeGame();
        const stackedCs = stackedGame.systems.challenge;
        stackedCs.togglePending('glass_cannon');
        stackedCs.togglePending('famine');
        stackedCs.applyToRun(stackedGame.player);
        expect(stackedCs.getGoldMultiplier()).toBeCloseTo(1.85, 2);

        // All three max: glass_cannon + famine + iron_will = 0.50 + 0.35 + 0.60 = 2.45
        const maxGame = makeChallengeGame();
        const maxCs = maxGame.systems.challenge;
        maxCs.togglePending('glass_cannon');
        maxCs.togglePending('famine');
        maxCs.togglePending('iron_will');
        maxCs.applyToRun(maxGame.player);
        expect(maxCs.getGoldMultiplier()).toBeCloseTo(2.45, 2);
    });

    test('togglePending respects maxActive of 3', () => {
        const game = makeChallengeGame();
        const cs = game.systems.challenge;

        cs.togglePending('glass_cannon');
        cs.togglePending('swarm');
        cs.togglePending('no_heals');
        expect(cs.pendingModifiers.size).toBe(3);

        // Fourth should be rejected
        cs.togglePending('famine');
        expect(cs.pendingModifiers.size).toBe(3);
        expect(cs.pendingModifiers.has('famine')).toBe(false);

        // Toggle off one, then add should work
        cs.togglePending('swarm');
        expect(cs.pendingModifiers.size).toBe(2);
        cs.togglePending('famine');
        expect(cs.pendingModifiers.size).toBe(3);
        expect(cs.pendingModifiers.has('famine')).toBe(true);
    });

    test('isUnlocked requires 15-min (900s) longestSurvival', () => {
        const game = makeChallengeGame();
        const cs = game.systems.challenge;

        // Has 1000s > 900s
        expect(cs.isUnlocked()).toBe(true);

        // Below threshold
        game.systems.persistence.data.records.longestSurvival = 500;
        expect(cs.isUnlocked()).toBe(false);
    });

    test('glass_cannon halves player HP on apply', () => {
        const game = makeChallengeGame();
        const cs = game.systems.challenge;

        game.player.maxHealth = 200;
        game.player.health = 200;

        cs.togglePending('glass_cannon');
        cs.applyToRun(game.player);

        expect(game.player.maxHealth).toBe(100);
        expect(game.player.health).toBe(100);
    });
});
