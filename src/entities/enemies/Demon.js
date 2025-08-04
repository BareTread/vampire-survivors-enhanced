import { Enemy } from '../Enemy.js';

export class Demon extends Enemy {
    constructor(game, x, y) {
        super(game, x, y, 'demon');
        
        // Override base enemy properties for Demon
        this.maxHealth = this.maxHealth || 80;
        this.health = this.maxHealth;
        this.speed = 45;
        this.damage = 35;
        this.size = 16;
        this.color = '#DC143C';
        this.expReward = 20;
        
        // FIXED: Set attackRange for demon
        this.attackRange = 30; // Melee attack range
        this.baseAttackCooldown = 1.2; // Attack cooldown
        
        // Demon-specific properties
        this.rageMode = false;
        this.rageModeThreshold = 0.3; // Enter rage at 30% health
        this.rageMultiplier = 1.8; // 80% increase in stats
        this.originalStats = {};
        
        // Area attack properties
        this.areaAttackRange = 100;
        this.areaAttackCooldown = 3.0;
        this.areaAttackTimer = 0;
        this.chargingAreaAttack = false;
        this.chargeTime = 1.5; // Time to charge area attack
        this.chargeTimer = 0;
        
        // Fire abilities
        this.fireballRange = 150;
        this.fireballSpeed = 180;
        this.fireballCooldown = 2.0;
        this.fireballTimer = 0;
        this.burnDuration = 3.0; // How long burn effect lasts
        
        // Visual properties
        this.baseColor = '#DC143C';
        this.rageColor = '#FF0000';
        this.fireColor = '#FF4500';
        this.glowIntensity = 12;
        this.flamePulse = 0;
        
        // Behavioral properties
        this.aggressionLevel = 1.0; // How aggressive this demon is
        this.territorialRadius = 120; // Defends this area around spawn point
        this.spawnX = x;
        this.spawnY = y;
        
        // Animation properties
        this.wingFlap = 0;
        this.wingFlapSpeed = 4.0;
        this.bodyBob = 0;
        this.bodyBobSpeed = 2.5;
    }
    
    initializeType(type) {
        // Override the base initializeType
        const difficultyMultiplier = this.getDifficultyMultiplier();
        
        this.maxHealth = Math.floor(80 * difficultyMultiplier);
        this.health = this.maxHealth;
        this.damage = Math.floor(35 * difficultyMultiplier);
        this.expReward = Math.floor(20 * difficultyMultiplier);
        
        // Store original stats for rage mode calculations
        this.originalStats = {
            damage: this.damage,
            speed: this.speed,
            attackCooldown: this.baseAttackCooldown
        };
        
        // Apply adaptive damage from flow state
        if (this.game.systems && this.game.systems.flowState && this.game.systems.flowState.adaptiveDamageMultiplier) {
            this.damage = Math.floor(this.damage * this.game.systems.flowState.adaptiveDamageMultiplier);
            this.originalStats.damage = this.damage;
        }
    }
    
    update(dt) {
        if (!this.active) return;
        
        // Update spawn animation
        if (this.currentSpawnTime > 0) {
            this.currentSpawnTime -= dt;
            return;
        }
        
        // Update animation timers
        this.updateAnimationTimers(dt);
        
        // Check for rage mode activation
        this.updateRageMode();
        
        // Update ability timers
        this.updateAbilityTimers(dt);
        
        // Update AI behavior
        this.updateDemonAI(dt);
        
        // Apply movement
        this.x += this.velocity.x * dt;
        this.y += this.velocity.y * dt;
        
        // Coordinate validation 
        if (!isFinite(this.x) || !isFinite(this.y) || Math.abs(this.x) > 1e6 || Math.abs(this.y) > 1e6) {
            console.warn('Demon coordinate overflow detected, resetting position');
            if (this.game.player) {
                this.x = this.game.player.x + (Math.random() - 0.5) * 400;
                this.y = this.game.player.y + (Math.random() - 0.5) * 400;
            } else {
                this.x = 0;
                this.y = 0;
            }
            this.velocity = { x: 0, y: 0 };
        }
        
        // Update damage numbers and flash effects
        this.updateDamageNumbers(dt);
        if (this.flashTime > 0) {
            this.flashTime -= dt;
        }
    }
    
