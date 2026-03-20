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
        this.freezeTimer = 0; // Hit freeze-frame timer

        // Spawning animation
        this.spawnTime = 0.3;
        this.currentSpawnTime = this.spawnTime;

        // Unique ID for object pooling
        this.id = Math.random().toString(36).substr(2, 9);
        this.active = true;

        // Death animation state
        this.dying = false;
        this.deathScaleTimer = 0;
        this.deathScaleDuration = 0.08; // ~5 frames @ 60fps

        // Elite-specific properties
        this.isBerserk = false;
        this.summonTimer = 0;
        this.lastShockwaveTime = 0;

        // Elite ability properties
        this.eliteAbility = null; // 'shield' | 'teleport' | 'healNearby' | 'explodeOnDeath'
        this.shieldHits = 0;
        this.teleportCooldown = 0;
        this.healTimer = 0;
    }

    initializeType(type) {
        const types = {
            basic: {
                maxHealth: 25,
                speed: 50,
                damage: 10,
                size: 8,
                color: '#FF6B6B',
                expReward: 5,
                attackRange: 20,
                attackCooldown: 1.0
            },
            fast: {
                maxHealth: 18,
                speed: 100,
                damage: 8,
                size: 6,
                color: '#4ECDC4',
                expReward: 4,
                attackRange: 15,
                attackCooldown: 0.8
            },
            tank: {
                maxHealth: 60,
                speed: 30,
                damage: 25,
                size: 14,
                color: '#45B7D1',
                expReward: 12,
                attackRange: 25,
                attackCooldown: 2.0
            },
            ranged: {
                maxHealth: 20,
                speed: 45,
                damage: 10,
                size: 7,
                color: '#F39C12',
                expReward: 8,
                attackRange: 100,
                attackCooldown: 2.0
            },
            elite: {
                maxHealth: 100,
                speed: 45,
                damage: 30,
                size: 16,
                color: '#9B59B6',
                expReward: 20,
                attackRange: 30,
                attackCooldown: 1.2
            },
            berserker: {
                maxHealth: 80,
                speed: 60,
                damage: 28,
                size: 14,
                color: '#FF4500',
                expReward: 25,
                attackRange: 25,
                attackCooldown: 0.8,
                rageThreshold: 0.5
            },
            summoner: {
                maxHealth: 60,
                speed: 35,
                damage: 18,
                size: 12,
                color: '#8A2BE2',
                expReward: 30,
                attackRange: 150,
                attackCooldown: 3.0,
                summonRate: 4.0
            },
            juggernaut: {
                maxHealth: 200,
                speed: 22,
                damage: 45,
                size: 20,
                color: '#2F4F4F',
                expReward: 50,
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

        // BALANCE SAFETY NET: Hard cap on single-hit damage for the first 5 minutes.
        // Player has 100 HP and no upgrades early — no single hit should exceed 40% of max HP
        // before 5 min, scaling to 60% cap by 10 min. This prevents one-shots from scaled
        // elites, Demons, and their area/explosion attacks before the player can adapt.
        if (this.game && typeof this.game.gameTime === 'number') {
            const gameTimeMin = this.game.gameTime / 60;
            const playerMaxHP = this.game.player?.maxHealth || 100;
            // Linear ramp: 40% cap at 0 min → 60% cap at 5 min → uncapped after 10 min
            if (gameTimeMin < 10) {
                const capPercent = 0.4 + Math.min(gameTimeMin / 5, 1.0) * 0.2; // 0.40 → 0.60
                const damageCap = Math.floor(playerMaxHP * capPercent);
                this.damage = Math.min(this.damage, damageCap);
            }
        }

        this.size = stats.size;
        this.color = stats.color;
        // REBALANCED: Drastically reduce XP scaling to maintain progression balance
        // With exponential enemy health scaling, XP should scale much more slowly
        const xpScalingFactor = Math.min(2.0, 1.0 + Math.log10(difficultyMultiplier) * 0.3); // Logarithmic scaling, max 2x
        this.expReward = Math.floor(stats.expReward * xpScalingFactor);
        this.attackRange = stats.attackRange;
        this.baseAttackCooldown = stats.attackCooldown;

        // Assign random elite ability
        if (type === 'elite') {
            const abilities = ['shield', 'teleport', 'healNearby', 'explodeOnDeath'];
            this.eliteAbility = abilities[Math.floor(Math.random() * abilities.length)];
            if (this.eliteAbility === 'shield') this.shieldHits = 3;
            if (this.eliteAbility === 'teleport') this.teleportCooldown = 3.0;
            if (this.eliteAbility === 'healNearby') this.healTimer = 4.0;
        }
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
        // REBALANCED: Softer exponential enemy scaling with player-power tracking
        if (!this.game || typeof this.game.gameTime !== 'number') {
            return 1.0; // Default multiplier during initialization
        }

        const gameTime = this.game.gameTime;
        const baseMultiplier = 1.0;

        // REBALANCED: Two-regime time scaling
        const timeMinutes = gameTime / 120; // intervals of 2 minutes
        // 25% increase per 2-min interval for first 5 min, then 30% per interval after
        const earlyScaling = Math.pow(1.25, Math.min(timeMinutes, 2.5)); // caps at 5 min: ~1.95x
        const lateBonus = timeMinutes > 2.5 ? Math.pow(1.30, timeMinutes - 2.5) : 1.0;
        const exponentialScaling = earlyScaling * lateBonus;

        // Wave-based scaling, capped at wave 30 to prevent extreme late-game
        const currentWave = this.game.systems?.enemy?.currentWave || 1;
        const effectiveWave = Math.min(currentWave, 30);
        const waveScaling = Math.pow(1.06, effectiveWave - 1); // 6% per wave

        // Player-power factor: enemies scale proportionally with player strength
        // so the difficulty curve matches the power curve
        const playerLevel = this.game.player?.level || 1;
        const weaponCount = this.game.player?.weapons?.size || 1;
        const playerPowerFactor = 1 + (playerLevel - 1) * 0.04 + (weaponCount - 1) * 0.08;

        const finalMultiplier = baseMultiplier * exponentialScaling * waveScaling * playerPowerFactor;

        // Cap multiplier at 50x overall
        const cappedMultiplier = Math.min(finalMultiplier, 50.0);

        // Debug logging for balance verification
        if (this.game.showDebug && gameTime > 240 && Math.random() < 0.01) {
            console.log(
                `ENEMY SCALING: ${timeMinutes.toFixed(1)} intervals, Wave ${currentWave}, Player L${playerLevel}, Health multiplier: ${cappedMultiplier.toFixed(2)}x`
            );
        }

        return cappedMultiplier;
    }

    update(dt) {
        if (!this.active) return;

        // Death animation: shrink to nothing then deactivate
        if (this.dying) {
            this.deathScaleTimer -= dt;
            if (this.deathScaleTimer <= 0) {
                this.active = false;
            }
            return;
        }

        // Update spawn animation
        if (this.currentSpawnTime > 0) {
            this.currentSpawnTime -= dt;
            return; // Don't update AI during spawn
        }

        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }

        // Hit freeze-frame: skip AI update while frozen
        if (this.freezeTimer > 0) {
            this.freezeTimer -= dt;
            return; // Don't move or act during freeze
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

        // Obstacle collision
        if (this.game.systems.terrain && this.game.systems.terrain.pushOutOfObstacles) {
            this.game.systems.terrain.pushOutOfObstacles(this);
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

            // Blood Moon speed buff
            const speedMult = (this.game.systems.dynamicEvents?.bloodMoonSpeedMult ?? 1)
                            * (this.game.systems.enemy?.enemySpeedMultiplier ?? 1);
            this.velocity.x = normalizedX * this.speed * speedMult + separation.x;
            this.velocity.y = normalizedY * this.speed * speedMult + separation.y;

            // FIXED: Clamp velocity to prevent runaway acceleration
            const maxVelocity = this.speed * speedMult * 2; // Allow 2x speed as max
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

        const rangedSpeedMult = this.game.systems.dynamicEvents?.bloodMoonSpeedMult ?? 1;
        if (distance > this.attackRange) {
            // Move closer
            const normalizedX = dx / distance;
            const normalizedY = dy / distance;
            this.velocity.x = normalizedX * this.speed * rangedSpeedMult;
            this.velocity.y = normalizedY * this.speed * rangedSpeedMult;
        } else if (distance < optimalRange) {
            // Move away to maintain distance
            const normalizedX = -dx / distance;
            const normalizedY = -dy / distance;
            this.velocity.x = normalizedX * this.speed * rangedSpeedMult * 0.5;
            this.velocity.y = normalizedY * this.speed * rangedSpeedMult * 0.5;
        } else {
            // In optimal range - strafe and attack
            const strafeDirection = this.direction + Math.PI / 2;
            this.velocity.x = Math.cos(strafeDirection) * this.speed * rangedSpeedMult * 0.3;
            this.velocity.y = Math.sin(strafeDirection) * this.speed * rangedSpeedMult * 0.3;

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
                if (distance > 0.001) {
                    // Avoid near-zero divisions
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

        // Deal damage to player (Blood Moon buff + Warchief aura buff)
        const bloodMoon  = this.game.systems.dynamicEvents?.bloodMoonDamageMult ?? 1;
        const auraBoost  = this.auraBuffed ? 1.30 : 1.0;
        const dmgMult    = bloodMoon * auraBoost;
        player.takeDamage(Math.round(this.damage * dmgMult), { type: this.type, name: this.variant ? `${this.variant} ${this.type}` : this.type });

        // Reset cooldown
        this.attackCooldown = this.baseAttackCooldown;

        // Visual effect
        this.game.systems.particle.createImpactEffect(this.x, this.y, '#FF4444');
    }

    rangedAttack() {
        const player = this.game.player;
        if (!player || !player.isAlive()) return;

        // Blood Moon + Warchief aura damage buff
        const auraBoost = this.auraBuffed ? 1.30 : 1.0;
        const dmgMult   = (this.game.systems.dynamicEvents?.bloodMoonDamageMult ?? 1) * auraBoost;

        // Create highly visible projectile towards player
        this.game.systems.projectile.createEnemyProjectile(
            this.x,
            this.y,
            player.x,
            player.y,
            Math.round(this.damage * dmgMult),
            150, // projectile speed
            '#FF4444' // bright red for visibility
        );

        // Reset cooldown
        this.attackCooldown = this.baseAttackCooldown;
    }

    takeDamage(amount, source = null, isCritical = false) {
        if (!this.active || this.health <= 0) return false;

        // Elite shield: absorb hits
        if (this.eliteAbility === 'shield' && this.shieldHits > 0) {
            this.shieldHits--;
            this.flashTime = 0.15;
            if (this.game.systems.particle) {
                this.game.systems.particle.create(this.x, this.y, {
                    vx: 0,
                    vy: -30,
                    life: 0.5,
                    size: 8,
                    color: '#4FC3F7',
                    glow: true,
                    fadeOut: true
                });
                this.game.systems.particle.create(this.x + 8, this.y - 5, {
                    vx: 15,
                    vy: -20,
                    life: 0.3,
                    size: 5,
                    color: '#81D4FA',
                    glow: true,
                    fadeOut: true
                });
                this.game.systems.particle.create(this.x - 8, this.y - 5, {
                    vx: -15,
                    vy: -20,
                    life: 0.3,
                    size: 5,
                    color: '#81D4FA',
                    glow: true,
                    fadeOut: true
                });
            }
            this.addDamageNumber('BLOCKED', '#4FC3F7');
            return false;
        }

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

        // Hit freeze-frame: brief pause on hit for juicy feel
        this.freezeTimer = isCritical ? 0.06 : 0.03; // ~2 frames for crit, ~1 for normal

        // Enhanced knockback: scale with damage (not just flat)
        if (source) {
            const dx = this.x - source.x;
            const dy = this.y - source.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const damageScale = Math.min(2.0, damage / 20); // Scale up to 2x for big hits
            if (distance > 0.001) {
                const knockbackStrength = (isCritical ? 180 : 100) * damageScale;
                this.velocity.x += (dx / distance) * knockbackStrength;
                this.velocity.y += (dy / distance) * knockbackStrength;
            } else {
                const randomAngle = Math.random() * Math.PI * 2;
                const knockbackStrength = (isCritical ? 180 : 100) * damageScale;
                this.velocity.x += Math.cos(randomAngle) * knockbackStrength;
                this.velocity.y += Math.sin(randomAngle) * knockbackStrength;
            }
        }

        // Hit-spark particles at impact point
        if (this.game.systems.particle) {
            const sparkCount = isCritical ? 6 : 3;
            for (let i = 0; i < sparkCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 80 + Math.random() * 120;
                this.game.systems.particle.create({
                    x: this.x,
                    y: this.y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    color: isCritical ? '#FFFFFF' : '#FFDD44',
                    size: isCritical ? 2 + Math.random() * 3 : 1.5 + Math.random() * 2,
                    lifetime: 0.15 + Math.random() * 0.1,
                    decay: 0.9,
                    type: 'circle'
                });
            }
        }

        // Camera shake proportional to damage
        if (this.game.camera) {
            const shakeIntensity = Math.min(10, damage * 0.08);
            if (isCritical) {
                this.game.camera.shake(shakeIntensity * 1.5, 0.12, 'critical');
            } else if (damage > 15) {
                this.game.camera.shake(shakeIntensity, 0.08, 'subtle');
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
        if (!this.active || this._deathProcessed) return;

        this._deathProcessed = true;

        // Track in codex/bestiary
        this.game.systems.codex?.discoverEnemy(this.type);

        // CRITICAL FIX: Create all visual effects BEFORE marking inactive
        // This ensures particles have proper context and timing

        // ADDICTION MECHANICS: Trigger combo system and psychological rewards
        const finalDamage = this.lastDamageAmount || this.maxHealth;
        const wasCritical = this.lastDamageWasCritical || false;

        // Drop raw enemy XP once; pickup-time systems apply player multipliers.
        let expReward = this.expReward;

        // Golden Swarm: 3x XP + bonus gold drop
        if (this.game.systems.dynamicEvents?.goldenSwarmActive) {
            expReward *= 3;
            if (this.game.systems.gold) {
                this.game.systems.gold.spawnCoin(this.x, this.y, 2 + Math.floor(Math.random() * 4));
            }
        }

        // Death particle effect with enhanced feedback for combos - CREATE FIRST
        const comboLevel = this.game.player ? Math.min(this.game.player.combo.count / 10, 3.0) : 1.0;

        // ── PER-TYPE DEATH ANIMATIONS ──
        const ps = this.game.systems.particle;
        if (ps) {
            switch (this.type) {
                case 'fast': {
                    // Fast scatter: quick burst of small particles radiating outward
                    const count = 8 + Math.floor(comboLevel * 3);
                    for (let i = 0; i < count; i++) {
                        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
                        const speed = 120 + Math.random() * 80;
                        ps.create(this.x, this.y, {
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed,
                            life: 0.3 + Math.random() * 0.2,
                            size: 2 + Math.random() * 2,
                            color: this.color,
                            fadeOut: true
                        });
                    }
                    break;
                }

                case 'tank': {
                    // Dissolve: particles float upward like ash
                    const count = 14 + Math.floor(comboLevel * 4);
                    for (let i = 0; i < count; i++) {
                        const offsetX = (Math.random() - 0.5) * this.size * 2;
                        const offsetY = (Math.random() - 0.5) * this.size * 2;
                        ps.create(this.x + offsetX, this.y + offsetY, {
                            vx: (Math.random() - 0.5) * 30,
                            vy: -(40 + Math.random() * 60),
                            life: 0.8 + Math.random() * 0.6,
                            size: 3 + Math.random() * 3,
                            color: this.color,
                            fadeOut: true,
                            glow: true
                        });
                    }
                    // Ground debris
                    for (let i = 0; i < 5; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        ps.create(this.x, this.y, {
                            vx: Math.cos(angle) * (50 + Math.random() * 40),
                            vy: Math.sin(angle) * (50 + Math.random() * 40),
                            life: 0.4 + Math.random() * 0.3,
                            size: 4 + Math.random() * 2,
                            color: '#666666',
                            fadeOut: true
                        });
                    }
                    break;
                }

                case 'ranged': {
                    // Explosion: outward debris burst + flash
                    const count = 10 + Math.floor(comboLevel * 3);
                    for (let i = 0; i < count; i++) {
                        const angle = (i / count) * Math.PI * 2;
                        const speed = 80 + Math.random() * 100;
                        ps.create(this.x, this.y, {
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed,
                            life: 0.5 + Math.random() * 0.3,
                            size: 2 + Math.random() * 3,
                            color: this.color,
                            fadeOut: true,
                            glow: true
                        });
                    }
                    // Central flash
                    ps.create(this.x, this.y, {
                        vx: 0,
                        vy: 0,
                        life: 0.15,
                        size: this.size * 2,
                        color: '#FFFFFF',
                        fadeOut: true,
                        glow: true
                    });
                    break;
                }

                case 'elite': {
                    // Multi-stage dramatic death
                    // Stage 1: Freeze-frame ring
                    ps.create(this.x, this.y, {
                        vx: 0,
                        vy: 0,
                        life: 0.3,
                        size: this.size * 3,
                        color: '#FFD700',
                        fadeOut: true,
                        glow: true
                    });
                    // Stage 2: Delayed colored trail burst
                    const count = 20 + Math.floor(comboLevel * 5);
                    for (let i = 0; i < count; i++) {
                        const angle = (i / count) * Math.PI * 2;
                        const speed = 60 + Math.random() * 120;
                        const delay = 0.05 + Math.random() * 0.1;
                        ps.create(this.x, this.y, {
                            vx: Math.cos(angle) * speed * delay * 10,
                            vy: Math.sin(angle) * speed * delay * 10,
                            life: 0.8 + Math.random() * 0.5,
                            size: 3 + Math.random() * 4,
                            color: i % 2 === 0 ? '#FFD700' : this.color,
                            fadeOut: true,
                            glow: true
                        });
                    }
                    // Stage 3: Rising sparkles
                    for (let i = 0; i < 8; i++) {
                        ps.create(this.x + (Math.random() - 0.5) * 20, this.y + (Math.random() - 0.5) * 20, {
                            vx: (Math.random() - 0.5) * 20,
                            vy: -(60 + Math.random() * 40),
                            life: 1.0 + Math.random() * 0.5,
                            size: 2,
                            color: '#FFFFFF',
                            fadeOut: true,
                            glow: true,
                            pulse: true
                        });
                    }
                    break;
                }

                default: {
                    // Basic enemies: simple radial burst
                    const count = 6 + Math.floor(comboLevel * 2);
                    for (let i = 0; i < count; i++) {
                        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
                        const speed = 60 + Math.random() * 60;
                        ps.create(this.x, this.y, {
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed,
                            life: 0.4 + Math.random() * 0.2,
                            size: 2 + Math.random() * 2,
                            color: this.color,
                            fadeOut: true
                        });
                    }
                    break;
                }
            }
        }

        // Also call existing enhanced death effect for VFX stacking
        if (ps && ps.createEnhancedDeathEffect) {
            ps.createEnhancedDeathEffect(this.x, this.y, this.color, comboLevel);
        }

        // Escalating screen shake based on combo
        const shakeIntensity = Math.min(5, 2 + comboLevel);
        if (this.game && this.game.camera && typeof this.game.camera.shake === 'function') {
            this.game.camera.shake(shakeIntensity, 0.1 + comboLevel * 0.05);
        }

        // Hit-stop on elite kills for dramatic weight
        if (this.type === 'elite' && this.game.camera && typeof this.game.camera.hitStop === 'function') {
            this.game.camera.hitStop(3, 0.5);
        }

        // Zoom punch on multi-kill (every 10 combo kills)
        if (this.game.player && this.game.player.combo.count % 10 === 0 && this.game.player.combo.count >= 10) {
            if (this.game.camera && typeof this.game.camera.zoomPunch === 'function') {
                const zoomIntensity = Math.min(0.8, this.game.player.combo.count / 50);
                this.game.camera.zoomPunch(zoomIntensity);
            }
        }

        // Drop experience gem with combo bonus
        this.game.systems.experience.createGem(
            this.x + (Math.random() - 0.5) * 20,
            this.y + (Math.random() - 0.5) * 20,
            expReward
        );

        // Elite explodeOnDeath: damage player if nearby.
        // Base 30 damage scaled by difficulty but capped at 35% of player max HP for first 5 min,
        // scaling to 50% by 10 min — prevents one-shots from this ability in early game.
        if (this.eliteAbility === 'explodeOnDeath') {
            const player = this.game.player;
            if (player) {
                const edx = player.x - this.x;
                const edy = player.y - this.y;
                if (Math.sqrt(edx * edx + edy * edy) <= 80) {
                    const baseExplosionDmg = Math.floor(30 * this.getDifficultyMultiplier());
                    const gameTimeMin = (this.game.gameTime || 0) / 60;
                    let explosionDmg = baseExplosionDmg;
                    if (gameTimeMin < 10) {
                        const capPercent = 0.35 + Math.min(gameTimeMin / 5, 1.0) * 0.15; // 0.35→0.50
                        explosionDmg = Math.min(explosionDmg, Math.floor(player.maxHealth * capPercent));
                    }
                    player.takeDamage(Math.max(10, explosionDmg), { type: 'elite', name: 'Elite Explosion' });
                }
            }
            // Red/orange explosion particles
            if (ps) {
                for (let i = 0; i < 12; i++) {
                    const angle = (i / 12) * Math.PI * 2;
                    const speed = 60 + Math.random() * 80;
                    ps.create(this.x, this.y, {
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        life: 0.4 + Math.random() * 0.3,
                        size: 4 + Math.random() * 3,
                        color: Math.random() > 0.5 ? '#FF4500' : '#FF0000',
                        glow: true,
                        fadeOut: true
                    });
                }
            }
            if (this.game.camera && typeof this.game.camera.shake === 'function') {
                this.game.camera.shake(8, 0.3);
            }
        }

        // Death scale pop animation: brief scale-up then shrink to nothing
        this.dying = true;
        this.deathScaleTimer = this.deathScaleDuration;

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
            const cap = this.game.maxPowerUpDrops || 8;
            const current = this.game.powerUpDrops?.length || 0;
            // Dynamic probability scales down as we approach the cap
            let chance = 0.2; // base 20%
            if (current >= cap * 0.75) chance = 0.05;
            else if (current >= cap * 0.5) chance = 0.12;
            if (Math.random() < chance) {
                this.game.spawnPowerUpDrop(this.x, this.y);
            }
        }

        // Track kill for rewards system (kill streaks, XP multiplier)
        if (this.game.systems.rewards) {
            this.game.systems.rewards.onEnemyKilled();
        }

        // Track kill for milestones system (kill counts, celebrations)
        if (this.game.systems.killMilestone) {
            this.game.systems.killMilestone.onEnemyKilled();
        }

        // Gold drop chance
        if (this.game.systems.gold) {
            this.game.systems.gold.onEnemyKilled(this);
        }

        // Floor item drops (health orbs, vacuum, rosary, chests for elites)
        if (this.game.systems.floorItems) {
            this.game.systems.floorItems.onEnemyDeath(this);
        }

        // Audio: enemy death sound (throttled by AudioManager)
        if (this.game.audioManager && this.game.audioManager.playEnemyDeath) {
            this.game.audioManager.playEnemyDeath();
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
        return globalDamageNumberPool.get(this.x + (Math.random() - 0.5) * 10, this.y - 5, amount, color, isCritical);
    }

    // updateDamageNumbers removed - now handled by globalDamageNumberPool

    lightenColor(color, amount) {
        if (!color) return '#ffffff';
        let hex = color.replace('#', '');
        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + 255 * amount);
        const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + 255 * amount);
        const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + 255 * amount);
        return (
            '#' +
            Math.round(r).toString(16).padStart(2, '0') +
            Math.round(g).toString(16).padStart(2, '0') +
            Math.round(b).toString(16).padStart(2, '0')
        );
    }

    darkenColor(color, amount) {
        if (!color) return '#000000';
        let hex = color.replace('#', '');
        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) * (1 - amount));
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) * (1 - amount));
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) * (1 - amount));
        return (
            '#' +
            Math.round(r).toString(16).padStart(2, '0') +
            Math.round(g).toString(16).padStart(2, '0') +
            Math.round(b).toString(16).padStart(2, '0')
        );
    }

    render(renderer, detailLevel = 'high') {
        if (!this.active) return;

        const ctx = renderer.ctx;
        const simplifyBody = detailLevel !== 'high' && !['elite', 'summoner', 'juggernaut'].includes(this.type);
        ctx.save();

        // Death scale pop animation: scale up to 1.3x then shrink to 0
        if (this.dying) {
            const t = this.deathScaleTimer / this.deathScaleDuration; // 1→0
            // First half: scale up to 1.3x, second half: shrink to 0
            const scale = t > 0.5 ? 1.0 + (1 - t) * 0.6 : t * 2.6;
            ctx.translate(this.x, this.y);
            ctx.scale(scale, scale);
            ctx.translate(-this.x, -this.y);
            ctx.globalAlpha = Math.max(0, t);
        }

        // Hit freeze-frame: enlarge slightly with white flash
        if (this.freezeTimer > 0 && !this.dying) {
            ctx.translate(this.x, this.y);
            ctx.scale(1.1, 1.1);
            ctx.translate(-this.x, -this.y);
        }

        // Spawn animation
        if (this.currentSpawnTime > 0) {
            const spawnProgress = 1 - this.currentSpawnTime / this.spawnTime;
            ctx.globalAlpha = spawnProgress;
            ctx.translate(this.x, this.y);
            ctx.scale(spawnProgress, spawnProgress);
            ctx.translate(-this.x, -this.y);
        }

        // 1. Ground shadow
        ctx.fillStyle = 'rgba(10, 6, 14, 0.28)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + this.size * 0.42, this.size * 0.92, this.size * 0.44, 0, 0, Math.PI * 2);
        ctx.fill();

        // Flash effect when damaged
        const isFlashing = this.flashTime > 0;
        if (isFlashing) {
            ctx.shadowColor = '#FFFFFF';
            ctx.shadowBlur = 10;
        }

        // Draw enemy body (Golden Swarm tint)
        const isGoldenSwarm = this.game.systems.dynamicEvents?.goldenSwarmActive;
        let bodyColor = this.color;
        if (isGoldenSwarm) {
            bodyColor = '#FFD700';
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 6;
        }

        if (simplifyBody) {
            ctx.fillStyle = isFlashing ? '#FFFFFF' : bodyColor;
        } else {
            const grad = ctx.createRadialGradient(
                this.x - this.size * 0.2,
                this.y - this.size * 0.2,
                0,
                this.x,
                this.y,
                this.size
            );
            grad.addColorStop(0, isFlashing ? '#FFFFFF' : this.lightenColor(bodyColor, 0.28));
            grad.addColorStop(0.7, bodyColor);
            grad.addColorStop(1, this.darkenColor(bodyColor, 0.45));
            ctx.fillStyle = grad;
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();

        if (isGoldenSwarm) {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        }
        ctx.shadowBlur = 0; // Turn off shadow blur for internal details

        // 4. Internal Details (personality/menace)
        if (!isFlashing && detailLevel === 'high') {
            ctx.save();
            // Rotate facing player
            ctx.translate(this.x, this.y);
            ctx.rotate(this.direction);

            // "Eyes" or core slits depending on enemy type
            if (this.type === 'ranged' || this.type === 'summoner') {
                // Central glowing diamond core
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.moveTo(0, -this.size * 0.28);
                ctx.lineTo(this.size * 0.24, 0);
                ctx.lineTo(0, this.size * 0.28);
                ctx.lineTo(-this.size * 0.24, 0);
                ctx.closePath();
                ctx.fill();
            } else if (this.type === 'juggernaut' || this.type === 'tank') {
                // Single cyclops slit
                ctx.fillStyle = '#FFEB3B';
                ctx.fillRect(-this.size * 0.12, -this.size * 0.28, this.size * 0.24, this.size * 0.56);
            } else {
                // Classic aggressive dual hollow eyes
                ctx.fillStyle = '#FFDDDD';
                ctx.beginPath();
                ctx.arc(-this.size * 0.22, -this.size * 0.12, this.size * 0.16, 0, Math.PI * 2);
                ctx.arc(this.size * 0.22, -this.size * 0.12, this.size * 0.16, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }

        // Draw type-specific details
        this.renderTypeDetails(ctx, detailLevel);

        this.renderHealthBar(ctx, detailLevel);

        ctx.restore();

        // Note: Damage numbers now rendered by globalDamageNumberPool
    }

    renderTypeDetails(ctx, detailLevel = 'high') {
        if (this.variant && detailLevel === 'high') {
            this.renderVariantIndicator(ctx);
        }

        switch (this.type) {
            case 'fast':
                if (detailLevel === 'low') break;
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
                if (detailLevel === 'low') break;
                // Draw armor plating
                ctx.strokeStyle = '#333333';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size * 0.7, 0, Math.PI * 2);
                ctx.stroke();
                break;

            case 'ranged':
                if (detailLevel === 'low') break;
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

                // Aura ring (rendered before ability indicator so it's behind)
                if (this.auraType) {
                    this.renderAura(ctx);
                }

                // Elite ability visual telegraphs
                if (this.eliteAbility) {
                    this.renderEliteAbilityIndicator(ctx);
                }
                break;
        }
    }

    renderEliteAbilityIndicator(ctx) {
        const time = performance.now() * 0.001;

        switch (this.eliteAbility) {
            case 'shield': {
                if (this.shieldHits <= 0) break;
                // Translucent blue shield ring
                ctx.save();
                ctx.strokeStyle = '#4FC3F7';
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = 0.4 + 0.15 * Math.sin(time * 3);
                ctx.shadowColor = '#4FC3F7';
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size + 6, 0, Math.PI * 2);
                ctx.stroke();
                // Shield hit count indicator (small dots)
                for (let i = 0; i < this.shieldHits; i++) {
                    const dotAngle = -Math.PI / 2 + (i - (this.shieldHits - 1) / 2) * 0.5;
                    ctx.fillStyle = '#4FC3F7';
                    ctx.beginPath();
                    ctx.arc(
                        this.x + Math.cos(dotAngle) * (this.size + 10),
                        this.y + Math.sin(dotAngle) * (this.size + 10),
                        2,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                }
                ctx.restore();
                break;
            }
            case 'teleport': {
                // Alpha flicker when teleport is nearly ready
                if (this.teleportCooldown < 1.0) {
                    ctx.save();
                    ctx.strokeStyle = '#CE93D8';
                    ctx.lineWidth = 1;
                    ctx.globalAlpha = 0.3 * Math.abs(Math.sin(time * 10));
                    ctx.setLineDash([3, 3]);
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size + 4, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.restore();
                }
                break;
            }
            case 'healNearby': {
                // Green pulse when about to heal
                if (this.healTimer < 1.5) {
                    ctx.save();
                    const pulseAlpha = 0.2 + 0.15 * Math.sin(time * 5);
                    ctx.strokeStyle = '#4CAF50';
                    ctx.lineWidth = 1;
                    ctx.globalAlpha = pulseAlpha;
                    ctx.shadowColor = '#4CAF50';
                    ctx.shadowBlur = 4;
                    const pulseRadius = this.size + 4 + Math.sin(time * 4) * 3;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, pulseRadius, 0, Math.PI * 2);
                    ctx.stroke();
                    // Small cross indicator
                    ctx.globalAlpha = pulseAlpha * 1.5;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(this.x - 3, this.y - this.size - 6);
                    ctx.lineTo(this.x + 3, this.y - this.size - 6);
                    ctx.moveTo(this.x, this.y - this.size - 9);
                    ctx.lineTo(this.x, this.y - this.size - 3);
                    ctx.stroke();
                    ctx.restore();
                }
                break;
            }
            case 'explodeOnDeath': {
                // Faint red inner glow
                ctx.save();
                ctx.globalAlpha = 0.15 + 0.08 * Math.sin(time * 2);
                const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
                grad.addColorStop(0, '#FF4500');
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                break;
            }
        }
    }

    renderAura(ctx) {
        if (!this.auraType) return;
        const time = performance.now() * 0.001;
        const r    = this.auraRadius || 150;
        const pulse = 0.15 + Math.sin(time * 2.5) * 0.06;

        const auraColors = {
            warchief:    { stroke: '#FF4422', glow: 'rgba(255,68,34,0.35)' },
            lifebinder:  { stroke: '#22CC55', glow: 'rgba(34,204,85,0.35)' },
            frostlord:   { stroke: '#44BBFF', glow: 'rgba(68,187,255,0.35)' },
            void_herald: { stroke: '#CC44FF', glow: 'rgba(204,68,255,0.35)' }
        };
        const col = auraColors[this.auraType];
        if (!col) return;

        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = col.stroke;
        ctx.lineWidth   = 2.5;
        ctx.shadowColor = col.stroke;
        ctx.shadowBlur  = 14;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Rotating accent dot
        const dotAngle = time * 1.8;
        ctx.globalAlpha = 0.7;
        ctx.shadowBlur  = 8;
        ctx.fillStyle   = col.stroke;
        ctx.beginPath();
        ctx.arc(
            this.x + Math.cos(dotAngle) * r,
            this.y + Math.sin(dotAngle) * r,
            4, 0, Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
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

    renderHealthBar(ctx, detailLevel = 'high') {
        const barWidth = Math.max(24, this.size * 2.5);
        const barHeight = detailLevel === 'low' ? 3 : 4;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.size - 10;
        const healthRatio = this.health / this.maxHealth;
        const alwaysShow = detailLevel === 'high' || this.type === 'elite';

        if (healthRatio >= 1.0) {
            if (!alwaysShow) {
                return;
            }
            ctx.fillStyle = 'rgba(0, 255, 0, 0.25)';
            ctx.fillRect(barX, barY, barWidth, 2);
            return;
        }

        // Background with border
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

        // Dark background
        ctx.fillStyle = '#222222';
        ctx.fillRect(barX, barY, barWidth, barHeight);
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

        if (detailLevel !== 'low' && healthRatio < 0.5) {
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
        this.freezeTimer = 0;
        this.dying = false;
        this.deathScaleTimer = 0;
        this.currentSpawnTime = this.spawnTime;
        // Note: Damage numbers now managed by globalDamageNumberPool
        this.active = true;
        this._deathProcessed = false;

        // Reset elite ability state
        this.eliteAbility = null;
        this.shieldHits = 0;
        this.teleportCooldown = 0;
        this.healTimer = 0;

        // Elite aura state (set externally by EnemySystem after wave 8)
        this.auraType   = null;
        this.auraTimer  = 0;
        this.auraBuffed = false; // set each frame by EnemySystem.applyAuraEffects()

        this.initializeType(type);
        this.health = this.maxHealth;
    }

    /**
     * Assign an aura to this elite enemy (called by EnemySystem).
     * @param {'warchief'|'lifebinder'|'frostlord'|'void_herald'} type
     */
    setAura(type) {
        this.auraType  = type;
        this.auraTimer = 0;
        // Aura elites are tougher
        this.maxHealth  = Math.round(this.maxHealth * 1.5);
        this.health     = this.maxHealth;
        this.auraRadius = 150; // default buffing radius (px)
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
                if (this.game.showDebug) {
                    console.log('💀 Berserker entering rage mode!');
                }
            }
        }

        // Summoner: Spawns minions periodically
        else if (this.type === 'summoner') {
            this.summonTimer += dt;
            if (this.summonTimer >= 4.0) {
                // Every 4 seconds
                this.summonTimer = 0;
                this.summonMinions();
            }
        }

        // Juggernaut: Creates shockwaves periodically
        else if (this.type === 'juggernaut') {
            const timeSinceShockwave = this.game.gameTime - this.lastShockwaveTime;
            if (timeSinceShockwave >= 6.0) {
                // Every 6 seconds
                this.createShockwave();
                this.lastShockwaveTime = this.game.gameTime;
            }
        }

        // Base elite type: special abilities
        else if (this.type === 'elite' && this.eliteAbility) {
            this.updateEliteAbility(dt);
        }
    }

    updateEliteAbility(dt) {
        const player = this.game.player;
        if (!player || !player.isAlive()) return;

        switch (this.eliteAbility) {
            case 'teleport': {
                this.teleportCooldown -= dt;
                if (this.teleportCooldown <= 0) {
                    const dx = player.x - this.x;
                    const dy = player.y - this.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 100) {
                        // Shimmer particles at old position
                        if (this.game.systems.particle) {
                            for (let i = 0; i < 8; i++) {
                                const angle = (i / 8) * Math.PI * 2;
                                this.game.systems.particle.create(this.x, this.y, {
                                    vx: Math.cos(angle) * 40,
                                    vy: Math.sin(angle) * 40,
                                    life: 0.4,
                                    size: 4,
                                    color: '#CE93D8',
                                    glow: true,
                                    fadeOut: true
                                });
                            }
                        }
                        // Teleport to random point 200-300px from player
                        const teleAngle = Math.random() * Math.PI * 2;
                        const teleDist = 200 + Math.random() * 100;
                        this.x = player.x + Math.cos(teleAngle) * teleDist;
                        this.y = player.y + Math.sin(teleAngle) * teleDist;
                        // Shimmer particles at new position
                        if (this.game.systems.particle) {
                            for (let i = 0; i < 6; i++) {
                                const angle = (i / 6) * Math.PI * 2;
                                this.game.systems.particle.create(this.x, this.y, {
                                    vx: Math.cos(angle) * 30,
                                    vy: Math.sin(angle) * 30,
                                    life: 0.3,
                                    size: 5,
                                    color: '#AB47BC',
                                    glow: true,
                                    fadeOut: true
                                });
                            }
                        }
                    }
                    this.teleportCooldown = 5.0;
                }
                break;
            }
            case 'healNearby': {
                this.healTimer -= dt;
                if (this.healTimer <= 0) {
                    const nearby = this.game.systems.enemy.getEnemiesInRange(this.x, this.y, 150);
                    let healed = 0;
                    for (const ally of nearby) {
                        if (ally === this || !ally.active || healed >= 3) continue;
                        if (ally.health < ally.maxHealth) {
                            ally.health = Math.min(ally.maxHealth, ally.health + 20);
                            healed++;
                            // Green heal particle on ally
                            if (this.game.systems.particle) {
                                this.game.systems.particle.create(ally.x, ally.y - ally.size, {
                                    vx: 0,
                                    vy: -25,
                                    life: 0.6,
                                    size: 6,
                                    color: '#66BB6A',
                                    glow: true,
                                    fadeOut: true
                                });
                            }
                        }
                    }
                    // Green pulse at healer
                    if (healed > 0 && this.game.systems.particle) {
                        for (let i = 0; i < 6; i++) {
                            const angle = (i / 6) * Math.PI * 2;
                            this.game.systems.particle.create(this.x, this.y, {
                                vx: Math.cos(angle) * 50,
                                vy: Math.sin(angle) * 50,
                                life: 0.5,
                                size: 4,
                                color: '#4CAF50',
                                glow: true,
                                fadeOut: true
                            });
                        }
                    }
                    this.healTimer = 6.0;
                }
                break;
            }
            // shield and explodeOnDeath have no per-frame logic
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
            player.takeDamage(damage, { type: this.type, name: this.variant ? `${this.variant} ${this.type}` : this.type });

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
