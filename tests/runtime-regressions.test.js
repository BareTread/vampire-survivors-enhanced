import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { VampireSurvivorsGame } from '../src/core/VampireSurvivorsGame.js';
import { Player } from '../src/entities/Player.js';
import { GoldSystem } from '../src/systems/GoldSystem.js';
import { PersistenceSystem } from '../src/systems/PersistenceSystem.js';
import { RewardsSystem } from '../src/systems/RewardsSystem.js';
import { ProgressionTelemetry } from '../src/debug/ProgressionTelemetry.js';

const createInputManager = () => {
    const listeners = new Map();

    return {
        listeners,
        on(event, callback) {
            if (!listeners.has(event)) listeners.set(event, []);
            listeners.get(event).push(callback);
        },
        off(event, callback) {
            const callbacks = listeners.get(event) || [];
            listeners.set(
                event,
                callbacks.filter((cb) => cb !== callback)
            );
        }
    };
};

const createPlayerGame = (upgradeModifiers = {}) => ({
    inputManager: createInputManager(),
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
            updateStats: jest.fn()
        },
        flowState: {
            onDamageTaken: jest.fn(),
            onComboAchieved: jest.fn()
        },
        microChallenge: {
            onPerfectAimShot: jest.fn()
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

describe('Runtime regression coverage', () => {
    beforeEach(() => {
        localStorage.getItem.mockReset();
        localStorage.setItem.mockReset();
        localStorage.getItem.mockReturnValue(null);
    });

    test('game click handling uses normalized input payload coordinates', () => {
        const mockGame = {
            canvas: { width: 1280, height: 720 },
            levelUpActive: false,
            levelUpOptions: [],
            gameState: 'menu',
            systems: {
                titleScreen: { handleClick: jest.fn() },
                runSummary: { handleClick: jest.fn() }
            }
        };

        VampireSurvivorsGame.prototype.handleClick.call(mockGame, { x: 320, y: 180 });

        expect(mockGame.systems.titleScreen.handleClick).toHaveBeenCalledWith(320, 180);
    });

    test('player destroy unregisters input listeners', () => {
        const game = createPlayerGame();
        const player = new Player(game, 100, 100);

        expect(game.inputManager.listeners.get('mouseMove')).toHaveLength(1);
        expect(game.inputManager.listeners.get('click')).toHaveLength(1);

        player.destroy();

        expect(game.inputManager.listeners.get('mouseMove')).toHaveLength(0);
        expect(game.inputManager.listeners.get('keyDown')).toHaveLength(0);
        expect(game.inputManager.listeners.get('keyUp')).toHaveLength(0);
        expect(game.inputManager.listeners.get('click')).toHaveLength(0);
        expect(game.inputManager.listeners.get('rightClick')).toHaveLength(0);
    });

    test('permanent upgrades affect max health, xp gain, armor, and revival in live player state', () => {
        const game = createPlayerGame({
            maxHealth: 1.2,
            xpGain: 1.5,
            armor: 2,
            revival: 1,
            damage: 1.1,
            moveSpeed: 1.05,
            cooldown: 0.94
        });
        const player = new Player(game, 100, 100);

        player.applyPersistentUpgrades();
        expect(player.maxHealth).toBe(120);
        expect(player.health).toBe(120);
        expect(player.revivesRemaining).toBe(1);

        player.gainExperienceEnhanced(10);
        expect(player.experience).toBe(15);

        player.invulnerable = false;
        player.health = 2;
        player.takeDamageEnhanced(10);

        expect(player.revivesRemaining).toBe(0);
        expect(player.health).toBe(60);
        expect(game.gameOver).not.toHaveBeenCalled();
    });

    test('collecting run gold does not immediately bank it', () => {
        const game = {
            systems: { persistence: { addGold: jest.fn(), getGold: jest.fn(() => 0) } },
            audioManager: null
        };
        const goldSystem = new GoldSystem(game);

        goldSystem.collectCoin({ x: 0, y: 0, value: 7 });

        expect(goldSystem.runGold).toBe(7);
        expect(game.systems.persistence.addGold).not.toHaveBeenCalled();
    });

    test('progression telemetry overlay stays hidden unless debug overlay is on', () => {
        const telemetry = new ProgressionTelemetry({ showDebug: false });
        telemetry.enabled = true;
        telemetry.currentMetrics = {
            gameTime: 90,
            playerLevel: 10,
            playerDPS: 250,
            enemyKillRate: 2.5,
            difficultyMultiplier: 1.8,
            enemySpawnRate: 3.2,
            activeEnemyCount: 18
        };

        const ctx = {
            canvas: { height: 600 },
            fillRect: jest.fn(),
            fillText: jest.fn(),
            fillStyle: '',
            font: ''
        };

        telemetry.render(ctx);

        expect(ctx.fillRect).not.toHaveBeenCalled();
        expect(ctx.fillText).not.toHaveBeenCalled();
    });

    test('run persistence banks gold once and stores max combo record', () => {
        const persistence = new PersistenceSystem({});

        persistence.recordRunEnd({
            goldEarned: 9,
            combo: 14,
            kills: 0,
            survivalTime: 0,
            level: 1,
            weaponsUsed: [],
            damageDealt: 0
        });

        expect(persistence.getGold()).toBe(9);
        expect(persistence.data.records.highestCombo).toBe(14);
    });

    test('jackpot rewards use the real player XP API', () => {
        const game = {
            player: { level: 3 },
            systems: { experience: { addExperienceToPlayer: jest.fn() } },
            showToast: jest.fn(),
            audioManager: { playVampireSound: jest.fn() }
        };
        const rewards = new RewardsSystem(game);
        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

        rewards.rollForJackpot();

        expect(game.systems.experience.addExperienceToPlayer).toHaveBeenCalledWith(35);
        randomSpy.mockRestore();
    });
});