    updateAnimationTimers(dt) {
        this.wingFlap += this.wingFlapSpeed * dt;
        this.bodyBob += this.bodyBobSpeed * dt;
        this.flamePulse += dt * 3.0;
    }
    
    updateRageMode() {
        const healthPercent = this.health / this.maxHealth;
        
        if (!this.rageMode && healthPercent <= this.rageModeThreshold) {
            this.enterRageMode();
        } else if (this.rageMode && healthPercent > this.rageModeThreshold) {
            this.exitRageMode();
        }
    }
    
    enterRageMode() {
        this.rageMode = true;
        this.color = this.rageColor;
        
        // Boost stats
        this.damage = Math.floor(this.originalStats.damage * this.rageMultiplier);
        this.speed = Math.floor(this.originalStats.speed * this.rageMultiplier);
        this.baseAttackCooldown = this.originalStats.attackCooldown / this.rageMultiplier;
        
        // Reduce ability cooldowns
        this.areaAttackTimer = Math.max(0, this.areaAttackTimer - 1.0);
        this.fireballTimer = Math.max(0, this.fireballTimer - 0.5);
        
        // Visual and audio effects
        this.createRageEnterEffect();
        this.playDemonSound('demon_rage_enter');
    }
    
    exitRageMode() {
        this.rageMode = false;
        this.color = this.baseColor;
        
        // Restore original stats
        this.damage = this.originalStats.damage;
        this.speed = this.originalStats.speed;
        this.baseAttackCooldown = this.originalStats.attackCooldown;
    }
    
    updateAbilityTimers(dt) {
        // Area attack timer
        if (this.areaAttackTimer > 0) {
            this.areaAttackTimer -= dt;
        }
        
        // Fireball timer
        if (this.fireballTimer > 0) {
            this.fireballTimer -= dt;
        }
        
        // Charge timer for area attack
        if (this.chargingAreaAttack) {
            this.chargeTimer += dt;
            if (this.chargeTimer >= this.chargeTime) {
                this.executeAreaAttack();
                this.chargingAreaAttack = false;
                this.chargeTimer = 0;
            }
        }
        
        // Attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }
    }
    
    updateDemonAI(dt) {
        const player = this.game.player;
        if (!player || !player.isAlive()) return;
        
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        this.direction = Math.atan2(dy, dx);
        
        // Determine behavior based on distance and abilities
        if (this.chargingAreaAttack) {
            // Stay still while charging area attack
            this.velocity.x *= 0.1;
            this.velocity.y *= 0.1;
            return;
        }
        
        // Check for area attack opportunity
        if (this.areaAttackTimer <= 0 && distance <= this.areaAttackRange) {
            this.startAreaAttack();
            return;
        }
        
        // Check for fireball attack opportunity
        if (this.fireballTimer <= 0 && distance > this.attackRange && distance <= this.fireballRange) {
            this.fireballAttack();
            return;
        }
        
        // Movement behavior
        if (distance > this.attackRange) {
            // Move towards player with territorial behavior
            const moveTowardsPlayer = this.shouldMoveTowardsPlayer(distance);
            
            if (moveTowardsPlayer) {
                const normalizedX = dx / distance;
                const normalizedY = dy / distance;
                
                this.velocity.x = normalizedX * this.speed;
                this.velocity.y = normalizedY * this.speed;
                
                // Apply separation from other enemies
                const separation = this.getSeparationForce();
                this.velocity.x += separation.x * 0.5; // Demons are less affected by separation
                this.velocity.y += separation.y * 0.5;
            } else {
                // Patrol around territorial area
                this.patrolTerritory();
            }
        } else {
            // In melee range - attack
            this.velocity.x *= 0.3;
            this.velocity.y *= 0.3;
            
            if (this.attackCooldown <= 0) {
                this.meleeAttack();
            }
        }
    }
    
    shouldMoveTowardsPlayer(distance) {
        // More aggressive demons always pursue
        if (this.rageMode) return true;
        if (this.aggressionLevel > 0.8) return true;
        
        // Territorial behavior - pursue if player is in territory
        const territoryDistance = Math.sqrt(
            (this.spawnX - this.x) ** 2 + (this.spawnY - this.y) ** 2
        );
        
        if (territoryDistance > this.territorialRadius) {
            return false; // Too far from territory
        }
        
        return distance < this.territorialRadius * 1.5;
    }
    
