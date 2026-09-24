import { jest } from '@jest/globals';



let VampireSurvivorsGame;
let LevelUpOverlay;
let DynamicEventSystem;

beforeAll(async () => {
    ({ VampireSurvivorsGame } = await import('../src/core/VampireSurvivorsGame.js'));
    ({ LevelUpOverlay } = await import('../src/systems/LevelUpOverlay.js'));
    ({ DynamicEventSystem } = await import('../src/systems/DynamicEventSystem.js'));
});

const makeGame = (overrides = {}) => {
    const game = Object.create(VampireSurvivorsGame.prototype);
    game.gameState = 'playing';
    game.timeScale = 1;
    game.levelUpActive = false;
    game.levelUpOptions = [];
    game._levelUpHoveredIndex = -1;
    game.canvas = { style: {}, width: 1280, height: 720 };
    game.camera = { clearFlash: jest.fn(), follow: jest.fn() };
    game.inputManager = { on: jest.fn(), off: jest.fn() };
    game.audioManager = { playLevelUp: jest.fn(), playPowerUpCollect: jest.fn() };
    game.showToast = jest.fn();
    game.systems = {
        particle: { createEvolutionEffect: jest.fn(), clearScreenEffects: jest.fn(), createPowerUpCollectEffect: jest.fn(), createPowerUpSpawnEffect: jest.fn() },
        challenge: { hasModifier: () => false },
        rarity: null,
        weaponEvolution: null,
        passiveItems: null,
        experience: null,
        ...overrides.systems
    };
    Object.assign(game, overrides.game || {});
    return game;
};

describe('queued level-ups stay paused (glue)', () => {
    test('a queued pick chains synchronously without leaving levelUp', () => {
        const game = makeGame();
        const player = {
            levelUpQueue: [{ level: 3 }],
            completeLevelUpSelection() {
                // Buffs-owned behavior: shift the queue and re-open the UI.
                if (this.levelUpQueue.length > 0) {
                    this.levelUpQueue.shift();
                    game.showLevelUpUI();
                }
            },
            grantLevelUpGrace: jest.fn()
        };
        game.player = player;
        game.generateLevelUpOptions = jest.fn(() => {
            game.levelUpOptions = [{ type: 'stat_upgrade', stat: 'damage', name: 'Damage', description: 'x' }];
        });

        game.showLevelUpUI();
        expect(game.gameState).toBe('levelUp');
        expect(game.timeScale).toBe(0);

        game.hideLevelUpUI();
        // Still paused, next pick already showing — zero playing gap.
        expect(game.gameState).toBe('levelUp');
        expect(game.timeScale).toBe(0);
        expect(game.levelUpActive).toBe(true);
        expect(player.grantLevelUpGrace).not.toHaveBeenCalled();

        // Final pick resumes and grants grace.
        player.levelUpQueue = [];
        game.hideLevelUpUI();
        expect(game.gameState).toBe('playing');
        expect(game.timeScale).toBe(1);
        expect(player.grantLevelUpGrace).toHaveBeenCalledTimes(1);
    });

    test('a hit-stop restore during selection cannot resume simulation', () => {
        const game = makeGame();
        game.gameState = 'levelUp';
        game.timeScale = 0;
        game.player = { updateLevelUpEffects: jest.fn() };
        game.progressionTelemetry = { update: jest.fn() };
        game.systems.canvasHUD = { update: jest.fn() };
        game.systems.particle = { update: jest.fn(), clearScreenEffects: jest.fn() };
        game.systems.inventory = { visible: false };
        game.systems.titleScreen = { update: jest.fn() };
        game.systems.runSummary = { update: jest.fn() };

        // Simulate camera hit-stop restoring timeScale mid-selection.
        game.timeScale = 1;
        game.update(0.016, 0.016);
        expect(game.timeScale).toBe(0);
        expect(game.player.updateLevelUpEffects).toHaveBeenCalled();
    });

    test('a level-up opened mid-update stops the remaining systems that frame', () => {
        const game = makeGame();
        const order = [];
        const mk = (name) => ({ update: jest.fn(() => order.push(name)) });
        for (const key of [
            'terrain', 'enemy', 'projectile', 'experience', 'statusEffect',
            'flowState', 'rewards', 'achievement', 'microChallenge', 'adaptiveMusic',
            'killMilestone', 'screenEffects', 'runTimer', 'gold', 'weaponEvolution',
            'synergy', 'boss', 'dynamicEvents', 'ambientParticles', 'decals', 'floorItems'
        ]) {
            game.systems[key] = mk(key);
        }
        game.systems.experience.update = jest.fn(() => {
            order.push('experience');
            game.gameState = 'levelUp';
        });
        game.systems.enemy.getEnemyCount = () => 0;
        game.systems.projectile.activeProjectiles = [];
        game.systems.canvasHUD = { update: jest.fn() };
        game.systems.particle = { update: jest.fn() };
        game.systems.inventory = { visible: false };
        game.systems.titleScreen = { update: jest.fn() };
        game.systems.runSummary = { update: jest.fn() };
        game.player = { update: jest.fn(), updateLevelUpEffects: jest.fn() };
        game.progressionTelemetry = { update: jest.fn() };
        game.updatePowerUpDrops = jest.fn();

        game.update(0.016, 0.016);

        expect(order).toEqual(['terrain', 'enemy', 'projectile', 'experience']);
        expect(game.updatePowerUpDrops).not.toHaveBeenCalled();
    });
});

