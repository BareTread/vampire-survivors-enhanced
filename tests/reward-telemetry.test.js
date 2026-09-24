import { jest } from '@jest/globals';

let RewardTelemetry;
let Player;
let ExperienceSystem;
let GoldSystem;
let FloorItemSystem;
let VampireSurvivorsGame;

beforeAll(async () => {
    ({ RewardTelemetry } = await import('../src/debug/RewardTelemetry.js'));
    ({ Player } = await import('../src/entities/Player.js'));
    ({ ExperienceSystem } = await import('../src/systems/ExperienceSystem.js'));
    ({ GoldSystem } = await import('../src/systems/GoldSystem.js'));
    ({ FloorItemSystem } = await import('../src/systems/FloorItemSystem.js'));
    ({ VampireSurvivorsGame } = await import('../src/core/VampireSurvivorsGame.js'));
});

function makeGame() {
    return {
        levelUpActive: false,
        gameState: 'playing',
        timeScale: 1,
        gameTime: 0,
        inputManager: { on: jest.fn(), off: jest.fn() },
        camera: { flash: jest.fn(), shake: jest.fn(), addTrauma: jest.fn(), kick: jest.fn() },
        audioManager: {
            playVampireSound: jest.fn(),
            playPowerUpCollect: jest.fn(),
            playLevelUp: jest.fn()
        },
        systems: {
            particle: {
                createPowerUpEffect: jest.fn(),
                createPowerUpCollectEffect: jest.fn(),
                createPowerUpSpawnEffect: jest.fn(),
                createBurst: jest.fn(),
                create: jest.fn(),
                createEnhancedDamageNumber: jest.fn(),
                createLuckyGemSparkles: jest.fn(),
                createBonusGemEffect: jest.fn()
            }
        },
        updateComboDisplay: jest.fn()
    };
}

// Real Player + real RewardTelemetry on a stub game.
function makePlayerGame() {
    const game = makeGame();
    game.rewardTelemetry = new RewardTelemetry(game);
    const player = new Player(game, 0, 0);
    game.player = player;
    return { game, player, tel: game.rewardTelemetry };
}

// Advance one combat frame exactly like the game loop: the player ticks
// (combatTime + buff sync + telemetry frame), then the experience system's
// magnet timers tick.
function step(game, player, dt) {
    player.updatePowerUps(dt);
    game.systems.experience?.update?.(dt);
}

describe('reward telemetry buff timing', () => {
    test('coverage integrates combat seconds and stops at layer expiry', () => {
        const { game, player, tel } = makePlayerGame();
        tel.setEnabled(true);

        player.activatePowerUp('damageBoost', 2, 1);
        for (let i = 0; i < 6; i++) step(game, player, 0.5); // 3s of combat

        const stats = tel.getStats();
        expect(stats.combatSeconds).toBeCloseTo(3, 6);
        expect(stats.buffs.damageBoost.seconds).toBeCloseTo(2, 6);
        expect(stats.buffs.damageBoost.percent).toBeCloseTo((2 / 3) * 100, 4);
    });

    test('a weaker tail keeps coverage alive after the strong layer ends', () => {
        const { game, player, tel } = makePlayerGame();
        tel.setEnabled(true);

        player.activatePowerUp('speedBoost', 1, 2); // strong, short
        player.activatePowerUp('speedBoost', 3, 0.5); // weaker, longer tail
        for (let i = 0; i < 8; i++) step(game, player, 0.5); // 4s of combat

        const stats = tel.getStats();
        expect(stats.buffs.speedBoost.seconds).toBeCloseTo(3, 6);
    });

    test('damage + fire rate overlap is the exact intersection', () => {
        const { game, player, tel } = makePlayerGame();
        tel.setEnabled(true);

        player.activatePowerUp('damageBoost', 2, 1);
        player.activatePowerUp('fireRate', 3, 1);
        for (let i = 0; i < 8; i++) step(game, player, 0.5); // 4s of combat

        const stats = tel.getStats();
        expect(stats.overlaps['damageBoost+fireRate'].seconds).toBeCloseTo(2, 6);
        expect(stats.buffs.damageBoost.seconds).toBeCloseTo(2, 6);
        expect(stats.buffs.fireRate.seconds).toBeCloseTo(3, 6);
    });

    test('magnet coverage is the union of player layer and system timers', () => {
        const { game, player, tel } = makePlayerGame();
        game.systems.experience = new ExperienceSystem(game);
        tel.setEnabled(true);

        // System-only global magnet: no player magnet layer at all.
        game.systems.experience.activateGlobalMagnet(1.5);
        for (let i = 0; i < 6; i++) step(game, player, 0.5); // 3s of combat

        const stats = tel.getStats();
        expect(stats.buffs.magnetBoost.seconds).toBeCloseTo(1.5, 6);
    });

    test('godmode invulnerability alone is not a buff', () => {
        const { game, player, tel } = makePlayerGame();
        tel.setEnabled(true);

        player.invulnerable = true; // debug godmode flag, not a buff layer
        for (let i = 0; i < 4; i++) step(game, player, 0.5);

        const stats = tel.getStats();
        expect(stats.buffs.invincible.seconds).toBe(0);
        expect(stats.combatSeconds).toBeCloseTo(2, 6);
    });
});

