import { Projectile } from '../entities/Projectile.js';

export class ProjectileSystem {
    constructor(game) {
        this.game = game;
        
        // Projectile pools for performance
        this.projectilePool = [];
        this.activeProjectiles = [];
        this.maxActiveProjectiles = 300; // Performance limit
        
        // OPTIMIZED: Removed redundant spatial grid - now using centralized CollisionSystem
        // Reusable structures for performance
        this.tempResults = new Array(50);
        
        // Performance tracking with adaptive cleanup
        this.lastCleanupTime = 0;
        this.cleanupInterval = 800; // More frequent cleanup for projectiles
        
        this.initializePool();
    }
    
    initializePool() {
        // OPTIMIZED: Larger pre-created projectile pool
        const poolSize = 250; // Increased for better performance
        
        for (let i = 0; i < poolSize; i++) {
            const projectile = new Projectile(this.game, 0, 0);
            projectile.active = false;
            this.projectilePool.push(projectile);
        }
        
        console.log(`🚀 ProjectileSystem: Initialized pool with ${poolSize} projectiles`);
    }
    
    
    update(dt) {
        // Update all active projectiles
        this.updateProjectiles(dt);
        
        // Periodic cleanup
        const currentTime = performance.now();
        if (currentTime - this.lastCleanupTime > this.cleanupInterval) {
            this.cleanup();
            this.lastCleanupTime = currentTime;
        }
    }
    
    updateProjectiles(dt) {
        // OPTIMIZED: Batch processing without splice operations
        let writeIndex = 0;
        
        for (let i = 0; i < this.activeProjectiles.length; i++) {
            const projectile = this.activeProjectiles[i];
            
            if (!projectile.active) {
                this.returnToPool(projectile);
                continue; // Skip inactive projectiles
            }
            
            projectile.update(dt);
            
            // OPTIMIZED: Compact array efficiently
            if (writeIndex !== i) {
                this.activeProjectiles[writeIndex] = projectile;
            }
            writeIndex++;
        }
        
        // OPTIMIZED: Single array truncation
        this.activeProjectiles.length = writeIndex;
    }
    
    
    createProjectile(x, y, config = {}) {
        if (this.activeProjectiles.length >= this.maxActiveProjectiles) {
            // Remove oldest projectile if at limit
            const oldest = this.activeProjectiles.shift();
            if (oldest) {
                oldest.active = false;
                this.returnToPool(oldest);
            }
        }
        
        // Get projectile from pool
        const projectile = this.getFromPool();
        if (!projectile) return null;
        
        // Initialize projectile
        projectile.reset(x, y, config);
        this.activeProjectiles.push(projectile);
        
        // Debug tracking
        if (this.game.projectileDebugger) {
            this.game.projectileDebugger.trackProjectileCreation(projectile);
        }
        
        return projectile;
    }
    
    createPlayerProjectile(x, y, targetX, targetY, config = {}) {
        const angle = Math.atan2(targetY - y, targetX - x);
        
        return this.createProjectile(x, y, {
            direction: angle,
            source: 'player',
            ...config
        });
    }
    
    createEnemyProjectile(x, y, targetX, targetY, damage, speed, color = '#FF8800') {
        const angle = Math.atan2(targetY - y, targetX - x);
        
        return this.createProjectile(x, y, {
            direction: angle,
            damage: damage,
            speed: speed,
            color: '#FF4444', // Changed to bright red for visibility
            source: 'enemy',
            size: 8, // Increased from 6 to 8 for better visibility
            lifetime: 4.0, // Reduced from 5.0 to 4.0 seconds
            glow: true // Add glow effect to make projectiles more visible
        });
    }
    
    createMagicMissile(x, y, target, config = {}) {
        const angle = target ? Math.atan2(target.y - y, target.x - x) : 0;
        
        return this.createProjectile(x, y, {
            direction: angle,
            type: 'magic',
            homing: true,
            homingTarget: target,
            trail: true,
            color: '#9B59B6',
            ...config
        });
    }
    
    createExplosiveProjectile(x, y, angle, config = {}) {
        return this.createProjectile(x, y, {
            direction: angle,
            type: 'explosive',
            explosive: true,
            explosionRadius: 80,
            color: '#FF6B00',
            size: 8,
            ...config
        });
    }
    
    createBoomerang(x, y, angle, config = {}) {
        return this.createProjectile(x, y, {
            direction: angle,
            type: 'boomerang',
            lifetime: 4.0,
            color: '#8B4513',
            ...config
        });
    }
    
    getFromPool() {
        if (this.projectilePool.length > 0) {
            return this.projectilePool.pop();
        }
        
        // Create new projectile if pool is empty
        return new Projectile(this.game, 0, 0);
    }
    
    returnToPool(projectile) {
        if (!projectile) return;
        
        // Debug tracking - track destruction reason
        let destructionReason = 'lifetime';
        if (this.game.projectileDebugger) {
            if (isNaN(projectile.x) || isNaN(projectile.y)) {
                destructionReason = 'coordinateOverflow';
            } else if (!isFinite(projectile.velocity.x) || !isFinite(projectile.velocity.y)) {
                destructionReason = 'invalidMovement';
            } else if (Math.abs(projectile.x) > 10000 || Math.abs(projectile.y) > 10000) {
                destructionReason = 'boundaryExit';
            }
            this.game.projectileDebugger.trackProjectileDestruction(projectile, destructionReason);
        }
        
        // Clean up any references
        projectile.active = false;
        projectile.hitTargets.clear();
        projectile.trailPoints = [];
        projectile.homingTarget = null;
        
        // OPTIMIZED: Validate projectile state before pooling
        if (isNaN(projectile.x) || isNaN(projectile.y)) {
            console.warn('⚠️ ProjectileSystem: Invalid projectile coordinates detected:', projectile.x, projectile.y);
            // Don't return corrupted projectiles to pool
            return;
        }
        
        // Return to pool for reuse
        this.projectilePool.push(projectile);
    }
    
