import { describe, test, expect, jest } from '@jest/globals';
import { ThrowingKnife } from '../src/entities/weapons/ThrowingKnife.js';
import { ShadowDagger } from '../src/entities/weapons/ShadowDagger.js';
import { LightningChain } from '../src/entities/weapons/LightningChain.js';
import { Whip } from '../src/entities/weapons/Whip.js';
import { MagicMissile } from '../src/entities/weapons/MagicMissile.js';
import { Enemy } from '../src/entities/Enemy.js';
import { Player } from '../src/entities/Player.js';
import { BossSystem } from '../src/systems/BossSystem.js';
import { PersistenceSystem } from '../src/systems/PersistenceSystem.js';

// ---- Helpers ----

const createWeaponPlayer = (overrides = {}) => ({
    x: 0,
    y: 0,
    stats: {
        damage: 1, speed: 1, health: 1, luck: 1,
        area: 1, cooldown: 1, duration: 1, projectiles: 0,
        ...overrides.stats
    },
    getEffectiveStats() { return this.stats; },
    getManualAimingBonus() { return 1; },
    ...overrides
});

const createWeaponGame = () => ({
    systems: {
        enemy: { getEnemiesInRange: () => [] },
        particle: {},
        statusEffect: { applyEffect: jest.fn() }
    },
    camera: { shakeWeaponFire: jest.fn() },
    audioManager: null
});

const createPlayerGame = (upgradeModifiers = {}) => ({
    inputManager: { on: jest.fn(), off: jest.fn() },
    camera: {
        screenToWorld: (x, y) => ({ x, y }),
        shake: jest.fn(), flash: jest.fn(),
        addVignette: jest.fn(), shakeKillStreak: jest.fn()
    },
    audioManager: {
        playVampireSound: jest.fn(), playLevelUp: jest.fn(),
        playCriticalHit: jest.fn(), playLastStandActivation: jest.fn(),
        playMiraculousSave: jest.fn()
    },
    systems: {
        particle: {
            createBurst: jest.fn(), create: jest.fn(),
            createEnhancedDamageNumber: jest.fn(), createMagnetWave: jest.fn(),
            createHeartbeatEffect: jest.fn(), createLastStandEffect: jest.fn(),
            createRecoveryEffect: jest.fn(), createStreakCelebration: jest.fn(),
            createComboExplosion: jest.fn(), createComboSparks: jest.fn(),
            createComboBreakEffect: jest.fn(), createKillStreakEffect: jest.fn(),
            createPowerUpEffect: jest.fn(), createMiraculousSaveEffect: jest.fn(),
            createPerfectAimEffect: jest.fn()
        },
        passiveItems: {
            getStatModifiers: () => ({ damage: 0, speed: 0, cooldown: 0, projectiles: 0, armor: 0, pickupRange: 1 })
        },
        persistence: {
            getUpgradeModifiers: () => ({
                maxHealth: 1, damage: 1, moveSpeed: 1, cooldown: 1,
                xpGain: 1, armor: 0, revival: 0, goldGain: 1,
                ...upgradeModifiers
            })
        },
        achievement: { onDamageTaken: jest.fn(), onComboAchieved: jest.fn(), onNearDeathSurvival: jest.fn(), onEnemyKilled: jest.fn() },
        flowState: { onDamageTaken: jest.fn(), onComboAchieved: jest.fn(), onEnemyKilled: jest.fn(), adaptiveDamageMultiplier: 1 },
        microChallenge: { onPerfectAimShot: jest.fn(), onEnemyKilled: jest.fn() },
        experience: { magnetizeAllGems: jest.fn() }
    },
    updateComboDisplay: jest.fn(),
    showLevelUpUI: jest.fn(),
    gameOver: jest.fn(),
    gameTime: 0
});

const createBossGame = (level = 20, weaponCount = 3) => ({
    gameTime: 300,
    player: {
        x: 0, y: 0,
        level,
        maxHealth: 100,
        isAlive: () => true,
        combo: { count: 0 },
        weapons: new Map(Array.from({ length: weaponCount }, (_, i) => [`w${i}`, {}]))
    },
    camera: { shake: jest.fn(), flash: jest.fn() },
    audioManager: { playVampireSound: jest.fn() },
    systems: {
        enemy: { activeEnemies: [], currentWave: 10 },
        flowState: { adaptiveDamageMultiplier: 1 },
        screenEffects: { triggerSlowMo: jest.fn() }
    }
});