describe('level-up overlay progress', () => {
    const makeCtx = () => {
        const texts = [];
        const grad = { addColorStop: jest.fn() };
        return {
            texts,
            canvas: { width: 1280, height: 720 },
            save: jest.fn(), restore: jest.fn(),
            beginPath: jest.fn(), closePath: jest.fn(),
            moveTo: jest.fn(), lineTo: jest.fn(),
            arc: jest.fn(), arcTo: jest.fn(), rect: jest.fn(),
            bezierCurveTo: jest.fn(), quadraticCurveTo: jest.fn(),
            roundRect: jest.fn(), ellipse: jest.fn(),
            fill: jest.fn(), stroke: jest.fn(), fillRect: jest.fn(), strokeRect: jest.fn(),
            createRadialGradient: jest.fn(() => grad),
            createLinearGradient: jest.fn(() => grad),
            measureText: jest.fn((t) => ({ width: String(t).length * 5 })),
            fillText: jest.fn((t) => { texts.push(String(t)); }),
            strokeText: jest.fn(),
            setTransform: jest.fn(),
            fillStyle: '', strokeStyle: '', font: '',
            textAlign: 'start', textBaseline: 'alphabetic',
            globalAlpha: 1, lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
            shadowBlur: 0, shadowColor: ''
        };
    };

    test('shows "Pick N of M" while a queue is pending', () => {
        const game = {
            canvas: { width: 1280, height: 720 },
            levelUpOptions: [{ type: 'stat_upgrade', stat: 'damage', name: 'Damage +15%', description: 'x' }],
            _levelUpHoveredIndex: -1,
            player: { level: 3, levelUpProgress: { current: 1, total: 3 }, weapons: new Map() },
            systems: {}
        };
        const overlay = new LevelUpOverlay(game);
        const ctx = makeCtx();
        overlay.render(ctx);
        expect(ctx.texts.some((t) => t.includes('Pick 1 of 3'))).toBe(true);
    });

    test('no progress text for a single level-up', () => {
        const game = {
            canvas: { width: 1280, height: 720 },
            levelUpOptions: [{ type: 'stat_upgrade', stat: 'damage', name: 'Damage +15%', description: 'x' }],
            _levelUpHoveredIndex: -1,
            player: { level: 2, levelUpProgress: { current: 1, total: 1 }, weapons: new Map() },
            systems: {}
        };
        const overlay = new LevelUpOverlay(game);
        const ctx = makeCtx();
        overlay.render(ctx);
        expect(ctx.texts.some((t) => t.includes('Pick '))).toBe(false);
    });
});

