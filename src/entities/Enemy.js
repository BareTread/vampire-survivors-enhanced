import { globalDamageNumberPool } from '../core/DamageNumberPool.js';

export class Enemy {
    constructor(game, x, y, type = 'basic') {
        this.game = game;
        this.x = x;
        this.y = y;
        this.type = type;
        
        // Movement properties
        this.velocity = { x: 0, y: 0 };
        this.direction = 0;
        
        // Initialize stats based on type
        this.initializeType(type);
        
        // Current health
        this.health = this.maxHealth;
        
        // Collision
        this.hitbox = {
            width: this.size * 1.5,
            height: this.size * 1.5
        };
        
        // AI properties
        this.target = null;
        this.lastDamageTime = 0;
        this.attackCooldown = 0;
        
        // Visual effects
        // Note: Damage numbers now handled by globalDamageNumberPool
        this.deathEffect = false;
        this.flashTime = 0;
        
        // Spawning animation
        this.spawnTime = 0.3;
        this.currentSpawnTime = this.spawnTime;
        
        // Unique ID for object pooling
        this.id = Math.random().toString(36).substr(2, 9);
        this.active = true;
        
        // Elite-specific properties
        this.isBerserk = false;
        this.summonTimer = 0;
        this.lastShockwaveTime = 0;
    }
    
