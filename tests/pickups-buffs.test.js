import { jest } from '@jest/globals';
import {
    BUFF_LAYER_CAP,
    KILL_MILESTONES,
    getProfile,
    layerStrength,
    listProfiles
} from '../src/data/powerUps.js';

function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function makeGame() {
    return {
        levelUpActive: false,
        gameState: 'playing',
        timeScale: 1,
        gameTime: 0,
        showLevelUpUI() {
            this.levelUpActive = true;
            this.gameState = 'levelUp';
            this.timeScale = 0;
        },
        inputManager: { on: jest.fn(), off: jest.fn() },
        camera: { flash: jest.fn(), shake: jest.fn(), addTrauma: jest.fn(), kick: jest.fn() },
        audioManager: { playVampireSound: jest.fn(), playCriticalHit: jest.fn(), playLevelUp: jest.fn() },
        systems: {
            particle: {
                createPowerUpEffect: jest.fn(),
                createBurst: jest.fn(),
                create: jest.fn(),
                createKillStreakEffect: jest.fn(),
                createEnhancedDamageNumber: jest.fn(),
                createComboExplosion: jest.fn(),
                createStreakCelebration: jest.fn()
            }
        },
        updateComboDisplay: jest.fn()
    };
}

const TYPES = ['damageBoost', 'speedBoost', 'fireRate', 'magnetBoost', 'invincible'];

function strongest(layers) {
    return layers.reduce((best, layer) => {
        if (!best) return layer;
        if (layer.strength > best.strength) return layer;
        if (layer.strength === best.strength && layer.expiresAt > best.expiresAt) return layer;
        return best;
    }, null);
}

describe('buff layers', () => {
    let Player;

    beforeAll(async () => {
        ({ Player } = await import('../src/entities/Player.js'));
    });

    function spawn() {
        return new Player(makeGame(), 0, 0);
    }

    function assertLayers(player, type) {
        const layers = player.buffLayers[type];
        expect(layers.length).toBeLessThanOrEqual(BUFF_LAYER_CAP);
        for (const layer of layers) {
            expect(layer.expiresAt).toBeGreaterThan(player.combatTime);
            const dominated = layers.some((other) =>
                other !== layer && other.strength >= layer.strength && other.expiresAt >= layer.expiresAt
            );
            expect(dominated).toBe(false);
        }
        const best = strongest(layers);
        const snap = player.powerUps[type];
        expect(snap.active).toBe(layers.length > 0);
        if (!best) {
            expect(snap.timer).toBe(0);
            return;
        }
        expect(snap.timer).toBeCloseTo(best.expiresAt - player.combatTime, 6);
        if (snap.multiplier !== undefined) expect(snap.currentMultiplier).toBeCloseTo(best.strength, 6);
        const longest = Math.max(...layers.map((layer) => layer.expiresAt));
        if (longest - best.expiresAt > 0.05) {
            expect(snap.timer).toBeLessThan(longest - player.combatTime - 0.01);
        }
    }

    test('500 seeded sequences keep strength, expiry, bound, and weak-tail rules', () => {
        const rand = mulberry32(0x5eedb0ff);
        const player = spawn();

        for (let sequence = 0; sequence < 500; sequence++) {
            player.resetRewardState();
            const steps = 6 + Math.floor(rand() * 6);
            for (let step = 0; step < steps; step++) {
                const type = TYPES[Math.floor(rand() * TYPES.length)];
                if (rand() < 0.72) {
                    const before = (player.buffLayers[type] || []).map((layer) => ({ ...layer }));
                    const beforeBest = strongest(before);
                    const duration = 1 + rand() * 18;
                    const intensity = 0.4 + rand() * 2.6;
                    player.activatePowerUp(type, duration, intensity);
                    const afterBest = strongest(player.buffLayers[type]);
                    if (beforeBest && afterBest) {
                        expect(afterBest.strength).toBeGreaterThanOrEqual(beforeBest.strength - 1e-9);
                        expect(player.buffLayers[type].some((layer) =>
                            layer.strength >= beforeBest.strength - 1e-9 && layer.expiresAt >= beforeBest.expiresAt - 1e-9
                        )).toBe(true);
                        if (layerStrength(type, intensity) < beforeBest.strength - 1e-9) {
                            expect(player.buffLayers[type].some((layer) =>
                                Math.abs(layer.strength - beforeBest.strength) < 1e-9 &&
                                Math.abs(layer.expiresAt - beforeBest.expiresAt) < 1e-9
                            )).toBe(true);
                        }
                    }
                } else {
                    player.updatePowerUps(0.2 + rand() * 6);
                }
                for (const id of TYPES) assertLayers(player, id);
            }
        }
        player.destroy();
    });

    test('a weaker longer pickup is a tail and does not extend the strong layer', () => {
        const player = spawn();
        player.activatePowerUp('damageBoost', 5, 2);
        player.activatePowerUp('damageBoost', 12, 1);
        expect(player.getEffectiveStats().damage).toBe(6);
        expect(player.powerUps.damageBoost.timer).toBeCloseTo(5, 5);
        expect(player.buffLayers.damageBoost).toHaveLength(2);

        player.updatePowerUps(5.1);
        expect(player.getEffectiveStats().damage).toBe(3);
        expect(player.powerUps.damageBoost.timer).toBeCloseTo(6.9, 5);

        player.updatePowerUps(7);
        expect(player.getEffectiveStats().damage).toBe(1);
        expect(player.powerUps.damageBoost.active).toBe(false);
        player.destroy();
    });

    test('a full stack drops a fourth weaker layer and keeps the strongest', () => {
        const player = spawn();
        player.activatePowerUp('speedBoost', 4, 2.2);
        player.activatePowerUp('speedBoost', 8, 1.6);
        player.activatePowerUp('speedBoost', 12, 1.1);
        player.activatePowerUp('speedBoost', 20, 0.5);
        expect(player.buffLayers.speedBoost.length).toBeLessThanOrEqual(3);
        expect(strongest(player.buffLayers.speedBoost).strength).toBeCloseTo(layerStrength('speedBoost', 2.2), 5);
        expect(player.buffLayers.speedBoost.some((layer) => layer.strength < layerStrength('speedBoost', 0.6))).toBe(false);
        player.destroy();
    });

    test('fire rate at intensity 1 is 1.3 attacks per second and the streak is not weaker', () => {
        const player = spawn();
        player.activatePowerUp('fireRate', 15, 1);
        const pickup = player.getEffectiveStats().cooldown / player.stats.cooldown;
        expect(pickup).toBeCloseTo(1.3, 5);
        player.deactivatePowerUp('fireRate');
        player.gainExperience = jest.fn();
        player.celebrateKillStreakMilestone(50);
        expect(player.powerUps.fireRate.active).toBe(true);
        expect(player.getEffectiveStats().cooldown / player.stats.cooldown).toBeGreaterThanOrEqual(pickup);
        player.destroy();
    });
});