    cleanup() {
        // OPTIMIZED: Use write index pattern instead of splice
        let writeIndex = 0;
        
        for (let i = 0; i < this.activeProjectiles.length; i++) {
            const projectile = this.activeProjectiles[i];
            
            if (!projectile.active) {
                this.returnToPool(projectile);
                continue; // Skip inactive projectiles
            }
            
            // Keep active projectiles
            if (writeIndex !== i) {
                this.activeProjectiles[writeIndex] = projectile;
            }
            writeIndex++;
        }
        
        // Truncate array
        this.activeProjectiles.length = writeIndex;
    }
    
    // Collision detection helpers
    getProjectilesInArea(x, y, radius) {
        // OPTIMIZED: Use centralized CollisionSystem for spatial queries
        if (!this.game.systems.collision) {
            // Fallback to linear search if collision system not available
            const radiusSquared = radius * radius;
            this.tempResults.length = 0;
            
            for (const projectile of this.activeProjectiles) {
                if (!projectile.active) continue;
                
                const dx = projectile.x - x;
                const dy = projectile.y - y;
                const distanceSquared = dx * dx + dy * dy;
                
                if (distanceSquared <= radiusSquared) {
                    this.tempResults.push(projectile);
                }
            }
            
            return this.tempResults.slice();
        }
        
        // Filter to only return projectile entities
        return this.game.systems.collision.getEntitiesInRadius(x, y, radius, entity => {
            return this.activeProjectiles.includes(entity) && entity.active;
        });
    }
    
    getPlayerProjectiles() {
        return this.activeProjectiles.filter(p => p.active && p.source === 'player');
    }
    
    getEnemyProjectiles() {
        return this.activeProjectiles.filter(p => p.active && p.source === 'enemy');
    }
    
    // Weapon-specific projectile creation methods
    createFireball(x, y, angle, damage, config = {}) {
        return this.createProjectile(x, y, {
            direction: angle,
            type: 'magic',
            damage: damage,
            explosive: true,
            explosionRadius: 60,
            color: '#FF4500',
            size: 10,
            trail: true,
            gravity: 50,
            ...config
        });
    }
    
    createIceShard(x, y, angle, damage, config = {}) {
        return this.createProjectile(x, y, {
            direction: angle,
            type: 'ice',
            damage: damage,
            piercing: 3,
            color: '#87CEEB',
            size: 6,
            speed: 250,
            ...config
        });
    }
    
    createLightningBolt(x, y, angle, damage, config = {}) {
        return this.createProjectile(x, y, {
            direction: angle,
            type: 'lightning',
            damage: damage,
            speed: 400,
            piercing: 999, // Pierces all enemies
            color: '#FFD700',
            size: 4,
            lifetime: 1.5,
            ...config
        });
    }
    
    createArrow(x, y, angle, damage, config = {}) {
        return this.createProjectile(x, y, {
            direction: angle,
            type: 'arrow',
            damage: damage,
            speed: 350,
            piercing: 1,
            color: '#8B4513',
            size: 5,
            gravity: 30,
            ...config
        });
    }
    
    // Mass projectile effects
    createSpread(x, y, centerAngle, count, spreadAngle, projectileConfig = {}) {
        const projectiles = [];
        
        for (let i = 0; i < count; i++) {
            const angle = centerAngle + (i - (count - 1) / 2) * (spreadAngle / (count - 1));
            const projectile = this.createProjectile(x, y, {
                direction: angle,
                ...projectileConfig
            });
            
            if (projectile) {
                projectiles.push(projectile);
            }
        }
        
        return projectiles;
    }
    
    createCircularBurst(x, y, count, projectileConfig = {}) {
        const projectiles = [];
        
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const projectile = this.createProjectile(x, y, {
                direction: angle,
                ...projectileConfig
            });
            
            if (projectile) {
                projectiles.push(projectile);
            }
        }
        
        return projectiles;
    }
    
    // Special effects
    createProjectileWave(startX, startY, endX, endY, count, damage, config = {}) {
        const dx = endX - startX;
        const dy = endY - startY;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        
        const projectiles = [];
        
        for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            const x = startX + dx * t;
            const y = startY + dy * t;
            
            const projectile = this.createProjectile(x, y, {
                direction: angle,
                damage: damage,
                speed: 200 + i * 10, // Staggered speeds
                ...config
            });
            
            if (projectile) {
                projectiles.push(projectile);
            }
        }
        
        return projectiles;
    }
    
    // Clear all projectiles (for game reset)
    clearAll() {
        for (const projectile of this.activeProjectiles) {
            projectile.active = false;
            this.returnToPool(projectile);
        }
        
        this.activeProjectiles = [];
    }
    
    render(renderer) {
        // Render all active projectiles
        for (const projectile of this.activeProjectiles) {
            if (projectile.active) {
                projectile.render(renderer);
            }
        }
    }
    
    // Debug and performance info
    getDebugInfo() {
        return {
            activeProjectiles: this.activeProjectiles.length,
            poolSize: this.projectilePool.length,
            playerProjectiles: this.getPlayerProjectiles().length,
            enemyProjectiles: this.getEnemyProjectiles().length
            // spatialGrid removed - using centralized CollisionSystem
        };
    }
    
    getPerformanceStats() {
        return {
            activeCount: this.activeProjectiles.length,
            poolCount: this.projectilePool.length,
            maxActive: this.maxActiveProjectiles,
            utilizationPercent: (this.activeProjectiles.length / this.maxActiveProjectiles * 100).toFixed(1)
        };
    }
}