    initializeType(type) {
        const types = {
            basic: {
                maxHealth: 35,  // Increased from 20 - HARDER
                speed: 60,  // Increased from 40 for more challenge
                damage: 15,  // Increased from 10 - MORE DANGEROUS
                size: 8,
                color: '#FF6B6B',
                expReward: 3, // REBALANCED: Reduced from 5 to 3
                attackRange: 20,
                attackCooldown: 1.0
            },
            fast: {
                maxHealth: 20,  // Doubled from 10 - TANKIER
                speed: 120,  // Increased from 80 for more challenge
                damage: 12,  // Increased from 8 - MORE DANGEROUS
                size: 6,
                color: '#4ECDC4',
                expReward: 5, // REBALANCED: Reduced from 8 to 5
                attackRange: 15,
                attackCooldown: 0.8
            },
            tank: {
                maxHealth: 100,  // Increased from 60 - MUCH TANKIER
                speed: 35,  // Increased from 20 for more challenge
                damage: 35,  // Increased from 25 - HEAVY HITTER
                size: 14,
                color: '#45B7D1',
                expReward: 8, // REBALANCED: Reduced from 15 to 8
                attackRange: 25,
                attackCooldown: 2.0
            },
            ranged: {
                maxHealth: 25,  // Increased from 15 - MORE DURABLE
                speed: 50,  // Increased from 30 for more challenge
                damage: 15,  // Increased from 8 - MORE DANGEROUS
                size: 7,
                color: '#F39C12',
                expReward: 6, // REBALANCED: Reduced from 10 to 6
                attackRange: 100, // Reduced from 120 to 100 to keep enemies closer
                attackCooldown: 2.0 // Increased from 1.5 to 2.0 seconds
            },
            elite: {
                maxHealth: 150,  // Increased from 100 - MINI BOSS
                speed: 55,  // Increased from 35 for more challenge
                damage: 45,  // Increased from 30 - DEADLY
                size: 16,
                color: '#9B59B6',
                expReward: 12, // REBALANCED: Reduced from 25 to 12
                attackRange: 30,
                attackCooldown: 1.2
            },
            berserker: {
                maxHealth: 120,  // Increased from 80 - RAGE MODE
                speed: 70,  // Increased from 45 for more challenge
                damage: 40,  // Increased from 25 - BERSERK DAMAGE
                size: 14,
                color: '#FF4500',
                expReward: 15, // REBALANCED: Reduced from 35 to 15
                attackRange: 25,
                attackCooldown: 0.8,
                rageThreshold: 0.5 // Goes berserk at 50% health
            },
            summoner: {
                maxHealth: 90,  // Increased from 60 - MORE DURABLE
                speed: 40,  // Increased from 25 for more challenge
                damage: 25,  // Increased from 15 - MORE DANGEROUS
                size: 12,
                color: '#8A2BE2',
                expReward: 18, // REBALANCED: Reduced from 40 to 18
                attackRange: 150,
                attackCooldown: 3.0,
                summonRate: 4.0 // Summons every 4 seconds
            },
            juggernaut: {
                maxHealth: 300,  // Increased from 200 - BOSS LEVEL
                speed: 25,  // Increased from 15 for more challenge
                damage: 60,  // Increased from 40 - DEVASTATING
                size: 20,
                color: '#2F4F4F',
                expReward: 25, // REBALANCED: Reduced from 60 to 25
                attackRange: 35,
                attackCooldown: 2.5,
                shockwaveRange: 80
            }
        };
        
        let stats = types[type] || types.basic;
        
        // ENEMY VARIANTS SYSTEM - Add visual and stat diversity
        const variant = this.generateVariant(type, stats);
        if (variant) {
            stats = { ...stats, ...variant };
            this.variant = variant.name; // Store variant name for rendering
        }
        
        // Apply difficulty scaling based on game time
        const difficultyMultiplier = this.getDifficultyMultiplier();
        
        this.maxHealth = Math.floor(stats.maxHealth * difficultyMultiplier);
        this.speed = stats.speed;
        
        // Apply adaptive damage from flow state
        let finalDamageMultiplier = difficultyMultiplier;
        if (this.game.systems && this.game.systems.flowState && this.game.systems.flowState.adaptiveDamageMultiplier) {
            finalDamageMultiplier *= this.game.systems.flowState.adaptiveDamageMultiplier;
        }
        
        this.damage = Math.floor(stats.damage * finalDamageMultiplier);
        this.size = stats.size;
        this.color = stats.color;
        // REBALANCED: Drastically reduce XP scaling to maintain progression balance
        // With exponential enemy health scaling, XP should scale much more slowly
        const xpScalingFactor = Math.min(2.0, 1.0 + Math.log10(difficultyMultiplier) * 0.3); // Logarithmic scaling, max 2x
        this.expReward = Math.floor(stats.expReward * xpScalingFactor);
        this.attackRange = stats.attackRange;
        this.baseAttackCooldown = stats.attackCooldown;
    }

    
    generateVariant(type, baseStats) {
        // Only generate variants for certain types and with low probability
        const variantChance = 0.15; // 15% chance for variant
        if (Math.random() > variantChance) return null;
        
        // Skip variants for special enemy types
        if (['elite', 'berserker', 'summoner', 'juggernaut'].includes(type)) {
            return null;
        }
        
        const variants = {
            basic: [
                {
                    name: 'Crimson',
                    color: '#CC0000',
                    maxHealth: baseStats.maxHealth * 1.2,
                    damage: baseStats.damage * 1.15,
                    expReward: baseStats.expReward * 1.3
                },
                {
                    name: 'Jade',
                    color: '#00AA44',
                    speed: baseStats.speed * 1.3,
                    maxHealth: baseStats.maxHealth * 0.8,
                    expReward: baseStats.expReward * 1.2
                },
                {
                    name: 'Shadow',
                    color: '#333333',
                    speed: baseStats.speed * 1.4,
                    damage: baseStats.damage * 0.8,
                    size: baseStats.size * 0.9,
                    expReward: baseStats.expReward * 1.4
                }
            ],
            fast: [
                {
                    name: 'Lightning',
                    color: '#FFFF00',
                    speed: baseStats.speed * 1.3,
                    damage: baseStats.damage * 1.1,
                    expReward: baseStats.expReward * 1.3
                },
                {
                    name: 'Frost',
                    color: '#88DDFF',
                    speed: baseStats.speed * 0.9,
                    maxHealth: baseStats.maxHealth * 1.4,
                    expReward: baseStats.expReward * 1.2
                }
            ],
            tank: [
                {
                    name: 'Iron',
                    color: '#666666',
                    maxHealth: baseStats.maxHealth * 1.4,
                    speed: baseStats.speed * 0.8,
                    expReward: baseStats.expReward * 1.5
                },
                {
                    name: 'Molten',
                    color: '#FF4400',
                    damage: baseStats.damage * 1.3,
                    maxHealth: baseStats.maxHealth * 1.1,
                    expReward: baseStats.expReward * 1.4
                }
            ],
            ranged: [
                {
                    name: 'Sniper',
                    color: '#8B4513',
                    attackRange: baseStats.attackRange * 1.3,
                    damage: baseStats.damage * 1.2,
                    attackCooldown: baseStats.attackCooldown * 1.2,
                    expReward: baseStats.expReward * 1.4
                },
                {
                    name: 'Poison',
                    color: '#9932CC',
                    damage: baseStats.damage * 0.8,
                    attackCooldown: baseStats.attackCooldown * 0.8,
                    expReward: baseStats.expReward * 1.3
                }
            ]
        };
        
        const typeVariants = variants[type];
        if (!typeVariants || typeVariants.length === 0) return null;
        
        // Select random variant
        const selectedVariant = typeVariants[Math.floor(Math.random() * typeVariants.length)];
        
        return selectedVariant;
    }
    
