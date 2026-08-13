import { Enemy } from '../entities/Enemy.js';
import { Wraith } from '../entities/enemies/Wraith.js';
import { Demon } from '../entities/enemies/Demon.js';
import { MathUtils } from '../utils/MathUtils.js';
import { managedSetTimeout } from '../core/TimerManager.js';

export class EnemySystem {
    constructor(game) {
        this.game = game;

        // Enemy pools for performance
        this.enemyPool = new Map(); // Pool by enemy type
        this.activeEnemies = [];
        this.maxActiveEnemies = 140;

        // Spawning configuration - tuned for earlier engagement
        this.spawnRate = 1.8; // Starting enemies per second — default mode should feel active immediately
        this.spawnTimer = 0;
        this.spawnDistance = 350; // Balanced spawn distance for visibility
        this.despawnDistance = 600; // Distance at which to despawn enemies

        // Wave system - tuned to reach real pressure sooner
        this.currentWave = 1;
        this.waveTimer = 0;
        this.waveDuration = 40; // Slightly shorter than before so the run escalates earlier
        this.waveProgress = 0;

        // Difficulty scaling - PROGRESSIVE CHALLENGE
        this.difficultyMultiplier = 1.0;
        this.eliteSpawnChance = 0.08; // 8% chance for elite enemies - rare but exciting

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
        this.nextSurgeTime = 150; // First surge at 2.5 minutes so the run does not stay sleepy for too long

        // Elite aura tracking (max 1 aura elite per wave, unlocked after wave 8)
        this.auraEliteThisWave = false;

        // Enemy type configurations - EARLIER INTRODUCTION
        this.enemyTypes = {
            basic: { weight: 30, minWave: 1 },
            fast: { weight: 25, minWave: 1 }, // Available from start (was wave 2)
            tank: { weight: 20, minWave: 2 }, // Earlier (was wave 3)
            ranged: { weight: 15, minWave: 2 }, // Earlier (was wave 4)
            wraith: { weight: 10, minWave: 3 }, // Earlier (was wave 5)
            demon: { weight: 12, minWave: 4 }, // Earlier (was wave 6)
            elite: { weight: 8, minWave: 5 }, // Earlier (was wave 7)
            berserker: { weight: 5, minWave: 6 },
            summoner: { weight: 3, minWave: 7 },
            juggernaut: { weight: 2, minWave: 8 }
        };

        // Dynamic difficulty adjustment - NEW
        this.performanceTracking = {
            playerHealthAverage: 1.0,
            timeSinceLastDamage: 0,
            complacencyMultiplier: 1.0
        };

        // Formation system
        this.formationEnabled = false;
        this.formationTimer = 0;
        this.formationCooldown = 0;
        this.formationWaveInterval = 5; // Every 5th wave triggers a formation
        this.formationTypes = ['pincer', 'encirclement', 'stampede', 'sniperRing'];
        this.activeFormation = null; // { type, enemies: [], glowTimer }

        // OPTIMIZED: Removed redundant spatial grid - now using centralized CollisionSystem
        // Pre-allocated structures for performance
        this.tempEnemyArray = new Array(320);
        this.nearbyResults = new Array(100); // Increased for dense swarms

        // Wave pacing — rest/rush rhythm
        this.waveType = this.getWaveType(this.currentWave); // 'rest', 'rush', or 'normal'
        this.enemySpeedMultiplier = 1.0;

        this.initializePools();
    }

