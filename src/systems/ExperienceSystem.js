import { ExperienceGem } from '../entities/ExperienceGem.js';

export class ExperienceSystem {
    constructor(game) {
        this.game = game;
        
        // Experience gem pools for performance
        this.gemPool = [];
        this.activeGems = [];
        this.maxActiveGems = 60; // Reduced for visual clarity
        
        // Collection mechanics - ENHANCED
        this.magnetRange = 120; // Base magnet range (was 80) - WIDER VACUUM
        this.autoCollectRange = 40; // Auto-collect when very close (was 25) - EASIER PICKUP
        
        // Gem spawn mechanics
        this.gemValues = {
            small: 5,
            medium: 15,
            large: 25,
            rare: 50
        };
        
        // Performance optimization
        this.spatialGrid = new Map();
        this.gridSize = 64;
        this.lastCleanupTime = 0;
        this.cleanupInterval = 2000; // Cleanup every 2 seconds
        
        // Global magnet timer (system-level). When > 0, all gems are pulled regardless of range
        this.globalMagnetTimer = 0;
        
        this.initializePool();
    }
    
    initializePool() {
        // Pre-create gem pool
        const poolSize = 100;
        
        for (let i = 0; i < poolSize; i++) {
            const gem = new ExperienceGem(this.game, 0, 0, 5);
            gem.active = false;
            this.gemPool.push(gem);
        }
    }
    
    update(dt) {
        // Update all active gems
        this.updateGems(dt);
        
        // Update spatial grid
        this.updateSpatialGrid();
        
        // Auto-collect nearby gems
        this.autoCollectGems();
        
        // Decrement global magnet timer
        if (this.globalMagnetTimer > 0) {
            this.globalMagnetTimer = Math.max(0, this.globalMagnetTimer - dt);
        }
        
        // Periodic cleanup
        const currentTime = performance.now();
        if (currentTime - this.lastCleanupTime > this.cleanupInterval) {
            this.cleanup();
            this.lastCleanupTime = currentTime;
        }
    }
    
    updateGems(dt) {
        for (let i = this.activeGems.length - 1; i >= 0; i--) {
            const gem = this.activeGems[i];
            
            if (!gem.active) {
                this.activeGems.splice(i, 1);
                this.returnGemToPool(gem);
                continue;
            }
            
            gem.update(dt);
        }
    }
    
    updateSpatialGrid() {
        // Clear grid
        this.spatialGrid.clear();
        
        // Add all active gems to grid
        for (const gem of this.activeGems) {
            if (!gem.active) continue;
            
            const gridX = Math.floor(gem.x / this.gridSize);
            const gridY = Math.floor(gem.y / this.gridSize);
            const key = `${gridX},${gridY}`;
            
            if (!this.spatialGrid.has(key)) {
                this.spatialGrid.set(key, []);
            }
            this.spatialGrid.get(key).push(gem);
        }
    }
    
    autoCollectGems() {
        if (!this.game.player || !this.game.player.isAlive()) return;
        
        const player = this.game.player;
        const effectiveMagnetRange = this.magnetRange * (player.stats.luck || 1);
        
        // Check gems near player for collection
        const nearbyGems = this.getGemsInRange(
            player.x, 
            player.y, 
            effectiveMagnetRange
        );
        
        for (const gem of nearbyGems) {
            const distanceSquared = this.getDistanceToPlayer(gem);
            
            // Auto-collect very close gems (compare squared distances)
            const autoCollectRangeSquared = this.autoCollectRange * this.autoCollectRange;
            if (distanceSquared <= autoCollectRangeSquared) {
                gem.collect();
            }
        }
    }
    
    createGem(x, y, value = null, type = null) {
        if (this.activeGems.length >= this.maxActiveGems) {
            // Remove oldest gem if at limit
            const oldest = this.activeGems.shift();
            if (oldest) {
                oldest.active = false;
                this.returnGemToPool(oldest);
            }
        }
        
        // Check for lucky gem (5% chance when no value is specified)
        let isLucky = false;
        if (value === null && Math.random() < 0.05) {
            isLucky = true;
            value = this.determineGemValue() * 5; // 5x experience
        } else if (value === null) {
            value = this.determineGemValue();
        }
        
        // Get gem from pool
        const gem = this.getGemFromPool();
        if (!gem) return null;
        
        // Initialize gem
        gem.reset(x, y, value);
        
        // Make it a lucky gem with special properties
        if (isLucky) {
            gem.isLucky = true;
            gem.color = '#FFD700'; // Gold color
            gem.size = Math.max(12, gem.size * 1.5); // Bigger
            gem.glowEffect = true;
            gem.pulseRate = 2.0; // Faster pulse
            
            // Enhanced visual effects for lucky gems
            if (this.game.systems.particle) {
                this.game.systems.particle.createLuckyGemSparkles(x, y);
            }
            
            // Enhanced camera shake
            if (this.game.camera) {
                this.game.camera.shakeLuckyGem();
            }
        }
        
        this.activeGems.push(gem);
        return gem;
    }
    