    getDifficultyMultiplier() {
        // REBALANCED: Exponential enemy scaling for challenging long-term gameplay
        if (!this.game || typeof this.game.gameTime !== 'number') {
            return 1.0; // Default multiplier during initialization
        }
        
        const gameTime = this.game.gameTime;
        const baseMultiplier = 1.0;
        
        // REBALANCED: Exponential health scaling to match weapon power growth
        // Every 2 minutes, enemies get significantly tougher to maintain challenge
        const timeMinutes = gameTime / 120; // Scale every 2 minutes (was 30 seconds)
        const exponentialScaling = Math.pow(1.6, timeMinutes); // 60% increase every 2 minutes (was 5% every 30s)
        
        // Additional wave-based scaling for continuous challenge
        const currentWave = this.game.systems?.enemy?.currentWave || 1;
        const waveScaling = Math.pow(1.08, currentWave - 1); // 8% per wave
        
        const finalMultiplier = baseMultiplier * exponentialScaling * waveScaling;
        
        // Much higher cap to allow proper scaling (was 3.0)
        const cappedMultiplier = Math.min(finalMultiplier, 50.0);
        
        // Debug logging for balance verification
        if (gameTime > 240 && Math.random() < 0.01) { // Log occasionally after 4 minutes
            console.log(`ENEMY SCALING: ${timeMinutes.toFixed(1)} intervals, Wave ${currentWave}, Health multiplier: ${cappedMultiplier.toFixed(2)}x`);
        }
        
        return cappedMultiplier;
    }
    
    update(dt) {
        if (!this.active) return;
        
        // Update spawn animation
        if (this.currentSpawnTime > 0) {
            this.currentSpawnTime -= dt;
            return; // Don't update AI during spawn
        }
        
        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }
        
        // Update flash effect from damage
        if (this.flashTime > 0) {
            this.flashTime -= dt;
        }
        
        // Note: Damage numbers now updated by globalDamageNumberPool
        
        // AI behavior
        this.updateAI(dt);
        
        // Elite-specific behaviors
        this.updateEliteBehaviors(dt);
        
        // Apply movement with coordinate validation
        // FIXED: Validate movement delta before applying
        const deltaX = this.velocity.x * dt;
        const deltaY = this.velocity.y * dt;
        
        if (isFinite(deltaX) && isFinite(deltaY) && Math.abs(deltaX) < 500 && Math.abs(deltaY) < 500) {
            this.x += deltaX;
            this.y += deltaY;
        } else {
            console.warn('Invalid enemy movement delta detected, zeroing velocity');
            this.velocity = { x: 0, y: 0 };
        }
        