describe('queued level-up grace', () => {
    let Player;

    beforeAll(async () => {
        ({ Player } = await import('../src/entities/Player.js'));
    });

    test('selection stays synchronous and grace does not flash or shorten i-frames', () => {
        const game = makeGame();
        const player = new Player(game, 0, 0);
        player.gainExperience(Player.xpForLevel(1) + Player.xpForLevel(2));
        expect(player.levelUpProgress).toEqual({ current: 1, total: 2 });
        expect(game.gameState).toBe('levelUp');

        game.levelUpActive = false;
        player.completeLevelUpSelection();
        expect(game.levelUpActive).toBe(true);
        expect(player.levelUpProgress).toEqual({ current: 2, total: 2 });
        expect(player.levelUpGraceTimer).toBe(0);

        player.invulnerabilityTime = 2;
        game.levelUpActive = false;
        player.completeLevelUpSelection();
        expect(player.levelUpGraceTimer).toBeCloseTo(0.4, 5);
        expect(player.invulnerable).toBe(false);
        expect(player.invulnerabilityTime).toBe(2);
        expect(player.levelUpProgress).toEqual({ current: 0, total: 0 });
        expect(game.gameState).toBe('levelUp');

        player.health = 80;
        expect(player.takeDamage(25)).toBe(false);
        expect(player.health).toBe(80);
        expect(player.invulnerable).toBe(false);

        player.update(0.4);
        expect(player.levelUpGraceTimer).toBe(0);
        player.resetRewardState();
        expect(player.levelUpQueue).toEqual([]);
        expect(player.levelUpGraceTimer).toBe(0);
        expect(player.buffLayers.damageBoost).toEqual([]);
        player.destroy();
    });

    test('heal reports only restored HP and refuses a full or no-heal player', () => {
        const game = makeGame();
        const player = new Player(game, 0, 0);
        player.health = 80;
        expect(player.heal(30)).toBe(20);
        expect(player.heal(10)).toBe(0);
        game.systems.challenge = { hasModifier: (id) => id === 'no_heals' };
        player.health = 40;
        expect(player.heal(15)).toBe(0);
        expect(player.health).toBe(40);
        player.destroy();
    });
});