    initializePools() {
        // Pre-create enemy pools sized for sustained swarms without front-loading too much memory
        const poolSizes = {
            basic: 100,
            fast: 80,
            tank: 45,
            ranged: 45,
            wraith: 24,
            demon: 20,
            elite: 18,
            berserker: 12,
            summoner: 8,
            juggernaut: 6
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
        this.updateDifficulty(dt);

        // Update spawning
        this.updateSpawning(dt);

        // Apply elite aura effects BEFORE enemy updates so auraBuffed is live during attack()
        this.applyAuraEffects(dt);

        // Update all active enemies
        this.updateEnemies(dt);

        // Clean up distant enemies
        this.cleanupDistantEnemies();

        // Update active formation
        if (this.activeFormation) {
            this.updateFormation(dt);
        }
    }

    updateDifficulty(dt) {
        // AGGRESSIVE difficulty scaling for engaging gameplay
        if (!this.game || typeof this.game.gameTime !== 'number') {
            this.difficultyMultiplier = 1.0;
            return;
        }

        const cappedGameTime = Math.min(this.game.gameTime, 7200); // Max 2 hours
        const cappedWave = Math.min(this.currentWave, 100); // Max wave 100
        const timeMinutes = cappedGameTime / 60;

        // BALANCED time scaling for engaging but fair progression
        let timeMultiplier;
        if (timeMinutes <= 3) {
            // First 3 minutes: Gradual warmup
            timeMultiplier = 1.0 + timeMinutes * 0.12; // 12% increase per minute
        } else if (timeMinutes <= 10) {
            // Minutes 3-10: Steady challenge increase
            const earlyMultiplier = 1.36; // Value at 3 minutes
            const midGameMinutes = timeMinutes - 3;
            timeMultiplier = earlyMultiplier * Math.pow(1.15, midGameMinutes); // 15% per minute
        } else {
            // Minutes 10+: Sustainable endgame challenge
            const midGameMultiplier = 1.36 * Math.pow(1.15, 7); // Value at 10 minutes
            const lateGameMinutes = timeMinutes - 10;
            timeMultiplier = midGameMultiplier * Math.pow(1.08, lateGameMinutes); // 8% per minute
        }

        // BALANCED wave scaling
        const waveMultiplier =
            Math.pow(1.08, Math.min(cappedWave - 1, 20)) * // 8% per wave
            Math.pow(1.05, Math.max(0, cappedWave - 20)); // 5% after wave 20

        const rawMultiplier = timeMultiplier * waveMultiplier;

        // Apply dynamic performance adjustment
        this.updatePerformanceTracking(dt);
        const adjustedMultiplier = rawMultiplier * this.performanceTracking.complacencyMultiplier;

        if (isFinite(adjustedMultiplier) && adjustedMultiplier > 0) {
            this.difficultyMultiplier = Math.min(adjustedMultiplier, 500.0); // Increased cap
        } else {
            this.difficultyMultiplier = Math.min(this.difficultyMultiplier * 1.15, 50.0);
        }

        // Spawn rates tuned to create pressure earlier without relying on unfair damage spikes
        const baseSpawnRate = 1.75;
        let rawSpawnRate;

        if (timeMinutes <= 2) {
            rawSpawnRate = baseSpawnRate + (this.difficultyMultiplier - 1) * 0.7;
        } else if (timeMinutes <= 6) {
            rawSpawnRate = baseSpawnRate + Math.pow(this.difficultyMultiplier - 1, 0.7) * 1.6;
        } else if (timeMinutes <= 12) {
            rawSpawnRate = baseSpawnRate + Math.pow(this.difficultyMultiplier - 1, 0.6) * 2.0;
        } else {
            rawSpawnRate = baseSpawnRate + Math.pow(this.difficultyMultiplier - 1, 0.55) * 2.4;
        }

        if (this.pressureSurgeActive) {
            rawSpawnRate *= 1.4;
        }

        if (isFinite(rawSpawnRate) && rawSpawnRate > 0) {
            // Apply wave-type spawn multiplier
            const waveTypeMultiplier = this.waveType === 'rest' ? 0.65
                : this.waveType === 'rush' ? 1.75 : 1.0;
            rawSpawnRate *= waveTypeMultiplier;
            this.spawnRate = Math.min(rawSpawnRate, this.pressureSurgeActive ? 9.0 : 7.0);
        } else {
            this.spawnRate = baseSpawnRate;
        }

        // Update elite spawn chance more aggressively
        this.updateEliteSpawnRate();

        const baseMaxEnemies = 140;
        const timeBonus = Math.floor(timeMinutes * 10);
        const waveBonus = (cappedWave - 1) * 5;
        this.maxActiveEnemies = Math.min(320, baseMaxEnemies + timeBonus + waveBonus);

        this.updatePressureSurge(dt);

        // Debug: Gate difficulty logging behind showDebug flag
        if (this.game.showDebug) {
            console.log(
                `AGGRESSIVE: Time ${timeMinutes.toFixed(1)}min, Wave ${this.currentWave}, ` +
                    `Difficulty ${this.difficultyMultiplier.toFixed(2)}x, Spawn ${this.spawnRate.toFixed(1)}/s, ` +
                    `Max ${this.maxActiveEnemies}, Surge: ${this.pressureSurgeActive}`
            );
        }
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
            } else if (flowMetrics.stressLevel > 0.8) {
                // Player struggling - reduce slightly for breathing room
                baseRate *= 0.7;
            }
        }

