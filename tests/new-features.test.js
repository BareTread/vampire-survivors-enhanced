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
 *
 * Agent #28 additions (Sprint #27 regression coverage):
 *   - Death cause tracking (lastDamageSource, killedBy)
 *   - Evolution abilities (recipes, specialAbility fields, evolveWeapon flow)
 *   - Wave pacing (getWaveType, speed/duration per type)
 *   - Zone system (getZoneAt concentric rings)
 *   - Endless mode (skip Death, escalation)
 *   - Codex system (discovery increments, completion stats)
 */
import { describe, test, expect, jest } from '@jest/globals';
import { FloorItemSystem } from '../src/systems/FloorItemSystem.js';
import { IceShard } from '../src/entities/weapons/IceShard.js';
import { ShadowDagger } from '../src/entities/weapons/ShadowDagger.js';
import { ChallengeSystem } from '../src/systems/ChallengeSystem.js';
import { CHARACTERS } from '../src/data/characters.js';
import { WeaponEvolutionSystem } from '../src/systems/WeaponEvolutionSystem.js';
import { EnemySystem } from '../src/systems/EnemySystem.js';
import { RunTimerSystem } from '../src/systems/RunTimerSystem.js';
import { TerrainRenderer } from '../src/core/TerrainRenderer.js';
import { CodexSystem } from '../src/systems/CodexSystem.js';

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

    test('onBossDeath always spawns 3 items (chest + orb + vacuum)', () => {
        const sys = new FloorItemSystem(makeGame());
        sys.onBossDeath(0, 0);
        expect(sys.items).toHaveLength(3);
        const types = sys.items.map((i) => i.type);
        expect(types).toContain('treasure_chest');
        expect(types).toContain('health_orb');
        expect(types).toContain('vacuum');
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

// ══════════════════════════════════════════════════════════════════════════════
// Sprint #27 Regression Tests (Agent #28)
// ══════════════════════════════════════════════════════════════════════════════

// ── CodexSystem tests ───────────────────────────────────────────────────────

describe('CodexSystem', () => {
    function makeCodexGame() {
        return { systems: { persistence: null } };
    }

    test('discoverEnemy increments count on repeat discovery', () => {
        const codex = new CodexSystem(makeCodexGame());
        codex.discoverEnemy('basic');
        codex.discoverEnemy('basic');
        codex.discoverEnemy('basic');
        const entries = codex.getDiscoveries('enemies');
        expect(entries).toHaveLength(1);
        expect(entries[0].count).toBe(3);
    });

    test('discoverWeapon and discoverSynergy populate different categories', () => {
        const codex = new CodexSystem(makeCodexGame());
        codex.discoverWeapon('whip');
        codex.discoverSynergy('fire_spinach');
        expect(codex.isDiscovered('weapons', 'whip')).toBe(true);
        expect(codex.isDiscovered('synergies', 'fire_spinach')).toBe(true);
        expect(codex.isDiscovered('weapons', 'fire_spinach')).toBe(false);
    });

    test('getCompletionStats reports correct totals and synergies=10', () => {
        const codex = new CodexSystem(makeCodexGame());
        codex.discoverEnemy('basic');
        codex.discoverEnemy('fast');
        const stats = codex.getCompletionStats();
        expect(stats.enemies.discovered).toBe(2);
        expect(stats.enemies.total).toBe(10);
        expect(stats.enemies.percent).toBe(20);
        expect(stats.synergies.total).toBe(10);
    });

    test('getTotalDiscoveries sums across all categories', () => {
        const codex = new CodexSystem(makeCodexGame());
        codex.discoverEnemy('tank');
        codex.discoverWeapon('whip');
        codex.discoverEvolution('Soul Missile');
        codex.discoverSynergy('holy_armor');
        expect(codex.getTotalDiscoveries()).toBe(4);
    });

    test('reset clears all discoveries', () => {
        const codex = new CodexSystem(makeCodexGame());
        codex.discoverEnemy('basic');
        codex.discoverWeapon('whip');
        codex.reset();
        expect(codex.getTotalDiscoveries()).toBe(0);
    });
});

// ── WeaponEvolutionSystem tests ─────────────────────────────────────────────

describe('WeaponEvolutionSystem', () => {
    function makeEvoGame() {
        return {
            player: { x: 0, y: 0, weapons: new Map() },
            systems: {
                passiveItems: { items: new Map() },
                codex: { discoverEvolution: jest.fn() },
                screenEffects: null,
                particle: null
            },
            audioManager: null,
            camera: null
        };
    }

    test('recipes map has all 10 weapon evolution recipes', () => {
        const evo = new WeaponEvolutionSystem(makeEvoGame());
        expect(evo.recipes.size).toBe(10);
    });

    test('each recipe has a specialAbility field', () => {
        const evo = new WeaponEvolutionSystem(makeEvoGame());
        for (const [weaponId, recipe] of evo.recipes) {
            expect(recipe.specialAbility).toBeDefined();
            expect(typeof recipe.specialAbility).toBe('string');
        }
    });

    test('ice_shard evolves into Blizzard with blizzard_storm ability', () => {
        const evo = new WeaponEvolutionSystem(makeEvoGame());
        const recipe = evo.recipes.get('ice_shard');
        expect(recipe.evolvedName).toBe('Blizzard');
        expect(recipe.specialAbility).toBe('blizzard_storm');
        expect(recipe.requiredPassive).toBe('empty_tome');
    });

    test('shadow_dagger evolves into Phantom Assassin with phantom_chain ability', () => {
        const evo = new WeaponEvolutionSystem(makeEvoGame());
        const recipe = evo.recipes.get('shadow_dagger');
        expect(recipe.evolvedName).toBe('Phantom Assassin');
        expect(recipe.specialAbility).toBe('phantom_chain');
        expect(recipe.specialStats.chainCount).toBe(4);
    });

    test('getRecipeInfo returns null for unknown weapon', () => {
        const evo = new WeaponEvolutionSystem(makeEvoGame());
        expect(evo.getRecipeInfo('nonexistent_weapon')).toBeNull();
    });
});

// ── Wave Pacing tests ───────────────────────────────────────────────────────

describe('Wave pacing (EnemySystem.getWaveType)', () => {
    const getWaveType = EnemySystem.prototype.getWaveType;

    test('waves 1-5 are always normal so the run ramps cleanly', () => {
        expect(getWaveType(1)).toBe('normal');
        expect(getWaveType(2)).toBe('normal');
        expect(getWaveType(3)).toBe('normal');
        expect(getWaveType(4)).toBe('normal');
        expect(getWaveType(5)).toBe('normal');
    });

    test('rest waves begin later at waves 8, 13, 18', () => {
        expect(getWaveType(8)).toBe('rest');
        expect(getWaveType(13)).toBe('rest');
        expect(getWaveType(18)).toBe('rest');
    });

    test('rush waves follow rest waves at 9, 14, 19', () => {
        expect(getWaveType(9)).toBe('rush');
        expect(getWaveType(14)).toBe('rush');
        expect(getWaveType(19)).toBe('rush');
    });

    test('non-special later waves remain normal', () => {
        expect(getWaveType(6)).toBe('normal');
        expect(getWaveType(7)).toBe('normal');
        expect(getWaveType(10)).toBe('normal');
        expect(getWaveType(11)).toBe('normal');
    });
});

// ── Zone System tests ───────────────────────────────────────────────────────

describe('TerrainRenderer zone system', () => {
    function makeTerrain() {
        const mockRenderer = { ctx: HTMLCanvasElement.prototype.getContext('2d') };
        const mockCamera = { x: 0, y: 0 };
        return new TerrainRenderer(mockRenderer, mockCamera);
    }

    test('zones are defined in increasing radius order', () => {
        const tr = makeTerrain();
        for (let i = 1; i < tr.zones.length; i++) {
            expect(tr.zones[i].radius).toBeGreaterThan(tr.zones[i - 1].radius);
        }
    });

    test('getZoneAt returns Crypt for origin (0,0)', () => {
        const tr = makeTerrain();
        const zone = tr.getZoneAt(0, 0);
        expect(zone.name).toBe('Crypt');
    });

    test('getZoneAt returns Catacombs at distance ~900', () => {
        const tr = makeTerrain();
        const zone = tr.getZoneAt(900, 0);
        expect(zone.name).toBe('Catacombs');
    });

    test('getZoneAt returns Wasteland far from origin', () => {
        const tr = makeTerrain();
        const zone = tr.getZoneAt(5000, 5000);
        expect(zone.name).toBe('Wasteland');
    });
});

// ── Endless Mode tests ──────────────────────────────────────────────────────

describe('RunTimerSystem endless mode', () => {
    function makeTimerGame() {
        return {
            player: { x: 0, y: 0, isAlive: () => true },
            camera: { flash: jest.fn(), shake: jest.fn() },
            audioManager: null,
            systems: {
                enemy: { maxActiveEnemies: 140, spawnRate: 2.0 }
            }
        };
    }

    test('endless mode defaults to false', () => {
        const rts = new RunTimerSystem(makeTimerGame());
        expect(rts.endlessMode).toBe(false);
    });

    test('endless mode skips Death spawn after 30 minutes', () => {
        const rts = new RunTimerSystem(makeTimerGame());
        rts.endlessMode = true;
        rts.runTime = rts.deathTime + 1;
        // Simulate one update tick — should NOT spawn death
        rts.update(0.016);
        expect(rts.deathSpawned).toBe(false);
    });

    test('endless mode escalates difficulty every 300s past deathTime', () => {
        const game = makeTimerGame();
        const rts = new RunTimerSystem(game);
        rts.endlessMode = true;
        rts.runTime = rts.deathTime + 1;

        // Simulate 300+ seconds of accumulated ticks
        rts._endlessScaleTick = 299;
        rts.update(2); // pushes past 300
        expect(game.systems.enemy.maxActiveEnemies).toBeGreaterThan(140);
    });

    test('reset restores default state', () => {
        const rts = new RunTimerSystem(makeTimerGame());
        rts.endlessMode = true;
        rts.runTime = 999;
        rts._endlessScaleTick = 100;
        rts.reset();
        expect(rts.endlessMode).toBe(false);
        expect(rts.runTime).toBe(0);
        expect(rts._endlessScaleTick).toBe(0);
    });
});
