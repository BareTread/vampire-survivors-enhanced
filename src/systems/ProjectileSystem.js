import { Projectile } from '../entities/Projectile.js';

export class ProjectileSystem {
    constructor(game) {
        this.game = game;
        
        // Projectile pools for performance
        this.projectilePool = [];
        this.activeProjectiles = [];
        this.maxActiveProjectiles = 300; // Performance limit
        
        // OPTIMIZED: Advanced collision optimization with hierarchical grids
        this.gridSize = 64;
        this.spatialGrid = new Map();
        
        // OPTIMIZED: Multi-resolution spatial indexing
        this.fineGrid = new Map();   // 32x32 cells for precise collision
        this.fineGridSize = 32;
        this.coarseGrid = new Map();  // 128x128 cells for area queries
        this.coarseGridSize = 128;
        
        // OPTIMIZED: Pooled structures for zero-allocation updates
        this.gridCellPool = [];
        this.queryResultsPool = [];
        this.tempResults = new Array(50);
        
        // Performance tracking with adaptive cleanup
        this.lastCleanupTime = 0;
        this.cleanupInterval = 800; // More frequent cleanup for projectiles
        this.lastSpatialUpdate = 0;
        this.spatialUpdateInterval = 25; // Update every 25ms for responsiveness
        
        this.initializePool();
        this.initializeGridPools();
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
    
    initializeGridPools() {
        // OPTIMIZED: Pre-create grid cell arrays
        for (let i = 0; i < 150; i++) {
            this.gridCellPool.push([]);
        }
        
        // OPTIMIZED: Pre-create query results arrays
        for (let i = 0; i < 20; i++) {
            this.queryResultsPool.push([]);
        }
    }
    
    // OPTIMIZED: Grid cell pooling to prevent array allocations
    getGridCell() {
        if (this.gridCellPool.length > 0) {
            const cell = this.gridCellPool.pop();
            cell.length = 0; // Clear the array
            return cell;
        }
        return [];
    }
    
    // OPTIMIZED: Recycle grid cells for reuse
    recycleSpatialGridCells() {
        // Return used cells to pool
        for (const cell of this.spatialGrid.values()) {
            if (this.gridCellPool.length < 300) { // Limit pool size
                cell.length = 0;
                this.gridCellPool.push(cell);
            }
        }
        for (const cell of this.fineGrid.values()) {
            if (this.gridCellPool.length < 300) {
                cell.length = 0;
                this.gridCellPool.push(cell);
            }
        }
        for (const cell of this.coarseGrid.values()) {
            if (this.gridCellPool.length < 300) {
                cell.length = 0;
                this.gridCellPool.push(cell);
            }
        }
    }
    
    update(dt) {
        // Update all active projectiles
        this.updateProjectiles(dt);
        
        // Update spatial grid for collision optimization
        this.updateSpatialGrid();
        
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
    
    updateSpatialGrid() {
        // OPTIMIZED: Skip updates if not enough time has passed
        const now = performance.now();
        if (now - this.lastSpatialUpdate < this.spatialUpdateInterval) {
            return;
        }
        this.lastSpatialUpdate = now;
        
        // OPTIMIZED: Recycle grid cells efficiently
        this.recycleSpatialGridCells();
        this.spatialGrid.clear();
        this.fineGrid.clear();
        this.coarseGrid.clear();
        
        // OPTIMIZED: Single pass multi-resolution grid population
        for (let i = 0; i < this.activeProjectiles.length; i++) {
            const projectile = this.activeProjectiles[i];
            if (!projectile.active) continue;
            
            const x = projectile.x;
            const y = projectile.y;
            
            // OPTIMIZED: Populate all grid levels simultaneously
            // Fine grid (precise collision)
            const fineGridX = (x / this.fineGridSize) | 0;
            const fineGridY = (y / this.fineGridSize) | 0;
            const fineKey = `${fineGridX},${fineGridY}`;
            
            let fineCell = this.fineGrid.get(fineKey);
            if (!fineCell) {
                fineCell = this.getGridCell();
                this.fineGrid.set(fineKey, fineCell);
            }
            fineCell.push(projectile);
            
            // Main grid (standard queries)
            const gridX = (x / this.gridSize) | 0;
            const gridY = (y / this.gridSize) | 0;
            const mainKey = `${gridX},${gridY}`;
            
            let mainCell = this.spatialGrid.get(mainKey);
            if (!mainCell) {
                mainCell = this.getGridCell();
                this.spatialGrid.set(mainKey, mainCell);
            }
            mainCell.push(projectile);
            
            // Coarse grid (area queries)
            const coarseGridX = (x / this.coarseGridSize) | 0;
            const coarseGridY = (y / this.coarseGridSize) | 0;
            const coarseKey = `${coarseGridX},${coarseGridY}`;
            
            let coarseCell = this.coarseGrid.get(coarseKey);
            if (!coarseCell) {
                coarseCell = this.getGridCell();
                this.coarseGrid.set(coarseKey, coarseCell);
            }
            coarseCell.push(projectile);
        }
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
        
        // OPTIMIZED: Ultra-fast state reset with minimal operations
        projectile.active = false;
        projectile.lifetime = 0;
        if (projectile.hitTargets) projectile.hitTargets.clear();
        if (projectile.trailPoints) projectile.trailPoints.length = 0; // Faster than new array
        // Reset transform properties for reuse
        projectile.x = 0;
        projectile.y = 0;
        projectile.vx = 0;
        projectile.vy = 0;
        
        // OPTIMIZED: Larger pool size and pre-check
        if (this.projectilePool.length < 300) {
            this.projectilePool.push(projectile);
        }
    }
    
    cleanup() {
        // Remove inactive projectiles
        for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
            const projectile = this.activeProjectiles[i];
            
            if (!projectile.active) {
                this.activeProjectiles.splice(i, 1);
                this.returnToPool(projectile);
            }
        }
    }
    
    // Collision detection helpers
    getProjectilesInArea(x, y, radius) {
        // OPTIMIZED: Hierarchical grid selection based on query size
        const radiusSquared = radius * radius;
        
        let grid, gridSize, maxResults;
        if (radius <= 64) {
            grid = this.fineGrid;
            gridSize = this.fineGridSize;
            maxResults = 10;
        } else if (radius <= 256) {
            grid = this.spatialGrid;
            gridSize = this.gridSize;
            maxResults = 20;
        } else {
            grid = this.coarseGrid;
            gridSize = this.coarseGridSize;
            maxResults = 30;
        }
        
        // OPTIMIZED: Reuse results array
        this.tempResults.length = 0;
        
        const gridRange = Math.ceil(radius / gridSize);
        const centerGridX = (x / gridSize) | 0;
        const centerGridY = (y / gridSize) | 0;
        
        // OPTIMIZED: Spiral search for better cache locality
        for (let r = 0; r <= gridRange && this.tempResults.length < maxResults; r++) {
            for (let gx = centerGridX - r; gx <= centerGridX + r; gx++) {
                for (let gy = centerGridY - r; gy <= centerGridY + r; gy++) {
                    // Only check border cells for current radius
                    if (r > 0 && 
                        gx > centerGridX - r && gx < centerGridX + r &&
                        gy > centerGridY - r && gy < centerGridY + r) {
                        continue;
                    }
                    
                    const key = `${gx},${gy}`;
                    const projectiles = grid.get(key);
                    
                    if (projectiles) {
                        for (let i = 0; i < projectiles.length && this.tempResults.length < maxResults; i++) {
                            const projectile = projectiles[i];
                            const dx = projectile.x - x;
                            const dy = projectile.y - y;
                            const distanceSquared = dx * dx + dy * dy;
                            
                            if (distanceSquared <= radiusSquared) {
                                this.tempResults.push(projectile);
                            }
                        }
                    }
                }
            }
        }
        
        return this.tempResults.slice(); // Return copy to prevent mutation
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
        this.spatialGrid.clear();
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
            enemyProjectiles: this.getEnemyProjectiles().length,
            gridCells: this.spatialGrid.size
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