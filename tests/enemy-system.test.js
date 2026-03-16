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

const createRenderContext = () => {
    const gradient = { addColorStop: jest.fn() };

    return {
        save: jest.fn(),
        restore: jest.fn(),
        beginPath: jest.fn(),
        closePath: jest.fn(),
        fill: jest.fn(),
        stroke: jest.fn(),
        fillRect: jest.fn(),
        strokeRect: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        arc: jest.fn(),
        ellipse: jest.fn(),
        translate: jest.fn(),
        scale: jest.fn(),
        rotate: jest.fn(),
        setLineDash: jest.fn(),
        createRadialGradient: jest.fn(() => gradient),
        fillStyle: '',
        strokeStyle: '',
        shadowColor: '',
        shadowBlur: 0,
        lineWidth: 1,
        globalAlpha: 1
    };
};

describe('Enemy swarm pacing', () => {
    test('performance tracking uses real dt', () => {
        const game = createEnemySystemGame();
        const enemySystem = new EnemySystem(game);

        enemySystem.updatePerformanceTracking(0.5);
        enemySystem.updatePerformanceTracking(0.5);

        expect(enemySystem.performanceTracking.timeSinceLastDamage).toBeCloseTo(1.0);
        expect(enemySystem.performanceTracking.playerHealthAverage).toBeCloseTo(1.0);
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

    test('low detail rendering skips radial gradient work for basic enemies', () => {
        const game = createEnemySystemGame();
        game.systems.dynamicEvents = { goldenSwarmActive: false };
        const enemy = new Enemy(game, 0, 0, 'basic');
        const ctx = createRenderContext();

        enemy.variant = null;
        enemy.currentSpawnTime = 0;
        enemy.render({ ctx }, 'low');

        expect(ctx.createRadialGradient).not.toHaveBeenCalled();
    });

    test('high detail rendering keeps radial gradient work', () => {
        const game = createEnemySystemGame();
        game.systems.dynamicEvents = { goldenSwarmActive: false };
        const enemy = new Enemy(game, 0, 0, 'basic');
        const ctx = createRenderContext();

        enemy.variant = null;
        enemy.currentSpawnTime = 0;
        enemy.render({ ctx }, 'high');

        expect(ctx.createRadialGradient).toHaveBeenCalledTimes(1);
    });
});