    determineGemValue() {
        // Random gem value based on probabilities
        const rand = Math.random();
        
        if (rand < 0.6) {
            return this.gemValues.small; // 60% chance
        } else if (rand < 0.85) {
            return this.gemValues.medium; // 25% chance
        } else if (rand < 0.98) {
            return this.gemValues.large; // 13% chance
        } else {
            return this.gemValues.rare; // 2% chance
        }
    }
    
    createMultipleGems(x, y, count, totalValue) {
        const baseValue = Math.floor(totalValue / count);
        const remainder = totalValue % count;
        
        for (let i = 0; i < count; i++) {
            // Spread gems in a small circle
            const angle = (i / count) * Math.PI * 2;
            const distance = 15 + Math.random() * 15;
            const gemX = x + Math.cos(angle) * distance;
            const gemY = y + Math.sin(angle) * distance;
            
            // Give some gems extra value from remainder
            const gemValue = baseValue + (i < remainder ? 1 : 0);
            
            this.createGem(gemX, gemY, gemValue);
        }
    }
    
    createBonusGem(x, y, multiplier = 2) {
        // Create a special bonus gem worth more experience
        const baseValue = this.determineGemValue();
        const bonusValue = Math.floor(baseValue * multiplier);
        
        const gem = this.createGem(x, y, bonusValue);
        if (gem) {
            // Special visual effects for bonus gems
            this.game.systems.particle.createBonusGemEffect(x, y, gem.color);
        }
        
        return gem;
    }
    
    createGemExplosion(x, y, totalValue, minGems = 3, maxGems = 8) {
        // Create an explosion of gems
        const gemCount = minGems + Math.floor(Math.random() * (maxGems - minGems + 1));
        const baseValue = Math.floor(totalValue / gemCount);
        
        for (let i = 0; i < gemCount; i++) {
            // Random explosion pattern
            const angle = Math.random() * Math.PI * 2;
            const distance = 20 + Math.random() * 40;
            const gemX = x + Math.cos(angle) * distance;
            const gemY = y + Math.sin(angle) * distance;
            
            // Randomize value slightly
            const variance = Math.floor(baseValue * 0.3);
            const gemValue = baseValue + Math.floor(Math.random() * variance * 2) - variance;
            
            const gem = this.createGem(gemX, gemY, Math.max(1, gemValue));
            
            if (gem) {
                // Add explosion velocity
                gem.velocity.x = Math.cos(angle) * (100 + Math.random() * 100);
                gem.velocity.y = Math.sin(angle) * (100 + Math.random() * 100) - 150;
            }
        }
        
        // Visual explosion effect
        this.game.systems.particle.createGemExplosionEffect(x, y);
    }
    
    getGemFromPool() {
        if (this.gemPool.length > 0) {
            return this.gemPool.pop();
        }
        
        // Create new gem if pool is empty
        return new ExperienceGem(this.game, 0, 0, 5);
    }
    
    returnGemToPool(gem) {
        if (!gem) return;
        
        // Reset gem state
        gem.active = false;
        gem.collected = false;
        
        // Return to pool if not full
        if (this.gemPool.length < 150) {
            this.gemPool.push(gem);
        }
    }
    
    cleanup() {
        // Remove inactive gems
        for (let i = this.activeGems.length - 1; i >= 0; i--) {
            const gem = this.activeGems[i];
            
            if (!gem.active) {
                this.activeGems.splice(i, 1);
                this.returnGemToPool(gem);
            }
        }
    }
    
    // Collection abilities
    collectAllGems() {
        // Collect all gems on screen (special ability)
        for (const gem of this.activeGems) {
            if (gem.active && !gem.collected) {
                gem.collect();
            }
        }
    }
    
    magnetizeAllGems() {
        // Force all gems to move toward player (special ability for level up)
        if (!this.game.player) return;
        
        let magnetizedCount = 0;
        
        for (const gem of this.activeGems) {
            if (gem.active && !gem.collected) {
                // Start a timed global magnet pulse that ignores range in ExperienceGem.updateMagnetism
                if (typeof gem.forceMagnetTimer !== 'number') {
                    gem.forceMagnetTimer = 0;
                }
                gem.forceMagnetTimer = Math.max(gem.forceMagnetTimer, 1.5); // seconds of forced pull
                gem.beingMagnetized = true;
                // Ensure magnet strength baseline is sane (pulse path uses baseMagnetStrength internally)
                if (typeof gem.baseMagnetStrength === 'number') {
                    gem.magnetStrength = gem.baseMagnetStrength;
                }
                magnetizedCount++;
                
                // Subtler sparkle trail: only every 8th gem
                if (this.game.systems.particle && magnetizedCount % 8 === 0) {
                    this.game.systems.particle.create(gem.x, gem.y, {
                        vx: (Math.random() - 0.5) * 20,
                        vy: (Math.random() - 0.5) * 20,
                        life: 0.5, // Shorter life
                        size: 1.5, // Smaller size
                        color: '#00FFFF',
                        glow: true,
                        fadeOut: true
                    });
                }
            }
        }
        
        // Play satisfying audio feedback if gems were magnetized
        if (magnetizedCount > 0 && this.game.audioManager) {
            this.game.audioManager.playVampireSound('experienceGain', 0.8, 1.3);
        }
        
        return magnetizedCount; // Return how many gems were affected
    }
    
