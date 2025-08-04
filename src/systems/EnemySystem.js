import { Enemy } from '../entities/Enemy.js';
import { Wraith } from '../entities/enemies/Wraith.js';
import { Demon } from '../entities/enemies/Demon.js';

export class EnemySystem {
    constructor(game) {
        this.game = game;
        
        // Enemy pools for performance
        this.enemyPool = new Map(); // Pool by enemy type
        this.activeEnemies = [];
        this.maxActiveEnemies = 150; // Reduced performance limit for better FPS
        
        // Spawning configuration
        this.spawnRate = 2.0; // Enemies per second
        this.spawnTimer = 0;
        this.spawnDistance = 400; // Distance from player to spawn
        this.despawnDistance = 600; // Distance at which to despawn enemies
        
        // Wave system
        this.currentWave = 1;
        this.waveTimer = 0;
        this.waveDuration = 60; // 60 seconds per wave
        this.waveProgress = 0;
        
        // Difficulty scaling
        this.difficultyMultiplier = 1.0;
        this.eliteSpawnChance = 0.05; // 5% chance for elite enemies
        
        // Spawn patterns
        this.spawnPatterns = {
            random: this.spawnRandomPattern.bind(this),
            circle: this.spawnCirclePattern.bind(this),
            cluster: this.spawnClusterPattern.bind(this),
            line: this.spawnLinePattern.bind(this)
        };
        this.currentPattern = 'random';
        
        // Pressure surge multipliers
        this.surgeSpawnMultiplier = 1.0;
        this.surgeEliteBonus = 0;
        
        // Enemy type configurations
        this.enemyTypes = {
            basic: { weight: 30, minWave: 1 },
            fast: { weight: 20, minWave: 2 },
            tank: { weight: 15, minWave: 3 },
            ranged: { weight: 12, minWave: 4 },
            wraith: { weight: 8, minWave: 5 },
            demon: { weight: 10, minWave: 6 },
            elite: { weight: 5, minWave: 7 },
            berserker: { weight: 3, minWave: 8 },
            summoner: { weight: 2, minWave: 9 },
            juggernaut: { weight: 1, minWave: 10 }
        };
        
        // OPTIMIZED: Ultra-efficient spatial partitioning with hierarchical grids
        this.gridSize = 64;
        this.spatialGrid = new Map();
        this.gridBounds = { minX: -2000, minY: -2000, maxX: 2000, maxY: 2000 };
        
        // OPTIMIZED: Hierarchical spatial indexing for different query ranges
        this.coarseGrid = new Map(); // 256x256 cells for long-range queries
        this.coarseGridSize = 256;
        this.fineGrid = new Map();   // 64x64 cells for precise queries
        this.fineGridSize = 64;
        
        // OPTIMIZED: Pre-allocated structures to eliminate garbage collection
        this.gridUpdateInterval = 33; // Update every 33ms (~30 FPS) for balance
        this.lastGridUpdate = 0;
        this.tempEnemyArray = new Array(300); // Larger reusable array
        this.nearbyResults = new Array(50);   // Reusable results array
        this.gridKeyPool = [];                // Pooled grid key strings
        this.gridCellPool = [];               // Pooled grid cell arrays
        
        // OPTIMIZED: Distance calculation cache for expensive operations
        this.distanceCache = new Map();
        this.cacheSize = 0;
        this.maxCacheSize = 1000;
        
        this.initializePools();
        this.initializeGridPools();
    }
    
    initializePools() {
        // Pre-create enemy pools
        const poolSizes = {
            basic: 50,
            fast: 30,
            tank: 20,
            ranged: 25,
            wraith: 15,
            demon: 15,
            elite: 10,
            berserker: 8,
            summoner: 6,
            juggernaut: 4
        };
        
        for (const [type, size] of Object.entries(poolSizes)) {
            this.enemyPool.set(type, []);
            
            for (let i = 0; i < size; i++) {
                const enemy = this.createEnemyByType(type);
                enemy.active = false;
                this.enemyPool.get(type).push(enemy);
            }
        }
    }
    
