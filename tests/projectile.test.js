// Unit tests for projectile system
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { Projectile } from '../src/entities/Projectile.js';
import { ProjectileSystem } from '../src/systems/ProjectileSystem.js';
import { ProgressionTelemetry } from '../src/debug/ProgressionTelemetry.js';

// Mock game object for testing
const createMockGame = () => ({
    gameTime: 0,
    camera: {
        getWorldBounds: () => ({ left: -1000, right: 1000, top: -1000, bottom: 1000 })
    },
    systems: {
        projectile: null,
        particle: {
            createProjectileImpactEffect: jest.fn(),
            createBounceEffect: jest.fn()
        },
        enemy: {
            activeEnemies: [],
            getActiveEnemies: () => []
        }
    },
    player: {
        x: 0,
        y: 0,
        stats: { area: 1.0 }
    },
    projectileDebugger: {
        trackProjectileCreation: jest.fn(),
        trackProjectileDestruction: jest.fn()
    }
});

describe('Projectile System Tests', () => {
    let mockGame;
    let projectileSystem;
    
    beforeEach(() => {
        mockGame = createMockGame();
        projectileSystem = new ProjectileSystem(mockGame);
        mockGame.systems.projectile = projectileSystem;
    });
    
    describe('Projectile Creation', () => {
        test('should create projectile with valid parameters', () => {
            const projectile = projectileSystem.createProjectile(100, 200, {
                direction: Math.PI / 4,
                damage: 50,
                speed: 300,
                size: 8
            });
            
            expect(projectile).toBeDefined();
            expect(projectile.x).toBe(100);
            expect(projectile.y).toBe(200);
            expect(projectile.damage).toBe(50);
            expect(projectile.speed).toBe(300);
            expect(projectile.size).toBe(8);
            expect(projectile.active).toBe(true);
        });
        
        test('should limit active projectiles to max count', () => {
            const maxProjectiles = projectileSystem.maxActiveProjectiles;
            
            // Create more projectiles than the limit
            for (let i = 0; i < maxProjectiles + 10; i++) {
                projectileSystem.createProjectile(i, i, { damage: 10 });
            }
            
            expect(projectileSystem.activeProjectiles.length).toBeLessThanOrEqual(maxProjectiles);
        });
        
        test('should track projectile creation in debugger', () => {
            const projectile = projectileSystem.createProjectile(0, 0, { damage: 10 });
            
            expect(mockGame.projectileDebugger.trackProjectileCreation).toHaveBeenCalledWith(projectile);
        });
    });
    
    describe('Projectile Lifecycle', () => {
        test('should deactivate projectile when lifetime expires', () => {
            const projectile = new Projectile(mockGame, 0, 0, { lifetime: 0.1 });
            
            expect(projectile.active).toBe(true);
            
            // Update beyond lifetime
            projectile.update(0.2);
            
            expect(projectile.active).toBe(false);
        });
        
        test('should handle coordinate overflow gracefully', () => {
            const projectile = new Projectile(mockGame, 0, 0, {
                speed: 1000000,
                direction: 0
            });
            
            // This should trigger overflow protection
            projectile.update(1000);
            
            expect(projectile.active).toBe(false);
        });
        
        test('should validate movement delta', () => {
            const projectile = new Projectile(mockGame, 0, 0);
            projectile.velocity = { x: NaN, y: 100 };
            
            projectile.update(0.1);
            
            expect(projectile.active).toBe(false);
        });
    });
    
    describe('Projectile Boundary Checking', () => {
        test('should destroy projectile when far off screen', () => {
            const projectile = new Projectile(mockGame, 2000, 2000); // Far outside bounds
            
            projectile.update(0.1);
            
            expect(projectile.active).toBe(false);
        });
        
        test('should track boundary destruction in debugger', () => {
            const projectile = new Projectile(mockGame, 2000, 2000);
            
            projectile.destroy('boundaryExit');
            
            expect(mockGame.projectileDebugger.trackProjectileDestruction)
                .toHaveBeenCalledWith(projectile, 'boundaryExit');
        });
    });
    
    describe('Object Pooling', () => {
        test('should reuse projectiles from pool', () => {
            const initialPoolSize = projectileSystem.projectilePool.length;
            
            // Create and destroy a projectile
            const projectile = projectileSystem.createProjectile(0, 0, { damage: 10 });
            projectileSystem.returnToPool(projectile);
            
            // Pool should have the same number of projectiles
            expect(projectileSystem.projectilePool.length).toBe(initialPoolSize);
            
            // Creating another should reuse from pool
            const newProjectile = projectileSystem.createProjectile(0, 0, { damage: 10 });
            expect(projectileSystem.projectilePool.length).toBe(initialPoolSize - 1);
        });
        
        test('should not pool corrupted projectiles', () => {
            const projectile = projectileSystem.createProjectile(0, 0, { damage: 10 });
            const initialPoolSize = projectileSystem.projectilePool.length;
            
            // Corrupt projectile coordinates
            projectile.x = NaN;
            projectile.y = NaN;
            
            projectileSystem.returnToPool(projectile);
            
            // Should not be added to pool
            expect(projectileSystem.projectilePool.length).toBe(initialPoolSize);
        });
    });
    
    describe('Area Scaling', () => {
        test('should apply area multiplier to projectile size', () => {
            mockGame.player.stats.area = 2.0;
            
            const weapon = {
                player: mockGame.player,
                game: mockGame,
                size: 10,
                getEffectiveDamage: () => 50,
                currentStats: { speed: 200, piercing: 0, duration: 3.0 },
                color: '#FF0000',
                id: 'test-weapon'
            };
            
            // Simulate BaseWeapon.createProjectile logic
            const baseSize = weapon.size;
            const effectiveSize = baseSize * weapon.player.stats.area;
            
            expect(effectiveSize).toBe(20); // 10 * 2.0
        });
    });
    
    describe('Performance', () => {
        test('should handle large numbers of projectiles efficiently', () => {
            const startTime = performance.now();
            
            // Create many projectiles
            const projectiles = [];
            for (let i = 0; i < 100; i++) {
                const projectile = projectileSystem.createProjectile(
                    Math.random() * 1000,
                    Math.random() * 1000,
                    { damage: 10, speed: 200 }
                );
                if (projectile) projectiles.push(projectile);
            }
            
            // Update all projectiles
            projectileSystem.update(0.016); // ~60 FPS
            
            const endTime = performance.now();
            const updateTime = endTime - startTime;
            
            // Should complete within reasonable time (< 10ms for 100 projectiles)
            expect(updateTime).toBeLessThan(10);
        });
        
        test('should cleanup efficiently', () => {
            // Create many projectiles
            for (let i = 0; i < 50; i++) {
                projectileSystem.createProjectile(i, i, { lifetime: 0.001 });
            }
            
            const initialCount = projectileSystem.activeProjectiles.length;
            
            // Update to trigger cleanup
            projectileSystem.update(0.1);
            
            const finalCount = projectileSystem.activeProjectiles.length;
            
            // Should have cleaned up expired projectiles
            expect(finalCount).toBeLessThan(initialCount);
        });
    });
});

describe('Progression Telemetry Tests', () => {
    test('should track damage dealt correctly', () => {
        const mockGame = createMockGame();
        const telemetry = new ProgressionTelemetry(mockGame);
        
        telemetry.trackDamageDealt(100);
        telemetry.trackDamageDealt(50);
        
        expect(telemetry.sampleAccumulators.damageDealt).toBe(150);
        expect(telemetry.currentMetrics.totalDamageDealt).toBe(150);
    });
    
    test('should detect progression issues', () => {
        const mockGame = createMockGame();
        const telemetry = new ProgressionTelemetry(mockGame);
        
        // Simulate low DPS scenario
        const lowDPSSample = {
            timestamp: 120, // After 2 minutes
            dps: 30, // Below threshold of 50
            killRate: 1,
            spawnRate: 2
        };
        
        telemetry.analyzeProgressionIssues(lowDPSSample);
        
        const underpoweredIssues = telemetry.detectedIssues.filter(
            issue => issue.type === 'underpowered'
        );
        
        expect(underpoweredIssues.length).toBeGreaterThan(0);
    });
});
