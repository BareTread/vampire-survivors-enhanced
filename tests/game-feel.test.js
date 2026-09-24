import { describe, test, expect } from '@jest/globals';
import { Camera } from '../src/core/Camera.js';
import { Player } from '../src/entities/Player.js';
import { Enemy } from '../src/entities/Enemy.js';

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
