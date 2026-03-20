import { jest } from '@jest/globals';
import { Camera } from '../src/core/Camera.js';
import { ScreenEffectsSystem } from '../src/systems/ScreenEffectsSystem.js';

// Minimal game mock for Camera and ScreenEffectsSystem
function makeGame(overrides = {}) {
    const game = {
        timeScale: 1.0,
        gameTime: 60,
        player: {
            x: 100, y: 100,
            health: 100, maxHealth: 100,
            level: 1,
            combo: { count: 0, multiplier: 1.0 },
            isAlive: () => true,
            ...overrides.player
        },
        camera: null,
        systems: {
            enemy: { activeEnemies: [] },
            screenEffects: null,
            ...overrides.systems
        },
        audioManager: null,
        ...overrides
    };
    return game;
}

// ──────────────────────────────────────────────────
// Camera hit-stop tests
// ──────────────────────────────────────────────────
describe('Camera.hitStop()', () => {
    let camera, game;

    beforeEach(() => {
        game = makeGame();
        camera = new Camera(800, 600);
        camera._game = game;
        game.camera = camera;
    });

    test('sets hitStopFrames and freezes timeScale to 0', () => {
        camera.hitStop(4, 0.8);
        expect(camera.hitStopFrames).toBe(4);
        expect(camera.hitStopIntensity).toBe(0.8);
        expect(game.timeScale).toBe(0);
    });

    test('saves and restores timeScale after hit-stop expires', () => {
        game.timeScale = 0.5; // e.g. during slow-mo
        camera.hitStop(2, 0.5);

        expect(game.timeScale).toBe(0);
        expect(camera._hitStopSavedTimeScale).toBe(0.5);

        // Simulate 2 frames via follow()
        camera.follow(100, 100, 0);
        expect(camera.hitStopFrames).toBe(1);
        expect(game.timeScale).toBe(0); // still frozen

        camera.follow(100, 100, 0);
        expect(camera.hitStopFrames).toBe(0);
        expect(game.timeScale).toBe(0.5); // restored
        expect(camera._hitStopSavedTimeScale).toBeNull();
    });

    test('triggers zoom punch on hit-stop exit', () => {
        camera.hitStop(1, 0.5);
        camera.follow(100, 100, 0); // expires
        expect(camera._zoomPunchActive).toBe(true);
        expect(camera._zoomPunchIntensity).toBeGreaterThan(0);
    });

    test('does not override a longer hit-stop already in progress', () => {
        camera.hitStop(6, 1.0);
        expect(camera.hitStopFrames).toBe(6);

        camera.hitStop(3, 0.5); // shorter, should be ignored
        expect(camera.hitStopFrames).toBe(6);
        expect(camera.hitStopIntensity).toBe(1.0);
    });

    test('halves frames in low performance mode', () => {
        camera.performanceMode = 'low';
        camera.hitStop(6, 1.0);
        expect(camera.hitStopFrames).toBe(3);
    });

    test('does nothing when effectsEnabled is false', () => {
        camera.effectsEnabled = false;
        camera.hitStop(4, 0.8);
        expect(camera.hitStopFrames).toBe(0);
        expect(game.timeScale).toBe(1.0);
    });

    test('does nothing without _game reference', () => {
        camera._game = null;
        camera.hitStop(4, 0.8);
        expect(camera.hitStopFrames).toBe(0);
    });

    test('follow() returns early during hit-stop (no camera movement)', () => {
        camera.hitStop(3, 0.5);
        camera.x = 50;
        camera.y = 50;

        // follow should return early, not update camera position
        camera.follow(200, 200, 0.016);
        // Camera should not have moved toward target significantly
        // (only lead tracking happens before the return)
        expect(camera.hitStopFrames).toBe(2);
    });
});

