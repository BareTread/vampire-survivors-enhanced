import { managedSetTimeout } from '../core/TimerManager.js';

export class ExperienceGem {
    constructor(game, x, y, value = 5) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.startX = x;
        this.startY = y;
        
        // Experience value
        this.value = value;
        
        // Visual properties based on value
        this.initializeVisuals();
        
        // Physics
        this.velocity = { x: 0, y: 0 };
        this.gravity = 200; // pixels per second squared
        this.bounce = 0.3; // bounce factor
        this.friction = 0.95; // velocity decay
        this.grounded = false;
        
        // Collection mechanics - IMPROVED MAGNETISM
        this.magnetRange = 120; // Distance at which gem starts moving toward player (was 80) - WIDER RANGE
        this.magnetStrength = 350; // Attraction force (was 200) - MUCH STRONGER PULL
        this.beingMagnetized = false;
        this.collectRange = 25; // Distance at which gem is collected (was 15) - EASIER COLLECTION
        
        // Lifetime
        this.maxLifetime = 30.0; // 30 seconds before disappearing
        this.lifetime = this.maxLifetime;
        this.fadeTime = 5.0; // Last 5 seconds fade out
        
        // Animation
        this.floatOffset = Math.random() * Math.PI * 2; // Random float phase
        this.pulseOffset = Math.random() * Math.PI * 2; // Random pulse phase
        this.rotationSpeed = 2.0; // Rotation speed
        this.rotation = 0;
        
        // Spawning effect
        this.spawnTime = 0.5;
        this.currentSpawnTime = this.spawnTime;
        
        // Initial burst
        const angle = Math.random() * Math.PI * 2;
        const force = 50 + Math.random() * 50;
        this.velocity.x = Math.cos(angle) * force;
        this.velocity.y = Math.sin(angle) * force - 100; // Slight upward bias
        
