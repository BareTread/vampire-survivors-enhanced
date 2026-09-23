import { describe, test, expect, jest } from '@jest/globals';
import { EnemySystem } from '../src/systems/EnemySystem.js';
import { Enemy } from '../src/entities/Enemy.js';

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
        streaks: { noDamage: 0, lastDamageTime: 0 }
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


describe('Enemy swarm pacing', () => {
    test('sustained safety raises pressure gradually and taking damage releases it', () => {
        const game = createEnemySystemGame();
        const enemySystem = new EnemySystem(game);

        game.gameTime = 25;
        enemySystem.updateDifficulty(0.016);
        const openingRate = enemySystem.spawnRate;

        game.gameTime = 35;
        enemySystem.updateDifficulty(0.016);
        const risingRate = enemySystem.spawnRate;
        expect(risingRate).toBeGreaterThan(openingRate);
        expect(risingRate / openingRate).toBeLessThan(1.15);

        game.player.streaks.lastDamageTime = game.gameTime;
        enemySystem.updateDifficulty(0.016);
        expect(enemySystem.spawnRate).toBeLessThan(risingRate);
    });

    test('pressure surge timer counts down with dt', () => {
        const game = createEnemySystemGame();
        const enemySystem = new EnemySystem(game);

        enemySystem.pressureSurgeActive = true;
        enemySystem.pressureSurgeTimer = 1.0;

        enemySystem.updatePressureSurge(0.4);

        expect(enemySystem.pressureSurgeTimer).toBeCloseTo(0.6);
        expect(enemySystem.pressureSurgeActive).toBe(true);
    });

    test('spawn throttle slows spawning under load and low fps', () => {
        const game = createEnemySystemGame();
        game.performanceStats.fps = 40;

        const enemySystem = new EnemySystem(game);
        enemySystem.spawnRate = 6;
        enemySystem.maxActiveEnemies = 100;
        enemySystem.activeEnemies = Array.from({ length: 90 }, () => ({ active: true }));
        enemySystem.spawnTimer = 0;
        enemySystem.spawnEnemyWave = jest.fn();

        enemySystem.updateSpawning(0.016);

        expect(enemySystem.spawnEnemyWave).toHaveBeenCalledTimes(1);
        expect(enemySystem.spawnTimer).toBeGreaterThan(1 / 6);
    });

    test('pressure surge forces swarm spawn pattern', () => {
        const game = createEnemySystemGame();
        const enemySystem = new EnemySystem(game);

        enemySystem.waveProgress = 0.1;
        enemySystem.pressureSurgeActive = true;

        expect(enemySystem.chooseSpawnPattern()).toBe('swarm');
    });

    test('spawn waves ramp up to 2 enemies by wave 2', () => {
        const game = createEnemySystemGame();
        game.gameTime = 50;
        const enemySystem = new EnemySystem(game);
        enemySystem.currentWave = 2;
        enemySystem.maxActiveEnemies = 100;
        enemySystem.activeEnemies = [];
        enemySystem.spawnSingleEnemy = jest.fn();

        enemySystem.spawnEnemyWave();

        expect(enemySystem.spawnSingleEnemy).toHaveBeenCalledTimes(2);
    });

    test('first five waves stay normal before rest/rush pacing begins', () => {
        const game = createEnemySystemGame();
        const enemySystem = new EnemySystem(game);

        expect(enemySystem.getWaveType(1)).toBe('normal');
        expect(enemySystem.getWaveType(3)).toBe('normal');
        expect(enemySystem.getWaveType(5)).toBe('normal');
        expect(enemySystem.getWaveType(8)).toBe('rest');
        expect(enemySystem.getWaveType(9)).toBe('rush');
    });

    test('restarting removes prior surge and restores its first-run schedule', () => {
        const game = createEnemySystemGame();
        const enemySystem = new EnemySystem(game);
        enemySystem.pressureSurgeActive = true;
        enemySystem.nextSurgeTime = 270;
        enemySystem.surgeSpawnMultiplier = 1.4;
        enemySystem.performanceTracking.complacencyMultiplier = 1.15;
        enemySystem.currentPattern = 'swarm';

        enemySystem.reset();
        expect(enemySystem.chooseSpawnPattern()).toBe('circle');
        game.gameTime = 149;
        enemySystem.updatePressureSurge(0.016);
        expect(enemySystem.pressureSurgeActive).toBe(false);
        game.gameTime = 150;
        enemySystem.updatePressureSurge(0.016);
        expect(enemySystem.pressureSurgeActive).toBe(true);
    });

    test('rejects an on-player spawn and overlapping fallback candidates', () => {
        const game = createEnemySystemGame();
        const enemySystem = new EnemySystem(game);
        enemySystem.chooseSpawnPattern = () => 'circle';
        enemySystem.spawnPatterns.circle = () => ({ x: 0, y: 0 });
        const random = jest.spyOn(Math, 'random').mockReturnValue(0);
        try {
            enemySystem.spawnSingleEnemy();
            expect(enemySystem.activeEnemies).toHaveLength(1);
            const first = enemySystem.activeEnemies[0];
            expect(Math.hypot(first.x - game.player.x, first.y - game.player.y)).toBeGreaterThanOrEqual(130);

            enemySystem.spawnSingleEnemy();
            expect(enemySystem.activeEnemies).toHaveLength(1);
        } finally {
            random.mockRestore();
        }
    });

    test('summoner skips unsafe minions but creates distinct pooled minions when distant', () => {
        const game = createEnemySystemGame();
        const enemySystem = new EnemySystem(game);
        game.systems.enemy = enemySystem;
        game.systems.particle.createEvolutionEffect = jest.fn();
        game.player.x = 40;
        const summoner = new Enemy(game, 0, 0, 'summoner');

        summoner.summonMinions();
        expect(enemySystem.activeEnemies).toHaveLength(0);

        game.player.x = 500;
        summoner.summonMinions();
        expect(enemySystem.activeEnemies).toHaveLength(2);
        expect(enemySystem.activeEnemies[0].active).toBe(true);
        expect(enemySystem.activeEnemies[0].x).toBe(40);
        expect(enemySystem.activeEnemies[1].x).toBe(-40);
    });
});

describe('Enemy rendering detail', () => {
    test('enemy system drops to low detail earlier in dense fights', () => {
        const game = createEnemySystemGame();
        const enemySystem = new EnemySystem(game);
        const renderSpy = jest.fn();

        enemySystem.activeEnemies = Array.from({ length: 121 }, () => ({ active: true, render: renderSpy }));
        enemySystem.render({});

        expect(renderSpy).toHaveBeenCalledWith({}, 'low');
    });

});