        // FIXED: Prevent coordinate overflow
        if (!isFinite(this.x) || !isFinite(this.y) || Math.abs(this.x) > 1e6 || Math.abs(this.y) > 1e6) {
            console.warn('Enemy coordinate overflow detected, resetting position');
            // Reset to safe position near player
            if (this.game.player) {
                this.x = this.game.player.x + (Math.random() - 0.5) * 400;
                this.y = this.game.player.y + (Math.random() - 0.5) * 400;
            } else {
                this.x = 0;
                this.y = 0;
            }
            this.velocity = { x: 0, y: 0 };
        }
    }
    
    updateAI(dt) {
        const player = this.game.player;
        if (!player || !player.isAlive()) return;
        
        // Calculate distance to player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Update direction
        this.direction = Math.atan2(dy, dx);
        
        // Different behaviors based on type
        switch (this.type) {
            case 'ranged':
                this.updateRangedAI(dx, dy, distance, dt);
                break;
            default:
                this.updateMeleeAI(dx, dy, distance, dt);
                break;
        }
    }
    
    updateMeleeAI(dx, dy, distance, dt) {
        if (distance > this.attackRange) {
            // Move towards player - FIXED: Add zero distance check
            if (distance === 0) {
                // If exactly on player, move in random direction
                const randomAngle = Math.random() * Math.PI * 2;
                this.velocity.x = Math.cos(randomAngle) * this.speed;
                this.velocity.y = Math.sin(randomAngle) * this.speed;
                return;
            }
            
            const normalizedX = dx / distance;
            const normalizedY = dy / distance;
            
            // Apply separation from other enemies
            const separation = this.getSeparationForce();
            
            this.velocity.x = (normalizedX * this.speed) + separation.x;
            this.velocity.y = (normalizedY * this.speed) + separation.y;
            
            // FIXED: Clamp velocity to prevent runaway acceleration
            const maxVelocity = this.speed * 2; // Allow 2x speed as max
            const velocityMagnitude = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
            if (velocityMagnitude > maxVelocity) {
                this.velocity.x = (this.velocity.x / velocityMagnitude) * maxVelocity;
                this.velocity.y = (this.velocity.y / velocityMagnitude) * maxVelocity;
            }
        } else {
            // In attack range - stop and attack
            this.velocity.x *= 0.1; // Quick deceleration
            this.velocity.y *= 0.1;
            
            if (this.attackCooldown <= 0) {
                this.attack();
            }
        }
    }
    
    updateRangedAI(dx, dy, distance, dt) {
        const optimalRange = this.attackRange * 0.8; // Stay at 80% of max range
        
        // FIXED: Add zero distance check for all ranged AI calculations
        if (distance === 0) {
            // If exactly on player, move in random direction
            const randomAngle = Math.random() * Math.PI * 2;
            this.velocity.x = Math.cos(randomAngle) * this.speed * 0.5;
            this.velocity.y = Math.sin(randomAngle) * this.speed * 0.5;
            return;
        }
        
        if (distance > this.attackRange) {
            // Move closer
            const normalizedX = dx / distance;
            const normalizedY = dy / distance;
            this.velocity.x = normalizedX * this.speed;
            this.velocity.y = normalizedY * this.speed;
        } else if (distance < optimalRange) {
            // Move away to maintain distance
            const normalizedX = -dx / distance;
            const normalizedY = -dy / distance;
            this.velocity.x = normalizedX * this.speed * 0.5;
            this.velocity.y = normalizedY * this.speed * 0.5;
        } else {
            // In optimal range - strafe and attack
            const strafeDirection = this.direction + Math.PI / 2;
            this.velocity.x = Math.cos(strafeDirection) * this.speed * 0.3;
            this.velocity.y = Math.sin(strafeDirection) * this.speed * 0.3;
            
            if (this.attackCooldown <= 0) {
                this.rangedAttack();
            }
        }
    }
    
    getSeparationForce() {
        const separationRadius = this.size * 3;
        const separationStrength = 50;
        let forceX = 0;
        let forceY = 0;
        let neighbors = 0;
        
        // Get nearby enemies from spatial grid
        const nearbyEnemies = this.game.systems.enemy.getNearbyEnemies(this.x, this.y, separationRadius);
        
        for (const enemy of nearbyEnemies) {
            if (enemy === this || !enemy.active) continue;
            
            const dx = this.x - enemy.x;
            const dy = this.y - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < separationRadius && distance > 0) {
                const strength = (separationRadius - distance) / separationRadius;
                // FIXED: Additional safety check for distance
                if (distance > 0.001) { // Avoid near-zero divisions
                    forceX += (dx / distance) * strength * separationStrength;
                    forceY += (dy / distance) * strength * separationStrength;
                }
                neighbors++;
            }
        }
        
        if (neighbors > 0) {
            forceX /= neighbors;
            forceY /= neighbors;
        }
        
        return { x: forceX, y: forceY };
    }
    
    attack() {
        const player = this.game.player;
        if (!player || !player.isAlive()) return;
        
        // Deal damage to player
        player.takeDamage(this.damage);
        
        // Reset cooldown
        this.attackCooldown = this.baseAttackCooldown;
        
        // Visual effect
        this.game.systems.particle.createImpactEffect(this.x, this.y, '#FF4444');
        
    }
    
    rangedAttack() {
        const player = this.game.player;
        if (!player || !player.isAlive()) return;
        
        
        // Create highly visible projectile towards player
        this.game.systems.projectile.createEnemyProjectile(
            this.x, this.y,
            player.x, player.y,
            this.damage,
            150, // projectile speed
            '#FF4444' // bright red for visibility
        );
        
        // Reset cooldown
        this.attackCooldown = this.baseAttackCooldown;
        
    }
    
    takeDamage(amount, source = null, isCritical = false) {
        if (!this.active || this.health <= 0) return false;
        
        const damage = Math.max(1, Math.floor(amount));
        this.health = Math.max(0, this.health - damage);
        
        // Track damage for psychology feedback
        this.lastDamageAmount = damage;
        this.lastDamageWasCritical = isCritical;
        this.lastDamageTime = performance.now();
        
        // Enhanced visual feedback based on damage
        this.flashTime = isCritical ? 0.2 : 0.1;
        const damageColor = isCritical ? '#FF0000' : '#FFFF00';
        this.addDamageNumber(damage, damageColor);
        
        // Hit effect particles
        if (this.game.systems.particle) {
            if (isCritical) {
                this.game.systems.particle.createCriticalEffect(this.x, this.y, '#FF0000');
            } else {
                this.game.systems.particle.createHitEffect(this.x, this.y, '#FFFF00');
            }
        }
        
        // Knockback effect
        if (source) {
            const dx = this.x - source.x;
            const dy = this.y - source.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            // FIXED: More robust distance check for knockback
            if (distance > 0.001) { // Avoid near-zero divisions
                const knockbackStrength = isCritical ? 150 : 100;
                this.velocity.x += (dx / distance) * knockbackStrength;
                this.velocity.y += (dy / distance) * knockbackStrength;
            } else {
                // If exactly on source, apply random knockback
                const randomAngle = Math.random() * Math.PI * 2;
                const knockbackStrength = isCritical ? 150 : 100;
                this.velocity.x += Math.cos(randomAngle) * knockbackStrength;
                this.velocity.y += Math.sin(randomAngle) * knockbackStrength;
            }
        }
        
        // Death check
        if (this.health <= 0) {
            this.die();
            return true;
        }
        
        return true;
    }
    
    die() {
        if (!this.active) return;
        
        // CRITICAL FIX: Create all visual effects BEFORE marking inactive
        // This ensures particles have proper context and timing
        
        // ADDICTION MECHANICS: Trigger combo system and psychological rewards
        const finalDamage = this.lastDamageAmount || this.maxHealth;
        const wasCritical = this.lastDamageWasCritical || false;
        
        // Enhanced experience rewards based on combo
        let expReward = this.expReward;
        if (this.game.player && this.game.player.combo) {
            expReward = Math.floor(expReward * this.game.player.combo.multiplier);
        }
        
        // Death particle effect with enhanced feedback for combos - CREATE FIRST
        const comboLevel = this.game.player ? Math.min(this.game.player.combo.count / 10, 3.0) : 1.0;
        this.game.systems.particle.createEnhancedDeathEffect(this.x, this.y, this.color, comboLevel);
        
        // Escalating screen shake based on combo
        const shakeIntensity = Math.min(5, 2 + comboLevel);
        if (this.game && this.game.camera && typeof this.game.camera.shake === 'function') {
            this.game.camera.shake(shakeIntensity, 0.1 + comboLevel * 0.05);
        }
        
        // Drop experience gem with combo bonus
        this.game.systems.experience.createGem(
            this.x + (Math.random() - 0.5) * 20,
            this.y + (Math.random() - 0.5) * 20,
            expReward
        );
        
        // NOW mark as inactive after all effects are created
        this.active = false;
        
        // Update player's combo count and kill streak
        if (this.game.player) {
            this.game.player.addKillToCombo();
            this.game.player.addKillToStreak(); // Add kill streak tracking
            
            // Track kill for achievements and flow state
            if (this.game.systems.achievement) {
                this.game.systems.achievement.onEnemyKilled(this, wasCritical);
            }
            if (this.game.systems.flowState) {
                this.game.systems.flowState.onEnemyKilled(this);
            }
            if (this.game.systems.microChallenge) {
                this.game.systems.microChallenge.onEnemyKilled(this);
            }
            
            // Bonus rewards for critical kills
            if (wasCritical) {
                this.game.player.streaks.criticalHits++;
                if (this.game.player.streaks.criticalHits >= 5) {
                    // Critical streak bonus
                    this.game.player.addDamageNumber('CRIT STREAK!', '#FF0066', 'BONUS');
                    this.game.player.activatePowerUp('damageBoost', 5.0, 1.5);
                    this.game.player.streaks.criticalHits = 0;
                }
            }
        }
        
        // Chance for power-up drop on elite kills
        if (this.type === 'elite' || (this.game.player && this.game.player.combo.count >= 20)) {
            if (Math.random() < 0.3) { // 30% chance
                this.game.spawnPowerUpDrop(this.x, this.y);
            }
        }
        
        // Update game score
        this.game.score += Math.floor(this.expReward * (this.game.player ? this.game.player.combo.multiplier : 1.0));
    }
    
    addDamageNumber(amount, color) {
        // Skip zero or invalid damage numbers unless it's a text message
        if (typeof amount === 'number' && (!isFinite(amount) || amount <= 0)) {
            return;
        }
        
        // Use centralized damage number pool
        const isCritical = color === '#FF0000' || color === '#FF69B4';
        return globalDamageNumberPool.get(
            this.x + (Math.random() - 0.5) * 10,
            this.y - 5,
            amount,
            color,
            isCritical
        );
    }
    
    // updateDamageNumbers removed - now handled by globalDamageNumberPool
    
    render(renderer) {
        if (!this.active) return;
        
        const ctx = renderer.ctx;
        ctx.save();
        
        // Spawn animation
        if (this.currentSpawnTime > 0) {
            const spawnProgress = 1 - (this.currentSpawnTime / this.spawnTime);
            ctx.globalAlpha = spawnProgress;
            ctx.scale(spawnProgress, spawnProgress);
        }
        
        // Flash effect when damaged
        if (this.flashTime > 0) {
            ctx.shadowColor = '#FFFFFF';
            ctx.shadowBlur = 10;
        }
        
        // Draw enemy body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw type-specific details
        this.renderTypeDetails(ctx);
        
        // Health bar for damaged enemies
        if (this.health < this.maxHealth) {
            this.renderHealthBar(ctx);
        }
        
        ctx.restore();
        
        // Note: Damage numbers now rendered by globalDamageNumberPool
    }
    
    renderTypeDetails(ctx) {
        // Render variant indicators first
        if (this.variant) {
            this.renderVariantIndicator(ctx);
        }
        
        switch (this.type) {
            case 'fast':
                // Draw speed lines
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1;
                for (let i = 0; i < 3; i++) {
                    const angle = this.direction + Math.PI + (i - 1) * 0.3;
                    const startX = this.x + Math.cos(angle) * this.size * 0.5;
                    const startY = this.y + Math.sin(angle) * this.size * 0.5;
                    const endX = startX + Math.cos(angle) * this.size * 0.8;
                    const endY = startY + Math.sin(angle) * this.size * 0.8;
                    
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();
                }
                break;
                
            case 'tank':
                // Draw armor plating
                ctx.strokeStyle = '#333333';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size * 0.7, 0, Math.PI * 2);
                ctx.stroke();
                break;
                
            case 'ranged':
                // Draw targeting reticle
                if (this.attackCooldown <= 0.5) {
                    ctx.strokeStyle = '#FF0000';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(this.x - this.size, this.y);
                    ctx.lineTo(this.x + this.size, this.y);
                    ctx.moveTo(this.x, this.y - this.size);
                    ctx.lineTo(this.x, this.y + this.size);
                    ctx.stroke();
                }
                break;
                
            case 'elite':
                // Draw crown/elite marker
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(this.x, this.y - this.size - 3, 3, 0, Math.PI * 2);
                ctx.fill();
                break;
        }
    }

    
    renderVariantIndicator(ctx) {
        // Draw variant indicators to show enemy is special
        const time = performance.now() * 0.01;
        
        switch (this.variant) {
            case 'Crimson':
                // Pulsing red aura
                ctx.save();
                ctx.globalAlpha = 0.3 + 0.2 * Math.sin(time * 2);
                ctx.shadowColor = '#CC0000';
                ctx.shadowBlur = this.size * 2;
                ctx.fillStyle = '#CC0000';
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size * 1.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                break;
                
            case 'Jade':
                // Green energy rings
                ctx.save();
                ctx.strokeStyle = '#00AA44';
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 3);
                for (let i = 0; i < 2; i++) {
                    const radius = this.size * (1.3 + i * 0.2 + Math.sin(time + i) * 0.1);
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
                    ctx.stroke();
                }
                ctx.restore();
                break;
                
            case 'Shadow':
                // Dark wisps
                ctx.save();
                ctx.fillStyle = '#000000';
                ctx.globalAlpha = 0.4 + 0.3 * Math.sin(time * 2);
                for (let i = 0; i < 3; i++) {
                    const angle = (i / 3) * Math.PI * 2 + time;
                    const distance = this.size * 1.8;
                    const wispX = this.x + Math.cos(angle) * distance;
                    const wispY = this.y + Math.sin(angle) * distance;
                    ctx.beginPath();
                    ctx.arc(wispX, wispY, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
                break;
                
            case 'Lightning':
                // Electric sparks
                ctx.save();
                ctx.strokeStyle = '#FFFF00';
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.8;
                if (Math.random() < 0.3) {
                    for (let i = 0; i < 2; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const length = this.size * 1.5;
                        const startX = this.x + Math.cos(angle) * this.size;
                        const startY = this.y + Math.sin(angle) * this.size;
                        const endX = startX + Math.cos(angle) * length;
                        const endY = startY + Math.sin(angle) * length;
                        
                        ctx.beginPath();
                        ctx.moveTo(startX, startY);
                        ctx.lineTo(endX, endY);
                        ctx.stroke();
                    }
                }
                ctx.restore();
                break;
                
            case 'Frost':
                // Ice crystals
                ctx.save();
                ctx.fillStyle = '#88DDFF';
                ctx.globalAlpha = 0.7;
                for (let i = 0; i < 4; i++) {
                    const angle = (i / 4) * Math.PI * 2;
                    const distance = this.size * 1.4;
                    const crystalX = this.x + Math.cos(angle) * distance;
                    const crystalY = this.y + Math.sin(angle) * distance;
                    
                    // Draw small diamond
                    ctx.beginPath();
                    ctx.moveTo(crystalX, crystalY - 3);
                    ctx.lineTo(crystalX + 2, crystalY);
                    ctx.lineTo(crystalX, crystalY + 3);
                    ctx.lineTo(crystalX - 2, crystalY);
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.restore();
                break;
                
            case 'Iron':
                // Metallic shine
                ctx.save();
                ctx.strokeStyle = '#CCCCCC';
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.8 + 0.2 * Math.sin(time * 1.5);
                ctx.beginPath();
                ctx.arc(this.x - this.size * 0.3, this.y - this.size * 0.3, this.size * 0.8, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
                break;
                
            case 'Molten':
                // Lava bubbles
                ctx.save();
                ctx.fillStyle = '#FF6600';
                ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 2.5);
                if (Math.random() < 0.2) {
                    const bubbleX = this.x + (Math.random() - 0.5) * this.size * 2;
                    const bubbleY = this.y + (Math.random() - 0.5) * this.size * 2;
                    ctx.beginPath();
                    ctx.arc(bubbleX, bubbleY, 1 + Math.random() * 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
                break;
                
            case 'Sniper':
                // Scope glint
                ctx.save();
                ctx.fillStyle = '#FFFFFF';
                ctx.globalAlpha = 0.9;
                if (this.attackCooldown <= 1.0) {
                    ctx.beginPath();
                    ctx.arc(this.x + this.size * 0.5, this.y - this.size * 0.5, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
                break;
                
            case 'Poison':
                // Toxic bubbles
                ctx.save();
                ctx.fillStyle = '#9932CC';
                ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 2);
                for (let i = 0; i < 2; i++) {
                    const angle = time + i * Math.PI;
                    const distance = this.size * 1.2;
                    const bubbleX = this.x + Math.cos(angle) * distance;
                    const bubbleY = this.y + Math.sin(angle) * distance;
                    ctx.beginPath();
                    ctx.arc(bubbleX, bubbleY, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
                break;
        }
    }
    
    renderHealthBar(ctx) {
        const barWidth = Math.max(24, this.size * 2.5); // Wider bars
        const barHeight = 4; // Taller bars
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.size - 10;
        
        // Background with border
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
        
        // Dark background
        ctx.fillStyle = '#222222';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Health fill with color coding
        const healthRatio = this.health / this.maxHealth;
        let healthColor;
        if (healthRatio > 0.6) {
            healthColor = '#00FF00'; // Green
        } else if (healthRatio > 0.3) {
            healthColor = '#FFAA00'; // Orange
        } else {
            healthColor = '#FF0000'; // Red
        }
        
        ctx.fillStyle = healthColor;
        ctx.fillRect(barX, barY, barWidth * healthRatio, barHeight);
        
        // Add subtle glow for better visibility
        if (healthRatio < 0.5) {
            ctx.shadowColor = healthColor;
            ctx.shadowBlur = 4;
            ctx.fillRect(barX, barY, barWidth * healthRatio, barHeight);
            ctx.shadowBlur = 0;
        }
    }
    
    // renderDamageNumbers removed - now handled by globalDamageNumberPool
    
    // Helper methods
    getBounds() {
        return {
            left: this.x - this.hitbox.width / 2,
            right: this.x + this.hitbox.width / 2,
            top: this.y - this.hitbox.height / 2,
            bottom: this.y + this.hitbox.height / 2
        };
    }
    
    getPosition() {
        return { x: this.x, y: this.y };
    }
    
    isAlive() {
        return this.active && this.health > 0;
    }
    
    // Reset method for object pooling
    reset(x, y, type = 'basic') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.velocity = { x: 0, y: 0 };
        this.direction = 0;
        this.attackCooldown = 0;
        this.flashTime = 0;
        this.currentSpawnTime = this.spawnTime;
        // Note: Damage numbers now managed by globalDamageNumberPool
        this.active = true;
        
        this.initializeType(type);
        this.health = this.maxHealth;
    }
    
    updateEliteBehaviors(dt) {
        // Berserker: Gains speed and damage as health decreases
        if (this.type === 'berserker') {
            const healthPercent = this.health / this.maxHealth;
            if (healthPercent <= 0.5 && !this.isBerserk) {
                this.isBerserk = true;
                this.speed *= 1.5; // 50% speed boost
                this.damage *= 1.3; // 30% damage boost
                this.color = '#FF0000'; // Turn red when berserking
                console.log('💀 Berserker entering rage mode!');
            }
        }
        
        // Summoner: Spawns minions periodically
        else if (this.type === 'summoner') {
            this.summonTimer += dt;
            if (this.summonTimer >= 4.0) { // Every 4 seconds
                this.summonTimer = 0;
                this.summonMinions();
            }
        }
        
        // Juggernaut: Creates shockwaves periodically
        else if (this.type === 'juggernaut') {
            const timeSinceShockwave = this.game.gameTime - this.lastShockwaveTime;
            if (timeSinceShockwave >= 6.0) { // Every 6 seconds
                this.createShockwave();
                this.lastShockwaveTime = this.game.gameTime;
            }
        }
    }
    
    summonMinions() {
        if (!this.game.systems.enemy) return;
        
        // Spawn 2 basic enemies near the summoner
        for (let i = 0; i < 2; i++) {
            const angle = (i / 2) * Math.PI * 2;
            const distance = 40;
            const x = this.x + Math.cos(angle) * distance;
            const y = this.y + Math.sin(angle) * distance;
            
            // Don't exceed enemy limits
            if (this.game.systems.enemy.activeEnemies.length < this.game.systems.enemy.maxActiveEnemies) {
                const enemy = this.game.systems.enemy.createEnemyByType('fast');
                if (enemy) {
                    enemy.x = x;
                    enemy.y = y;
                    this.game.systems.enemy.activeEnemies.push(enemy);
                }
            }
        }
        
        // Visual effect
        if (this.game.systems.particle) {
            this.game.systems.particle.createEvolutionEffect(this.x, this.y);
        }
    }
    
    createShockwave() {
        if (!this.game.player) return;
        
        const player = this.game.player;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Damage player if in range
        if (distance <= 80) {
            const damage = this.damage * 0.8; // 80% of normal damage
            player.takeDamage(damage);
            
            // Knockback effect
            const knockbackForce = 200;
            const normalizedX = dx / distance;
            const normalizedY = dy / distance;
            
            if (player.velocity) {
                player.velocity.x += normalizedX * knockbackForce;
                player.velocity.y += normalizedY * knockbackForce;
            }
        }
        
        // Visual effect
        if (this.game.systems.particle) {
            this.game.systems.particle.createExplosionEffect(this.x, this.y, 80, '#2F4F4F');
        }
        
        console.log('💥 Juggernaut shockwave!');
    }
}