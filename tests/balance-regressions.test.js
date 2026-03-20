import { describe, test, expect, jest } from '@jest/globals';
import { MagicMissile } from '../src/entities/weapons/MagicMissile.js';
import { HolyBible } from '../src/entities/weapons/HolyBible.js';
import { Enemy } from '../src/entities/Enemy.js';
import { Player } from '../src/entities/Player.js';
import { RewardsSystem } from '../src/systems/RewardsSystem.js';
import { BossSystem } from '../src/systems/BossSystem.js';
import { EnemySystem } from '../src/systems/EnemySystem.js';
import { ExperienceSystem } from '../src/systems/ExperienceSystem.js';

const createWeaponPlayer = (overrides = {}) => ({
    x: 0,
    y: 0,
    stats: {
        damage: 1,
        speed: 1,
        health: 1,
        luck: 1,
        area: 1,
        cooldown: 1,
        duration: 1,
        projectiles: 0,
        ...overrides.stats
    },
    getEffectiveStats() {
        return this.stats;
    },
    getManualAimingBonus() {
        return 1;
    },
    ...overrides
});

const createWeaponGame = () => ({
    systems: {
        enemy: { getEnemiesInRange: () => [] },
        particle: {}
    },
    camera: { shakeWeaponFire: jest.fn() },
    audioManager: null
});

const createPlayerGame = (upgradeModifiers = {}) => ({
    inputManager: {
        on: jest.fn(),
        off: jest.fn()
    },
    camera: {
        screenToWorld: (x, y) => ({ x, y }),
        shake: jest.fn(),
        flash: jest.fn(),
        addVignette: jest.fn(),
        shakeKillStreak: jest.fn()
    },
    audioManager: {
        playVampireSound: jest.fn(),
        playLevelUp: jest.fn(),
        playCriticalHit: jest.fn(),
        playLastStandActivation: jest.fn(),
        playMiraculousSave: jest.fn()
    },
    systems: {
        particle: {
            createBurst: jest.fn(),
            create: jest.fn(),
            createEnhancedDamageNumber: jest.fn(),
            createMagnetWave: jest.fn(),
            createHeartbeatEffect: jest.fn(),
            createLastStandEffect: jest.fn(),
            createRecoveryEffect: jest.fn(),
            createStreakCelebration: jest.fn(),
            createComboExplosion: jest.fn(),
            createComboSparks: jest.fn(),
            createComboBreakEffect: jest.fn(),
            createKillStreakEffect: jest.fn(),
            createPowerUpEffect: jest.fn(),
            createMiraculousSaveEffect: jest.fn(),
            createPerfectAimEffect: jest.fn()
        },
        passiveItems: {
            getStatModifiers: () => ({ damage: 0, speed: 0, cooldown: 0, projectiles: 0, armor: 0, pickupRange: 1 })
        },
        persistence: {
            getUpgradeModifiers: () => ({
                maxHealth: 1,
                damage: 1,
                moveSpeed: 1,
                cooldown: 1,
                xpGain: 1,
                armor: 0,
                revival: 0,
                goldGain: 1,
                ...upgradeModifiers
            })
        },
        achievement: {
            onDamageTaken: jest.fn(),
            onComboAchieved: jest.fn(),
            onNearDeathSurvival: jest.fn(),
            onEnemyKilled: jest.fn()
        },
        flowState: {
            onDamageTaken: jest.fn(),
            onComboAchieved: jest.fn(),
            onEnemyKilled: jest.fn(),
            adaptiveDamageMultiplier: 1
        },
        microChallenge: {
            onPerfectAimShot: jest.fn(),
            onEnemyKilled: jest.fn()
        },
        experience: {
            magnetizeAllGems: jest.fn()
        }
    },
    updateComboDisplay: jest.fn(),
    showLevelUpUI: jest.fn(),
    gameOver: jest.fn(),
    gameTime: 0
});