    // System-level global magnet activation
    activateGlobalMagnet(duration = 0) {
        const d = Math.max(0, duration);
        this.globalMagnetTimer = Math.max(this.globalMagnetTimer, d);
        return this.globalMagnetTimer;
    }
    
    isGlobalMagnetActive() {
        return this.globalMagnetTimer > 0;
    }
    
    // Query methods
    getGemsInRange(x, y, range) {
        const result = [];
        const rangeSquared = range * range;
        
        for (const gem of this.activeGems) {
            if (!gem.active || gem.collected) continue;
            
            const dx = gem.x - x;
            const dy = gem.y - y;
            const distanceSquared = dx * dx + dy * dy;
            
            if (distanceSquared <= rangeSquared) {
                result.push(gem);
            }
        }
        
        return result;
    }
    
    getNearbyGems(x, y, range) {
        // Use spatial grid for efficient lookup
        const result = [];
        const gridRange = Math.ceil(range / this.gridSize);
        const centerGridX = Math.floor(x / this.gridSize);
        const centerGridY = Math.floor(y / this.gridSize);
        
        for (let gx = centerGridX - gridRange; gx <= centerGridX + gridRange; gx++) {
            for (let gy = centerGridY - gridRange; gy <= centerGridY + gridRange; gy++) {
                const key = `${gx},${gy}`;
                const gems = this.spatialGrid.get(key);
                
                if (gems) {
                    for (const gem of gems) {
                        const dx = gem.x - x;
                        const dy = gem.y - y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance <= range) {
                            result.push(gem);
                        }
                    }
                }
            }
        }
        
        return result;
    }
    
    // OPTIMIZED: Return squared distance to avoid expensive Math.sqrt()
    getDistanceToPlayer(gem) {
        if (!this.game.player) return Infinity;
        
        const dx = gem.x - this.game.player.x;
        const dy = gem.y - this.game.player.y;
        return dx * dx + dy * dy; // Squared distance for performance
    }
    
    getDistanceSquaredToPlayer(gem) {
        if (!this.game.player) return Infinity;
        
        const dx = gem.x - this.game.player.x;
        const dy = gem.y - this.game.player.y;
        return dx * dx + dy * dy;
    }
    
    getActiveGemCount() {
        return this.activeGems.length;
    }
    
    getTotalGemValue() {
        let total = 0;
        for (const gem of this.activeGems) {
            if (gem.active && !gem.collected) {
                total += gem.value;
            }
        }
        return total;
    }
    
    // Special gem creation for specific scenarios
    createBossDrops(x, y, bossLevel) {
        // Create special gems dropped by bosses
        const baseValue = 100 * bossLevel;
        const gemCount = 3 + bossLevel;
        
        this.createGemExplosion(x, y, baseValue, gemCount, gemCount + 2);
        
        // Always create one rare gem
        setTimeout(() => {
            this.createBonusGem(x, y, 3);
        }, 500);
    }
    
    createLevelUpReward(x, y) {
        // Create gems as level up reward
        const gems = 5 + Math.floor(this.game.player.level / 5);
        const totalValue = 50 + this.game.player.level * 10;
        
        this.createMultipleGems(x, y, gems, totalValue);
    }
    
    createAchievementReward(x, y, achievementTier = 1) {
        // Create gems for achievement completion
        const value = 50 * achievementTier;
        const gemCount = 2 + achievementTier;
        
        for (let i = 0; i < gemCount; i++) {
            setTimeout(() => {
                this.createBonusGem(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40, 1.5);
            }, i * 200);
        }
    }
    
    // Clear all gems (for game reset)
    clearAll() {
        for (const gem of this.activeGems) {
            gem.active = false;
            this.returnGemToPool(gem);
        }
        
        this.activeGems = [];
        this.spatialGrid.clear();
    }
    
    render(renderer) {
        // Render all active gems
        for (const gem of this.activeGems) {
            if (gem.active && !gem.collected) {
                gem.render(renderer);
            }
        }
    }
    
    // Debug info
    getDebugInfo() {
        return {
            activeGems: this.activeGems.length,
            poolSize: this.gemPool.length,
            totalValue: this.getTotalGemValue(),
            gridCells: this.spatialGrid.size,
            gemTypes: this.getGemTypeDistribution()
        };
    }
    
    getGemTypeDistribution() {
        const distribution = { small: 0, medium: 0, large: 0, rare: 0 };
        
        for (const gem of this.activeGems) {
            if (!gem.active || gem.collected) continue;
            
            if (gem.value >= this.gemValues.rare) {
                distribution.rare++;
            } else if (gem.value >= this.gemValues.large) {
                distribution.large++;
            } else if (gem.value >= this.gemValues.medium) {
                distribution.medium++;
            } else {
                distribution.small++;
            }
        }
        
        return distribution;
    }
}