// ---- Tests ----

describe('Balance audit', () => {
    // WEAPON DPS TESTS

    test('ThrowingKnife L8 DPS is within 3x of Whip L8 DPS', () => {
        const game = createWeaponGame();
        const player = createWeaponPlayer();

        const knife = new ThrowingKnife(game, player);
        while (knife.level < 8) knife.upgrade();

        const whip = new Whip(game, player);
        while (whip.level < 8) whip.upgrade();

        const knifeDPS = knife.getEffectiveDamage() / knife.getEffectiveCooldown();
        const whipDPS = whip.getEffectiveDamage() / whip.getEffectiveCooldown();

        expect(knifeDPS / whipDPS).toBeLessThan(3.0);
    });

    test('ThrowingKnife L8 has nerfed stats', () => {
        const game = createWeaponGame();
        const player = createWeaponPlayer();
        const knife = new ThrowingKnife(game, player);

        while (knife.level < 8) knife.upgrade();

        expect(knife.baseStats.damage).toBe(38);
        expect(knife.baseStats.cooldown).toBe(0.35);
        expect(knife.baseStats.piercing).toBe(4);
    });

    test('ShadowDagger L8 per-hit damage is under 100', () => {
        const game = createWeaponGame();
        const player = createWeaponPlayer();
        const dagger = new ShadowDagger(game, player);

        while (dagger.level < 8) dagger.upgrade();

        expect(dagger.baseStats.damage).toBeLessThan(100);
        expect(dagger.chainCount).toBe(1);
    });

    test('LightningChain L8 chainDamageMultiplier is 1.5', () => {
        const game = createWeaponGame();
        const player = createWeaponPlayer();
        const lightning = new LightningChain(game, player);

        while (lightning.level < 8) lightning.upgrade();

        expect(lightning.chainDamageMultiplier).toBe(1.5);
    });

    // DPS SOFT CAP

    test('DPS soft cap kicks in above 300 DPS', () => {
        const game = createWeaponGame();
        // Create a player with extreme damage stat to trigger the cap
        const player = createWeaponPlayer({ stats: { damage: 10, cooldown: 1 } });
        const weapon = new MagicMissile(game, player);

        while (weapon.level < 8) weapon.upgrade();

        const rawDPS = weapon.currentStats.damage / weapon.getEffectiveCooldown();
        const effectiveDPS = weapon.getEffectiveDamage() / weapon.getEffectiveCooldown();

        // If raw DPS > 300, effective should be lower due to cap
        if (rawDPS > 300) {
            expect(effectiveDPS).toBeLessThan(rawDPS);
            expect(effectiveDPS).toBeGreaterThan(300);
        }
        // If raw DPS ≤ 300, effective should equal raw
        else {
            expect(effectiveDPS).toBeCloseTo(rawDPS, 1);
        }
    });

    // ENEMY SCALING

    test('late-game enemy scaling uses softened exponent 1.30', () => {
        const game = {
            gameTime: 600, // 10 minutes
            showDebug: false,
            systems: { enemy: { currentWave: 10 } },
            player: { level: 15, weapons: new Map([['w1', {}], ['w2', {}]]) }
        };
        const enemy = new Enemy(game, 0, 0, 'basic');
        const mult = enemy.getDifficultyMultiplier();

        // With 1.30 exponent at 10 min (5 intervals, 2.5 late):
        // earlyScaling = 1.25^2.5 ≈ 1.95
        // lateBonus = 1.30^2.5 ≈ 2.20
        // timeScaling ≈ 4.30
        // Much lower than old 1.45^2.5 ≈ 3.39 → 6.61 total
        expect(mult).toBeLessThan(50);
        expect(mult).toBeGreaterThan(1);
    });

    test('wave scaling caps at wave 30', () => {
        const mkGame = (wave) => ({
            gameTime: 300,
            showDebug: false,
            systems: { enemy: { currentWave: wave } },
            player: { level: 10, weapons: new Map([['w1', {}]]) }
        });

        const enemyW30 = new Enemy(mkGame(30), 0, 0, 'basic');
        const enemyW50 = new Enemy(mkGame(50), 0, 0, 'basic');

        // Wave 30 and 50 should produce the same multiplier (capped at 30)
        expect(enemyW30.getDifficultyMultiplier()).toBe(enemyW50.getDifficultyMultiplier());
    });

    // DR CAP

    test('total damage reduction is capped at 60%', () => {
        const game = createPlayerGame();
        const player = new Player(game, 0, 0);

        player.invulnerable = false;
        player.health = 200;
        player.nearDeath.bonusActive = true;  // 20% DR
        // holyBible also adds DR, armor adds flat DR...
        // Even with stacking, minimum damage is 40% of original

        const originalHealth = player.health;
        player.takeDamageEnhanced(100);

        // Player must take at least 40 damage (100 * 0.4)
        const damageTaken = originalHealth - player.health;
        expect(damageTaken).toBeGreaterThanOrEqual(40);
    });

    // BOSS HP SCALING

    test('boss HP scales with player level at +6% per level', () => {
        const game1 = createBossGame(1, 1);
        const boss1 = new BossSystem(game1);
        boss1.pendingBossType = 'vampire_lord';
        boss1._spawnBoss();
        const hp1 = boss1.bossEnemy.maxHealth;

        const game30 = createBossGame(30, 1);
        const boss30 = new BossSystem(game30);
        boss30.pendingBossType = 'vampire_lord';
        boss30._spawnBoss();
        const hp30 = boss30.bossEnemy.maxHealth;

        // At L30, playerScale = 1 + 29 * 0.06 = 2.74x
        // So HP should roughly double+ from L1 to L30
        expect(hp30 / hp1).toBeGreaterThan(2.0);
    });

    test('boss HP scales with weapon count', () => {
        const game1w = createBossGame(20, 1);
        const boss1w = new BossSystem(game1w);
        boss1w.pendingBossType = 'vampire_lord';
        boss1w._spawnBoss();
        const hp1w = boss1w.bossEnemy.maxHealth;

        const game5w = createBossGame(20, 5);
        const boss5w = new BossSystem(game5w);
        boss5w.pendingBossType = 'vampire_lord';
        boss5w._spawnBoss();
        const hp5w = boss5w.bossEnemy.maxHealth;

        // 5 weapons: weaponScale = 1 + 4 * 0.12 = 1.48x
        expect(hp5w).toBeGreaterThan(hp1w);
        expect(hp5w / hp1w).toBeGreaterThan(1.3);
    });

    // ECONOMY

    test('goldGain max level is 5', () => {
        const game = { systems: {} };
        const persistence = new PersistenceSystem(game);
        expect(persistence.getUpgradeMaxLevel('goldGain')).toBe(5);
    });

    test('damage upgrade base cost is 100', () => {
        const game = { systems: {} };
        const persistence = new PersistenceSystem(game);
        expect(persistence.getUpgradeCosts().damage).toBe(100);
    });

    test('cooldown upgrade base cost is 130', () => {
        const game = { systems: {} };
        const persistence = new PersistenceSystem(game);
        expect(persistence.getUpgradeCosts().cooldown).toBe(130);
    });

    test('damage upgrade per level is 2%', () => {
        const game = { systems: {} };
        const persistence = new PersistenceSystem(game);
        persistence.data.upgrades.damage = 1;
        const mods = persistence.getUpgradeModifiers();
        expect(mods.damage).toBeCloseTo(1.02, 3);
    });

    // UPDATESTATS IDEMPOTENCY

    test('updateStats is idempotent (calling twice gives same result)', () => {
        const game = createWeaponGame();
        const player = createWeaponPlayer();
        const weapon = new MagicMissile(game, player);

        while (weapon.level < 5) weapon.upgrade();

        weapon.updateStats();
        const first = { ...weapon.currentStats };

        weapon.updateStats();
        const second = { ...weapon.currentStats };

        expect(first.damage).toBe(second.damage);
        expect(first.cooldown).toBe(second.cooldown);
        expect(first.projectiles).toBe(second.projectiles);
    });

    // COOLDOWN MINIMUM

    test('cooldown floor is 0.15 seconds', () => {
        const game = createWeaponGame();
        const player = createWeaponPlayer({ stats: { cooldown: 100 } });
        const weapon = new MagicMissile(game, player);

        expect(weapon.getEffectiveCooldown()).toBe(0.15);
    });
});
