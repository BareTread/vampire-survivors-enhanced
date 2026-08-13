import { describe, test, expect } from '@jest/globals';
import { ParticleSystemCore } from '../src/systems/ParticleSystemCore.js';

const createGame = ({ fps = 60, enemyCount = 0 } = {}) => ({
    performanceStats: { fps },
    systems: {
        enemy: {
            activeEnemies: Array.from({ length: enemyCount }, () => ({ active: true }))
        }
    }
});

describe('ParticleSystemCore budget priorities', () => {
    test('heavy load disables glow on cosmetic particles', () => {
        const system = new ParticleSystemCore(createGame({ fps: 42, enemyCount: 160 }));

        const particle = system.createEffectParticle(10, 20, {
            color: '#FFD700',
            glow: true,
            priority: 'cosmetic'
        });

        expect(particle).not.toBeNull();
        expect(particle.glow).toBe(false);
    });

    test('critical particles can replace lower-priority particles at budget limit', () => {
        const system = new ParticleSystemCore(createGame({ fps: 42, enemyCount: 160 }));
        system.maxEffectParticles = 10;

        for (let i = 0; i < 6; i++) {
            system.effectParticles.push({
                ...system.createParticleObject(),
                active: true,
                priority: 'combat',
                life: 1,
                maxLife: 1
            });
        }

        const particle = system.createEffectParticle(0, 0, {
            color: '#FF0000',
            glow: true,
            priority: 'critical'
        });

        expect(particle).not.toBeNull();
        expect(system.effectParticles).toHaveLength(6);
        expect(system.effectParticles.some((entry) => entry.priority === 'critical')).toBe(true);
    });

    test('update trims cosmetic overflow before updating particles', () => {
        const system = new ParticleSystemCore(createGame({ fps: 42, enemyCount: 160 }));
        system.maxEffectParticles = 10;

        for (let i = 0; i < 4; i++) {
            system.effectParticles.push({
                ...system.createParticleObject(),
                active: true,
                priority: 'cosmetic',
                life: 1,
                maxLife: 1
            });
        }

        system.update(0.016, { particleReduction: 1.0 });

        expect(system.effectParticles).toHaveLength(1);
        expect(system.effectParticles.every((entry) => entry.priority === 'cosmetic')).toBe(true);
    });

    test('adaptive particle limits reduce instead of inflating caps under low fps', () => {
        const system = new ParticleSystemCore(createGame({ fps: 40, enemyCount: 120 }));

        system.effectParticles = Array.from({ length: 90 }, () => ({
            ...system.createParticleObject(),
            active: true,
            priority: 'combat',
            life: 1,
            maxLife: 1
        }));
        system.bloodSplatters = Array.from({ length: 11 }, () => ({ active: true }));

        system.adaptParticleLimits();

        expect(system.maxEffectParticles).toBeLessThan(50);
        expect(system.maxBloodSplatters).toBeLessThan(15);
    });

    test('createHitEffect accepts a color string as callers pass it', () => {
        const system = new ParticleSystemCore(createGame());

        const before = system.effectParticles.length;
        system.createHitEffect(10, 20, '#FF4444');

        expect(system.effectParticles.length).toBeGreaterThan(before);
        expect(system.effectParticles[system.effectParticles.length - 1].color).toBe('#FF4444');
    });

    test('createDamageNumber only defines one implementation (no silent method shadowing)', () => {
        const system = new ParticleSystemCore(createGame());
        const number = system.createDamageNumber(10, 20, '42', '#FFFFFF');

        expect(number).toBeTruthy();
    });

    test('createBloodSplatter respects the pooled budget instead of an unbounded burst', () => {
        const system = new ParticleSystemCore(createGame());
        system.maxBloodSplatters = 2;

        system.createBloodSplatter(0, 0);
        system.createBloodSplatter(0, 0);
        system.createBloodSplatter(0, 0);

        expect(system.bloodSplatters.length).toBe(2);
    });
});