const createEnemyDeathGame = () => ({
    showDebug: false,
    gameTime: 300,
    maxPowerUpDrops: 8,
    powerUpDrops: [],
    spawnPowerUpDrop: jest.fn(),
    score: 0,
    player: {
        combo: { multiplier: 2.5, count: 0 },
        streaks: { criticalHits: 0 },
        addKillToCombo: jest.fn(),
        addKillToStreak: jest.fn(),
        addDamageNumber: jest.fn(),
        activatePowerUp: jest.fn(),
        isAlive: () => true,
        maxHealth: 100
    },
    systems: {
        enemy: { currentWave: 5 },
        flowState: { adaptiveDamageMultiplier: 1, onEnemyKilled: jest.fn() },
        experience: { createGem: jest.fn() },
        dynamicEvents: { goldenSwarmActive: false },
        particle: { createEnhancedDeathEffect: jest.fn(), create: jest.fn() },
        gold: { onEnemyKilled: jest.fn() },
        achievement: { onEnemyKilled: jest.fn() },
        rewards: { onEnemyKilled: jest.fn() },
        microChallenge: { onEnemyKilled: jest.fn() },
        psychologyFeedback: null,
        killMilestone: { onEnemyKilled: jest.fn() }
    },
    camera: { shake: jest.fn() },
    audioManager: null
});

const createBossGame = () => ({
    gameTime: 300,
    player: {
        x: 0,
        y: 0,
        level: 20,
        maxHealth: 100,
        isAlive: () => true,
        combo: { count: 0 }
    },
    camera: {
        shake: jest.fn(),
        flash: jest.fn()
    },
    audioManager: { playVampireSound: jest.fn() },
    systems: {
        enemy: { activeEnemies: [], currentWave: 10 },
        flowState: { adaptiveDamageMultiplier: 1 },
        screenEffects: { triggerSlowMo: jest.fn() }
    }
});

const createEnemySystemGame = () => ({
    gameTime: 0,
    showDebug: false,
    performanceStats: { fps: 60 },
    player: {
        x: 0,
        y: 0,
        health: 100,
        maxHealth: 100,
        combo: { count: 0 },
        isAlive: () => true,
        streaks: { noDamage: 0 }
    },
    camera: {
        shake: jest.fn(),
        flash: jest.fn()
    },
    systems: {
        flowState: {
            adaptiveDamageMultiplier: 1,
            playerPerformance: { stressLevel: 0.5 }
        },
        terrain: {
            worldBounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 },
            isPositionValid: () => true
        },
        particle: {
            createBossSpawnEffect: jest.fn()
        },
        achievement: {
            onWaveCompleted: jest.fn()
        }
    },
    showWaveNotification: jest.fn()
});

