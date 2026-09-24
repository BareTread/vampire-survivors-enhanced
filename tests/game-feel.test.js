import { describe, test, expect } from '@jest/globals';
import { Camera } from '../src/core/Camera.js';
import { Player } from '../src/entities/Player.js';
import { Enemy } from '../src/entities/Enemy.js';
import { BossSystem } from '../src/systems/BossSystem.js';

const step = (cam, seconds) => {
    for (let t = 0; t < seconds; t += 1 / 60) cam.updateShake(1 / 60);
};

describe('screen shake', () => {
    test('trauma decays to rest and offsets return to zero', () => {
        const cam = new Camera(1280, 720);
        cam.addTrauma(1);
        cam.kick(1, 0, 10);
        step(cam, 1.5);
        expect(cam.trauma).toBe(0);
        expect(Math.abs(cam.shakeEffect.offsetX)).toBeLessThan(0.05);
        expect(Math.abs(cam.shakeEffect.offsetY)).toBeLessThan(0.05);
    });

    test('a stream of small hits stays under its ceiling', () => {
        const cam = new Camera(1280, 720);
        for (let i = 0; i < 40; i++) {
            cam.addTrauma(0.4, 0.5);
            step(cam, 0.25);
        }
        expect(cam.trauma).toBeLessThanOrEqual(0.5);
    });

    test('legacy shake() maps weak calls to near-invisible trauma', () => {
        const cam = new Camera(1280, 720);
        cam.shake(2, 0.1);
        expect(cam.trauma).toBeLessThan(0.05);
        cam.trauma = 0;
        cam.shake(20, 0.8);
        expect(cam.trauma).toBeGreaterThan(0.5);
    });

    test('shake respects the settings toggle', () => {
        const cam = new Camera(1280, 720);
        cam.setScreenShakeEnabled(false);
        cam.shake(30, 1);
        cam.kick(1, 1, 10);
        step(cam, 0.1);
        expect(cam.trauma).toBe(0);
        expect(cam.shakeEffect.offsetX).toBe(0);
    });

    test('shakeAt fades with distance from the view', () => {
        const cam = new Camera(1280, 720);
        cam.shakeAt(0, 0, 0.5);
        const near = cam.trauma;
        cam.trauma = 0;
        cam.shakeAt(300, 0, 0.5);
        expect(cam.trauma).toBeLessThan(near);
        cam.trauma = 0;
        cam.shakeAt(2000, 0, 0.5);
        expect(cam.trauma).toBe(0);
    });
});

describe('run pacing', () => {
    test('XP steps grow steadily, never shrink', () => {
        let prev = 0;
        for (let l = 1; l <= 60; l++) {
            const need = Player.xpForLevel(l);
            expect(need).toBeGreaterThan(prev);
            prev = need;
        }
        // First upgrade arrives quickly; level 10 takes real play
        expect(Player.xpForLevel(1)).toBeLessThan(250);
        let total = 0;
        for (let l = 1; l < 10; l++) total += Player.xpForLevel(l);
        expect(total).toBeGreaterThan(5000);
    });

    test('contact damage no longer scales with player level', () => {
        const mk = (level, weapons, gameTime) => {
            const game = {
                gameTime,
                player: { level, maxHealth: 100, weapons: { size: weapons } },
                systems: { enemy: { currentWave: 5 } }
            };
            const e = Object.create(Enemy.prototype);
            e.game = game;
            return e.contactDamage(11);
        };
        expect(mk(30, 6, 240)).toBe(mk(1, 1, 240));
        // One hit never exceeds the per-hit cap
        const e = Object.create(Enemy.prototype);
        e.game = { gameTime: 120, player: { maxHealth: 100 }, systems: {} };
        expect(e.contactDamage(500)).toBeLessThanOrEqual(e.hitCap());
    });
});

describe('damage numbers', () => {
    test('the same hit reported twice shows one number, crit styling wins', async () => {
        const { DamageNumberPool } = await import('../src/core/DamageNumberPool.js');
        const pool = new DamageNumberPool();
        pool.get(100, 100, 30, '#FFFF00', false);
        pool.get(106, 96, 29, '#FF0000', true);
        expect(pool.activeNumbers.length).toBe(1);
        expect(pool.activeNumbers[0].isCritical).toBe(true);
        // A different enemy nearby still gets its own number
        pool.get(160, 100, 30, '#FFFF00', false);
        expect(pool.activeNumbers.length).toBe(2);
    });
});

describe('boss fights', () => {
    test('phases advance as the boss loses health', () => {
        const bs = Object.create(BossSystem.prototype);
        const def = { phases: [{ threshold: 1 }, { threshold: 0.66 }, { threshold: 0.33 }] };
        const seen = [];
        bs.game = { player: { x: 0, y: 0 } };
        bs.bossEnemy = { health: 100, maxHealth: 100, x: 0, y: 0 };
        bs.activeBoss = { def, phase: 0 };
        bs._onPhaseTransition = (p) => { seen.push(p); bs.activeBoss.phase = p; throw new Error('stop'); };
        for (const hp of [90, 60, 20]) {
            bs.bossEnemy.health = hp;
            try { bs._updateBossAI(0.016); } catch (e) { /* stop after phase check */ }
        }
        expect(seen).toEqual([1, 2]);
    });

    test('no single boss attack takes more than 30% of max HP', () => {
        const bs = Object.create(BossSystem.prototype);
        bs.game = { player: { maxHealth: 100 } };
        expect(bs._bossHit(45)).toBe(30);
        expect(bs._bossHit(10)).toBe(10);
    });
});

describe('knockback', () => {
    test('impulse survives the chase AI and decays; heavy types resist', () => {
        const mk = (type) => {
            const e = Object.create(Enemy.prototype);
            e.type = type;
            e.knockX = 0;
            e.knockY = 0;
            return e;
        };
        const ghoul = mk('basic');
        const golem = mk('juggernaut');
        ghoul.applyKnockback(200, 0);
        golem.applyKnockback(200, 0);
        expect(ghoul.knockX).toBe(200);
        expect(golem.knockX).toBeCloseTo(40);
        // Stacked hits are capped
        for (let i = 0; i < 10; i++) ghoul.applyKnockback(300, 0);
        expect(Math.hypot(ghoul.knockX, ghoul.knockY)).toBeLessThanOrEqual(420);
    });
});

describe('dead special enemies', () => {
    test('a killed wraith or demon finishes dying instead of haunting the player', async () => {
        const { Wraith } = await import('../src/entities/enemies/Wraith.js');
        const { Demon } = await import('../src/entities/enemies/Demon.js');
        for (const Cls of [Wraith, Demon]) {
            const e = Object.create(Cls.prototype);
            e.active = true;
            e.dying = true;
            e.health = 0;
            e.deathScaleTimer = 0.1;
            e.currentSpawnTime = 0;
            e.updatePhaseTimers = () => { throw new Error('AI ran while dying'); };
            e.updateDemonAI = e.updatePhaseTimers;
            e.updateFloatingAnimation = e.updatePhaseTimers;
            e.update(0.05);
            expect(e.active).toBe(true);
            e.update(0.1);
            expect(e.active).toBe(false);
        }
    });
});
