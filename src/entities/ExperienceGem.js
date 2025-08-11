import { managedSetTimeout } from '../core/TimerManager.js';
import { globalDamageNumberPool } from '../core/DamageNumberPool.js';

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
        this.baseMagnetStrength = this.magnetStrength; // Keep base for pulses
        this.beingMagnetized = false;
        this.forceMagnetTimer = 0; // While > 0, ignore range and pull toward player
        this.collectRange = 25; // Distance at which gem is collected (was 15) - EASIER COLLECTION
        
        // Debug instrumentation (magnetization)
        this.debugNoMoveFrames = 0;
        this.magnetSource = ''; // '', 'range', 'forced', 'player', 'system'
        this._debugPrevMagnetized = false;
        
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
            this.sparkleCount = 4;
        } else if (this.value >= 20) {
            // Uncommon gem
            this.type = 'uncommon';
            this.size = 6;
            this.color = '#3498DB';
            this.glowColor = '#2ECC71';
            this.sparkleCount = 2;
        } else {
            // Common gem
            this.type = 'common';
            this.size = 4;
            this.color = '#F1C40F';
            this.glowColor = '#E67E22';
            this.sparkleCount = 1;
        }
    }
    
    update(dt) {
        if (!this.active || this.collected) return;
        
        if (this.game.camera && this.game.player) {
            if (Math.abs(this.game.player.x) > 500 || Math.abs(this.game.player.y) > 500) {
                if (Math.abs(this.x) < 400 && Math.abs(this.y) < 400) {
                    this.active = false;
                    return;
                }
            }
        }
        
        if (this.currentSpawnTime > 0) {
            this.currentSpawnTime -= dt;
            const player = this.game && this.game.player;
            const systemMagnetActive = !!(this.game && this.game.systems && this.game.systems.experience && typeof this.game.systems.experience.isGlobalMagnetActive === 'function' && this.game.systems.experience.isGlobalMagnetActive());
            if (this.forceMagnetTimer > 0 || systemMagnetActive) {
                this.updateMagnetism(dt);
                this.checkCollection();
            }
            return;
        }
        
        this.lifetime -= dt;
        if (this.lifetime <= 0) {
            this.destroy();
            return;
        }
        
        this.rotation += this.rotationSpeed * dt;
        
        this.updateMagnetism(dt);
        
        if (!this.beingMagnetized) {
            this.updatePhysics(dt);
        }
        
        this.applyMovement(dt);

        this.checkCollection();
    }

    applyMovement(dt) {
        const deltaX = this.velocity.x * dt;
        const deltaY = this.velocity.y * dt;

        if (isFinite(deltaX) && isFinite(deltaY) && Math.abs(deltaX) < 500 && Math.abs(deltaY) < 500) {
            this.x += deltaX;
            this.y += deltaY;
        } else {
            this.velocity = { x: 0, y: 0 };
        }
    }
    
    updateMagnetism(dt) {
        const player = this.game.player;
        if (!player || !player.isAlive()) return;
        
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const _prevX = this.x, _prevY = this.y;
        const _prevBeingMagnetized = this.beingMagnetized;
        
        const effectiveMagnetRange = this.magnetRange * (player.stats.luck || 1);
        
        const systemMagnetActive = !!(this.game && this.game.systems && this.game.systems.experience && typeof this.game.systems.experience.isGlobalMagnetActive === 'function' && this.game.systems.experience.isGlobalMagnetActive());
        if (this.forceMagnetTimer > 0 || systemMagnetActive) {
            if (this.forceMagnetTimer > 0) {
                this.forceMagnetTimer = Math.max(0, this.forceMagnetTimer - dt);
            }
            this.beingMagnetized = true;
            this.grounded = false;
            this.magnetSource = systemMagnetActive ? 'system' : 'forced';
            
            if (distance === 0) {
                this.velocity.x = 0;
                this.velocity.y = 0;
                return;
            }
            const nx = dx / distance;
            const ny = dy / distance;
            
            let speed;
            if (systemMagnetActive) {
                let cm = 3.0;
                let remaining = (this.game && this.game.systems && this.game.systems.experience) ? (this.game.systems.experience.globalMagnetTimer || 0) : 0;
                const minBase = this.baseMagnetStrength * Math.max(3, cm + 2);
                const timeBudget = Math.max(0.3, Math.min(remaining * 0.9, 3.0));
                const requiredSpeed = distance / timeBudget;
                const maxPerFrameDelta = 460;
                const maxSpeed = maxPerFrameDelta / Math.max(0.001, dt);
                speed = Math.min(Math.max(minBase, requiredSpeed), maxSpeed);
            } else {
                speed = this.baseMagnetStrength * 5;
            }
            this.velocity.x = nx * speed;
            this.velocity.y = ny * speed;

            const moved = Math.hypot(this.x - _prevX, this.y - _prevY);
            if (this.beingMagnetized && moved < 0.5) {
                this.debugNoMoveFrames++;
            } else {
                this.debugNoMoveFrames = 0;
            }
            if (this.game && this.game.showDebug && _prevBeingMagnetized !== this.beingMagnetized) {
                console.log(`Gem ${this.id} magnet ${this.beingMagnetized ? 'START' : 'STOP'} [${this.magnetSource}] d=${distance.toFixed(1)}`);
            }
            return;
        }
        
        if (distance <= effectiveMagnetRange) {
            this.beingMagnetized = true;
            this.magnetSource = 'range';
            
            if (distance === 0) {
                this.velocity.x = 0;
                this.velocity.y = 0;
                return;
            }
            
            const normalizedX = dx / distance;
            const normalizedY = dy / distance;
            
            const attractionMultiplier = 1 + (1 - distance / effectiveMagnetRange);
            const force = this.magnetStrength * attractionMultiplier;
            
            this.velocity.x = normalizedX * force;
            this.velocity.y = normalizedY * force;
            
            const moved2 = Math.hypot(this.x - _prevX, this.y - _prevY);
            if (this.beingMagnetized && moved2 < 0.5) {
                this.debugNoMoveFrames++;
            } else {
                this.debugNoMoveFrames = 0;
            }
            if (this.game && this.game.showDebug && _prevBeingMagnetized !== this.beingMagnetized) {
                console.log(`Gem ${this.id} magnet START [${this.magnetSource}] d=${distance.toFixed(1)}`);
            }
        } else {
            this.beingMagnetized = false;
            this.magnetSource = '';
            this.debugNoMoveFrames = 0;
            if (this.game && this.game.showDebug && _prevBeingMagnetized !== this.beingMagnetized) {
                console.log(`Gem ${this.id} magnet STOP`);
            }
        }
    }
    
    updatePhysics(dt) {
        this.velocity.y += this.gravity * dt;
        
        if (!isFinite(this.x) || !isFinite(this.y) || Math.abs(this.x) > 1e6 || Math.abs(this.y) > 1e6) {
            console.warn('ExperienceGem coordinate overflow, deactivating');
            this.active = false;
            return;
        }
        
        const groundY = this.startY + 50;
        if (this.y > groundY && this.velocity.y > 0) {
            this.y = groundY;
            this.velocity.y *= -this.bounce;
            this.velocity.x *= this.friction;
            
            if (Math.abs(this.velocity.y) < 20) {
                this.velocity.y = 0;
                this.grounded = true;
            }
        }
        
        if (this.grounded) {
            this.velocity.x *= Math.pow(this.friction, dt * 60);
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
        
        this.game.player.gainExperience(this.value);
        
        this.createCollectionEffects();
        
        this.destroy();
    }
    
    createCollectionEffects() {
        if (!this.game.systems.particle) return;
        
        if (this.isLucky) {
            this.createLuckyCollectionEffect();
        } else {
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
        
        this.playCollectionSound();
        
        this.showExperienceGain();
    }
    
    createLuckyCollectionEffect() {
        this.game.systems.particle.createBurst(this.x, this.y, 'gemExplosion', {
            color: '#FFD700',
            count: 8,
            spread: 80,
            intensity: 2.0
        });
        
        managedSetTimeout(() => {
            this.game.systems.particle.createBurst(this.x, this.y, 'collect', {
                color: '#FFD700',
                count: 6,
                spread: 60
            });
        }, 100, this);
        
        if (this.game.camera) {
            this.game.camera.flash('#FFD700', 0.5);
        }
        
        if (this.game.camera) {
            this.game.camera.shakeLuckyGem();
        }
        
        if (this.game.camera) {
            this.game.camera.shakePickupGem();
        }
    }
    
    createRareCollectionEffect() {
        this.game.systems.particle.createBurst(this.x, this.y, 'gemExplosion', {
            color: this.color,
            count: 6,
            spread: 60,
            intensity: 1.5
        });
        
        managedSetTimeout(() => {
            this.game.systems.particle.createBurst(this.x, this.y, 'collect', {
                color: this.glowColor,
                count: 4,
                spread: 50
            });
        }, 100, this);
        
        if (this.game.camera) {
            this.game.camera.flash(this.color, 0.3);
        }
        
        if (this.game.camera) {
            this.game.camera.shake(3, 0.2);
        }
    }
    
    createUncommonCollectionEffect() {
        this.game.systems.particle.createBurst(this.x, this.y, 'collect', {
            color: this.color,
            count: 4,
            spread: 40,
            intensity: 1.2
        });
    }
    
    createCommonCollectionEffect() {
        this.game.systems.particle.createBurst(this.x, this.y, 'collect', {
            color: this.color,
            count: 3,
            spread: 25,
            intensity: 1.0
        });
    }
    
    createSparkleTrail() {
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
        
        if (this.isLucky) {
            this.game.audioManager.playVampireSound('experienceGain', 0.9, 1.5);
            managedSetTimeout(() => {
                this.game.audioManager.playVampireSound('levelUp', 0.4, 2.0);
            }, 100, this);
            managedSetTimeout(() => {
                this.game.audioManager.playVampireSound('criticalHit', 0.3, 1.8);
            }, 200, this);
            return;
        }
        
        let volume = 0.4;
        let pitch = 1.0;
        
        switch (this.type) {
            case 'rare':
                volume = 0.8;
                pitch = 1.3;
                this.game.audioManager.playVampireSound('experienceGain', volume, pitch);
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
        if (this.game.systems.particle && this.game.systems.particle.createEnhancedDamageNumber) {
            let color, size, intensity;
            
            if (this.isLucky) {
                color = '#FFD700';
                size = 24;
                intensity = 3.0;
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
        
        this.game.systems.experience.returnGemToPool(this);
    }
    
    render(renderer) {
        if (!this.active || this.collected) return;
        
        const ctx = renderer.ctx;
        ctx.save();
        
        if (this.currentSpawnTime > 0) {
            const spawnProgress = 1 - (this.currentSpawnTime / this.spawnTime);
            ctx.globalAlpha = spawnProgress;
            
            const scale = 0.3 + 0.7 * spawnProgress;
            ctx.scale(scale, scale);
        }
        
        if (this.lifetime < this.fadeTime) {
            ctx.globalAlpha *= this.lifetime / this.fadeTime;
        }
        
        const floatY = Math.sin(performance.now() * 0.003 + this.floatOffset) * 2;
        const gemY = this.y + floatY;
        
        const pulseRate = this.pulseRate || 1.0;
        const pulseIntensity = 0.7 + 0.3 * Math.sin(performance.now() * 0.005 * pulseRate + this.pulseOffset);
        
        if (this.game && this.game.showDebug && (this.beingMagnetized || this.magnetSource)) {
            const player = this.game.player;
            if (player) {
                const dx = player.x - this.x;
                const dy = player.y - gemY;
                const len = Math.hypot(dx, dy) || 1;
                const nx = dx / len;
                const ny = dy / len;
                
                let color = '#00FF00';
                switch (this.magnetSource) {
                    case 'system': color = '#44AAFF'; break;
                    case 'player': color = '#00FF88'; break;
                    case 'forced': color = '#FFEE00'; break;
                    case 'range':  color = '#AAAAAA'; break;
                }
                
                ctx.save();
                ctx.globalAlpha = 0.85;
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = color;
                ctx.fillStyle = color;
                
                ctx.beginPath();
                ctx.moveTo(this.x, gemY);
                ctx.lineTo(player.x, player.y);
                ctx.stroke();
                
                const ax = this.x + nx * 14;
                const ay = gemY + ny * 14;
                ctx.beginPath();
                ctx.moveTo(ax, ay);
                ctx.lineTo(ax - ny * 4, ay + nx * 4);
                ctx.lineTo(ax + ny * 4, ay - nx * 4);
                ctx.closePath();
                ctx.fill();
                
                if (this.debugNoMoveFrames > 20) {
                    ctx.globalAlpha = 0.95;
                    ctx.fillStyle = '#FF3333';
                    ctx.font = '10px monospace';
                    ctx.fillText('STUCK', this.x + 6, gemY - 6);
                }
                ctx.restore();
            }
        }
        
        const systemMagnetActive = !!(this.game && this.game.systems && this.game.systems.experience && typeof this.game.systems.experience.isGlobalMagnetActive === 'function' && this.game.systems.experience.isGlobalMagnetActive());
        if (this.beingMagnetized || systemMagnetActive) {
            const haloPulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.006 + this.pulseOffset);
            const radius = this.size * (this.type === 'rare' ? 6 : 4.5);
            const grad = ctx.createRadialGradient(this.x, gemY, 0, this.x, gemY, radius);
            grad.addColorStop(0, `rgba(68,255,68,${0.28 * haloPulse})`);
            grad.addColorStop(1, 'rgba(68,255,68,0)');
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha *= (0.9 * pulseIntensity);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.x, gemY, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        
        if (this.isLucky && this.glowEffect) {
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = this.size * 5 * pulseIntensity;
        } else {
            ctx.shadowColor = this.glowColor;
            ctx.shadowBlur = this.size * 3 * pulseIntensity;
        }
        
        ctx.translate(this.x, gemY);
        ctx.rotate(this.rotation);
        
        this.renderGem(ctx);
        
        if (this.isLucky) {
            this.renderLuckySparkles(ctx, intensity);
        } else {
            this.renderSparkles(ctx, intensity);
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
        
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(0, -this.size * 0.3, this.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
    
    renderUncommonGem(ctx) {
        ctx.fillStyle = this.color;
        
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size * 0.7, 0);
        ctx.lineTo(0, this.size);
        ctx.lineTo(-this.size * 0.7, 0);
        ctx.closePath();
        ctx.fill();
        
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
        
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(-this.size * 0.2, -this.size * 0.4, this.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
    
    renderRareGem(ctx) {
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
        
        ctx.fillStyle = this.glowColor;
        ctx.beginPath();
        ctx.arc(0, 0, innerRadius * 0.6, 0, Math.PI * 2);
        ctx.fill();
        
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
        
        const luckySparkleCount = Math.ceil(this.sparkleCount * 1.5);
        
        for (let i = 0; i < luckySparkleCount; i++) {
            const angle = (i / luckySparkleCount) * Math.PI * 2 + time * 2;
            const distance = this.size * (1.8 + 0.7 * Math.sin(time * 3 + i));
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            
            ctx.fillStyle = i % 2 === 0 ? '#FFD700' : '#FFFFFF';
            ctx.globalAlpha = intensity * 0.9;
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
        
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
    
    reset(x, y, value = 5) {
        this.x = x;
        this.y = y;
        this.startX = x;
        this.startY = y;
        this.value = value;
        
        this.isLucky = false;
        this.glowEffect = false;
        this.pulseRate = 1.0;
        
        this.initializeVisuals();
        
        this.velocity = { x: 0, y: 0 };
        this.grounded = false;
        this.beingMagnetized = false;
        
        this.lifetime = this.maxLifetime;
        this.currentSpawnTime = this.spawnTime;
        this.rotation = 0;
        this.floatOffset = Math.random() * Math.PI * 2;
        this.pulseOffset = Math.random() * Math.PI * 2;
        
        const angle = Math.random() * Math.PI * 2;
        const force = 50 + Math.random() * 50;
        this.velocity.x = Math.cos(angle) * force;
        this.velocity.y = Math.sin(angle) * force - 100;
        
        this.active = true;
        this.collected = false;
    }
}