describe('reward telemetry enable/disable/reset', () => {
    test('disabled recorder collects nothing through real hooks', () => {
        const { game, player, tel } = makePlayerGame();
        game.systems.experience = new ExperienceSystem(game);
        game.systems.gold = new GoldSystem(game);
        // never enabled

        player.activatePowerUp('damageBoost', 2, 1);
        for (let i = 0; i < 4; i++) step(game, player, 0.5);
        game.systems.experience.createGem(0, 0, 5).collect();
        game.systems.gold.spawnCoin(0, 0, 5);
        game.systems.gold.update(20); // coin expires

        const stats = tel.getStats();
        expect(stats.enabled).toBe(false);
        expect(stats.combatSeconds).toBe(0);
        expect(stats.buffs.damageBoost.seconds).toBe(0);
        expect(stats.pickups.collected).toEqual({});
        expect(stats.pickups.expired).toEqual({});
        expect(stats.healing).toEqual({ requested: 0, actual: 0, wasted: 0 });
    });

    test('disabling freezes the snapshot; re-enabling opens a fresh window', () => {
        const { game, player, tel } = makePlayerGame();
        tel.setEnabled(true);
        player.activatePowerUp('damageBoost', 10, 1);
        step(game, player, 0.5);

        tel.setEnabled(false);
        const frozen = tel.getStats();
        expect(frozen.enabled).toBe(false);
        expect(frozen.combatSeconds).toBeCloseTo(0.5, 6);

        // Further combat does not move the frozen snapshot.
        for (let i = 0; i < 4; i++) step(game, player, 0.5);
        expect(tel.getStats().combatSeconds).toBeCloseTo(0.5, 6);

        tel.setEnabled(true);
        expect(tel.getStats().combatSeconds).toBe(0);
        expect(tel.getStats().enabled).toBe(true);
    });

    test('run reset honors opt-in and starts fresh stats', () => {
        const { game, player, tel } = makePlayerGame();
        tel.setEnabled(true);
        player.activatePowerUp('damageBoost', 10, 1);
        step(game, player, 0.5);

        tel.onRunReset();
        const stats = tel.getStats();
        expect(stats.combatSeconds).toBe(0);
        expect(stats.buffs.damageBoost.seconds).toBe(0);
        expect(stats.enabled).toBe(true); // opt-in survives the reset
    });

    test('snapshots are plain copies — mutating one cannot corrupt the next', () => {
        const { game, player, tel } = makePlayerGame();
        tel.setEnabled(true);
        step(game, player, 0.5);

        const first = tel.getStats();
        first.pickups.collected.gem = { xp: 999 };
        first.buffs.damageBoost.seconds = 999;

        const second = tel.getStats();
        expect(second.pickups.collected).toEqual({});
        expect(second.buffs.damageBoost.seconds).toBe(0);
        expect(() => JSON.parse(JSON.stringify(second))).not.toThrow();
    });
});

describe('reward telemetry XP conservation', () => {
    function makeXpGame() {
        const game = makeGame();
        game.systems.experience = new ExperienceSystem(game);
        game.player = {
            x: 0,
            y: 0,
            stats: { luck: 1 },
            isAlive: () => true,
            gainExperience: jest.fn()
        };
        game.rewardTelemetry = new RewardTelemetry(game);
        return { game, tel: game.rewardTelemetry };
    }

    test('mid-run enable baselines the floor so lost stays zero', () => {
        const { game, tel } = makeXpGame();
        const exp = game.systems.experience;

        // Drops and collections happen BEFORE opt-in.
        exp.createGem(0, 0, 10);
        exp.createGem(10, 0, 20).collect();

        tel.setEnabled(true);
        const opening = tel.getStats();
        expect(opening.xp.openingFloor).toBe(10);
        expect(opening.xp.dropped).toBe(0);
        expect(opening.xp.lost).toBe(0);

        // New drops and collections inside the window conserve exactly.
        exp.createGem(20, 0, 7);
        exp.createGem(30, 0, 3).collect();

        const stats = tel.getStats();
        expect(stats.xp.dropped).toBe(10);
        expect(stats.xp.awardedBase).toBe(3);
        expect(stats.xp.currentFloor).toBe(17);
        expect(stats.xp.lost).toBe(0);
        expect(stats.pickups.collected.gem.xp).toBe(1);
    });

    test('bonus XP is reported separately from base gem XP', () => {
        const { game, player, tel } = makePlayerGame();
        game.systems.experience = new ExperienceSystem(game);
        tel.setEnabled(true);

        // A non-gem grant (streak/achievement style) is bonus, not base.
        player.gainExperience(50);

        const stats = tel.getStats();
        expect(stats.xp.awardedBase).toBe(0);
        expect(stats.xp.bonus).toBe(50);
        expect(stats.xp.lost).toBe(0);
    });
});