describe('Balance regressions', () => {
    test('weapon level progression does not get multiplied by weapon level again', () => {
        const weapon = new MagicMissile(createWeaponGame(), createWeaponPlayer());

        while (weapon.level < 8) {
            weapon.upgrade();
        }

        expect(weapon.baseStats.damage).toBe(33);
        expect(weapon.currentStats.damage).toBe(33);
        expect(weapon.currentStats.projectiles).toBe(3);
    });

    test('weapon cooldowns and projectile counts respect safety caps', () => {
        const player = createWeaponPlayer({
            stats: { cooldown: 20, projectiles: 10 }
        });
        const weapon = new MagicMissile(createWeaponGame(), player);

        expect(weapon.getEffectiveCooldown()).toBe(0.15);
        expect(weapon.currentStats.projectiles).toBe(8);
    });

    test('XP multiplier does not affect weapon damage', () => {
        const game = createWeaponGame();
        game.systems.rewards = {
            rollForCritical: () => false,
            calculateExperienceMultiplier: () => 2.0
        };

        const weapon = new MagicMissile(game, createWeaponPlayer());
        const result = weapon.calculateDamageWithPsychology();

        expect(result.baseDamage).toBe(10);
        expect(result.damage).toBe(10);
    });

    test('desperation bonus affects crit chance instead of unrelated luck stats', () => {
        const game = {
            player: {
                level: 1,
                desperationMode: {
                    active: false,
                    criticalChanceBonus: 0.1
                }
            }
        };
        const rewards = new RewardsSystem(game);
        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.12);

        expect(rewards.rollForCritical()).toBe(false);

        game.player.desperationMode.active = true;

        expect(rewards.rollForCritical()).toBe(true);

        randomSpy.mockRestore();
    });

    test('enemy death drops raw enemy XP once before pickup multipliers', () => {
        const game = createEnemyDeathGame();
        const enemy = new Enemy(game, 0, 0, 'basic');

        enemy.lastDamageAmount = enemy.maxHealth;
        enemy.die();

        expect(game.systems.experience.createGem).toHaveBeenCalledWith(
            expect.any(Number),
            expect.any(Number),
            enemy.expReward
        );
    });

    test('near-death damage reduction reduces damage instead of almost nullifying it', () => {
        const game = createPlayerGame();
        const player = new Player(game, 0, 0);

        player.invulnerable = false;
        player.health = 20;
        player.nearDeath.bonusActive = true;
        player.takeDamageEnhanced(10);

        expect(player.health).toBe(12);
    });

    test('no RNG death save mechanic exists', () => {
        const game = createPlayerGame();
        const player = new Player(game, 0, 0);

        expect(player.triggerLastSecondSave).toBeUndefined();
    });

    test('XP multipliers are additive with 2.5x hard cap', () => {
        const game = createPlayerGame({ xpGain: 2.0 });
        const player = new Player(game, 0, 0);

        player.combo.multiplier = 2.5;
        player.nearDeath.bonusActive = true;
        player.stats.luck = 1.5;
        player.experienceToNext = 1000;
        player.gainExperienceEnhanced(100);

        expect(player.experience).toBe(250);
    });

    test('holy bible grants capped defensive reduction and orbiter cap', () => {
        const game = createPlayerGame();
        const player = new Player(game, 0, 0);
        player.stats.projectiles = 10;

        const holyBible = new HolyBible(game, player);
        while (holyBible.level < 8) {
            holyBible.upgrade();
        }
        player.weapons.set(holyBible.id, holyBible);

        expect(holyBible.getEffectiveOrbiterCount()).toBe(5);

        player.health = 100;
        player.invulnerable = false;
        player.takeDamageEnhanced(10);

        expect(player.health).toBe(94);
    });

    test('boss health scales with player level as well as time', () => {
        const game = createBossGame();
        const bossSystem = new BossSystem(game);
        bossSystem.pendingBossType = 'vampire_lord';

        bossSystem._spawnBoss();

        expect(bossSystem.bossEnemy.maxHealth).toBe(8024);
        expect(game.systems.enemy.activeEnemies).toHaveLength(1);
    });

    test('wave bosses scale beyond a flat 2x elite health buff', () => {
        const game = createEnemySystemGame();
        game.gameTime = 300;
        const enemySystem = new EnemySystem(game);
        enemySystem.currentWave = 10;

        enemySystem.spawnBoss();

        expect(enemySystem.activeEnemies).toHaveLength(1);
        expect(enemySystem.activeEnemies[0].maxHealth).toBeGreaterThan(500);
    });

    test('Attractorb pickup bonus extends magnet range, not reduces it', () => {
        // Attractorb L1: mods.pickupRange = 0.25 (additive bonus).
        // Old bug: pickupBonus = 0.25 → effectiveMagnetRange = 80 * 0.25 = 20 px (reduction!).
        // Fix:     pickupBonus = 1 + 0.25 = 1.25 → effectiveMagnetRange = 80 * 1.25 = 100 px.
        const mockGame = {
            player: { x: 0, y: 0, isAlive: () => true, stats: { luck: 1.0 } },
            systems: {
                passiveItems: {
                    getStatModifiers: () => ({ pickupRange: 0.25 }) // Attractorb L1
                }
            }
        };
        const system = new ExperienceSystem(mockGame);

        // Gem at 85 px — outside normal 80 px magnetRange, inside Attractorb extended 100 px range
        const gem = { active: true, collected: false, x: 85, y: 0, magnetRange: 80, forceMagnetTimer: 0 };
        system.activeGems = [gem];

        system.autoCollectGems();

        // With the fix, the gem should have been force-magnetized (timer > 0).
        // With the old bug (range = 20 px), the gem would not even be found by the query.
        expect(gem.forceMagnetTimer).toBeGreaterThan(0);
    });

    test('Attractorb at max level (L5) gives 2.25x range, not 1.25x', () => {
        // L5: mods.pickupRange = 5 * 0.25 = 1.25 → multiplier should be 1 + 1.25 = 2.25x
        const mockGame = {
            player: { x: 0, y: 0, isAlive: () => true, stats: { luck: 1.0 } },
            systems: {
                passiveItems: {
                    getStatModifiers: () => ({ pickupRange: 1.25 }) // Attractorb L5
                }
            }
        };
        const system = new ExperienceSystem(mockGame);

        // Gem at 170 px — inside 2.25× extended range (80 * 2.25 = 180 px) but outside normal 80 px
        const gem = { active: true, collected: false, x: 170, y: 0, magnetRange: 80, forceMagnetTimer: 0 };
        system.activeGems = [gem];

        system.autoCollectGems();

        expect(gem.forceMagnetTimer).toBeGreaterThan(0);
    });
});