describe('collectPowerUp contract', () => {
    test('health relic is not consumed at full HP', () => {
        const game = makeGame();
        game.player = {
            maxHealth: 100, health: 100,
            heal: jest.fn(() => 0),
            callout: jest.fn()
        };
        const powerUp = { type: 'health', x: 0, y: 0 };
        expect(game.collectPowerUp(powerUp)).toBe(false);
        expect(game.player.callout).not.toHaveBeenCalled();
        expect(game.systems.particle.createPowerUpCollectEffect).not.toHaveBeenCalled();
    });

    test('health relic callout reports only HP actually restored', () => {
        const game = makeGame();
        game.player = {
            maxHealth: 100, health: 90,
            heal: jest.fn(() => 10), // only 10 HP of headroom
            callout: jest.fn()
        };
        const powerUp = { type: 'health', x: 0, y: 0 };
        expect(game.collectPowerUp(powerUp)).toBe(true);
        expect(game.player.heal).toHaveBeenCalledWith(50);
        expect(game.player.callout).toHaveBeenCalledWith('+10 HP', '#FF4455', 2);
    });
});

describe('dynamic event XP conservation', () => {
    const makeEventGame = (experience) => {
        const game = {
            gameState: 'playing',
            gameTime: 300,
            player: { x: 0, y: 0, isAlive: () => true, maxHealth: 100, health: 50 },
            camera: { flash: jest.fn(), shake: jest.fn() },
            audioManager: { playVampireSound: jest.fn() },
            systems: {
                runTimer: { runTime: 300 },
                projectile: { activeProjectiles: [] },
                enemy: { activeEnemies: [] },
                gold: { spawnCoin: jest.fn() },
                experience,
                particle: { create: jest.fn() }
            }
        };
        return game;
    };

    test('chest fallback path awards exactly the promised XP', () => {
        const created = [];
        const experience = {
            createMultipleGems: jest.fn((x, y, count, total) => {
                const base = Math.floor(total / count);
                const rem = total % count;
                for (let i = 0; i < count; i++) created.push(base + (i < rem ? 1 : 0));
            })
        };
        const game = makeEventGame(experience);
        const sys = new DynamicEventSystem(game);
        sys.activeEvent = { type: 'treasure', timer: 10, data: {} };
        sys.activeChest = { x: 0, y: 0, health: 0, maxHealth: 100, pulsePhase: 0, guardians: [] };

        sys._updateTreasure(0.016);

        const xpValue = 200 + Math.floor(300 * 3); // 1100
        expect(experience.createMultipleGems).toHaveBeenCalledWith(0, 0, 12, xpValue);
        expect(created.reduce((a, b) => a + b, 0)).toBe(xpValue);
    });

    test('chest gold shower conserves its rolled total', () => {
        const experience = { createGemExplosion: jest.fn() };
        const game = makeEventGame(experience);
        const sys = new DynamicEventSystem(game);
        sys.activeEvent = { type: 'treasure', timer: 10, data: {} };
        sys.activeChest = { x: 0, y: 0, health: 0, maxHealth: 100, pulsePhase: 0, guardians: [] };

        sys._updateTreasure(0.016);

        const calls = game.systems.gold.spawnCoin.mock.calls;
        expect(calls.length).toBeGreaterThanOrEqual(15);
        expect(calls.length).toBeLessThanOrEqual(25);
        const total = calls.reduce((sum, c) => sum + c[2], 0);
        // Every spawned coin carries its rolled value; nothing is dropped.
        expect(total).toBeGreaterThanOrEqual(15 * 5);
        expect(total).toBeLessThanOrEqual(25 * 10);
    });
});