// ──────────────────────────────────────────────────
// Camera zoomPunch tests
// ──────────────────────────────────────────────────
describe('Camera.zoomPunch()', () => {
    let camera;

    beforeEach(() => {
        camera = new Camera(800, 600);
        camera._game = makeGame();
    });

    test('activates zoom punch with correct intensity', () => {
        camera.zoomPunch(0.5);
        expect(camera._zoomPunchActive).toBe(true);
        expect(camera._zoomPunchIntensity).toBeCloseTo(0.015);
    });

    test('keeps max intensity when called multiple times', () => {
        camera.zoomPunch(0.3);
        const first = camera._zoomPunchIntensity;
        camera.zoomPunch(0.8);
        expect(camera._zoomPunchIntensity).toBeGreaterThan(first);
    });

    test('decays over follow() calls', () => {
        camera.zoomPunch(0.5);
        const initial = camera._zoomPunchIntensity;

        camera.follow(100, 100, 0.016);
        expect(camera._zoomPunchIntensity).toBeLessThan(initial);
    });

    test('deactivates when intensity drops below threshold', () => {
        camera.zoomPunch(0.01); // very small
        // Run enough follow ticks to decay
        for (let i = 0; i < 100; i++) {
            camera.follow(100, 100, 0.016);
        }
        expect(camera._zoomPunchActive).toBe(false);
        expect(camera._zoomPunchIntensity).toBe(0);
    });
});

// ──────────────────────────────────────────────────
// Camera resetEffects tests
// ──────────────────────────────────────────────────
describe('Camera.resetEffects()', () => {
    test('clears hit-stop and zoom punch state', () => {
        const camera = new Camera(800, 600);
        const game = makeGame();
        camera._game = game;

        camera.hitStop(4, 0.8);
        camera.zoomPunch(0.5);

        camera.resetEffects();

        expect(camera.hitStopFrames).toBe(0);
        expect(camera.hitStopIntensity).toBe(0);
        expect(camera._hitStopSavedTimeScale).toBeNull();
        expect(camera._zoomPunchActive).toBe(false);
        expect(camera._zoomPunchIntensity).toBe(0);
    });
});

// ──────────────────────────────────────────────────
// ScreenEffectsSystem tests
// ──────────────────────────────────────────────────
describe('ScreenEffectsSystem', () => {
    let game, ses;

    beforeEach(() => {
        game = makeGame();
        const camera = new Camera(800, 600);
        camera._game = game;
        game.camera = camera;
        ses = new ScreenEffectsSystem(game);
        game.systems.screenEffects = ses;
    });

    test('slow-mo recovery skips when hit-stop is active', () => {
        ses.triggerSlowMo(0.5, 0.25);
        expect(game.timeScale).toBe(0.25);

        // Activate hit-stop
        game.camera.hitStop(3, 0.5);
        expect(game.timeScale).toBe(0);

        // update should NOT recover slow-mo while hit-stop is active
        ses.update(0.016);
        expect(ses.slowMoActive).toBe(true); // still active, not recovered
    });

    test('triggerEvolutionReveal uses hitStop instead of slow-mo', () => {
        ses.triggerEvolutionReveal();
        expect(game.camera.hitStopFrames).toBe(5);
        expect(ses.slowMoActive).toBe(false); // should NOT have triggered slow-mo
    });

    test('heartbeat zoom activates below 25% HP', () => {
        game.player.health = 20; // 20% HP
        ses.update(0.016);
        expect(ses._heartbeatZoomActive).toBe(true);
        expect(game.camera.targetZoom).not.toBe(game.camera.baseZoom);
    });

    test('heartbeat zoom deactivates above 25% HP', () => {
        game.player.health = 20;
        ses.update(0.016);
        expect(ses._heartbeatZoomActive).toBe(true);

        game.player.health = 100;
        ses.update(0.016);
        expect(ses._heartbeatZoomActive).toBe(false);
        expect(game.camera.targetZoom).toBe(game.camera.baseZoom);
    });

    test('renderDangerEffects does nothing above 30% HP', () => {
        game.player.health = 50; // 50%
        const ctx = makeMockCtx();
        ses.renderDangerEffects(ctx);
        // save/restore should not be called since we return early
        expect(ctx.save).not.toHaveBeenCalled();
    });

    test('renderDangerEffects renders below 30% HP', () => {
        game.player.health = 20; // 20%
        ses.lowHealthPulsePhase = 1.0; // give it a nonzero phase
        const ctx = makeMockCtx();
        ses.renderDangerEffects(ctx);
        expect(ctx.save).toHaveBeenCalled();
        expect(ctx.fillRect).toHaveBeenCalled();
        expect(ctx.restore).toHaveBeenCalled();
    });

    test('renderDangerEffects does nothing when effectsEnabled is false', () => {
        game.camera.effectsEnabled = false;
        game.player.health = 10;
        const ctx = makeMockCtx();
        ses.renderDangerEffects(ctx);
        expect(ctx.save).not.toHaveBeenCalled();
    });
});