        // Status
        this.active = true;
        this.collected = false;
        this.id = Math.random().toString(36).substr(2, 9);
    }
    
    initializeVisuals() {
        // Different gem types based on value
        if (this.value >= 50) {
            // Rare gem
            this.type = 'rare';
            this.size = 8;
            this.color = '#9B59B6';
            this.glowColor = '#E74C3C';
            this.sparkleCount = 4; // Reduced from 8 to 4
        } else if (this.value >= 20) {
            // Uncommon gem
            this.type = 'uncommon';
            this.size = 6;
            this.color = '#3498DB';
            this.glowColor = '#2ECC71';
            this.sparkleCount = 2; // Reduced from 4 to 2
        } else {
            // Common gem
            this.type = 'common';
            this.size = 4;
            this.color = '#F1C40F';
            this.glowColor = '#E67E22';
            this.sparkleCount = 1; // Reduced from 2 to 1
        }
    }
    
    update(dt) {
        if (!this.active || this.collected) return;
        
        // FIXED: Validate gem coordinates and reset if corrupted (screen-space gems)
        // Gems should be in world space, not screen space
        if (this.game.camera && this.game.player) {
            const screenBounds = {
                left: this.game.camera.x - this.game.camera.width / 2,
                right: this.game.camera.x + this.game.camera.width / 2,
                top: this.game.camera.y - this.game.camera.height / 2,
                bottom: this.game.camera.y + this.game.camera.height / 2
            };
            
            // Check if gem is suspiciously close to screen coordinates (0-800 range typically)
            // While player is far from origin - indicates screen-space coordinates
            if (Math.abs(this.game.player.x) > 500 || Math.abs(this.game.player.y) > 500) {
                if (Math.abs(this.x) < 400 && Math.abs(this.y) < 400) {
                    // This gem has screen-space coordinates, fix it
                    console.log(`Fixing corrupted gem coordinates: (${this.x}, ${this.y}) -> world space`);
                    this.active = false; // Remove corrupted gem
                    return;
                }
            }
        }
        
        // Update spawn animation
        if (this.currentSpawnTime > 0) {
            this.currentSpawnTime -= dt;
            return; // Don't update physics during spawn
        }
        
        // Update lifetime
        this.lifetime -= dt;
        if (this.lifetime <= 0) {
            this.destroy();
            return;
        }
        
        // Update rotation
        this.rotation += this.rotationSpeed * dt;
        
        // Check for player magnetism
        this.updateMagnetism(dt);
        
        // Update physics if not being magnetized
        if (!this.beingMagnetized) {
            this.updatePhysics(dt);
        }
        
        // Check for collection
        this.checkCollection();
    }
    
    updateMagnetism(dt) {
        const player = this.game.player;
        if (!player || !player.isAlive()) return;
        
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Enhanced magnet range based on player luck stat
        const effectiveMagnetRange = this.magnetRange * (player.stats.luck || 1);
        
        if (distance <= effectiveMagnetRange) {
            this.beingMagnetized = true;
            
            // Move toward player with increasing speed as we get closer
            // FIXED: Add zero distance check to prevent division by zero
            if (distance === 0) {
                // If exactly on player, just set zero velocity
                this.velocity.x = 0;
                this.velocity.y = 0;
                return;
            }
            
            const normalizedX = dx / distance;
            const normalizedY = dy / distance;
            
            // Stronger attraction when closer
            const attractionMultiplier = 1 + (1 - distance / effectiveMagnetRange);
            const force = this.magnetStrength * attractionMultiplier;
            
            this.velocity.x = normalizedX * force;
            this.velocity.y = normalizedY * force;
            
            // Apply velocity with overflow protection
            const deltaX = this.velocity.x * dt;
            const deltaY = this.velocity.y * dt;
            
            if (isFinite(deltaX) && isFinite(deltaY) && Math.abs(deltaX) < 500 && Math.abs(deltaY) < 500) {
                this.x += deltaX;
                this.y += deltaY;
            } else {
                this.velocity = { x: 0, y: 0 };
            }
        } else {
            this.beingMagnetized = false;
        }
    }
    
    updatePhysics(dt) {
        // Apply gravity
        this.velocity.y += this.gravity * dt;
        
        // Apply velocity with overflow protection
        const deltaX = this.velocity.x * dt;
        const deltaY = this.velocity.y * dt;
        
        if (isFinite(deltaX) && isFinite(deltaY) && Math.abs(deltaX) < 500 && Math.abs(deltaY) < 500) {
            this.x += deltaX;
            this.y += deltaY;
        } else {
            this.velocity = { x: 0, y: 0 };
        }
        
        // Coordinate overflow protection
        if (!isFinite(this.x) || !isFinite(this.y) || Math.abs(this.x) > 1e6 || Math.abs(this.y) > 1e6) {
            console.warn('ExperienceGem coordinate overflow, deactivating');
            this.active = false;
            return;
        }
        
        // Ground collision (simple)
        const groundY = this.startY + 50; // Rough ground level
        if (this.y > groundY && this.velocity.y > 0) {
            this.y = groundY;
            this.velocity.y *= -this.bounce;
            this.velocity.x *= this.friction;
            
            // Stop small bounces
            if (Math.abs(this.velocity.y) < 20) {
                this.velocity.y = 0;
                this.grounded = true;
            }
        }
        
        // Apply friction when grounded
        if (this.grounded) {
            this.velocity.x *= Math.pow(this.friction, dt * 60); // Frame-rate independent
        }
    }
    
    checkCollection() {
        const player = this.game.player;
        if (!player || !player.isAlive()) return;
        
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= this.collectRange) {
            this.collect();
        }
    }
    
    collect() {
        if (this.collected) return;
        
        this.collected = true;
        
        // Give experience to player
        this.game.player.gainExperience(this.value);
        
        // Enhanced collection effects
        this.createCollectionEffects();
        
        // Remove from world
        this.destroy();
    }
    
    createCollectionEffects() {
        if (!this.game.systems.particle) return;
        
        // Lucky gems get special effects
        if (this.isLucky) {
            this.createLuckyCollectionEffect();
        } else {
            // Enhanced collection effect based on gem rarity
            switch (this.type) {
                case 'rare':
                    this.createRareCollectionEffect();
                    break;
                case 'uncommon':
                    this.createUncommonCollectionEffect();
                    break;
                default:
                    this.createCommonCollectionEffect();
            }
        }
        
        // Audio feedback
        this.playCollectionSound();
        
        // Experience number display
        this.showExperienceGain();
    }
    
    createLuckyCollectionEffect() {
        // Spectacular effects for lucky gems - reduced for clarity!
        this.game.systems.particle.createBurst(this.x, this.y, 'gemExplosion', {
            color: '#FFD700',
            count: 8, // Reduced from 35
            spread: 80,
            intensity: 2.0
        });
        
        // Single secondary explosion only
        managedSetTimeout(() => {
            this.game.systems.particle.createBurst(this.x, this.y, 'collect', {
                color: '#FFD700',
                count: 6, // Reduced from 20
                spread: 60 // Reduced spread
            });
        }, 100, this);
        
        // Screen flash for lucky gems
        if (this.game.camera) {
            this.game.camera.flash('#FFD700', 0.5);
        }
        
        // Enhanced screen shake
        if (this.game.camera) {
            this.game.camera.shakeLuckyGem();
        }
        
        // Pickup camera shake for tactile feedback
        if (this.game.camera) {
            this.game.camera.shakePickupGem();
        }
    }
    
    createRareCollectionEffect() {
        // Moderate burst for rare gems - reduced for clarity
        this.game.systems.particle.createBurst(this.x, this.y, 'gemExplosion', {
            color: this.color,
            count: 6, // Reduced from 25
            spread: 60,
            intensity: 1.5
        });
        
        // Single secondary explosion
        managedSetTimeout(() => {
            this.game.systems.particle.createBurst(this.x, this.y, 'collect', {
                color: this.glowColor,
                count: 4, // Reduced from 15
                spread: 50
            });
        }, 100, this);
        
        // Screen flash for rare gems
        if (this.game.camera) {
            this.game.camera.flash(this.color, 0.3);
        }
        
        // Brief screen shake
        if (this.game.camera) {
            this.game.camera.shake(3, 0.2);
        }
    }
    
    createUncommonCollectionEffect() {
        // Medium burst for uncommon gems - reduced for clarity
        this.game.systems.particle.createBurst(this.x, this.y, 'collect', {
            color: this.color,
            count: 4, // Reduced from 15
            spread: 40,
            intensity: 1.2
        });
        
        // Skip sparkle trail - too many particles
    }
    
    createCommonCollectionEffect() {
        // Simple burst for common gems - reduced for clarity
        this.game.systems.particle.createBurst(this.x, this.y, 'collect', {
            color: this.color,
            count: 3, // Reduced from 8
            spread: 25,
            intensity: 1.0
        });
    }
    
    createSparkleTrail() {
        // Create sparkle trail from gem to player
        const player = this.game.player;
        if (!player) return;
        
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const sparkleCount = Math.floor(distance / 20);
        
        for (let i = 0; i < sparkleCount; i++) {
            const t = i / sparkleCount;
            const x = this.x + dx * t;
            const y = this.y + dy * t;
            
            managedSetTimeout(() => {
                this.game.systems.particle.create(x, y, {
                    vx: (Math.random() - 0.5) * 50,
                    vy: (Math.random() - 0.5) * 50,
                    life: 0.8,
                    size: 3,
                    color: this.color,
                    glow: true,
                    fadeOut: true
                });
            }, i * 30, this);
        }
    }
    
    playCollectionSound() {
        if (!this.game.audioManager || !this.game.audioManager.playVampireSound) return;
        
        // Lucky gems get special sound treatment
        if (this.isLucky) {
            // Multiple layered sounds for lucky gems
            this.game.audioManager.playVampireSound('experienceGain', 0.9, 1.5);
            managedSetTimeout(() => {
                this.game.audioManager.playVampireSound('levelUp', 0.4, 2.0);
            }, 100, this);
            managedSetTimeout(() => {
                this.game.audioManager.playVampireSound('criticalHit', 0.3, 1.8);
            }, 200, this);
            return;
        }
        
        // Different sounds for different rarities
        let volume = 0.4;
        let pitch = 1.0;
        
        switch (this.type) {
            case 'rare':
                volume = 0.8;
                pitch = 1.3;
                this.game.audioManager.playVampireSound('experienceGain', volume, pitch);
                // Add bonus sound
                managedSetTimeout(() => {
                    this.game.audioManager.playVampireSound('levelUp', 0.3, 1.8);
                }, 100, this);
                break;
            case 'uncommon':
                volume = 0.6;
                pitch = 1.1;
                this.game.audioManager.playVampireSound('experienceGain', volume, pitch);
                break;
            default:
                volume = 0.4;
                pitch = 1.0;
                this.game.audioManager.playVampireSound('experienceGain', volume, pitch);
        }
    }
    
    showExperienceGain() {
        // Show floating experience number
        if (this.game.systems.particle && this.game.systems.particle.createEnhancedDamageNumber) {
            let color, size, intensity;
            
            if (this.isLucky) {
                color = '#FFD700';
                size = 24;
                intensity = 3.0;
                // Show "LUCKY!" text above the number
                managedSetTimeout(() => {
                    this.game.systems.particle.createEnhancedDamageNumber(
                        this.x, this.y - 20, 
                        'LUCKY!', 
                        true, 
                        '#FFD700', 
                        18, 
                        2.0
                    );
                }, 200, this);
            } else {
                color = this.type === 'rare' ? '#FF00FF' : 
                       this.type === 'uncommon' ? '#00AAFF' : '#FFFF00';
                size = this.type === 'rare' ? 20 : 
                      this.type === 'uncommon' ? 16 : 14;
                intensity = this.type === 'rare' ? 2.0 : 1.0;
            }
            
            this.game.systems.particle.createEnhancedDamageNumber(
                this.x, this.y, 
                `+${this.value} EXP`, 
                false, 
                color, 
                size, 
                intensity
            );
        }
    }
    
    destroy() {
        this.active = false;
        
        // Return to object pool
        this.game.systems.experience.returnGemToPool(this);
    }
    
    render(renderer) {
        if (!this.active || this.collected) return;
        
        const ctx = renderer.ctx;
        ctx.save();
        
        // Spawn animation
        if (this.currentSpawnTime > 0) {
            const spawnProgress = 1 - (this.currentSpawnTime / this.spawnTime);
            ctx.globalAlpha = spawnProgress;
            
            // Scale in effect
            const scale = 0.3 + 0.7 * spawnProgress;
            ctx.scale(scale, scale);
        }
        
        // Fade out near end of lifetime
        if (this.lifetime < this.fadeTime) {
            ctx.globalAlpha *= this.lifetime / this.fadeTime;
        }
        
        // Floating animation
        const floatY = Math.sin(performance.now() * 0.003 + this.floatOffset) * 2;
        const gemY = this.y + floatY;
        
        // Pulsing glow (faster for lucky gems)
        const pulseRate = this.pulseRate || 1.0;
        const pulseIntensity = 0.7 + 0.3 * Math.sin(performance.now() * 0.005 * pulseRate + this.pulseOffset);
        
        // Enhanced glow for lucky gems
        if (this.isLucky && this.glowEffect) {
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = this.size * 5 * pulseIntensity;
        } else {
            ctx.shadowColor = this.glowColor;
            ctx.shadowBlur = this.size * 3 * pulseIntensity;
        }
        
        // Draw main gem
        ctx.translate(this.x, gemY);
        ctx.rotate(this.rotation);
        
        this.renderGem(ctx);
        
        // Enhanced sparkles for lucky gems
        if (this.isLucky) {
            this.renderLuckySparkles(ctx, pulseIntensity);
        } else {
            this.renderSparkles(ctx, pulseIntensity);
        }
        
        ctx.restore();
    }
    
    renderGem(ctx) {
        switch (this.type) {
            case 'rare':
                this.renderRareGem(ctx);
                break;
            case 'uncommon':
                this.renderUncommonGem(ctx);
                break;
            default:
                this.renderCommonGem(ctx);
                break;
        }
    }
    
    renderCommonGem(ctx) {
        // Simple hexagon
        ctx.fillStyle = this.color;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const x = Math.cos(angle) * this.size;
            const y = Math.sin(angle) * this.size;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fill();
        
        // Inner highlight
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(0, -this.size * 0.3, this.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
    
    renderUncommonGem(ctx) {
        // Diamond shape with facets
        ctx.fillStyle = this.color;
        
        // Main diamond
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size * 0.7, 0);
        ctx.lineTo(0, this.size);
        ctx.lineTo(-this.size * 0.7, 0);
        ctx.closePath();
        ctx.fill();
        
        // Facets
        ctx.fillStyle = this.glowColor;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size * 0.3, -this.size * 0.3);
        ctx.lineTo(0, 0);
        ctx.lineTo(-this.size * 0.3, -this.size * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // Highlight
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(-this.size * 0.2, -this.size * 0.4, this.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
    
    renderRareGem(ctx) {
        // Complex star gem
        const spikes = 8;
        const outerRadius = this.size;
        const innerRadius = this.size * 0.5;
        
        ctx.fillStyle = this.color;
        ctx.beginPath();
        
        for (let i = 0; i < spikes * 2; i++) {
            const angle = (i / (spikes * 2)) * Math.PI * 2;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fill();
        
        // Inner core
        ctx.fillStyle = this.glowColor;
        ctx.beginPath();
        ctx.arc(0, 0, innerRadius * 0.6, 0, Math.PI * 2);
        ctx.fill();
        
        // Bright highlight
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(-this.size * 0.2, -this.size * 0.2, this.size * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
    
    renderSparkles(ctx, intensity) {
        const time = performance.now() * 0.01;
        
        for (let i = 0; i < this.sparkleCount; i++) {
            const angle = (i / this.sparkleCount) * Math.PI * 2 + time;
            const distance = this.size * (1.5 + 0.5 * Math.sin(time * 2 + i));
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            
            ctx.fillStyle = '#FFFFFF';
            ctx.globalAlpha = intensity * 0.8;
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
    
    renderLuckySparkles(ctx, intensity) {
        const time = performance.now() * 0.01;
        
        // More sparkles for lucky gems - reduced from 2x to 1.5x
        const luckySparkleCount = Math.ceil(this.sparkleCount * 1.5);
        
        for (let i = 0; i < luckySparkleCount; i++) {
            const angle = (i / luckySparkleCount) * Math.PI * 2 + time * 2;
            const distance = this.size * (1.8 + 0.7 * Math.sin(time * 3 + i));
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            
            // Alternating gold and white sparkles
            ctx.fillStyle = i % 2 === 0 ? '#FFD700' : '#FFFFFF';
            ctx.globalAlpha = intensity * 0.9;
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Add outer ring of sparkles
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + time * 0.5;
            const distance = this.size * 2.5;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            
            ctx.fillStyle = '#FFD700';
            ctx.globalAlpha = intensity * 0.6;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.globalAlpha = 1;
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
    
    isActive() {
        return this.active && !this.collected;
    }
    
    // Reset method for object pooling
    reset(x, y, value = 5) {
        this.x = x;
        this.y = y;
        this.startX = x;
        this.startY = y;
        this.value = value;
        
        // Reset lucky gem properties
        this.isLucky = false;
        this.glowEffect = false;
        this.pulseRate = 1.0;
        
        // Reset visuals
        this.initializeVisuals();
        
        // Reset physics
        this.velocity = { x: 0, y: 0 };
        this.grounded = false;
        this.beingMagnetized = false;
        
        // Reset state
        this.lifetime = this.maxLifetime;
        this.currentSpawnTime = this.spawnTime;
        this.rotation = 0;
        this.floatOffset = Math.random() * Math.PI * 2;
        this.pulseOffset = Math.random() * Math.PI * 2;
        
        // Initial burst
        const angle = Math.random() * Math.PI * 2;
        const force = 50 + Math.random() * 50;
        this.velocity.x = Math.cos(angle) * force;
        this.velocity.y = Math.sin(angle) * force - 100;
        
        this.active = true;
        this.collected = false;
    }
}