        // Combo-based scaling for skilled players
        if (this.game.player && this.game.player.combo) {
            const comboBonus = Math.min(this.game.player.combo.count / 60, 1.0);
            baseRate *= 1 + comboBonus;
        }

        baseRate += this.surgeEliteBonus;
        this.eliteSpawnChance = Math.min(baseRate, 0.25);
    }

    updatePerformanceTracking(dt) {
        // Track player performance for dynamic difficulty
        if (!this.game.player) return;

        const safeDt = Math.max(0, dt || 0);

        const player = this.game.player;
        const healthPercent = player.health / player.maxHealth;

        // Update health average (smoothed over time)
        this.performanceTracking.playerHealthAverage =
            this.performanceTracking.playerHealthAverage * 0.95 + healthPercent * 0.05;

        // Track time since last damage
        if (player.health < player.maxHealth) {
            this.performanceTracking.timeSinceLastDamage = 0;
        } else {
            this.performanceTracking.timeSinceLastDamage += safeDt;
        }

        // Calculate complacency multiplier - punish players who are too comfortable
        if (this.performanceTracking.playerHealthAverage > 0.7 && this.performanceTracking.timeSinceLastDamage > 60) {
            // Player has been above 70% health for over 60 seconds - increase difficulty!
            this.performanceTracking.complacencyMultiplier = 1.5;
        } else if (this.performanceTracking.playerHealthAverage < 0.25) {
            // Player struggling - slight mercy
            this.performanceTracking.complacencyMultiplier = 0.8;
        } else {
            // Normal difficulty
            this.performanceTracking.complacencyMultiplier = 1.0;
        }
    }

    updatePressureSurge(dt) {
        const gameTime = this.game.gameTime || 0;
        const safeDt = Math.max(0, dt || 0);

        if (!this.pressureSurgeActive && gameTime >= this.nextSurgeTime) {
            this.pressureSurgeActive = true;
            this.pressureSurgeTimer = 12;
            this.surgeEliteBonus = 0.12;

            this.nextSurgeTime = gameTime + 90 + Math.random() * 30;

            if (this.game.camera && typeof this.game.camera.shake === 'function') {
                this.game.camera.shake(10, 0.6);
                if (typeof this.game.camera.flash === 'function') {
                    this.game.camera.flash('#FF0000', 0.2);
                }
            }

            this.currentPattern = 'swarm';
        }

        if (this.pressureSurgeActive) {
            this.pressureSurgeTimer -= safeDt;

            if (this.pressureSurgeTimer <= 0) {
                this.pressureSurgeActive = false;
                this.surgeEliteBonus = 0;
                this.surgeSpawnMultiplier = 0.85;
                this.currentPattern = 'random';

                managedSetTimeout(
                    () => {
                        this.surgeSpawnMultiplier = 1.0;
                    },
                    8000,
                    this
                );
            }
        }
    }

    updateSpawning(dt) {
        if (!this.game.player || !this.game.player.isAlive()) return;

        const challengeMult = this.spawnRateMultiplier || 1.0;
        let effectiveSpawnRate = this.spawnRate * this.surgeSpawnMultiplier * this.getSpawnThrottle() * challengeMult;
        effectiveSpawnRate = Math.max(0.5, effectiveSpawnRate);

        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnTimer = 1.0 / effectiveSpawnRate;
            this.spawnEnemyWave();
        }
    }

    getSpawnThrottle() {
        let throttle = 1.0;
        const density = this.activeEnemies.length / Math.max(this.maxActiveEnemies, 1);

        if (density >= 0.95) {
            throttle *= 0.2;
        } else if (density >= 0.85) {
            throttle *= 0.35;
        } else if (density >= 0.7) {
            throttle *= 0.6;
        }

        const fps = this.game.performanceStats?.fps;
        if (typeof fps === 'number' && fps > 0) {
            if (fps < 45) {
                throttle *= 0.45;
            } else if (fps < 52) {
                throttle *= 0.7;
            }
        }

        return Math.max(0.2, throttle);
    }

    spawnEnemyWave() {
        const timeMinutes = this.game.gameTime / 60;
        const difficultyBonus = Math.min(Math.floor(Math.max(0, this.difficultyMultiplier - 1) / 3), 2);
        const earlyPressureBonus = this.currentWave >= 2 ? 1 : 0;
        const waveBonus = this.currentWave >= 5 ? 1 : 0;
        const timeBonus = timeMinutes >= 6 ? Math.min(1 + Math.floor((timeMinutes - 6) / 5), 2) : 0;
        const surgeBonus = this.pressureSurgeActive ? 1 : 0;
        const availableSlots = Math.max(0, this.maxActiveEnemies - this.activeEnemies.length);
        const spawnCount = Math.min(
            1 + earlyPressureBonus + waveBonus + difficultyBonus + timeBonus + surgeBonus,
            6,
            availableSlots
        );

        if (spawnCount <= 0) return;

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

        // Nudge spawn position if it overlaps an obstacle
        if (this.game.systems.terrain && !this.game.systems.terrain.isPositionValid(spawnPos.x, spawnPos.y, 20)) {
            // Try a few offset positions
            const offsets = [
                { x: 50, y: 0 },
                { x: -50, y: 0 },
                { x: 0, y: 50 },
                { x: 0, y: -50 }
            ];
            let nudged = false;
            for (const off of offsets) {
                const nx = spawnPos.x + off.x;
                const ny = spawnPos.y + off.y;
                if (this.game.systems.terrain.isPositionValid(nx, ny, 20)) {
                    spawnPos.x = nx;
                    spawnPos.y = ny;
                    nudged = true;
                    break;
                }
            }
            if (!nudged) return; // Skip this spawn if no valid position found
        }

        // Get enemy from pool
        const enemy = this.getEnemyFromPool(enemyType);
        if (!enemy) return;

        // Initialize enemy
        enemy.reset(spawnPos.x, spawnPos.y, enemyType);

        // Elite Aura: after wave 8, 15% chance this elite becomes an aura carrier (max 1/wave)
        if (
            enemyType === 'elite' &&
            this.currentWave >= 8 &&
            !this.auraEliteThisWave &&
            Math.random() < 0.15
        ) {
            const auraTypes = ['warchief', 'lifebinder', 'frostlord', 'void_herald'];
            enemy.setAura(auraTypes[Math.floor(Math.random() * auraTypes.length)]);
            this.auraEliteThisWave = true;
        }

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
        if (this.currentPattern === 'swarm' || this.pressureSurgeActive) return 'swarm';

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
        const worldBounds = this.game.systems.terrain?.worldBounds || {
            left: -2000,
            right: 2000,
            top: -2000,
            bottom: 2000
        };
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
        const randomOffset = ((Math.random() - 0.5) * Math.PI) / 4; // ±45 degrees
        const angle = baseAngle + randomOffset;

        const distance = this.spawnDistance + (Math.random() - 0.5) * 100;

        // Calculate spawn position
        let x = player.x + Math.cos(angle) * distance;
        let y = player.y + Math.sin(angle) * distance;

        // Clamp to world boundaries from TerrainSystem
        const worldBounds = this.game.systems.terrain?.worldBounds || {
            left: -2000,
            right: 2000,
            top: -2000,
            bottom: 2000
        };
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
        if (pool && pool.length < 50) {
            // Don't let pools grow too large
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
        const wasPerfectWave = this.game.player && this.game.player.streaks.noDamage >= this.waveDuration;

        // Track wave completion for achievements
        if (this.game.systems.achievement) {
            this.game.systems.achievement.onWaveCompleted(this.currentWave, wasPerfectWave);
        }

        this.currentWave++;
        this.waveTimer = 0;
        this.waveProgress = 0;
        this.auraEliteThisWave = false; // allow one new aura elite in the new wave

        // Wave pacing — set type and duration for this wave
        this.waveType = this.getWaveType(this.currentWave);
        if (this.waveType === 'rest') {
            this.waveDuration = 30; // shorter breather
            this.enemySpeedMultiplier = 0.8; // enemies slower during rest
        } else if (this.waveType === 'rush') {
            this.waveDuration = 35; // slightly shorter, intense
            this.enemySpeedMultiplier = 1.15; // enemies faster during rush
        } else {
            this.waveDuration = 40; // standard waves resolve sooner so challenge arrives earlier
            this.enemySpeedMultiplier = 1.0;
        }

        // Check for formation wave
        if (this.currentWave % this.formationWaveInterval === 0) {
            this.triggerFormation();
        }

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
            managedSetTimeout(
                () => {
                    this.spawnBoss();
                },
                i * 1000,
                this
            ); // 1 second delay between bosses
        }
    }

    spawnBoss() {
        if (this.activeEnemies.length >= this.maxActiveEnemies) return;

        const player = this.game.player;
        const angle = Math.random() * Math.PI * 2;
        const distance = this.spawnDistance * 1.5; // Spawn bosses further away

        const enemy = this.getEnemyFromPool('elite');
        if (!enemy) return;

        const x = player.x + Math.cos(angle) * distance;
        const y = player.y + Math.sin(angle) * distance;

        enemy.reset(x, y, 'elite');

        // Boss buffs
        const bonusWaveCount = Math.max(0, this.currentWave - 5);
        const healthMultiplier = 3 + Math.min(bonusWaveCount * 0.15, 1.5);
        const damageMultiplier = 1.75 + Math.min(bonusWaveCount * 0.05, 0.5);
        enemy.maxHealth = Math.floor(enemy.maxHealth * healthMultiplier);
        enemy.health = enemy.maxHealth;
        enemy.damage = Math.floor(enemy.damage * damageMultiplier);
        enemy.expReward *= 4;

        this.activeEnemies.push(enemy);

        // Visual effect
        this.game.systems.particle.createBossSpawnEffect(x, y);
        if (this.game && this.game.camera && typeof this.game.camera.shake === 'function') {
            this.game.camera.shake(5, 1.0);
        }
    }

    /**
     * Returns wave type for pacing rhythm once the run is established.
     * Early waves stay normal on purpose so normal mode ramps into pressure
     * instead of immediately alternating between rest/rush gimmicks.
     */
    getWaveType(waveNumber) {
        if (waveNumber <= 5) return 'normal';
        const mod = waveNumber % 5;
        if (mod === 3) return 'rest';   // Waves 8, 13, 18...
        if (mod === 4) return 'rush';   // Waves 9, 14, 19...
        return 'normal';
    }

    // Query methods for other systems
    getActiveEnemies() {
        return this.activeEnemies.filter((enemy) => enemy.active);
    }

    getEnemiesInRange(x, y, range) {
        const result = [];
        const rangeSquared = range * range;

        for (const enemy of this.activeEnemies) {
            if (!enemy.active) continue;

            const distanceSquared = MathUtils.distanceSquared(enemy.x, enemy.y, x, y);

            if (distanceSquared <= rangeSquared) {
                result.push(enemy);
            }
        }

        return result;
    }

    getNearbyEnemies(x, y, range) {
        return this.getEnemiesInRange(x, y, range);
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
        const distanceSquared = MathUtils.distanceSquared(enemy.x, enemy.y, this.game.player.x, this.game.player.y);
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
        const fps = this.game.performanceStats?.fps || 60;
        let renderDetail = 'high';

        if (this.activeEnemies.length > 120 || fps < 50) {
            renderDetail = 'low';
        } else if (this.activeEnemies.length > 70 || fps < 58) {
            renderDetail = 'medium';
        }

        for (const enemy of this.activeEnemies) {
            if (enemy.active) {
                enemy.render(renderer, renderDetail);
            }
        }

        // Render formation glow rings on top of enemies
        this.renderFormationGlow(renderer);
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

    // Formation system methods

    triggerFormation() {
        // Don't stack formations
        if (this.activeFormation) return;

        const availableSlots = Math.max(0, this.maxActiveEnemies - this.activeEnemies.length);
        if (availableSlots < 4) return;

        const type = this.formationTypes[Math.floor(Math.random() * this.formationTypes.length)];
        const count = Math.min(8 + Math.floor(this.difficultyMultiplier), 12, availableSlots);

        this.activeFormation = { type, enemies: [], glowTimer: 3.0 };

        // Camera shake to announce formation
        if (this.game.camera && typeof this.game.camera.shake === 'function') {
            this.game.camera.shake(10, 0.6);
        }

        // Dispatch to specific formation spawner
        switch (type) {
            case 'pincer':
                this.spawnPincerFormation(count);
                break;
            case 'encirclement':
                this.spawnEncirclementFormation(count);
                break;
            case 'stampede':
                this.spawnStampedeFormation(count);
                break;
            case 'sniperRing':
                this.spawnSniperRingFormation(count);
                break;
        }
    }

    spawnPincerFormation(count) {
        const player = this.game.player;
        if (!player) return;

        const baseAngle = Math.random() * Math.PI * 2;
        const half = Math.floor(count / 2);

        for (let i = 0; i < count; i++) {
            // First half on one side, second half on opposite side
            const angle = i < half ? baseAngle : baseAngle + Math.PI;
            const spread = (Math.random() - 0.5) * (Math.PI / 6);
            const finalAngle = angle + spread;
            const distance = 400 + Math.random() * 100;

            const x = player.x + Math.cos(finalAngle) * distance;
            const y = player.y + Math.sin(finalAngle) * distance;

            const enemyType = this.chooseEnemyType();
            const enemy = this.getEnemyFromPool(enemyType);
            if (!enemy) continue;

            enemy.reset(x, y, enemyType);
            enemy.formationGlow = 3.0;
            this.activeEnemies.push(enemy);
            this.activeFormation.enemies.push(enemy);
        }
    }

    spawnEncirclementFormation(count) {
        const player = this.game.player;
        if (!player) return;

        const radius = 350;
        const angleStep = (Math.PI * 2) / count;

        for (let i = 0; i < count; i++) {
            const angle = angleStep * i;
            const x = player.x + Math.cos(angle) * radius;
            const y = player.y + Math.sin(angle) * radius;

            const enemyType = this.chooseEnemyType();
            const enemy = this.getEnemyFromPool(enemyType);
            if (!enemy) continue;

            enemy.reset(x, y, enemyType);
            enemy.formationGlow = 3.0;
            this.activeEnemies.push(enemy);
            this.activeFormation.enemies.push(enemy);
        }
    }

    spawnStampedeFormation(count) {
        const player = this.game.player;
        if (!player) return;

        const baseAngle = Math.random() * Math.PI * 2;
        const arcSpread = Math.PI / 3; // 60 degree arc
        const distance = 450;

        for (let i = 0; i < count; i++) {
            const spread = (i / (count - 1) - 0.5) * arcSpread;
            const angle = baseAngle + spread;
            const x = player.x + Math.cos(angle) * distance;
            const y = player.y + Math.sin(angle) * distance;

            const enemy = this.getEnemyFromPool('fast');
            if (!enemy) continue;

            enemy.reset(x, y, 'fast');
            enemy.formationGlow = 3.0;
            this.activeEnemies.push(enemy);
            this.activeFormation.enemies.push(enemy);
        }
    }

    spawnSniperRingFormation(count) {
        const player = this.game.player;
        if (!player) return;

        const radius = 500;
        const angleStep = (Math.PI * 2) / count;

        for (let i = 0; i < count; i++) {
            const angle = angleStep * i;
            const x = player.x + Math.cos(angle) * radius;
            const y = player.y + Math.sin(angle) * radius;

            const enemy = this.getEnemyFromPool('ranged');
            if (!enemy) continue;

            enemy.reset(x, y, 'ranged');
            enemy.formationGlow = 3.0;
            enemy.formationStationary = true;
            this.activeEnemies.push(enemy);
            this.activeFormation.enemies.push(enemy);
        }
    }

    updateFormation(dt) {
        if (!this.activeFormation) return;

        // Decay the formation announcement glow timer
        this.activeFormation.glowTimer -= dt;

        // Update per-enemy glow timers and handle stationary enemies
        for (const enemy of this.activeFormation.enemies) {
            if (!enemy.active) continue;

            if (enemy.formationGlow > 0) {
                enemy.formationGlow -= dt;
            }

            // Keep sniperRing enemies stationary
            if (enemy.formationStationary && this.activeFormation.type === 'sniperRing') {
                enemy.vx = 0;
                enemy.vy = 0;
            }
        }

        // Remove dead enemies from formation list
        this.activeFormation.enemies = this.activeFormation.enemies.filter((e) => e.active);

        // Clear formation when all enemies are dead or 10s max lifetime exceeded
        const maxLifetime = 10;
        const expired = this.activeFormation.glowTimer <= -(maxLifetime - 3.0); // glowTimer starts at 3.0
        if (this.activeFormation.enemies.length === 0 || expired) {
            this.activeFormation = null;
        }
    }

    renderFormationGlow(renderer) {
        if (!this.activeFormation) return;

        const ctx = renderer.ctx;
        if (!ctx) return;

        const formationColors = {
            pincer: '#FF8800',
            encirclement: '#AA00FF',
            stampede: '#FF2200',
            sniperRing: '#00FFFF'
        };

        const color = formationColors[this.activeFormation.type] || '#FFFFFF';

        for (const enemy of this.activeFormation.enemies) {
            if (!enemy.active || !enemy.formationGlow || enemy.formationGlow <= 0) continue;

            const alpha = Math.min(enemy.formationGlow / 3.0, 1.0) * 0.7;
            // Pulsing radius driven by time
            const pulse = 1.0 + 0.25 * Math.sin(performance.now() * 0.006);
            const ringRadius = (enemy.size || 16) * 1.5 * pulse;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;

            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, ringRadius, 0, Math.PI * 2);
            ctx.stroke();

            ctx.restore();
        }
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
        this.activeFormation = null;
        this.formationTimer = 0;
        this.formationCooldown = 0;
        this.auraEliteThisWave = false;
        this.waveType = 'normal';
        this.enemySpeedMultiplier = 1.0;
        this.waveDuration = 40;
    }

    /**
     * Each frame: iterate aura-carrying elites and apply their zone effects to
     * nearby enemies / the player. Called from update() after updateEnemies().
     */
    applyAuraEffects(dt) {
        const player = this.game.player;

        // Reset all per-frame aura buff flags before re-applying this frame's buffs
        for (const e of this.activeEnemies) e.auraBuffed = false;

        for (const elite of this.activeEnemies) {
            if (!elite.active || !elite.auraType) continue;

            const r  = elite.auraRadius || 150;
            const rSq = r * r;

            switch (elite.auraType) {

                case 'warchief':
                    // +30% damage to all non-aura enemies within radius
                    for (const e of this.activeEnemies) {
                        if (!e.active || e === elite) continue;
                        const dx = e.x - elite.x, dy = e.y - elite.y;
                        if (dx * dx + dy * dy <= rSq) e.auraBuffed = true;
                    }
                    break;

                case 'lifebinder':
                    // Heal nearby enemies 5 HP/s
                    for (const e of this.activeEnemies) {
                        if (!e.active || e === elite || e.auraType) continue;
                        const dx = e.x - elite.x, dy = e.y - elite.y;
                        if (dx * dx + dy * dy <= rSq) {
                            e.health = Math.min(e.maxHealth, e.health + 5 * dt);
                        }
                    }
                    break;

                case 'frostlord':
                    // Slow player by 15% when within radius
                    if (player && player.isAlive()) {
                        const dx = player.x - elite.x, dy = player.y - elite.y;
                        if (dx * dx + dy * dy <= rSq) {
                            // Dampen velocity (applied once per frame — feels like sticky mud)
                            if (player.velocity) {
                                player.velocity.x *= 0.85;
                                player.velocity.y *= 0.85;
                            }
                        }
                    }
                    break;

                case 'void_herald':
                    // Spawn 2 fast shadow clone enemies every 8 seconds
                    elite.auraTimer = (elite.auraTimer || 0) + dt;
                    if (elite.auraTimer >= 8.0) {
                        elite.auraTimer = 0;
                        for (let c = 0; c < 2; c++) {
                            if (this.activeEnemies.length < this.maxActiveEnemies) {
                                const a  = Math.random() * Math.PI * 2;
                                const cx = elite.x + Math.cos(a) * 60;
                                const cy = elite.y + Math.sin(a) * 60;
                                const clone = this.getEnemyFromPool('fast');
                                if (clone) {
                                    clone.reset(cx, cy, 'fast');
                                    clone.color = '#CC44FF';
                                    // Clones have reduced HP
                                    clone.maxHealth = Math.round(clone.maxHealth * 0.5);
                                    clone.health    = clone.maxHealth;
                                    this.activeEnemies.push(clone);
                                }
                            }
                        }
                        // Purple flash at herald position
                        if (this.game.systems.particle) {
                            for (let i = 0; i < 10; i++) {
                                const a = (i / 10) * Math.PI * 2;
                                this.game.systems.particle.create(elite.x, elite.y, {
                                    vx: Math.cos(a) * 80, vy: Math.sin(a) * 80,
                                    life: 0.4, size: 3, color: '#CC44FF', fadeOut: true
                                });
                            }
                        }
                    }
                    break;
            }
        }
    }
}
