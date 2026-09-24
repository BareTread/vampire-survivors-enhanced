import { jest } from '@jest/globals';

// Adversarial A+C review. Only behaviors that violate the reward contract.

let FloorItemSystem;
let Wraith;

beforeAll(async () => {
    ({ FloorItemSystem } = await import('../src/systems/FloorItemSystem.js'));
    ({ Wraith } = await import('../src/entities/enemies/Wraith.js'));
});

afterEach(() => {
    jest.restoreAllMocks();
});

function makePlayer() {
    return {
        x: 0,
        y: 0,
        level: 1,
        health: 100,
        maxHealth: 100,
        weapons: new Map(),
        combo: { multiplier: 1, count: 0 },
        streaks: { criticalHits: 0 },
        stats: { damage: 1, luck: 1, speed: 1, area: 1 },
        callout: jest.fn(),
        addKillToCombo: jest.fn(),
        addKillToStreak: jest.fn(),
        addDamageNumber: jest.fn(),
        activatePowerUp: jest.fn(),
        isAlive: () => true,
        takeDamage(amount) {
            this.health = Math.max(0, this.health - amount);
        }
    };
}

function makeGame() {
    const player = makePlayer();
    const game = {
        showDebug: false,
        gameTime: 60,
        score: 0,
        spawnPowerUpDrop: jest.fn(),
        player,
        camera: {
            getWorldBounds: () => ({ left: -640, right: 640, top: -360, bottom: 360 }),
            shake: jest.fn(),
            shakeAt: jest.fn(),
            flash: jest.fn(),
            hitStop: jest.fn()
        },
        audioManager: null,
        systems: {
            enemy: { activeEnemies: [], currentWave: 1 },
            experience: { createGem: jest.fn() },
            particle: null,
            gold: { onEnemyKilled: jest.fn(), spawnCoin: jest.fn(), runGold: 0 },
            achievement: { onEnemyKilled: jest.fn() },
            flowState: { adaptiveDamageMultiplier: 1, onEnemyKilled: jest.fn() },
            microChallenge: { onEnemyKilled: jest.fn() },
            rewards: { onEnemyKilled: jest.fn() },
            killMilestone: { onEnemyKilled: jest.fn() },
            challenge: null,
            passiveItems: null,
            codex: { discoverEnemy: jest.fn() },
            decals: { addSplat: jest.fn() }
        }
    };
    game.systems.floorItems = new FloorItemSystem(game);
    return game;
}

function rosary(game, enemy) {
    game.systems.enemy.activeEnemies.push(enemy);
    const floor = game.systems.floorItems;
    floor.spawnItem(10, 0, 'rosary');
    floor.update(0.016);
}

describe('rosary cause through Wraith overrides', () => {
    test('phased wraith is cleansed with cause, credit, and no player damage', () => {
        const random = jest.spyOn(Math, 'random').mockReturnValue(0.99);
        try {
            const game = makeGame();
            const wraith = new Wraith(game, 40, 0);
            wraith.currentSpawnTime = 0;
            wraith.enterPhaseMode();
            const xp = wraith.expReward;

            rosary(game, wraith);

            expect(wraith.health).toBe(0);
            expect(wraith._deathProcessed).toBe(true);
            expect(wraith.deathCause).toBe('rosary');
            expect(game.player.health).toBe(100);
            expect(game.player.addKillToCombo).toHaveBeenCalled();
            expect(game.systems.experience.createGem).toHaveBeenCalledWith(
                expect.any(Number),
                expect.any(Number),
                xp
            );
            expect(game.systems.gold.onEnemyKilled).toHaveBeenCalledWith(wraith);
        } finally {
            random.mockRestore();
        }
    });

    test('pool reset clears phase immunity so a reused wraith can be cleansed', () => {
        const random = jest.spyOn(Math, 'random').mockReturnValue(0.99);
        try {
            const game = makeGame();
            const wraith = new Wraith(game, 40, 0);
            wraith.currentSpawnTime = 0;
            wraith.enterPhaseMode();
            wraith.active = false;

            wraith.reset(40, 0, 'wraith');

            expect(wraith.deathCause).toBeNull();
            expect(wraith.phaseMode).toBe(false);
            expect(wraith.immuneToDamage).toBe(false);

            rosary(game, wraith);

            expect(wraith.health).toBe(0);
            expect(wraith.deathCause).toBe('rosary');
            expect(wraith._deathProcessed).toBe(true);
            expect(game.systems.experience.createGem).toHaveBeenCalled();
            expect(game.player.health).toBe(100);
        } finally {
            random.mockRestore();
        }
    });
});