describe('reward telemetry pickup events', () => {
    test('coin expiry counts natural expiry; collection counts once', () => {
        const game = makeGame();
        game.systems.gold = new GoldSystem(game);
        game.player = {
            x: 0,
            y: 0,
            stats: { luck: 1 },
            isAlive: () => true
        };
        game.rewardTelemetry = new RewardTelemetry(game);
        const tel = game.rewardTelemetry;
        tel.setEnabled(true);

        const gold = game.systems.gold;
        gold.spawnCoin(1000, 1000, 5); // far away: will expire
        gold.coins[0].lifetime = 0.01;
        gold.spawnCoin(0, 0, 7); // on top of the player: collected

        gold.update(0.016);
        gold.update(0.016);

        const stats = tel.getStats();
        expect(stats.pickups.expired.coin.gold).toBe(1);
        expect(stats.pickups.collected.coin.gold).toBe(1);
        expect(stats.gold.awardedBase).toBe(7);
        expect(stats.gold.lost).toBe(5); // the expired coin is honestly lost
    });

    test('relic expiry and collection fire through updatePowerUpDrops', () => {
        const { game, player, tel } = makePlayerGame();
        tel.setEnabled(true);

        const host = Object.create(VampireSurvivorsGame.prototype);
        host.player = player;
        host.systems = game.systems;
        host.audioManager = game.audioManager;
        host.rewardTelemetry = tel;
        host.powerUpDrops = [
            { x: 5000, y: 5000, type: 'speedBoost', timer: 9.99, lifetime: 10, collected: false, pulsePhase: 0 },
            { x: 0, y: 0, type: 'damageBoost', timer: 0, lifetime: 10, collected: false, pulsePhase: 0 }
        ];

        VampireSurvivorsGame.prototype.updatePowerUpDrops.call(host, 0.02);

        const stats = tel.getStats();
        expect(stats.pickups.expired.relic.speedBoost).toBe(1);
        expect(stats.pickups.collected.relic.damageBoost).toBe(1);
        expect(host.powerUpDrops).toHaveLength(0);
    });

    test('health relic measures requested vs actual healing once consumed', () => {
        const { game, player, tel } = makePlayerGame();
        tel.setEnabled(true);

        const host = Object.create(VampireSurvivorsGame.prototype);
        host.player = player;
        host.systems = game.systems;
        host.audioManager = game.audioManager;
        host.rewardTelemetry = tel;

        player.maxHealth = 100;
        player.health = 90; // healFraction 0.5 → requested 50, actual 10
        const relic = { x: 0, y: 0, type: 'health' };
        expect(
            VampireSurvivorsGame.prototype.collectPowerUp.call(host, relic)
        ).toBe(true);

        let stats = tel.getStats();
        expect(stats.healing.requested).toBeCloseTo(50, 6);
        expect(stats.healing.actual).toBeCloseTo(10, 6);
        expect(stats.healing.wasted).toBeCloseTo(40, 6);
        expect(stats.pickups.collected.relic.health).toBe(1);

        // Full HP: the relic is rejected, not consumed, and not counted again.
        player.health = 100;
        expect(
            VampireSurvivorsGame.prototype.collectPowerUp.call(host, relic)
        ).toBe(false);
        stats = tel.getStats();
        expect(stats.healing.requested).toBeCloseTo(50, 6);
        expect(stats.pickups.collected.relic.health).toBe(1);
    });

    test('health orb waste is measured once on consumption', () => {
        const { game, player, tel } = makePlayerGame();
        tel.setEnabled(true);
        game.systems.floorItems = new FloorItemSystem(game);

        player.maxHealth = 100;
        player.health = 95; // requested 15–25, actual 5
        game.systems.floorItems.spawnItem(0, 0, 'health_orb');
        game.systems.floorItems.update(0.016);

        const stats = tel.getStats();
        expect(stats.pickups.collected.floorItem.health_orb).toBe(1);
        expect(stats.healing.actual).toBeCloseTo(5, 6);
        expect(stats.healing.requested).toBeGreaterThanOrEqual(15);
        expect(stats.healing.requested).toBeLessThanOrEqual(25);
        expect(stats.healing.wasted).toBeCloseTo(stats.healing.requested - 5, 6);
        expect(game.systems.floorItems.items).toHaveLength(0);
    });

    test('health orb at full HP stays on the floor and is not counted', () => {
        const { game, player, tel } = makePlayerGame();
        tel.setEnabled(true);
        game.systems.floorItems = new FloorItemSystem(game);

        player.health = player.maxHealth;
        game.systems.floorItems.spawnItem(0, 0, 'health_orb');
        game.systems.floorItems.update(0.016);
        game.systems.floorItems.update(0.016);

        const stats = tel.getStats();
        expect(stats.healing.requested).toBe(0);
        expect(stats.pickups.collected.floorItem).toBeUndefined();
        expect(game.systems.floorItems.items).toHaveLength(1);
    });
});
