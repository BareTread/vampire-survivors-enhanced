import { describe, test, expect, jest } from '@jest/globals';
import { ProjectileSystem } from '../src/systems/ProjectileSystem.js';
import { ExperienceSystem } from '../src/systems/ExperienceSystem.js';

const createMockGame = () => ({
    gameTime: 0,
    camera: {
        getWorldBounds: () => ({ left: -1000, right: 1000, top: -1000, bottom: 1000 }),
        x: 0,
        y: 0,
        width: 800,
        height: 600
    },
    systems: {
        projectile: null,
        experience: null,
        particle: {
            createLuckyGemSparkles: jest.fn(),
            createBonusGemEffect: jest.fn(),
            createGemExplosionEffect: jest.fn(),
            createBurst: jest.fn(),
            createEnhancedDamageNumber: jest.fn(),
            create: jest.fn()
        },
        enemy: {
            getActiveEnemies: () => [],
            getEnemiesInRange: () => []
        },
        passiveItems: {
            getStatModifiers: () => ({ pickupRange: 1 })
        }
    },
    player: {
        x: 0,
        y: 0,
        stats: { luck: 1 },
        isAlive: () => true,
        gainExperience: jest.fn()
    },
    projectileDebugger: {
        trackProjectileCreation: jest.fn(),
        trackProjectileDestruction: jest.fn()
    },
    audioManager: null
});

describe('Pooling regression coverage', () => {
    test('destroyed projectiles are removed from the active list on update and returned once to the pool', () => {
        const game = createMockGame();
        const projectileSystem = new ProjectileSystem(game);
        game.systems.projectile = projectileSystem;

        const projectile = projectileSystem.createProjectile(0, 0, { damage: 10 });
        const initialPoolSize = projectileSystem.projectilePool.length;

        projectile.destroy('manualTest');
        projectileSystem.update(0.016);

        expect(projectileSystem.activeProjectiles).not.toContain(projectile);
        expect(projectileSystem.projectilePool).toContain(projectile);
        expect(projectileSystem.projectilePool.length).toBe(initialPoolSize + 1);
    });

    test('destroyed experience gems are removed from the active list on update and returned once to the pool', () => {
        const game = createMockGame();
        const experienceSystem = new ExperienceSystem(game);
        game.systems.experience = experienceSystem;

        const gem = experienceSystem.createGem(10, 10, 5);
        const initialPoolSize = experienceSystem.gemPool.length;

        gem.destroy();
        experienceSystem.updateGems(0.016);

        expect(experienceSystem.activeGems).not.toContain(gem);
        expect(experienceSystem.gemPool).toContain(gem);
        expect(experienceSystem.gemPool.length).toBe(initialPoolSize + 1);
    });
});