    patrolTerritory() {
        // Move towards spawn point with some randomness
        const dx = this.spawnX - this.x;
        const dy = this.spawnY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            const normalizedX = dx / distance;
            const normalizedY = dy / distance;
            
            // Add random wandering
            const wanderAngle = (Math.random() - 0.5) * Math.PI;
            const wanderX = Math.cos(wanderAngle) * 0.5;
            const wanderY = Math.sin(wanderAngle) * 0.5;
            
            this.velocity.x = (normalizedX + wanderX) * this.speed * 0.4;
            this.velocity.y = (normalizedY + wanderY) * this.speed * 0.4;
        }
    }
    
    startAreaAttack() {
        this.chargingAreaAttack = true;
        this.chargeTimer = 0;
        this.areaAttackTimer = this.areaAttackCooldown;
        
        // Warning effect
        this.createAreaAttackWarning();
        this.playDemonSound('demon_area_charge');
    }
    
    executeAreaAttack() {
        // Damage all enemies in range
        const enemies = this.game.systems.enemy.getEnemiesInRange(
            this.x, this.y, this.areaAttackRange
        );
        
        // Check if player is in range
        const player = this.game.player;
        if (player && player.isAlive()) {
            const playerDistance = Math.sqrt(
                (player.x - this.x) ** 2 + (player.y - this.y) ** 2
            );
            
            if (playerDistance <= this.areaAttackRange) {
                player.takeDamage(this.damage * 1.5); // Area attack does more damage
            }
        }
        
        // Create explosion effect
        this.createAreaAttackExplosion();
        this.playDemonSound('demon_area_explode');
        
        // Screen shake
        this.game.camera.shake(8, 0.6);
    }
    
    fireballAttack() {
        const player = this.game.player;
        if (!player || !player.isAlive()) return;
        
        // Create fireball projectile
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        
        this.game.systems.projectile.createEnemyProjectile(
            this.x, this.y,
            player.x, player.y,
            this.damage * 0.8, // Fireball does 80% of melee damage
            this.fireballSpeed,
            this.fireColor,
            {
                type: 'fireball',
                onHit: this.onFireballHit.bind(this),
                trail: true,
                size: 8,
                burnDuration: this.burnDuration
            }
        );
        
        this.fireballTimer = this.fireballCooldown;
        
        // Create firing effect
        this.createFireballLaunchEffect();
        this.playDemonSound('demon_fireball');
    }
    
    onFireballHit(projectile, target) {
        // Apply burn effect to target
        if (target && target.takeDamage) {
            // Additional burn damage over time (would need burn system)
            if (this.game.addStatusEffect) {
                this.game.addStatusEffect(target, 'burn', {
                    duration: this.burnDuration,
                    damagePerSecond: this.damage * 0.2,
                    source: this
                });
            }
        }
        
        // Create burn explosion
        this.createBurnExplosion(projectile.x, projectile.y);
    }
    
    meleeAttack() {
        const player = this.game.player;
        if (!player || !player.isAlive()) return;
        
        // Claw attack with knockback
        player.takeDamage(this.damage);
        
        // Apply knockback
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            const knockbackStrength = this.rageMode ? 200 : 120;
            player.velocity.x += (dx / distance) * knockbackStrength;
            player.velocity.y += (dy / distance) * knockbackStrength;
        }
        
        this.attackCooldown = this.baseAttackCooldown;
        
        // Create claw attack effect
        this.createClawAttackEffect();
        this.playDemonSound('demon_claw');
    }
    
    // Visual effects methods
    createRageEnterEffect() {
        if (!this.game.systems.particle) return;
        
        // Rage explosion
        this.game.systems.particle.createBurst(this.x, this.y, 'demonRage', {
            color: this.rageColor,
            count: 20,
            intensity: 2.5,
            spread: 60
        });
        
        // Fire ring
        this.createFireRing(this.x, this.y, 40);
    }
    
    createAreaAttackWarning() {
        if (!this.game.systems.particle) return;
        
        // Warning circle
        const warningParticles = 24;
        for (let i = 0; i < warningParticles; i++) {
            const angle = (i / warningParticles) * Math.PI * 2;
            const x = this.x + Math.cos(angle) * this.areaAttackRange;
            const y = this.y + Math.sin(angle) * this.areaAttackRange;
            
            this.game.systems.particle.create(x, y, {
                vx: 0,
                vy: 0,
                life: this.chargeTime,
                size: 4,
                color: '#FFFF00',
                glow: true,
                pulse: true
            });
        }
    }
    
    createAreaAttackExplosion() {
        if (!this.game.systems.particle) return;
        
        // Main explosion
        this.game.systems.particle.createBurst(this.x, this.y, 'demonExplosion', {
            color: this.fireColor,
            count: 40,
            intensity: 3.0,
            spread: this.areaAttackRange
        });
        
        // Fire ring expansion
        for (let ring = 0; ring < 3; ring++) {
            setTimeout(() => {
                this.createFireRing(this.x, this.y, 30 + ring * 25);
            }, ring * 150);
        }
    }
    
    createFireRing(x, y, radius) {
        if (!this.game.systems.particle) return;
        
        const ringParticles = 20;
        for (let i = 0; i < ringParticles; i++) {
            const angle = (i / ringParticles) * Math.PI * 2;
            const particleX = x + Math.cos(angle) * radius;
            const particleY = y + Math.sin(angle) * radius;
            
            this.game.systems.particle.create(particleX, particleY, {
                vx: Math.cos(angle) * 30,
                vy: Math.sin(angle) * 30,
                life: 1.2,
                size: 6,
                color: this.fireColor,
                glow: true,
                fadeOut: true
            });
        }
    }
    
    createFireballLaunchEffect() {
        if (!this.game.systems.particle) return;
        
        // Muzzle flash
        this.game.systems.particle.createBurst(this.x, this.y, 'fireballLaunch', {
            color: this.fireColor,
            count: 10,
            intensity: 1.5,
            spread: 30
        });
    }
    
    createBurnExplosion(x, y) {
        if (!this.game.systems.particle) return;
        
        // Burn explosion
        this.game.systems.particle.createBurst(x, y, 'burnExplosion', {
            color: '#FF4500',
            count: 15,
            intensity: 2.0,
            spread: 40
        });
    }
    
    createClawAttackEffect() {
        if (!this.game.systems.particle) return;
        
        // Claw slash effect
        const slashAngle = this.direction;
        for (let i = 0; i < 5; i++) {
            const angle = slashAngle + (i - 2) * 0.2;
            const distance = 15 + i * 5;
            const x = this.x + Math.cos(angle) * distance;
            const y = this.y + Math.sin(angle) * distance;
            
            this.game.systems.particle.create(x, y, {
                vx: Math.cos(angle) * 80,
                vy: Math.sin(angle) * 80,
                life: 0.4,
                size: 4,
                color: '#FFFFFF',
                glow: true,
                fadeOut: true
            });
        }
    }
    
    playDemonSound(soundName) {
        if (this.game.audioManager && this.game.audioManager.playVampireSound) {
            const volume = 0.6 + Math.random() * 0.2;
            const pitch = 0.7 + Math.random() * 0.3;
            this.game.audioManager.playVampireSound(soundName, volume, pitch);
        }
    }
    
    render(renderer) {
        if (!this.active) return;
        
        const ctx = renderer.ctx;
        ctx.save();
        
        // Spawn animation
        if (this.currentSpawnTime > 0) {
            const spawnProgress = 1 - (this.currentSpawnTime / this.spawnTime);
            ctx.globalAlpha = spawnProgress;
        }
        
        // Flash effect when damaged
        if (this.flashTime > 0) {
            ctx.shadowColor = '#FFFFFF';
            ctx.shadowBlur = 10;
        }
        
        // Demonic glow
        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.glowIntensity + (this.rageMode ? 8 : 0);
        
        // Body bobbing animation
        const bobOffset = Math.sin(this.bodyBob) * 3;
        const renderY = this.y + bobOffset;
        
        // Draw demon body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, renderY, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw demon details
        this.renderDemonDetails(ctx, renderY);
        
        // Charging area attack indicator
        if (this.chargingAreaAttack) {
            this.renderAreaAttackCharge(ctx);
        }
        
        // Health bar for damaged demons
        if (this.health < this.maxHealth) {
            this.renderHealthBar(ctx, renderY);
        }
        
        ctx.restore();
        
        // Render damage numbers
        this.renderDamageNumbers(ctx);
    }
    
    renderDemonDetails(ctx, renderY) {
        // Demon horns
        ctx.fillStyle = '#8B0000';
        ctx.beginPath();
        ctx.arc(this.x - this.size * 0.4, renderY - this.size * 0.6, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x + this.size * 0.4, renderY - this.size * 0.6, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Wings (animated)
        const wingAngle = Math.sin(this.wingFlap) * 0.3;
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 3;
        
        // Left wing
        ctx.beginPath();
        ctx.moveTo(this.x - this.size * 0.3, renderY);
        ctx.lineTo(this.x - this.size * 1.2, renderY - this.size * 0.5 + Math.sin(this.wingFlap) * 8);
        ctx.stroke();
        
        // Right wing
        ctx.beginPath();
        ctx.moveTo(this.x + this.size * 0.3, renderY);
        ctx.lineTo(this.x + this.size * 1.2, renderY - this.size * 0.5 + Math.sin(this.wingFlap + Math.PI) * 8);
        ctx.stroke();
        
        // Fire aura in rage mode
        if (this.rageMode) {
            const flameIntensity = Math.sin(this.flamePulse) * 0.3 + 0.7;
            ctx.globalAlpha = flameIntensity * 0.6;
            
            // Fire particles around demon
            const flameCount = 8;
            for (let i = 0; i < flameCount; i++) {
                const angle = (i / flameCount) * Math.PI * 2 + this.flamePulse * 0.5;
                const distance = this.size + 8 + Math.sin(this.flamePulse + i) * 5;
                const flameX = this.x + Math.cos(angle) * distance;
                const flameY = renderY + Math.sin(angle) * distance;
                
                ctx.fillStyle = this.fireColor;
                ctx.beginPath();
                ctx.arc(flameX, flameY, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
    
    renderAreaAttackCharge(ctx) {
        const chargeProgress = this.chargeTimer / this.chargeTime;
        
        // Charging circle
        ctx.globalAlpha = 0.4 + chargeProgress * 0.4;
        ctx.strokeStyle = '#FFFF00';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.areaAttackRange * chargeProgress, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.setLineDash([]);
    }
    
    renderHealthBar(ctx, renderY) {
        const barWidth = this.size * 2.5;
        const barHeight = 4;
        const barX = this.x - barWidth / 2;
        const barY = renderY - this.size - 12;
        
        // Background
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#333333';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Health
        const healthRatio = this.health / this.maxHealth;
        let healthColor = '#44FF44';
        
        if (healthRatio <= this.rageModeThreshold) {
            healthColor = '#FF4444'; // Red when in rage mode range
        } else if (healthRatio <= 0.6) {
            healthColor = '#FFAA44'; // Orange when damaged
        }
        
        ctx.fillStyle = healthColor;
        ctx.fillRect(barX, barY, barWidth * healthRatio, barHeight);
        
        // Rage mode indicator
        if (this.rageMode) {
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(barX - 2, barY - 1, 2, barHeight + 2);
            ctx.fillRect(barX + barWidth, barY - 1, 2, barHeight + 2);
        }
    }
    
    // Override death to create spectacular demon death
    die() {
        if (!this.active) return;
        
        this.createDemonDeathEffect();
        super.die();
    }
    
    createDemonDeathEffect() {
        if (!this.game.systems.particle) return;
        
        // Demonic explosion
        this.game.systems.particle.createBurst(this.x, this.y, 'demonDeath', {
            color: this.color,
            count: 30,
            intensity: 3.0,
            spread: 80
        });
        
        // Fire explosion
        this.game.systems.particle.createBurst(this.x, this.y, 'fireExplosion', {
            color: this.fireColor,
            count: 20,
            intensity: 2.5,
            spread: 60
        });
        
        // Soul flames rising
        for (let i = 0; i < 6; i++) {
            setTimeout(() => {
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * 40;
                const flameX = this.x + Math.cos(angle) * distance;
                const flameY = this.y + Math.sin(angle) * distance;
                
                this.game.systems.particle.create(flameX, flameY, {
                    vx: (Math.random() - 0.5) * 40,
                    vy: -80 - Math.random() * 40,
                    life: 2.5,
                    size: 8,
                    color: this.fireColor,
                    glow: true,
                    fadeOut: true
                });
            }, i * 150);
        }
        
        this.playDemonSound('demon_death');
    }
}