describe('truthful HUD and milestone table', () => {
    let CanvasHUD;
    let KillMilestoneSystem;

    beforeAll(async () => {
        ({ CanvasHUD } = await import('../src/systems/CanvasHUD.js'));
        ({ KillMilestoneSystem } = await import('../src/systems/KillMilestoneSystem.js'));
    });

    function ctxOf() {
        const texts = [];
        const rects = [];
        return {
            texts,
            rects,
            save: jest.fn(),
            restore: jest.fn(),
            beginPath: jest.fn(),
            closePath: jest.fn(),
            moveTo: jest.fn(),
            lineTo: jest.fn(),
            arc: jest.fn(),
            fill: jest.fn(),
            stroke: jest.fn(),
            fillRect: jest.fn(),
            measureText: jest.fn((t) => ({ width: String(t).length * 5 })),
            fillText: jest.fn((t) => { texts.push(String(t)); }),
            strokeText: jest.fn(),
            roundRect: jest.fn((x, y, w, h) => { rects.push({ x, y, w, h }); }),
            fillStyle: '',
            strokeStyle: '',
            font: '',
            textAlign: 'start',
            textBaseline: 'alphabetic',
            globalAlpha: 1,
            lineWidth: 1
        };
    }

    test('magnet pill uses the longest of player, area, and global timers', () => {
        const hud = new CanvasHUD({ systems: { experience: { globalMagnetTimer: 3, areaMagnetTimer: 0 } } });
        expect(hud.version).toBe('20260924-pickups1');
        const idle = {
            magnetBoost: { active: false, timer: 0, multiplier: 3 },
            invincible: { active: false, timer: 0 },
            speedBoost: { active: false, timer: 0 },
            damageBoost: { active: false, timer: 0 },
            fireRate: { active: false, timer: 0 }
        };
        let ctx = ctxOf();
        hud._renderPowerUpPills(ctx, { powerUps: idle }, 800, 40);
        expect(ctx.texts).toContain('3.0s');

        hud.game.systems.experience = { globalMagnetTimer: 0, areaMagnetTimer: 9 };
        ctx = ctxOf();
        hud._renderPowerUpPills(ctx, { powerUps: idle }, 390, 40);
        expect(ctx.texts).toContain('9.0s');
        expect(ctx.texts).not.toContain('4.0s');
        for (const rect of ctx.rects) {
            expect(rect.x).toBeGreaterThanOrEqual(8);
            expect(rect.x + rect.w).toBeLessThanOrEqual(390);
        }
    });

    test('a damage pill shows the strong layer, not the weak tail', async () => {
        const { Player } = await import('../src/entities/Player.js');
        const player = new Player(makeGame(), 0, 0);
        player.activatePowerUp('damageBoost', 5, 2);
        player.activatePowerUp('damageBoost', 12, 1);
        const hud = new CanvasHUD({ systems: { experience: { areaMagnetTimer: 0, globalMagnetTimer: 0 } } });
        const ctx = ctxOf();
        hud._renderPowerUpPills(ctx, player, 1280, 40);
        expect(ctx.texts).toContain('5.0s');
        expect(ctx.texts).not.toContain('12.0s');
        expect(ctx.texts.some((text) => text.includes('×6'))).toBe(true);
        player.destroy();
    });

    test('profiles and the 500-kill reward read the shared table', () => {
        expect(getProfile('critical')).toMatchObject({ id: 'damageBoost', duration: 5, intensity: 1.5, strength: 4.5 });
        expect(layerStrength('damageBoost', 2)).toBe(6);
        expect(layerStrength('fireRate', 1)).toBeCloseTo(1.3, 5);
        const wave = listProfiles('wave', 'milestone');
        expect(wave.find((profile) => profile.id === 'damageBoost')).toMatchObject({ duration: 15, intensity: 2, strength: 6 });
        expect(KILL_MILESTONES.find((milestone) => milestone.threshold === 500).reward).toBe('fireRate');
        const system = new KillMilestoneSystem({ player: null });
        expect(system.milestones.find((milestone) => milestone.threshold === 500).reward).toBe('fireRate');
        const layout = new CanvasHUD({ systems: {} })._fitTopPanels(390);
        expect(layout.charX + layout.charW).toBeLessThanOrEqual(layout.econX);
        expect(layout.econX + layout.econW).toBeLessThanOrEqual(390);
    });
});
