import { jest } from '@jest/globals';
import { AudioManager } from '../src/core/AudioManager.js';

describe('AudioManager Retro Gothic Synth', () => {
    let warnSpy;

    beforeEach(() => {
        jest.useFakeTimers();
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        warnSpy.mockRestore();
    });

    test('initializes with correct defaults', () => {
        const audio = new AudioManager();
        expect(audio).toBeDefined();
        expect(audio.masterVolume).toBe(0.8);
        expect(audio.soundVolume).toBe(0.5);
        expect(audio.musicVolume).toBe(0.4);
        expect(audio.muted).toBe(false);
        expect(audio.voices).toEqual([]);
        expect(audio.gemNoteIndex).toBe(0);
    });

    test('throttles sound requests using per-sound intervals', () => {
        const audio = new AudioManager();

        let currentTime = 1000;
        jest.spyOn(performance, 'now').mockImplementation(() => currentTime);

        audio.initialized = true;
        audio.audioContext = { state: 'running', resume: () => Promise.resolve() };
        let synthCalled = 0;
        audio._synthUISelect = () => { synthCalled++; };

        const throttle = audio._getThrottle('uiSelect');

        audio.playVampireSound('uiSelect', 1.0, 1.0);
        expect(synthCalled).toBe(1);

        audio.playVampireSound('uiSelect', 1.0, 1.0); // Should be throttled
        expect(synthCalled).toBe(1);

        currentTime += throttle + 10;
        audio.playVampireSound('uiSelect', 1.0, 1.0); // Should play
        expect(synthCalled).toBe(2);
    });

    test('routes different sound names to different synth methods', () => {
        const audio = new AudioManager();
        audio.initialized = true;
        audio.audioContext = { state: 'running', resume: () => Promise.resolve() };

        const called = {};
        audio._synthMagicMissile = () => { called.magic = true; };
        audio._synthWhipCrack = () => { called.whip = true; };
        audio._synthEnemyDeath = () => { called.death = true; };
        audio._synthGemPickup = () => { called.gem = true; };
        audio._synthLevelUp = () => { called.levelUp = true; };

        let t = 1000;
        jest.spyOn(performance, 'now').mockImplementation(() => t);

        audio.playVampireSound('magicMissile'); t += 100;
        audio.playVampireSound('whipCrack'); t += 100;
        audio.playVampireSound('enemyDeath'); t += 100;
        audio.playVampireSound('experienceGain'); t += 100;
        audio.playVampireSound('levelUp'); t += 100;

        expect(called.magic).toBe(true);
        expect(called.whip).toBe(true);
        expect(called.death).toBe(true);
        expect(called.gem).toBe(true);
        expect(called.levelUp).toBe(true);
    });

    test('normalizes aliases before routing', () => {
        const audio = new AudioManager();
        audio.initialized = true;
        audio.audioContext = { state: 'running', resume: () => Promise.resolve() };

        const called = {};
        audio._synthOrbiterWhoosh = () => { called.orbiter = true; };
        audio._synthVictoryFanfare = () => { called.victory = true; };

        let t = 1000;
        jest.spyOn(performance, 'now').mockImplementation(() => t);

        audio.playVampireSound('orbiterHit'); t += 100;
        audio.playVampireSound('weaponEvolution');

        expect(called.orbiter).toBe(true);
        expect(called.victory).toBe(true);
    });

    test('gem melody cycles through pentatonic notes', () => {
        const audio = new AudioManager();
        expect(audio.gemNoteIndex).toBe(0);

        audio.initialized = true;
        audio.audioContext = { state: 'running', resume: () => Promise.resolve() };

        const notes = [];
        audio._synthGemPickup = function (vol) {
            notes.push(this.gemNoteIndex);
            this.gemNoteIndex = (this.gemNoteIndex + 1) % 5;
        };

        let t = 1000;
        jest.spyOn(performance, 'now').mockImplementation(() => t);

        for (let i = 0; i < 7; i++) {
            audio.playVampireSound('experienceGain');
            t += 100;
        }

        // Should cycle: 0,1,2,3,4,0,1
        expect(notes).toEqual([0, 1, 2, 3, 4, 0, 1]);
    });

    test('public API methods exist and are callable', () => {
        const audio = new AudioManager();
        const methods = [
            'playVampireSound', 'playLayeredHitSound', 'playWeaponHitSound',
            'playEnhancedWeaponFire', 'playEnemyDeathSound', 'playEnhancedUISound',
            'playVampireBite', 'playBloodSplash', 'playMagicMissile', 'playWhipCrack',
            'playKnifeThrow', 'playCriticalHit', 'playEnemyDeath', 'playLevelUp',
            'playExperienceGain', 'playWeaponUpgrade', 'playMenuHover', 'playMenuSelect',
            'playGameOver', 'startVampireAmbient', 'stopVampireAmbient',
            'playWeaponEvolution', 'playAchievementUnlock', 'playPowerUpCollect',
            'playLastStandActivation', 'setGameIntensity',
            'setMasterVolume', 'setSoundVolume', 'setMusicVolume',
            'updateVolumes', 'mute', 'unmute', 'toggleMute'
        ];
        for (const m of methods) {
            expect(typeof audio[m]).toBe('function');
        }
    });

    test('setGameIntensity clamps to 0-1', () => {
        const audio = new AudioManager();
        audio.setGameIntensity(-0.5);
        expect(audio.gameIntensity).toBe(0);
        audio.setGameIntensity(1.5);
        expect(audio.gameIntensity).toBe(1);
        audio.setGameIntensity(0.7);
        expect(audio.gameIntensity).toBe(0.7);
    });

    test('exposes scale and PRIORITY for AdaptiveMusicSystem', () => {
        const audio = new AudioManager();
        expect(audio.scale).toBeDefined();
        expect(audio.scale.length).toBe(20);
        expect(audio.PRIORITY).toBeDefined();
        expect(audio.PRIORITY.milestone).toBe(5);
    });
});