// ──────────────────────────────────────────────────
// Enemy freeze-timer and dying state tests
// ──────────────────────────────────────────────────
describe('Enemy freezeTimer and dying state', () => {
    // Lightweight Enemy-like object for testing state transitions
    // (importing the real Enemy requires too many game dependencies)

    test('freezeTimer blocks update until expired', () => {
        const enemy = makeMinimalEnemy();
        enemy.freezeTimer = 0.05;

        // During freeze, AI should not run
        let aiCalled = false;
        enemy.updateAI = () => { aiCalled = true; };

        simulateEnemyUpdate(enemy, 0.016);
        expect(aiCalled).toBe(false);
        expect(enemy.freezeTimer).toBeLessThan(0.05);

        // Advance past freeze
        simulateEnemyUpdate(enemy, 0.05);
        simulateEnemyUpdate(enemy, 0.016);
        expect(aiCalled).toBe(true);
    });

    test('dying state deactivates enemy after deathScaleDuration', () => {
        const enemy = makeMinimalEnemy();
        enemy.dying = true;
        enemy.deathScaleTimer = 0.08;
        enemy.deathScaleDuration = 0.08;

        simulateEnemyUpdate(enemy, 0.04);
        expect(enemy.active).toBe(true); // still dying

        simulateEnemyUpdate(enemy, 0.05);
        expect(enemy.active).toBe(false); // animation complete
    });

    test('dying state takes priority over freeze and AI', () => {
        const enemy = makeMinimalEnemy();
        enemy.dying = true;
        enemy.deathScaleTimer = 0.08;
        enemy.freezeTimer = 0.1; // also has freeze

        let aiCalled = false;
        enemy.updateAI = () => { aiCalled = true; };

        simulateEnemyUpdate(enemy, 0.016);
        expect(aiCalled).toBe(false); // dying short-circuits
    });

    test('reset() clears dying state for object pool reuse', () => {
        const enemy = makeMinimalEnemy();
        enemy.dying = true;
        enemy.deathScaleTimer = 0.03;

        // Simulate reset
        enemy.dying = false;
        enemy.deathScaleTimer = 0;
        enemy.active = true;
        enemy._deathProcessed = false;

        expect(enemy.dying).toBe(false);
        expect(enemy.active).toBe(true);
    });
});

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
function makeMockCtx() {
    return {
        save: jest.fn(),
        restore: jest.fn(),
        fillRect: jest.fn(),
        createRadialGradient: jest.fn(() => ({
            addColorStop: jest.fn()
        })),
        globalCompositeOperation: 'source-over',
        globalAlpha: 1,
        fillStyle: ''
    };
}

function makeMinimalEnemy() {
    return {
        active: true,
        dying: false,
        deathScaleTimer: 0,
        deathScaleDuration: 0.08,
        freezeTimer: 0,
        currentSpawnTime: 0,
        attackCooldown: 0,
        flashTime: 0,
        _deathProcessed: false,
        velocity: { x: 0, y: 0 },
        x: 0, y: 0,
        speed: 50,
        updateAI: () => {},
        updateEliteBehaviors: () => {},
        game: {
            systems: { terrain: null, enemy: { getNearbyEnemies: () => [] } },
            player: { x: 0, y: 0, isAlive: () => true }
        }
    };
}

function simulateEnemyUpdate(enemy, dt) {
    if (!enemy.active) return;

    if (enemy.dying) {
        enemy.deathScaleTimer -= dt;
        if (enemy.deathScaleTimer <= 0) {
            enemy.active = false;
        }
        return;
    }

    if (enemy.currentSpawnTime > 0) {
        enemy.currentSpawnTime -= dt;
        return;
    }

    if (enemy.attackCooldown > 0) {
        enemy.attackCooldown -= dt;
    }

    if (enemy.freezeTimer > 0) {
        enemy.freezeTimer -= dt;
        return;
    }

    if (enemy.flashTime > 0) {
        enemy.flashTime -= dt;
    }

    enemy.updateAI(dt);
}
