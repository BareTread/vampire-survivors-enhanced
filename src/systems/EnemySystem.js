import { Enemy } from '../entities/Enemy.js';
import { Wraith } from '../entities/enemies/Wraith.js';
import { Demon } from '../entities/enemies/Demon.js';
import { MathUtils } from '../utils/MathUtils.js';

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
        
        // OPTIMIZED: Removed redundant spatial grid - now using centralized CollisionSystem
        // Pre-allocated structures for performance
        this.tempEnemyArray = new Array(300); // Larger reusable array
        this.nearbyResults = new Array(50);   // Reusable results array
        
        this.initializePools();
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
    }
    
    updateDifficulty() {
        // Increase difficulty over time and waves - REBALANCED FOR LONG-TERM ENGAGEMENT
        if (!this.game || typeof this.game.gameTime !== 'number') {
            this.difficultyMultiplier = 1.0;
            return;
        }
        
        // Cap game time to prevent astronomical numbers
        const cappedGameTime = Math.min(this.game.gameTime, 7200); // Max 2 hours
        const cappedWave = Math.min(this.currentWave, 100); // Max wave 100
        
        // REBALANCED: Exponential scaling for challenging long-term gameplay
        // Time scaling: Exponential growth every 60 seconds (was linear every 10)
        const timeMinutes = cappedGameTime / 60;
        const timeMultiplier = Math.pow(1.4, timeMinutes); // 40% increase every minute
        
        // Wave scaling: Exponential growth (was linear 8% per wave)  
        const waveMultiplier = Math.pow(1.12, cappedWave - 1); // 12% increase per wave
        
        // REBALANCED: Remove artificial caps to allow proper scaling
        const rawMultiplier = timeMultiplier * waveMultiplier;
        
        // Validate the calculation result and use much higher cap
        if (isFinite(rawMultiplier) && rawMultiplier > 0) {
            this.difficultyMultiplier = Math.min(rawMultiplier, 1000.0); // Increased from 100x to 1000x
        } else {
            console.warn('Invalid difficulty multiplier calculated, using fallback');
            this.difficultyMultiplier = Math.min(this.difficultyMultiplier * 1.2, 50.0);
        }
        
        // REBALANCED: Aggressive spawn rate scaling for crowded battles
        // Base spawn rate increases exponentially to create swarm encounters
        const rawSpawnRate = 2.0 + Math.pow(this.difficultyMultiplier - 1, 0.8) * 2.0;
        
        // Validate spawn rate calculation with much higher cap
        if (isFinite(rawSpawnRate) && rawSpawnRate > 0) {
            this.spawnRate = Math.min(rawSpawnRate, 25.0); // Increased from 8 to 25 enemies per second
        } else {
            console.warn('Invalid spawn rate calculated, using fallback');
            this.spawnRate = 2.0; // Fallback to base rate
        }
        
        // Enhanced elite spawn chance based on player performance
        this.updateEliteSpawnRate();
        
        // REBALANCED: Update max active enemies based on time for epic battles
        const baseMaxEnemies = 150;
        const timeBonus = Math.floor(timeMinutes * 25); // +25 enemies per minute
        const waveBonus = (cappedWave - 1) * 5; // +5 enemies per wave
        this.maxActiveEnemies = Math.min(500, baseMaxEnemies + timeBonus + waveBonus); // Cap at 500 for performance
        
        console.log(`REBALANCED: Time ${timeMinutes.toFixed(1)}min, Wave ${this.currentWave}, Difficulty ${this.difficultyMultiplier.toFixed(2)}x, Spawn Rate ${this.spawnRate.toFixed(1)}/s, Max Enemies ${this.maxActiveEnemies}`);
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
        // REBALANCED: Scale number of enemies per spawn based on difficulty for swarm encounters
        const baseSpawnCount = Math.min(1 + Math.floor(this.difficultyMultiplier / 2), 8); // Up to 8 enemies per spawn (was 3)
        
        // Additional swarm bonus after 5 minutes for epic battles
        const timeMinutes = this.game.gameTime / 60;
        const swarmBonus = timeMinutes > 5 ? Math.floor((timeMinutes - 5) / 2) : 0; // +1 enemy per spawn every 2 minutes after 5min
        
        const spawnCount = Math.min(baseSpawnCount + swarmBonus, 12); // Cap at 12 enemies per spawn for epic swarms
        
        for (let i = 0; i < spawnCount; i++) {
            this.spawnSingleEnemy();
        }
        
        // Debug logging for balance testing
        if (this.game.gameTime > 240) { // After 4 minutes
            console.log(`SWARM: Spawning ${spawnCount} enemies (base: ${baseSpawnCount}, swarm bonus: ${swarmBonus})`);
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
            
            const distanceSquared = MathUtils.distanceSquared(
                enemy.x, enemy.y, x, y
            );
            
            if (distanceSquared <= rangeSquared) {
                result.push(enemy);
            }
        }
        
        return result;
    }
    
    getNearbyEnemies(x, y, range) {
        // OPTIMIZED: Use centralized CollisionSystem for spatial queries
        if (!this.game.systems.collision) {
            // Fallback to linear search if collision system not available
            return this.getEnemiesInRange(x, y, range);
        }
        
        // Filter to only return enemy entities
        return this.game.systems.collision.getEntitiesInRadius(x, y, range, entity => {
            // Check if this entity is an enemy from our active enemies list
            return this.activeEnemies.includes(entity) && entity.active;
        });
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
        
        // Return squared distance for performance using MathUtils
        const distanceSquared = MathUtils.distanceSquared(
            enemy.x, enemy.y, this.game.player.x, this.game.player.y
        );
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
    }
}