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
        this.maxActiveEnemies = 300; // Increased from 150 for more chaos
        
        // Spawning configuration - ULTRA AGGRESSIVE
        this.spawnRate = 5.0; // Starting enemies per second (was 3.0) - MUCH MORE
        this.spawnTimer = 0;
        this.spawnDistance = 300; // Even closer spawn for maximum pressure (was 350)
        this.despawnDistance = 600; // Distance at which to despawn enemies
        
        // Wave system - RAPID WAVES
        this.currentWave = 1;
        this.waveTimer = 0;
        this.waveDuration = 30; // 30 seconds per wave (was 45) - FASTER PROGRESSION
        this.waveProgress = 0;
        
        // Difficulty scaling - EXTREME
        this.difficultyMultiplier = 1.0;
        this.eliteSpawnChance = 0.15; // 15% chance for elite enemies (was 8%) - MORE ELITES
        
        // Spawn patterns
        this.spawnPatterns = {
            random: this.spawnRandomPattern.bind(this),
            circle: this.spawnCirclePattern.bind(this),
            cluster: this.spawnClusterPattern.bind(this),
            line: this.spawnLinePattern.bind(this),
            swarm: this.spawnSwarmPattern.bind(this) // New pattern for overwhelming moments
        };
        this.currentPattern = 'random';
        
        // Pressure surge system - NEW
        this.surgeSpawnMultiplier = 1.0;
        this.surgeEliteBonus = 0;
        this.pressureSurgeTimer = 0;
        this.pressureSurgeActive = false;
        this.nextSurgeTime = 120; // First surge at 2 minutes
        
        // Enemy type configurations - EARLIER INTRODUCTION
        this.enemyTypes = {
            basic: { weight: 30, minWave: 1 },
            fast: { weight: 25, minWave: 1 },  // Available from start (was wave 2)
            tank: { weight: 20, minWave: 2 },  // Earlier (was wave 3)
            ranged: { weight: 15, minWave: 2 }, // Earlier (was wave 4)
            wraith: { weight: 10, minWave: 3 }, // Earlier (was wave 5)
            demon: { weight: 12, minWave: 4 },  // Earlier (was wave 6)
            elite: { weight: 8, minWave: 5 },   // Earlier (was wave 7)
            berserker: { weight: 5, minWave: 6 },
            summoner: { weight: 3, minWave: 7 },
            juggernaut: { weight: 2, minWave: 8 }
        };
        
        // Dynamic difficulty adjustment - NEW
        this.performanceTracking = {
            playerHealthAverage: 100,
            timeSinceLastDamage: 0,
            complacencyMultiplier: 1.0
        };
        
        // OPTIMIZED: Removed redundant spatial grid - now using centralized CollisionSystem
        // Pre-allocated structures for performance
        this.tempEnemyArray = new Array(500); // Increased for more enemies
        this.nearbyResults = new Array(100);   // Increased for dense swarms
        
        this.initializePools();
    }
    
    initializePools() {
        // Pre-create LARGER enemy pools for 1000 enemy support
        const poolSizes = {
            basic: 200,     // Increased from 50 - most common enemy
            fast: 150,      // Increased from 30 - second most common
            tank: 100,      // Increased from 20
            ranged: 100,    // Increased from 25
            wraith: 50,     // Increased from 15
            demon: 50,      // Increased from 15
            elite: 40,      // Increased from 10
            berserker: 30,  // Increased from 8
            summoner: 20,   // Increased from 6
            juggernaut: 10  // Increased from 4 - rare enemy
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
        // AGGRESSIVE difficulty scaling for engaging gameplay
        if (!this.game || typeof this.game.gameTime !== 'number') {
            this.difficultyMultiplier = 1.0;
            return;
        }
        
        const cappedGameTime = Math.min(this.game.gameTime, 7200); // Max 2 hours
        const cappedWave = Math.min(this.currentWave, 100); // Max wave 100
        const timeMinutes = cappedGameTime / 60;
        
        // MORE AGGRESSIVE time scaling
        let timeMultiplier;
        if (timeMinutes <= 2) {
            // First 2 minutes: Gentle (builds confidence)
            timeMultiplier = 1.0 + (timeMinutes * 0.25); // 25% increase per minute
        } else if (timeMinutes <= 8) {
            // Minutes 2-8: Aggressive ramp-up
            const earlyMultiplier = 1.5; // Value at 2 minutes
            const midGameMinutes = timeMinutes - 2;
            timeMultiplier = earlyMultiplier * Math.pow(1.35, midGameMinutes); // 35% per minute!
        } else {
            // Minutes 8+: Still challenging but sustainable
            const midGameMultiplier = 1.5 * Math.pow(1.35, 6); // Value at 8 minutes
            const lateGameMinutes = timeMinutes - 8;
            timeMultiplier = midGameMultiplier * Math.pow(1.15, lateGameMinutes); // 15% per minute
        }
        
        // MORE AGGRESSIVE wave scaling
        const waveMultiplier = Math.pow(1.12, Math.min(cappedWave - 1, 20)) * // 12% per wave (was 8%)
                              Math.pow(1.08, Math.max(0, cappedWave - 20)); // 8% after wave 20
        
        const rawMultiplier = timeMultiplier * waveMultiplier;
        
        // Apply dynamic performance adjustment
        this.updatePerformanceTracking();
        const adjustedMultiplier = rawMultiplier * this.performanceTracking.complacencyMultiplier;
        
        if (isFinite(adjustedMultiplier) && adjustedMultiplier > 0) {
            this.difficultyMultiplier = Math.min(adjustedMultiplier, 500.0); // Increased cap
        } else {
            this.difficultyMultiplier = Math.min(this.difficultyMultiplier * 1.15, 50.0);
        }
        
        // HYPER AGGRESSIVE spawn rates
        let baseSpawnRate = 5.0; // Starting at 5 (was 3) - MUCH MORE INTENSE
        let rawSpawnRate;
        
        if (timeMinutes <= 1) {
            // First minute: Ramping up quickly
            rawSpawnRate = baseSpawnRate + (this.difficultyMultiplier - 1) * 1.0;
        } else if (timeMinutes <= 3) {
            // Early-mid game: Aggressive growth
            rawSpawnRate = baseSpawnRate + Math.pow(this.difficultyMultiplier - 1, 0.6) * 4.0;
        } else if (timeMinutes <= 5) {
            // Mid game: Very rapid growth
            rawSpawnRate = baseSpawnRate + Math.pow(this.difficultyMultiplier - 1, 0.5) * 6.0;
        } else {
            // Late game: ABSOLUTE CHAOS
            rawSpawnRate = baseSpawnRate + Math.pow(this.difficultyMultiplier - 1, 0.4) * 8.0;
        }
        
        // Apply pressure surge multiplier
        if (this.pressureSurgeActive) {
            rawSpawnRate *= 4.0; // Quadruple spawn rate during surges!
        }
        
        // Much higher spawn rate cap for insane late game
        if (isFinite(rawSpawnRate) && rawSpawnRate > 0) {
            this.spawnRate = Math.min(rawSpawnRate, this.pressureSurgeActive ? 80.0 : 50.0);
        } else {
            this.spawnRate = baseSpawnRate;
        }
        
        // Update elite spawn chance more aggressively
        this.updateEliteSpawnRate();
        
        // Much higher enemy caps for epic battles
        const baseMaxEnemies = 300; // Start higher (was 150)
        const timeBonus = Math.floor(timeMinutes * 50); // +50 per minute (was 25)
        const waveBonus = (cappedWave - 1) * 10; // +10 per wave (was 5)
        this.maxActiveEnemies = Math.min(1000, baseMaxEnemies + timeBonus + waveBonus); // Cap at 1000!
        
        // Check for pressure surge activation
        this.updatePressureSurge();
        
        console.log(`AGGRESSIVE: Time ${timeMinutes.toFixed(1)}min, Wave ${this.currentWave}, ` +
                   `Difficulty ${this.difficultyMultiplier.toFixed(2)}x, Spawn ${this.spawnRate.toFixed(1)}/s, ` +
                   `Max ${this.maxActiveEnemies}, Surge: ${this.pressureSurgeActive}`);
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

    updatePerformanceTracking() {
        // Track player performance for dynamic difficulty
        if (!this.game.player) return;
        
        const player = this.game.player;
        const healthPercent = player.health / player.maxHealth;
        
        // Update health average (smoothed over time)
        this.performanceTracking.playerHealthAverage = 
            this.performanceTracking.playerHealthAverage * 0.95 + healthPercent * 0.05;
        
        // Track time since last damage
        if (player.health < player.maxHealth) {
            this.performanceTracking.timeSinceLastDamage = 0;
        } else {
            this.performanceTracking.timeSinceLastDamage += 0.016; // Assume 60fps
        }
        
        // Calculate complacency multiplier - punish players who are too comfortable
        if (this.performanceTracking.playerHealthAverage > 0.7 && 
            this.performanceTracking.timeSinceLastDamage > 60) {
            // Player has been above 70% health for over 60 seconds - increase difficulty!
            this.performanceTracking.complacencyMultiplier = 1.5;
            console.log('⚠️ Player too comfortable - increasing difficulty!');
        } else if (this.performanceTracking.playerHealthAverage < 0.25) {
            // Player struggling - slight mercy
            this.performanceTracking.complacencyMultiplier = 0.8;
        } else {
            // Normal difficulty
            this.performanceTracking.complacencyMultiplier = 1.0;
        }
    }
    
    updatePressureSurge() {
        // Pressure surge system - MORE FREQUENT overwhelming moments
        const gameTime = this.game.gameTime || 0;
        
        // Check if it's time for a surge
        if (!this.pressureSurgeActive && gameTime >= this.nextSurgeTime) {
            // Activate INTENSE surge!
            this.pressureSurgeActive = true;
            this.pressureSurgeTimer = 20; // 20 second surge (was 30) - MORE INTENSE
            this.surgeEliteBonus = 0.25; // +25% elite spawn chance during surge (was 15%)
            
            // Schedule next surge MORE FREQUENTLY (every 60-90 seconds instead of 2-3 minutes)
            this.nextSurgeTime = gameTime + 60 + Math.random() * 30;
            
            console.log('🔥🔥🔥 PRESSURE SURGE ACTIVATED! SURVIVE THE HORDE!');
            
            // More intense visual feedback for surge
            if (this.game.camera) {
                this.game.camera.addShake(15, 0.8); // Stronger shake
                this.game.camera.flash('#FF0000', 0.3); // Red flash
            }
            
            // Spawn pattern changes to swarm during surge
            this.currentPattern = 'swarm';
        }
        
        // Update surge timer
        if (this.pressureSurgeActive) {
            this.pressureSurgeTimer -= 0.016; // Assume 60fps
            
            if (this.pressureSurgeTimer <= 0) {
                // End surge - SHORTER relief period
                this.pressureSurgeActive = false;
                this.surgeEliteBonus = 0;
                this.surgeSpawnMultiplier = 0.7; // Less relief (was 0.5)
                this.currentPattern = 'random'; // Back to normal pattern
                
                console.log('✅ Pressure surge survived! Quick breather...');
                
                // Shorter relief period (10 seconds instead of 15)
                setTimeout(() => {
                    this.surgeSpawnMultiplier = 1.0;
                }, 10000);
            }
        }
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
        
        // Calculate spawn position
        let x = player.x + Math.cos(angle) * this.spawnDistance;
        let y = player.y + Math.sin(angle) * this.spawnDistance;
        
        // Clamp to world boundaries from TerrainSystem
        const worldBounds = this.game.systems.terrain?.worldBounds || { left: -2000, right: 2000, top: -2000, bottom: 2000 };
        x = Math.max(worldBounds.left + 150, Math.min(worldBounds.right - 150, x));
        y = Math.max(worldBounds.top + 150, Math.min(worldBounds.bottom - 150, y));
        
        // Validate coordinates are finite
        if (!isFinite(x) || !isFinite(y)) {
            console.warn('Invalid spawn coordinates detected, using fallback');
            return {
                x: player.x + (Math.random() - 0.5) * 400,
                y: player.y + (Math.random() - 0.5) * 400
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
        
        // Calculate spawn position
        let x = player.x + Math.cos(angle) * distance;
        let y = player.y + Math.sin(angle) * distance;
        
        // Clamp to world boundaries from TerrainSystem
        const worldBounds = this.game.systems.terrain?.worldBounds || { left: -2000, right: 2000, top: -2000, bottom: 2000 };
        x = Math.max(worldBounds.left + 150, Math.min(worldBounds.right - 150, x));
        y = Math.max(worldBounds.top + 150, Math.min(worldBounds.bottom - 150, y));
        
        // Validate coordinates are finite
        if (!isFinite(x) || !isFinite(y)) {
            console.warn('Invalid circle spawn coordinates detected, using fallback');
            return {
                x: player.x + (Math.random() - 0.5) * 400,
                y: player.y + (Math.random() - 0.5) * 400
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

    spawnSwarmPattern(enemyType) {
        const player = this.game.player;
        
        // Swarm pattern - spawns many enemies from one direction for overwhelming moments
        const swarmAngle = Math.random() * Math.PI * 2;
        const swarmSpread = Math.PI / 3; // 60 degree spread
        
        // Random angle within the swarm spread
        const angleVariance = (Math.random() - 0.5) * swarmSpread;
        const finalAngle = swarmAngle + angleVariance;
        
        // Vary the distance for depth
        const distanceVariance = this.spawnDistance + (Math.random() - 0.5) * 100;
        
        const x = player.x + Math.cos(finalAngle) * distanceVariance;
        const y = player.y + Math.sin(finalAngle) * distanceVariance;
        
        // Validate coordinates
        if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 1000000 || Math.abs(y) > 1000000) {
            console.warn('Invalid swarm spawn coordinates, using fallback');
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