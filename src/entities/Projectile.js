export class Projectile {
    constructor(game, x, y, config = {}) {
        this.game = game;
        this.x = x;
        this.y = y;
        
        // Movement properties
        this.velocity = { x: 0, y: 0 };
        this.speed = config.speed || 200;
        this.direction = config.direction || 0;
        
        // Set initial velocity
        this.velocity.x = Math.cos(this.direction) * this.speed;
        this.velocity.y = Math.sin(this.direction) * this.speed;
        
        // Combat properties
        this.damage = config.damage || 10;
        this.piercing = config.piercing || 0; // How many enemies it can pierce through
        this.hitTargets = new Set(); // Track hit targets for piercing
        
        // Visual properties
        this.size = config.size || 4;
        this.color = config.color || '#FFD700';
        this.trail = config.trail || false;
        this.trailPoints = [];
        
        // Lifetime
        this.maxLifetime = config.lifetime || 3.0; // 3 seconds
        this.lifetime = this.maxLifetime;
        
        // Type and behavior
        this.type = config.type || 'basic'; // basic, magic, explosive, etc.
        this.source = config.source || 'player'; // player or enemy
        this.weaponId = config.weaponId || null;
        
        // Physics
        this.gravity = config.gravity || 0;
        this.bounce = config.bounce || false;
        this.bounceCount = 0;
        this.maxBounces = config.maxBounces || 0;
        
        // Special effects
        this.homing = config.homing || false;
        this.homingStrength = config.homingStrength || 100;
        this.homingTarget = null;
        
        // Explosion properties (for explosive projectiles)
        this.explosive = config.explosive || false;
        this.explosionRadius = config.explosionRadius || 50;
        this.explosionDamage = config.explosionDamage || this.damage;
        
        // Status
        this.active = true;
        this.id = Math.random().toString(36).substr(2, 9);
    }
    
    update(dt) {
        if (!this.active) return;
        
        // Update lifetime
        this.lifetime -= dt;
        if (this.lifetime <= 0) {
            this.destroy();
            return;
        }
        
        // Special behaviors based on type
        this.updateSpecialBehavior(dt);
        
        // Apply gravity
        if (this.gravity !== 0) {
            this.velocity.y += this.gravity * dt;
        }
        
        // Update trail
        if (this.trail) {
            this.updateTrail();
        }
        
        // Update position with overflow protection
        const deltaX = this.velocity.x * dt;
        const deltaY = this.velocity.y * dt;
        
        // FIXED: Validate movement delta before applying
        if (isFinite(deltaX) && isFinite(deltaY) && Math.abs(deltaX) < 1000 && Math.abs(deltaY) < 1000) {
            this.x += deltaX;
            this.y += deltaY;
        } else {
            console.warn('Invalid projectile movement delta detected, deactivating');
            this.active = false;
            return;
        }
        
        // FIXED: Prevent coordinate overflow
        if (!isFinite(this.x) || !isFinite(this.y) || Math.abs(this.x) > 1e6 || Math.abs(this.y) > 1e6) {
            console.warn('Projectile coordinate overflow detected, deactivating');
            this.active = false;
            return;
        }
        
        // Check for collisions
        this.checkCollisions();
        
        // Check world boundaries (optional)
        this.checkBoundaries();
    }
    
    updateSpecialBehavior(dt) {
        switch (this.type) {
            case 'homing':
                this.updateHoming(dt);
                break;
            case 'wave':
                this.updateWaveMotion(dt);
                break;
            case 'boomerang':
                this.updateBoomerang(dt);
                break;
        }
    }
    
    updateHoming(dt) {
        if (!this.homing) return;
        
        // Find target if we don't have one
        if (!this.homingTarget || !this.homingTarget.isAlive()) {
            this.findHomingTarget();
        }
        
        if (this.homingTarget) {
            const dx = this.homingTarget.x - this.x;
            const dy = this.homingTarget.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // FIXED: More robust distance check for homing
            if (distance > 0.001) { // Avoid near-zero divisions
                const homingForce = this.homingStrength * dt;
                const normalizedX = dx / distance;
                const normalizedY = dy / distance;
                
                this.velocity.x += normalizedX * homingForce;
                this.velocity.y += normalizedY * homingForce;
                
                // Maintain speed
                const currentSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
                if (currentSpeed > 0) {
                    this.velocity.x = (this.velocity.x / currentSpeed) * this.speed;
                    this.velocity.y = (this.velocity.y / currentSpeed) * this.speed;
                }
            }
        }
    }
    
    updateWaveMotion(dt) {
        // Add sine wave motion perpendicular to movement direction
        const waveAmplitude = 30;
        const waveFrequency = 5;
        const waveOffset = Math.sin(this.lifetime * waveFrequency) * waveAmplitude;
        
        const perpDirection = this.direction + Math.PI / 2;
        this.x += Math.cos(perpDirection) * waveOffset * dt;
        this.y += Math.sin(perpDirection) * waveOffset * dt;
    }
    
    updateBoomerang(dt) {
        // Slow down and eventually return to source
        const slowdownRate = 100; // pixels per second squared
        const currentSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
        
        if (currentSpeed > 0) {
            const slowdown = Math.min(slowdownRate * dt, currentSpeed);
            const slowdownRatio = (currentSpeed - slowdown) / currentSpeed;
            this.velocity.x *= slowdownRatio;
            this.velocity.y *= slowdownRatio;
            
            // If very slow, start returning to player
            if (currentSpeed < 50 && this.game.player) {
                const dx = this.game.player.x - this.x;
                const dy = this.game.player.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 20) {
                    const returnSpeed = 150;
                    // FIXED: Additional safety check for return velocity
                    if (distance > 0.001) {
                        this.velocity.x = (dx / distance) * returnSpeed;
                        this.velocity.y = (dy / distance) * returnSpeed;
                    }
                } else {
                    // Collected by player
                    this.destroy();
                }
            }
        }
    }
    
    findHomingTarget() {
        if (this.source === 'player') {
            // Target nearest enemy
            const enemies = this.game.systems.enemy.getActiveEnemies();
            let nearestEnemy = null;
            let nearestDistance = Infinity;
            
            for (const enemy of enemies) {
                const dx = enemy.x - this.x;
                const dy = enemy.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestEnemy = enemy;
                }
            }
            
            this.homingTarget = nearestEnemy;
        } else {
            // Target player
            this.homingTarget = this.game.player;
        }
    }
    
    updateTrail() {
        this.trailPoints.unshift({ x: this.x, y: this.y, time: performance.now() });
        
        // Remove old trail points
        const maxTrailAge = 200; // milliseconds
        const currentTime = performance.now();
        this.trailPoints = this.trailPoints.filter(point => 
            currentTime - point.time < maxTrailAge
        );
    }
    
    checkCollisions() {
        // CRITICAL FIX: Player projectiles should NEVER hit the player
        if (this.source === 'player') {
            this.checkEnemyCollisions();
        } else if (this.source === 'enemy') {
            this.checkPlayerCollision();
        } else {
            // Invalid source - log error and deactivate projectile
            console.error('CRITICAL: Projectile has invalid source, deactivating!', {
                source: this.source,
                type: this.type,
                id: this.id,
                weaponId: this.weaponId
            });
            this.active = false;
        }
    }
    
    checkEnemyCollisions() {
        const enemies = this.game.systems.enemy.getActiveEnemies();
        
        for (const enemy of enemies) {
            if (this.hitTargets.has(enemy.id)) continue; // Already hit this enemy
            
            if (this.isCollidingWith(enemy)) {
                this.hitEnemy(enemy);
                
                // Mark as hit for piercing
                this.hitTargets.add(enemy.id);
                
                // Check if projectile should be destroyed
                if (this.piercing <= 0 || this.hitTargets.size > this.piercing) {
                    if (this.explosive) {
                        this.explode();
                    } else {
                        this.destroy();
                    }
                    return;
                }
            }
        }
    }
    
    checkPlayerCollision() {
        // CRITICAL SAFETY: Never allow player projectiles to hit the player
        if (this.source === 'player') {
            console.error('🚫 BUG PREVENTED: Player projectile tried to hit player!', this);
            return;
        }
        
        const player = this.game.player;
        if (!player || !player.isAlive()) return;
        
        if (this.isCollidingWith(player)) {
            this.hitPlayer(player);
            this.destroy();
        }
    }
    
    isCollidingWith(entity) {
        const distanceSquared = (this.x - entity.x) * (this.x - entity.x) + (this.y - entity.y) * (this.y - entity.y);
        
        // Use actual collision size - for enemies, use visual size instead of enlarged hitbox
        let entityCollisionSize = entity.size;
        if (entity.hitbox && entity.hitbox.width) {
            // For enemies with hitboxes, use visual size for collision detection
            entityCollisionSize = entity.size; // Use visual size, not hitbox size
        }
        
        const minDistance = this.size + entityCollisionSize;
        const minDistanceSquared = minDistance * minDistance;
        
        return distanceSquared <= minDistanceSquared;
    }
    
    hitEnemy(enemy) {
        // Calculate damage with psychology system if available
        let damageInfo;
        
        if (this.sourceWeapon && this.sourceWeapon.calculateDamageWithPsychology) {
            damageInfo = this.sourceWeapon.calculateDamageWithPsychology();
        } else {
            // Fallback to basic damage calculation
            const baseDamage = this.damage * (this.game.player?.stats.damage || 1);
            const isCritical = Math.random() < 0.15;
            damageInfo = {
                damage: isCritical ? baseDamage * 2 : baseDamage,
                isCritical: isCritical,
                baseDamage: baseDamage
            };
        }
        
        // Apply damage with critical information
        enemy.takeDamage(damageInfo.damage, this, damageInfo.isCritical);
        
        // Let the weapon handle enhanced hit feedback
        if (this.sourceWeapon && this.sourceWeapon.onHitEnemy) {
            this.sourceWeapon.onHitEnemy(enemy, damageInfo.damage, damageInfo.isCritical);
        } else {
            // Fallback to basic hit effects
            if (damageInfo.isCritical) {
                this.game.systems.particle.createCriticalEffect(this.x, this.y, '#FF0000');
            } else {
                this.game.systems.particle.createHitEffect(this.x, this.y, this.color);
            }
            
            // Basic screen shake
            const shakeIntensity = damageInfo.isCritical ? 5 : 3;
            if (damageInfo.damage > 25 && this.game && this.game.camera && typeof this.game.camera.shake === 'function') {
                this.game.camera.shake(shakeIntensity, damageInfo.isCritical ? 0.3 : 0.2);
            }
        }
        
        // Projectile-specific impact effects
        this.createProjectileImpactEffect(enemy, damageInfo);
        
        // Check for jackpot on critical hits
        if (damageInfo.isCritical && this.game.systems.rewards) {
            this.game.systems.rewards.rollForJackpot();
        }
    }
    
    createProjectileImpactEffect(enemy, damageInfo) {
        if (!this.game.systems.particle) return;
        
        // Type-specific impact effects
        switch (this.type) {
            case 'magic':
                this.createMagicImpact(enemy, damageInfo);
                break;
            case 'fire':
                this.createFireImpact(enemy, damageInfo);
                break;
            case 'ice':
                this.createIceImpact(enemy, damageInfo);
                break;
            case 'lightning':
                this.createLightningImpact(enemy, damageInfo);
                break;
            default:
                this.createBasicImpact(enemy, damageInfo);
        }
    }
    
    createMagicImpact(enemy, damageInfo) {
        // Magical sparkles
        this.game.systems.particle.createBurst(enemy.x, enemy.y, 'magic', {
            color: this.color,
            count: damageInfo.isCritical ? 12 : 8,
            intensity: damageInfo.damage * 0.02
        });
        
        // Magic circle for critical hits
        if (damageInfo.isCritical) {
            const circleCount = 16;
            for (let i = 0; i < circleCount; i++) {
                const angle = (i / circleCount) * Math.PI * 2;
                const radius = 25;
                const x = enemy.x + Math.cos(angle) * radius;
                const y = enemy.y + Math.sin(angle) * radius;
                
                this.game.systems.particle.create(x, y, {
                    vx: Math.cos(angle) * -30,
                    vy: Math.sin(angle) * -30,
                    life: 0.8,
                    size: 3,
                    color: this.color,
                    glow: true,
                    fadeOut: true
                });
            }
        }
    }
    
    createFireImpact(enemy, damageInfo) {
        // Fire burst
        this.game.systems.particle.createBurst(enemy.x, enemy.y, 'explosion', {
            color: '#FF4500',
            count: damageInfo.isCritical ? 15 : 10,
            intensity: damageInfo.damage * 0.02
        });
        
        // Burning effect
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                this.game.systems.particle.create(
                    enemy.x + (Math.random() - 0.5) * 20,
                    enemy.y + (Math.random() - 0.5) * 20,
                    {
                        vx: (Math.random() - 0.5) * 30,
                        vy: -Math.random() * 50 - 20,
                        life: 0.6,
                        size: 3,
                        color: '#FF4500',
                        glow: true,
                        fadeOut: true
                    }
                );
            }, i * 100);
        }
    }
    
    createIceImpact(enemy, damageInfo) {
        // Ice crystal shatter
        this.game.systems.particle.createBurst(enemy.x, enemy.y, 'ricochet', {
            color: '#87CEEB',
            count: damageInfo.isCritical ? 18 : 12,
            intensity: damageInfo.damage * 0.02
        });
        
        // Freeze effect
        const shardCount = 8;
        for (let i = 0; i < shardCount; i++) {
            const angle = (i / shardCount) * Math.PI * 2;
            this.game.systems.particle.create(enemy.x, enemy.y, {
                vx: Math.cos(angle) * 80,
                vy: Math.sin(angle) * 80,
                life: 1.0,
                size: 2,
                color: '#FFFFFF',
                glow: true,
                fadeOut: true
            });
        }
    }
    
    createLightningImpact(enemy, damageInfo) {
        // Lightning arc
        this.game.systems.particle.createBurst(enemy.x, enemy.y, 'critical', {
            color: '#FFD700',
            count: damageInfo.isCritical ? 20 : 15,
            intensity: damageInfo.damage * 0.02
        });
        
        // Chain lightning effect
        if (damageInfo.isCritical) {
            const nearbyEnemies = this.game.systems.enemy.getEnemiesInRange(enemy.x, enemy.y, 100);
            for (const nearbyEnemy of nearbyEnemies.slice(0, 3)) {
                if (nearbyEnemy.id !== enemy.id) {
                    // Draw lightning arc
                    const segmentCount = 6;
                    for (let i = 0; i < segmentCount; i++) {
                        const t = i / segmentCount;
                        const x = enemy.x + (nearbyEnemy.x - enemy.x) * t;
                        const y = enemy.y + (nearbyEnemy.y - enemy.y) * t + Math.sin(t * Math.PI * 3) * 10;
                        
                        this.game.systems.particle.create(x, y, {
                            vx: 0,
                            vy: 0,
                            life: 0.2,
                            size: 2,
                            color: '#FFFFFF',
                            glow: true,
                            fadeOut: true
                        });
                    }
                }
            }
        }
    }
    
    createBasicImpact(enemy, damageInfo) {
        // Basic hit spark
        this.game.systems.particle.createBurst(enemy.x, enemy.y, 'hit', {
            color: this.color,
            count: damageInfo.isCritical ? 10 : 6,
            intensity: damageInfo.damage * 0.02
        });
    }
    
    hitPlayer(player) {
        // Apply damage to player
        player.takeDamage(this.damage);
        
        // Create hit effect
        this.game.systems.particle.createHitEffect(this.x, this.y, '#FF4444');
    }
    
    explode() {
        if (this.source === 'player') {
            // Damage all enemies in explosion radius
            const enemies = this.game.systems.enemy.getActiveEnemies();
            
            for (const enemy of enemies) {
                const dx = enemy.x - this.x;
                const dy = enemy.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance <= this.explosionRadius) {
                    // Damage falloff based on distance
                    const falloff = 1 - (distance / this.explosionRadius);
                    const damage = this.explosionDamage * falloff;
                    
                    enemy.takeDamage(damage, this);
                }
            }
        }
        
        // Create explosion effect
        this.game.systems.particle.createExplosionEffect(this.x, this.y, this.explosionRadius, this.color);
        
        // Screen shake (with safety check)
        if (this.game && this.game.camera && typeof this.game.camera.shake === 'function') {
            this.game.camera.shake(8, 0.5);
        }
        
        this.destroy();
    }
    
    checkBoundaries() {
        if (this.bounce && this.bounceCount < this.maxBounces) {
            const margin = 50;
            const bounds = this.game.camera.getWorldBounds(margin);
            
            let bounced = false;
            
            if (this.x < bounds.left || this.x > bounds.right) {
                this.velocity.x *= -1;
                bounced = true;
            }
            
            if (this.y < bounds.top || this.y > bounds.bottom) {
                this.velocity.y *= -1;
                bounced = true;
            }
            
            if (bounced) {
                this.bounceCount++;
                // Create bounce effect
                this.game.systems.particle.createBounceEffect(this.x, this.y, this.color);
            }
        } else {
            // Check if projectile is way off screen
            const bounds = this.game.camera.getWorldBounds(200);
            if (this.x < bounds.left - 200 || this.x > bounds.right + 200 ||
                this.y < bounds.top - 200 || this.y > bounds.bottom + 200) {
                this.destroy('boundaryExit');
            }
        }
    }
    
    destroy(reason = 'lifetime') {
        this.active = false;
        
        // Debug tracking for destruction reason
        if (this.game.projectileDebugger) {
            this.game.projectileDebugger.trackProjectileDestruction(this, reason);
        }
        
        // Return to object pool
        this.game.systems.projectile.returnToPool(this);
    }
    
    render(renderer) {
        if (!this.active) return;
        
        const ctx = renderer.ctx;
        ctx.save();
        
        // Render trail
        if (this.trail && this.trailPoints.length > 1) {
            this.renderTrail(ctx);
        }
        
        // Render projectile based on type
        switch (this.type) {
            case 'magic':
                this.renderMagicProjectile(ctx);
                break;
            case 'explosive':
                this.renderExplosiveProjectile(ctx);
                break;
            default:
                this.renderBasicProjectile(ctx);
                break;
        }
        
        // Fade out near end of lifetime
        const fadeThreshold = 0.5;
        if (this.lifetime < fadeThreshold) {
            ctx.globalAlpha = this.lifetime / fadeThreshold;
        }
        
        ctx.restore();
    }
    
    renderBasicProjectile(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Add glow effect
        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.size;
        ctx.fill();
    }
    
    renderMagicProjectile(ctx) {
        // Pulsing magical orb
        const pulseSize = this.size + Math.sin(performance.now() * 0.01) * 2;
        
        // Outer glow
        ctx.shadowColor = this.color;
        ctx.shadowBlur = pulseSize * 2;
        
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, pulseSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner core
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(this.x, this.y, pulseSize * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }
    
    renderExplosiveProjectile(ctx) {
        // Rotating explosive projectile
        const rotation = performance.now() * 0.01;
        
        ctx.translate(this.x, this.y);
        ctx.rotate(rotation);
        
        // Draw warning stripes
        ctx.fillStyle = '#FF4444';
        ctx.fillRect(-this.size, -this.size/3, this.size * 2, this.size * 2/3);
        
        ctx.fillStyle = '#FFAA00';
        ctx.fillRect(-this.size, -this.size/6, this.size * 2, this.size/3);
        
        // Core
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
    }
    
    renderTrail(ctx) {
        if (this.trailPoints.length < 2) return;
        
        ctx.save(); // Save context state
        
        // Draw trail with gradient effect
        for (let i = 1; i < this.trailPoints.length; i++) {
            const point = this.trailPoints[i];
            const prevPoint = this.trailPoints[i - 1];
            const age = (performance.now() - point.time) / 200; // 0 to 1
            
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.size * 0.5 * (1 - age); // Taper trail
            ctx.lineCap = 'round';
            ctx.globalAlpha = Math.max(0, 1 - age);
            
            ctx.beginPath();
            ctx.moveTo(prevPoint.x, prevPoint.y);
            ctx.lineTo(point.x, point.y);
            ctx.stroke();
            ctx.closePath(); // Properly close each segment
        }
        
        ctx.restore(); // Restore context state
    }
    
    // Helper methods
    getPosition() {
        return { x: this.x, y: this.y };
    }
    
    getBounds() {
        return {
            left: this.x - this.size,
            right: this.x + this.size,
            top: this.y - this.size,
            bottom: this.y + this.size
        };
    }
    
    // Reset method for object pooling
    reset(x, y, config = {}) {
        this.x = x;
        this.y = y;
        
        // Reset all properties
        this.speed = config.speed || 200;
        this.direction = config.direction || 0;
        this.velocity.x = Math.cos(this.direction) * this.speed;
        this.velocity.y = Math.sin(this.direction) * this.speed;
        
        this.damage = config.damage || 10;
        this.piercing = config.piercing || 0;
        this.hitTargets.clear();
        
        this.size = config.size || 4;
        this.color = config.color || '#FFD700';
        this.trail = config.trail || false;
        this.trailPoints = [];
        
        this.maxLifetime = config.lifetime || 3.0;
        this.lifetime = this.maxLifetime;
        
        this.type = config.type || 'basic';
        this.source = config.source || 'player';
        this.weaponId = config.weaponId || null;
        
        // CRITICAL DEBUG: Log if source is wrong
        if (this.source !== 'player' && this.source !== 'enemy') {
            console.error('🚫 CRITICAL: Invalid projectile source!', this.source, config);
            this.source = 'player'; // Force to player as safety
        }
        
        this.gravity = config.gravity || 0;
        this.bounce = config.bounce || false;
        this.bounceCount = 0;
        this.maxBounces = config.maxBounces || 0;
        
        this.homing = config.homing || false;
        this.homingStrength = config.homingStrength || 100;
        this.homingTarget = null;
        
        this.explosive = config.explosive || false;
        this.explosionRadius = config.explosionRadius || 50;
        this.explosionDamage = config.explosionDamage || this.damage;
        
        this.active = true;
    }
}