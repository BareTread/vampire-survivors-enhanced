import { jest } from '@jest/globals';
import { AudioManager } from '../src/core/AudioManager.js';

describe('AudioManager aggregation and caps', () => {
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

    test('aggregates clustered experience gain into one composite cue', () => {
        const audio = new AudioManager();
        const playSpy = jest.spyOn(audio, 'playWithEffects').mockImplementation(() => {});

        audio.playVampireSound('experienceGain', 0.35, 1.0);
        audio.playVampireSound('experienceGain', 0.45, 1.1);
        audio.playVampireSound('experienceGain', 0.4, 1.2);

        expect(playSpy).not.toHaveBeenCalled();

        jest.advanceTimersByTime(81);

        expect(playSpy).toHaveBeenCalledTimes(1);
        expect(playSpy.mock.calls[0][0]).toBe('experienceCluster');
        expect(playSpy.mock.calls[0][3].type).toBe('collectCluster');
    });

    test('aggregates dense enemy deaths into one bloom cue', () => {
        const audio = new AudioManager();
        const playSpy = jest.spyOn(audio, 'playWithEffects').mockImplementation(() => {});

        audio.playVampireSound('enemyDeath', 0.4, 0.9);
        audio.playVampireSound('enemyDeath', 0.4, 1.0);
        audio.playVampireSound('enemyDeath', 0.5, 1.05);

        expect(playSpy).not.toHaveBeenCalled();

        jest.advanceTimersByTime(111);

        expect(playSpy).toHaveBeenCalledTimes(1);
        expect(playSpy.mock.calls[0][0]).toBe('enemyDeathBloom');
        expect(playSpy.mock.calls[0][3].type).toBe('deathBloom');
    });

    test('enforces family concurrency caps beyond per-key throttling', () => {
        const audio = new AudioManager();
        const playSpy = jest.spyOn(audio, 'playWithEffects').mockImplementation(() => {});
        audio.familyCaps.combat = 1;

        const first = audio.playResolvedSound('magicMissile', 0.4, 1.0, audio.getSoundConfig('magicMissile'), {
            bypassThrottle: true
        });
        const second = audio.playResolvedSound('whipCrack', 0.4, 1.0, audio.getSoundConfig('whipCrack'), {
            bypassThrottle: true
        });

        expect(first).toBe(true);
        expect(second).toBe(false);
        expect(playSpy).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(audio.getSoundConfig('magicMissile').durationMs + 1);

        const third = audio.playResolvedSound('whipCrack', 0.4, 1.0, audio.getSoundConfig('whipCrack'), {
            bypassThrottle: true
        });
        expect(third).toBe(true);
        expect(playSpy).toHaveBeenCalledTimes(2);
    });
});
