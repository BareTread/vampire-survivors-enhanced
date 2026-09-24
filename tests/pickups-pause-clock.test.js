import { Camera } from '../src/core/Camera.js';
import { VampireSurvivorsGame } from '../src/core/VampireSurvivorsGame.js';
import { Player } from '../src/entities/Player.js';
import { ScreenEffectsSystem } from '../src/systems/ScreenEffectsSystem.js';

function createSelection() {
    const game = Object.create(VampireSurvivorsGame.prototype);
    game.gameState = 'levelUp';
    game.timeScale = 0;
    game.levelUpActive = true;
    game.canvas = { style: {} };
    game.camera = new Camera(1280, 720);
    game.camera._game = game;
    game.inputManager = { on() {} };
    game.player = new Player(game, 100, 100);
    game.systems = {
        particle: { clearScreenEffects() {} },
        screenEffects: new ScreenEffectsSystem(game)
    };
    return game;
}

describe('level-up clock and camera hit-stop ownership', () => {
    test('evolution hit-stop cannot strand the clock after the final selection', () => {
        const game = createSelection();
        game.systems.screenEffects.triggerEvolutionReveal();
        expect(game.camera.hitStopFrames).toBeGreaterThan(0);

        game.hideLevelUpUI();
        expect(game.gameState).toBe('playing');
        expect(game.timeScale).toBe(1);
        for (let i = 0; i < 5; i++) game.camera.follow(game.player.x, game.player.y, 1 / 60);
        expect(game.camera.hitStopFrames).toBe(0);
        expect(game.timeScale).toBe(1);
    });

    test('hit-stop expiry during a queued selection does not restart combat', () => {
        const game = createSelection();
        game.systems.screenEffects.triggerEvolutionReveal();
        for (let i = 0; i < 5; i++) game.camera.follow(game.player.x, game.player.y, 0);
        expect(game.gameState).toBe('levelUp');
        expect(game.timeScale).toBe(0);
        game.hideLevelUpUI();
        expect(game.timeScale).toBe(1);
    });

    test('a playing hit-stop restores the slowdown it interrupted', () => {
        const game = createSelection();
        game.gameState = 'playing';
        game.systems.screenEffects.triggerSlowMo(0.5, 0.3);
        game.camera.hitStop(3);
        for (let i = 0; i < 3; i++) game.camera.follow(game.player.x, game.player.y, 0);
        expect(game.timeScale).toBe(0.3);
    });
});