    initializeGridPools() {
        // OPTIMIZED: Pre-create grid key strings to prevent string allocation
        for (let x = -50; x <= 50; x++) {
            for (let y = -50; y <= 50; y++) {
                this.gridKeyPool.push(`${x},${y}`);
            }
        }
        
        // OPTIMIZED: Pre-create grid cell arrays
        for (let i = 0; i < 200; i++) {
            this.gridCellPool.push([]);
        }
    }
    
    // OPTIMIZED: Fast grid key generation with pooling
    getGridKey(x, y) {
        // For common coordinates, use pooled keys
        if (x >= -50 && x <= 50 && y >= -50 && y <= 50) {
            const index = (x + 50) * 101 + (y + 50);
            return this.gridKeyPool[index];
        }
        // Fall back to string generation for extreme coordinates
        return `${x},${y}`;
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
            if (this.gridCellPool.length < 500) { // Limit pool size
                cell.length = 0;
                this.gridCellPool.push(cell);
            }
        }
        for (const cell of this.fineGrid.values()) {
            if (this.gridCellPool.length < 500) {
                cell.length = 0;
                this.gridCellPool.push(cell);
            }
        }
        for (const cell of this.coarseGrid.values()) {
            if (this.gridCellPool.length < 500) {
                cell.length = 0;
                this.gridCellPool.push(cell);
            }
        }
    }
    
    update(dt) {
        // Update wave timer
        this.waveTimer += dt;
        this.waveProgress = this.waveTimer / this.waveDuration;
        
        // Check for wave transition
        if (this.waveTimer >= this.waveDuration) {
            this.nextWave();
        }
        
        // Update difficulty
        this.updateDifficulty();
        
        // Update spawning
        this.updateSpawning(dt);
        
        // Update all active enemies
        this.updateEnemies(dt);
        
        // Clean up distant enemies
        this.cleanupDistantEnemies();
        
        // Update spatial grid adaptively based on entity count
        const updateFreq = this.activeEnemies.length > 100 ? 4 : this.activeEnemies.length > 50 ? 3 : 2;
        if (this.game.frameCount % updateFreq === 0) {
            this.updateSpatialGrid();
        }
    }
    
    updateDifficulty() {
        // Increase difficulty over time and waves - FIXED: Added bounds checking
        if (!this.game || typeof this.game.gameTime !== 'number') {
            this.difficultyMultiplier = 1.0;
            return;
        }
        
        // Cap game time to prevent astronomical numbers
        const cappedGameTime = Math.min(this.game.gameTime, 3600); // Max 1 hour
        const cappedWave = Math.min(this.currentWave, 50); // Max wave 50
        
        // FIXED: More gradual difficulty increase to prevent overwhelming at 4 minutes
        // Linear time scaling: 1% every 10 seconds (was exponential 2%)
        const timeMultiplier = 1.0 + (cappedGameTime / 10) * 0.01;
        // Reduced wave scaling: 8% per wave (was 15%)
        const waveMultiplier = 1.0 + (cappedWave - 1) * 0.08;
        
        // FIXED: Add safety checks for mathematical operations
        const rawMultiplier = timeMultiplier * waveMultiplier;
        
        // Validate the calculation result and cap total difficulty to prevent overflow
        if (isFinite(rawMultiplier) && rawMultiplier > 0) {
            this.difficultyMultiplier = Math.min(rawMultiplier, 100.0);
        } else {
            console.warn('Invalid difficulty multiplier calculated, using fallback');
            this.difficultyMultiplier = Math.min(this.difficultyMultiplier * 1.1, 10.0);
        }
        
        // Adjust spawn rate based on difficulty
        const rawSpawnRate = 2.0 + (this.difficultyMultiplier - 1) * 1.5;
        
        // FIXED: Validate spawn rate calculation
        if (isFinite(rawSpawnRate) && rawSpawnRate > 0) {
            this.spawnRate = Math.min(rawSpawnRate, 8.0); // Cap at 8 per second
        } else {
            console.warn('Invalid spawn rate calculated, using fallback');
            this.spawnRate = 2.0; // Fallback to base rate
        }
        
        // Enhanced elite spawn chance based on player performance
        this.updateEliteSpawnRate();
    }
    
    updateEliteSpawnRate() {
        const cappedWave = Math.min(this.currentWave, 50);
        
        // Base rate increases with waves
        let baseRate = 0.05 + (cappedWave - 1) * 0.02;
        
        // Performance-based modifiers using flow state
        if (this.game.systems.flowState) {
            const flowMetrics = this.game.systems.flowState.playerPerformance;
            
            if (flowMetrics.stressLevel < 0.4) {
                // Player dominating - increase elite pressure significantly
                baseRate *= 2.5;
                console.log('Player dominating - increasing elite spawn rate');
            } else if (flowMetrics.stressLevel > 0.8) {
                // Player struggling - reduce slightly for breathing room
                baseRate *= 0.7;
                console.log('Player struggling - reducing elite spawn rate');  
            }
        }
        
        // Combo-based scaling for skilled players
        if (this.game.player && this.game.player.combo) {
            const comboBonus = Math.min(this.game.player.combo.count / 50, 2.0);
            baseRate *= (1 + comboBonus);
        }
        
        // Apply surge bonus and cap the final elite spawn chance
        baseRate += this.surgeEliteBonus;
        this.eliteSpawnChance = Math.min(baseRate, 0.35); // Increased max from 0.25 to 0.35
    }
    
    updateSpawning(dt) {
        if (!this.game.player || !this.game.player.isAlive()) return;
        
        // Apply surge multiplier and reduce spawn rate if too many enemies
        let effectiveSpawnRate = this.spawnRate * this.surgeSpawnMultiplier;
        if (this.activeEnemies.length > this.maxActiveEnemies * 0.8) {
            effectiveSpawnRate *= 0.5;
        }
        
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnTimer = 1.0 / effectiveSpawnRate;
            this.spawnEnemyWave();
        }
    }
    
    spawnEnemyWave() {
        // Determine number of enemies to spawn (1-3 based on difficulty)
        const spawnCount = Math.min(1 + Math.floor(this.difficultyMultiplier / 3), 3);
        
        for (let i = 0; i < spawnCount; i++) {
            this.spawnSingleEnemy();
        }
    }
    
    spawnSingleEnemy() {
        if (this.activeEnemies.length >= this.maxActiveEnemies) return;
        
        // Choose enemy type
        const enemyType = this.chooseEnemyType();
        
        // Choose spawn pattern
        const pattern = this.chooseSpawnPattern();
        
        // Get spawn position
        const spawnPos = this.spawnPatterns[pattern](enemyType);
        if (!spawnPos) return;
        
        // Get enemy from pool
        const enemy = this.getEnemyFromPool(enemyType);
        if (!enemy) return;
        
        // Initialize enemy
        enemy.reset(spawnPos.x, spawnPos.y, enemyType);
        this.activeEnemies.push(enemy);
        
    }
    
    chooseEnemyType() {
        // Filter types available for current wave
        const availableTypes = Object.entries(this.enemyTypes).filter(
            ([type, config]) => this.currentWave >= config.minWave
        );
        
        // Calculate total weight
        const totalWeight = availableTypes.reduce((sum, [type, config]) => sum + config.weight, 0);
        
        // Random selection based on weights
        let random = Math.random() * totalWeight;
        
        for (const [type, config] of availableTypes) {
            random -= config.weight;
            if (random <= 0) {
                // Check for elite upgrade
                if (type !== 'elite' && Math.random() < this.eliteSpawnChance) {
                    return 'elite';
                }
                return type;
            }
        }
        
        return 'basic'; // Fallback
    }
    
    chooseSpawnPattern() {
        // Change pattern based on wave progress
        if (this.waveProgress < 0.3) return 'circle';
        if (this.waveProgress < 0.6) return 'random';
        if (this.waveProgress < 0.8) return 'cluster';
        return 'line';
    }
    
    spawnRandomPattern(enemyType) {
        const player = this.game.player;
        const angle = Math.random() * Math.PI * 2;
        
        // FIXED: Add coordinate validation
        const x = player.x + Math.cos(angle) * this.spawnDistance;
        const y = player.y + Math.sin(angle) * this.spawnDistance;
        
        // Validate coordinates are finite and reasonable
        if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 1000000 || Math.abs(y) > 1000000) {
            console.warn('Invalid spawn coordinates detected, using fallback');
            return {
                x: player.x + (Math.random() - 0.5) * 800,
                y: player.y + (Math.random() - 0.5) * 800
            };
        }
        
        return { x, y };
    }
    
    spawnCirclePattern(enemyType) {
        const player = this.game.player;
        
        // Spawn in a circle around player with slight randomization
        const baseAngle = performance.now() * 0.001; // Slowly rotating circle
        const randomOffset = (Math.random() - 0.5) * Math.PI / 4; // ±45 degrees
        const angle = baseAngle + randomOffset;
        
        const distance = this.spawnDistance + (Math.random() - 0.5) * 100;
        
        // FIXED: Add coordinate validation
        const x = player.x + Math.cos(angle) * distance;
        const y = player.y + Math.sin(angle) * distance;
        
        // Validate coordinates are finite and reasonable
        if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 1000000 || Math.abs(y) > 1000000) {
            console.warn('Invalid circle spawn coordinates detected, using fallback');
            return {
                x: player.x + (Math.random() - 0.5) * 800,
                y: player.y + (Math.random() - 0.5) * 800
            };
        }
        
        return { x, y };
    }
    
    spawnClusterPattern(enemyType) {
        const player = this.game.player;
        
        // Choose a random direction and spawn multiple enemies in that area
        const clusterAngle = Math.random() * Math.PI * 2;
        const clusterSpread = Math.PI / 6; // 30 degrees
        
        const angle = clusterAngle + (Math.random() - 0.5) * clusterSpread;
        const distance = this.spawnDistance + (Math.random() - 0.5) * 100;
        
        // FIXED: Add coordinate validation
        const x = player.x + Math.cos(angle) * distance;
        const y = player.y + Math.sin(angle) * distance;
        
        // Validate coordinates are finite and reasonable
        if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 1000000 || Math.abs(y) > 1000000) {
            console.warn('Invalid cluster spawn coordinates detected, using fallback');
            return {
                x: player.x + (Math.random() - 0.5) * 800,
                y: player.y + (Math.random() - 0.5) * 800
            };
        }
        
        return { x, y };
    }
    
    spawnLinePattern(enemyType) {
        const player = this.game.player;
        
        // Spawn enemies in a line formation
        const lineAngle = Math.random() * Math.PI * 2;
        const lineLength = 200;
        const lineProgress = (Math.random() - 0.5) * lineLength;
        
        const perpAngle = lineAngle + Math.PI / 2;
        const baseX = player.x + Math.cos(lineAngle) * this.spawnDistance;
        const baseY = player.y + Math.sin(lineAngle) * this.spawnDistance;
        
        // FIXED: Add coordinate validation
        const x = baseX + Math.cos(perpAngle) * lineProgress;
        const y = baseY + Math.sin(perpAngle) * lineProgress;
        
        // Validate coordinates are finite and reasonable
        if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 1000000 || Math.abs(y) > 1000000) {
            console.warn('Invalid line spawn coordinates detected, using fallback');
            return {
                x: player.x + (Math.random() - 0.5) * 800,
                y: player.y + (Math.random() - 0.5) * 800
            };
        }
        
        return { x, y };
    }
    
    getEnemyFromPool(type) {
        const pool = this.enemyPool.get(type);
        if (!pool || pool.length === 0) {
            // Create new enemy if pool is empty
            return this.createEnemyByType(type);
        }
        
        return pool.pop();
    }
    
    createEnemyByType(type) {
        // Create appropriate enemy class based on type
        switch (type) {
            case 'wraith':
                return new Wraith(this.game, 0, 0);
            case 'demon':
                return new Demon(this.game, 0, 0);
            default:
                return new Enemy(this.game, 0, 0, type);
        }
    }
    
    returnEnemyToPool(enemy) {
        if (!enemy) return;
        
        const pool = this.enemyPool.get(enemy.type);
        if (pool && pool.length < 50) { // Don't let pools grow too large
            enemy.active = false;
            pool.push(enemy);
        }
    }
    
    updateEnemies(dt) {
        // OPTIMIZED: Batch processing with minimal array operations
        let writeIndex = 0;
        
        for (let i = 0; i < this.activeEnemies.length; i++) {
            const enemy = this.activeEnemies[i];
            
            if (!enemy.active) {
                this.returnEnemyToPool(enemy);
                continue; // Skip this enemy, don't copy to write position
            }
            
            enemy.update(dt);
            
            // OPTIMIZED: Compact array without splice
            if (writeIndex !== i) {
                this.activeEnemies[writeIndex] = enemy;
            }
            writeIndex++;
        }
        
        // OPTIMIZED: Single array truncation instead of multiple splices
        this.activeEnemies.length = writeIndex;
    }
    
    cleanupDistantEnemies() {
        if (!this.game.player) return;
        
        for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
            const enemy = this.activeEnemies[i];
            // FIXED: Add null/undefined enemy check
            if (!enemy || typeof enemy.x !== 'number' || typeof enemy.y !== 'number') {
                this.activeEnemies.splice(i, 1);
                continue;
            }
            
            const distanceSquared = this.getDistanceToPlayer(enemy);
            
            // FIXED: Add safety check for distance calculation (compare squared distances)
            const despawnDistanceSquared = this.despawnDistance * this.despawnDistance;
            if (!isFinite(distanceSquared) || distanceSquared > despawnDistanceSquared) {
                enemy.active = false;
                this.activeEnemies.splice(i, 1);
                this.returnEnemyToPool(enemy);
            }
        }
    }
    
    updateSpatialGrid() {
        // OPTIMIZED: Skip grid updates if not enough time has passed
        const now = performance.now();
        if (now - this.lastGridUpdate < this.gridUpdateInterval) {
            return;
        }
        this.lastGridUpdate = now;
        
        // OPTIMIZED: Efficient grid clearing with cell recycling
        this.recycleSpatialGridCells();
        this.spatialGrid.clear();
        this.coarseGrid.clear();
        this.fineGrid.clear();
        
        // OPTIMIZED: Pre-calculate player position for distance culling
        const playerX = this.game.player ? this.game.player.x : 0;
        const playerY = this.game.player ? this.game.player.y : 0;
        const maxDistance = 1000; // Increased for better spatial queries
        const maxDistanceSquared = maxDistance * maxDistance;
        
        // OPTIMIZED: Single pass to populate both grid levels
        for (let i = 0; i < this.activeEnemies.length; i++) {
            const enemy = this.activeEnemies[i];
            if (!enemy.active) continue;
            
            // OPTIMIZED: Fast distance culling with squared distances
            const dx = enemy.x - playerX;
            const dy = enemy.y - playerY;
            const distanceSquared = dx * dx + dy * dy;
            
            if (distanceSquared > maxDistanceSquared) continue;
            
            // OPTIMIZED: Populate fine grid (precise collision detection)
            const fineGridX = (enemy.x / this.fineGridSize) | 0;
            const fineGridY = (enemy.y / this.fineGridSize) | 0;
            const fineKey = this.getGridKey(fineGridX, fineGridY);
            
            let fineCell = this.fineGrid.get(fineKey);
            if (!fineCell) {
                fineCell = this.getGridCell();
                this.fineGrid.set(fineKey, fineCell);
            }
            fineCell.push(enemy);
            
            // OPTIMIZED: Populate coarse grid (long-range queries)
            const coarseGridX = (enemy.x / this.coarseGridSize) | 0;
            const coarseGridY = (enemy.y / this.coarseGridSize) | 0;
            const coarseKey = this.getGridKey(coarseGridX, coarseGridY);
            
            let coarseCell = this.coarseGrid.get(coarseKey);
            if (!coarseCell) {
                coarseCell = this.getGridCell();
                this.coarseGrid.set(coarseKey, coarseCell);
            }
            coarseCell.push(enemy);
            
            // OPTIMIZED: Maintain backward compatibility with existing grid
            const gridX = (enemy.x / this.gridSize) | 0;
            const gridY = (enemy.y / this.gridSize) | 0;
            const mainKey = this.getGridKey(gridX, gridY);
            
            let mainCell = this.spatialGrid.get(mainKey);
            if (!mainCell) {
                mainCell = this.getGridCell();
                this.spatialGrid.set(mainKey, mainCell);
            }
            mainCell.push(enemy);
        }
    }
    
    nextWave() {
        // Check if previous wave was perfect (no damage taken)
        const wasPerfectWave = this.game.player && 
            this.game.player.streaks.noDamage >= this.waveDuration;
        
        // Track wave completion for achievements
        if (this.game.systems.achievement) {
            this.game.systems.achievement.onWaveCompleted(this.currentWave, wasPerfectWave);
        }
        
        this.currentWave++;
        this.waveTimer = 0;
        this.waveProgress = 0;
        
        // Show wave notification
        this.game.showWaveNotification(this.currentWave);
        
        // Bonus effects every 5 waves
        if (this.currentWave % 5 === 0) {
            this.spawnBossWave();
        }
        
    }
    
    spawnBossWave() {
        // Spawn multiple elite enemies as a boss wave
        const bossCount = Math.floor(this.currentWave / 5);
        
        for (let i = 0; i < bossCount; i++) {
            setTimeout(() => {
                this.spawnBoss();
            }, i * 1000); // 1 second delay between bosses
        }
    }
    
    spawnBoss() {
        const player = this.game.player;
        const angle = Math.random() * Math.PI * 2;
        const distance = this.spawnDistance * 1.5; // Spawn bosses further away
        
        const enemy = this.getEnemyFromPool('elite');
        if (!enemy) return;
        
        const x = player.x + Math.cos(angle) * distance;
        const y = player.y + Math.sin(angle) * distance;
        
        enemy.reset(x, y, 'elite');
        
        // Boss buffs
        enemy.maxHealth *= 2;
        enemy.health = enemy.maxHealth;
        enemy.damage *= 1.5;
        enemy.expReward *= 3;
        
        this.activeEnemies.push(enemy);
        
        // Visual effect
        this.game.systems.particle.createBossSpawnEffect(x, y);
        if (this.game && this.game.camera && typeof this.game.camera.shake === 'function') {
            this.game.camera.shake(5, 1.0);
        }
        
    }
    
    // Query methods for other systems
    getActiveEnemies() {
        return this.activeEnemies.filter(enemy => enemy.active);
    }
    
    getEnemiesInRange(x, y, range) {
        const result = [];
        const rangeSquared = range * range;
        
        for (const enemy of this.activeEnemies) {
            if (!enemy.active) continue;
            
            const dx = enemy.x - x;
            const dy = enemy.y - y;
            const distanceSquared = dx * dx + dy * dy;
            
            if (distanceSquared <= rangeSquared) {
                result.push(enemy);
            }
        }
        
        return result;
    }
    
    getNearbyEnemies(x, y, range) {
        // OPTIMIZED: Hierarchical spatial lookup for maximum efficiency
        const rangeSquared = range * range;
        
        // OPTIMIZED: Choose grid resolution based on query range
        let grid, gridSize, maxResults;
        
        if (range <= 128) {
            // Small range: use fine grid for precision
            grid = this.fineGrid;
            gridSize = this.fineGridSize;
            maxResults = 15;
        } else if (range <= 512) {
            // Medium range: use main grid
            grid = this.spatialGrid;
            gridSize = this.gridSize;
            maxResults = 25;
        } else {
            // Large range: use coarse grid
            grid = this.coarseGrid;
            gridSize = this.coarseGridSize;
            maxResults = 40;
        }
        
        // OPTIMIZED: Reuse results array to prevent allocations
        this.nearbyResults.length = 0;
        
        const gridRange = Math.ceil(range / gridSize);
        const centerGridX = (x / gridSize) | 0;
        const centerGridY = (y / gridSize) | 0;
        
        // OPTIMIZED: Spiral search pattern for better cache locality
        for (let radius = 0; radius <= gridRange; radius++) {
            for (let gx = centerGridX - radius; gx <= centerGridX + radius; gx++) {
                for (let gy = centerGridY - radius; gy <= centerGridY + radius; gy++) {
                    // Only check border cells for current radius (spiral pattern)
                    if (radius > 0 && 
                        gx > centerGridX - radius && gx < centerGridX + radius &&
                        gy > centerGridY - radius && gy < centerGridY + radius) {
                        continue;
                    }
                    
                    const key = this.getGridKey(gx, gy);
                    const enemies = grid.get(key);
                    
                    if (enemies) {
                        for (let i = 0; i < enemies.length && this.nearbyResults.length < maxResults; i++) {
                            const enemy = enemies[i];
                            
                            // OPTIMIZED: Fast squared distance check
                            const dx = enemy.x - x;
                            const dy = enemy.y - y;
                            const distanceSquared = dx * dx + dy * dy;
                            
                            if (distanceSquared <= rangeSquared) {
                                this.nearbyResults.push(enemy);
                            }
                        }
                    }
                    
                    if (this.nearbyResults.length >= maxResults) {
                        return this.nearbyResults.slice(); // Return copy to avoid mutation
                    }
                }
            }
        }
        
        return this.nearbyResults.slice();
    }
    
    // OPTIMIZED: Return squared distance to avoid expensive Math.sqrt()
    getDistanceToPlayer(enemy) {
        if (!this.game.player) return Infinity;
        
        // FIXED: Add safety checks for enemy and player coordinates
        if (!enemy || typeof enemy.x !== 'number' || typeof enemy.y !== 'number') {
            return Infinity;
        }
        if (typeof this.game.player.x !== 'number' || typeof this.game.player.y !== 'number') {
            return Infinity;
        }
        
        const dx = enemy.x - this.game.player.x;
        const dy = enemy.y - this.game.player.y;
        
        // Return squared distance for performance
        const distanceSquared = dx * dx + dy * dy;
        return isFinite(distanceSquared) ? distanceSquared : Infinity;
    }
    
    getEnemyCount() {
        return this.activeEnemies.length;
    }
    
    getCurrentWave() {
        return this.currentWave;
    }
    
    getWaveProgress() {
        return this.waveProgress;
    }
    
    render(renderer) {
        // Render all active enemies
        for (const enemy of this.activeEnemies) {
            if (enemy.active) {
                enemy.render(renderer);
            }
        }
    }
    
    // Debug methods
    getDebugInfo() {
        return {
            activeEnemies: this.activeEnemies.length,
            currentWave: this.currentWave,
            waveProgress: (this.waveProgress * 100).toFixed(1) + '%',
            spawnRate: this.spawnRate.toFixed(1),
            difficultyMultiplier: this.difficultyMultiplier.toFixed(2),
            eliteSpawnChance: (this.eliteSpawnChance * 100).toFixed(1) + '%',
            poolSizes: Object.fromEntries(
                Array.from(this.enemyPool.entries()).map(([type, pool]) => [type, pool.length])
            )
        };
    }
    
    // Reset for new game
    reset() {
        // Return all active enemies to pools
        for (const enemy of this.activeEnemies) {
            enemy.active = false;
            this.returnEnemyToPool(enemy);
        }
        
        this.activeEnemies = [];
        this.currentWave = 1;
        this.waveTimer = 0;
        this.waveProgress = 0;
        this.difficultyMultiplier = 1.0;
        this.eliteSpawnChance = 0.05;
        this.spawnTimer = 0;
        this.spatialGrid.clear();
    }
}