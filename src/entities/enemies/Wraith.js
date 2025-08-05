import { Enemy } from '../Enemy.js';

export class Wraith extends Enemy {
    constructor(game, x, y) {
        super(game, x, y, 'wraith');
        
        // Override base enemy properties for Wraith
        this.maxHealth = this.maxHealth || 35;
        this.health = this.maxHealth;
        this.speed = 60;
        this.damage = 15;
        this.size = 10;
        this.color = '#9370DB';
        this.expReward = 12;
        
        // FIXED: Set attackRange for wraith
        this.attackRange = 25; // Spectral touch range
        this.baseAttackCooldown = 1.5; // Attack cooldown
        
        // Wraith-specific properties
        this.phaseMode = false;
        this.phaseDuration = 2.0; // How long phase lasts
        this.phaseTimer = 0;
        this.phaseCooldown = 4.0; // Cooldown between phases
        this.phaseCooldownTimer = 0;
        this.phaseSpeed = 120; // Speed when phasing
        this.normalSpeed = 60;
        
        // Visual properties
        this.baseAlpha = 0.8; // Slightly transparent normally
        this.phaseAlpha = 0.3; // Very transparent when phasing
        this.currentAlpha = this.baseAlpha;
        this.glowIntensity = 15;
        this.phaseTrail = [];
        
        // Behavioral properties
        this.targetPlayer = true;
        this.ghostlyFloat = 0; // Floating animation offset
        this.floatSpeed = 2.0;
        this.floatAmplitude = 8;
        
        // Phase abilities
        this.canPassThroughWalls = false; // Normally false, true during phase
        this.immuneToDamage = false; // Immune during phase
        
        // Audio properties
        this.whisperSounds = ['ghostWhisper1', 'ghostWhisper2', 'ghostWhisper3'];
    }
    
    initializeType(type) {
        // Override the base initializeType to prevent it from overriding our custom stats
        // Apply difficulty scaling
        const difficultyMultiplier = this.getDifficultyMultiplier();
        
        this.maxHealth = Math.floor(35 * difficultyMultiplier);
        this.health = this.maxHealth;
        this.damage = Math.floor(15 * difficultyMultiplier);
        this.expReward = Math.floor(12 * difficultyMultiplier);
        
        // Apply adaptive damage from flow state
        if (this.game.systems && this.game.systems.flowState && this.game.systems.flowState.adaptiveDamageMultiplier) {
            this.damage = Math.floor(this.damage * this.game.systems.flowState.adaptiveDamageMultiplier);
        }
    }
    
    update(dt) {
        if (!this.active) return;
        
        // Update spawn animation
        if (this.currentSpawnTime > 0) {
            this.currentSpawnTime -= dt;
            return;
        }
        
        // Update phase timers
        this.updatePhaseTimers(dt);
        
        // Update floating animation
        this.updateFloatingAnimation(dt);
        
        // Update phase trail
        this.updatePhaseTrail(dt);
        
        // Update AI based on phase state
        this.updateWraithAI(dt);
        
        // Apply movement with validation
        this.x += this.velocity.x * dt;
        this.y += this.velocity.y * dt;
        
        // Coordinate validation
        if (!isFinite(this.x) || !isFinite(this.y) || Math.abs(this.x) > 1e6 || Math.abs(this.y) > 1e6) {
            console.warn('Wraith coordinate overflow detected, resetting position');
            if (this.game.player) {
                this.x = this.game.player.x + (Math.random() - 0.5) * 400;
                this.y = this.game.player.y + (Math.random() - 0.5) * 400;
            } else {
                this.x = 0;
                this.y = 0;
            }
            this.velocity = { x: 0, y: 0 };
        }
        
        // Flash effects (damage numbers now handled by globalDamageNumberPool)
        if (this.flashTime > 0) {
            this.flashTime -= dt;
        }
    }
    
    updatePhaseTimers(dt) {
        if (this.phaseMode) {
            this.phaseTimer -= dt;
            if (this.phaseTimer <= 0) {
                this.exitPhaseMode();
            }
        } else {
            this.phaseCooldownTimer -= dt;
            if (this.phaseCooldownTimer <= 0 && this.shouldEnterPhase()) {
                this.enterPhaseMode();
            }
        }
    }
    
    updateFloatingAnimation(dt) {
        this.ghostlyFloat += this.floatSpeed * dt;
        this.floatOffset = Math.sin(this.ghostlyFloat) * this.floatAmplitude;
    }
    
    updatePhaseTrail(dt) {
        if (this.phaseMode) {
            // Add current position to trail
            this.phaseTrail.push({
                x: this.x,
                y: this.y,
                opacity: 1.0,
                lifetime: 0.8
            });
            
            // Limit trail length
            if (this.phaseTrail.length > 10) {
                this.phaseTrail.shift();
            }
        }
        
        // Update existing trail points
        for (let i = this.phaseTrail.length - 1; i >= 0; i--) {
            const point = this.phaseTrail[i];
            point.lifetime -= dt;
            point.opacity = point.lifetime / 0.8;
            
            if (point.lifetime <= 0) {
                this.phaseTrail.splice(i, 1);
            }
        }
    }
    
    shouldEnterPhase() {
        const player = this.game.player;
        if (!player || !player.isAlive()) return false;
        
        // Enter phase mode when:
        // 1. Player is far away (to close distance quickly)
        // 2. Wraith is surrounded by other enemies (to escape)
        // 3. Random chance for unpredictability
        
        const distanceToPlayer = Math.sqrt(
            (player.x - this.x) ** 2 + (player.y - this.y) ** 2
        );
        
        if (distanceToPlayer > 200) return true; // Far from player
        if (Math.random() < 0.02) return true; // 2% chance per frame
        
        // Check if surrounded by other enemies
        const nearbyEnemies = this.game.systems.enemy.getNearbyEnemies(this.x, this.y, 50);
        if (nearbyEnemies.length > 3) return true;
        
        return false;
    }
    
    enterPhaseMode() {
        this.phaseMode = true;
        this.phaseTimer = this.phaseDuration;
        this.phaseCooldownTimer = this.phaseCooldown;
        this.canPassThroughWalls = true;
        this.immuneToDamage = true;
        this.currentAlpha = this.phaseAlpha;
        this.speed = this.phaseSpeed;
        
        // Visual effect
        this.createPhaseEnterEffect();
        
        // Audio effect
        this.playWraithSound('wraith_phase_enter');
    }
    
    exitPhaseMode() {
        this.phaseMode = false;
        this.canPassThroughWalls = false;
        this.immuneToDamage = false;
        this.currentAlpha = this.baseAlpha;
        this.speed = this.normalSpeed;
        this.phaseTrail = [];
        
        // Visual effect
        this.createPhaseExitEffect();
        
        // Audio effect
        this.playWraithSound('wraith_phase_exit');
    }
    
    updateWraithAI(dt) {
        const player = this.game.player;
        if (!player || !player.isAlive()) return;
        
        // Calculate distance and direction to player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            this.direction = Math.atan2(dy, dx);
            
            if (this.phaseMode) {
                // In phase mode: move directly towards player, ignoring obstacles
                this.velocity.x = (dx / distance) * this.speed;
                this.velocity.y = (dy / distance) * this.speed;
            } else {
                // Normal mode: standard enemy AI with floating behavior
                if (distance > this.attackRange) {
                    const normalizedX = dx / distance;
                    const normalizedY = dy / distance;
                    
                    // Add some floating/drifting motion
                    const driftX = Math.sin(this.ghostlyFloat * 0.7) * 20;
                    const driftY = Math.cos(this.ghostlyFloat * 0.5) * 15;
                    
                    this.velocity.x = normalizedX * this.speed + driftX;
                    this.velocity.y = normalizedY * this.speed + driftY;
                    
                    // Apply separation from other enemies
                    const separation = this.getSeparationForce();
                    this.velocity.x += separation.x;
                    this.velocity.y += separation.y;
                } else {
                    // In attack range - float around player menacingly
                    const orbitAngle = this.direction + Math.PI / 2;
                    this.velocity.x = Math.cos(orbitAngle) * this.speed * 0.3;
                    this.velocity.y = Math.sin(orbitAngle) * this.speed * 0.3;
                    
                    // Attack if ready
                    if (this.attackCooldown <= 0) {
                        this.wraithAttack();
                    }
                }
            }
        }
        
        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }
    }
    
    wraithAttack() {
        const player = this.game.player;
        if (!player || !player.isAlive()) return;
        
        // FIXED: Validate player is actually in attack range before dealing damage
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Only attack if player is within actual attack range
        if (distance <= this.attackRange) {
            // Spectral touch attack - phases through defenses
            player.takeDamage(this.damage);
            
            // Create spectral attack effect
            this.createSpectralAttackEffect();
            
            // Audio effect
            this.playWraithSound('wraith_attack');
        }
        
        // Reset cooldown regardless (prevents spam attempts)
        this.attackCooldown = this.baseAttackCooldown;
    }
    
    takeDamage(amount, source = null, isCritical = false) {
        // Immune to damage during phase mode
        if (this.immuneToDamage || this.phaseMode) {
            this.createImmuneEffect();
            return false;
        }
        
        // Normal damage processing
        return super.takeDamage(amount, source, isCritical);
    }
    
    createPhaseEnterEffect() {
        if (!this.game.systems.particle) return;
        
        // Ghostly dissipation effect
        this.game.systems.particle.createBurst(this.x, this.y, 'ghostlyDissipation', {
            color: this.color,
            count: 15,
            intensity: 1.5,
            spread: 40
        });
        
        // Spectral rings
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                this.createSpectralRing(this.x, this.y, 30 + i * 15);
            }, i * 100);
        }
    }
    
    createPhaseExitEffect() {
        if (!this.game.systems.particle) return;
        
        // Materialization effect
        this.game.systems.particle.createBurst(this.x, this.y, 'ghostlyMaterialization', {
            color: this.color,
            count: 20,
            intensity: 2.0,
            spread: 50,
            inward: true
        });
    }
    
    createSpectralRing(x, y, radius) {
        if (!this.game.systems.particle) return;
        
        const ringParticles = 16;
        for (let i = 0; i < ringParticles; i++) {
            const angle = (i / ringParticles) * Math.PI * 2;
            const particleX = x + Math.cos(angle) * radius;
            const particleY = y + Math.sin(angle) * radius;
            
            this.game.systems.particle.create(particleX, particleY, {
                vx: 0,
                vy: -20,
                life: 1.0,
                size: 3,
                color: this.color,
                glow: true,
                fadeOut: true
            });
        }
    }
    
    createSpectralAttackEffect() {
        if (!this.game.systems.particle) return;
        
        // Energy drain effect towards wraith
        const drainParticles = 8;
        for (let i = 0; i < drainParticles; i++) {
            const angle = (i / drainParticles) * Math.PI * 2;
            const startDistance = 30;
            const startX = this.game.player.x + Math.cos(angle) * startDistance;
            const startY = this.game.player.y + Math.sin(angle) * startDistance;
            
            this.game.systems.particle.create(startX, startY, {
                vx: (this.x - startX) * 2,
                vy: (this.y - startY) * 2,
                life: 0.8,
                size: 4,
                color: '#FF6B6B',
                glow: true,
                fadeOut: true
            });
        }
    }
    
    createImmuneEffect() {
        if (!this.game.systems.particle) return;
        
        // Phase immunity sparkles
        this.game.systems.particle.createBurst(this.x, this.y, 'phaseImmune', {
            color: '#FFFFFF',
            count: 6,
            intensity: 1.0,
            spread: 20
        });
        
        // Show "IMMUNE" text
        this.addDamageNumber('IMMUNE', '#FFFFFF');
    }
    
    playWraithSound(soundName) {
        if (this.game.audioManager && this.game.audioManager.playVampireSound) {
            const volume = 0.4 + Math.random() * 0.2;
            const pitch = 0.8 + Math.random() * 0.4;
            this.game.audioManager.playVampireSound(soundName, volume, pitch);
        }
    }
    
    render(renderer) {
        if (!this.active) return;
        
        const ctx = renderer.ctx;
        ctx.save();
        
        // Render phase trail first
        this.renderPhaseTrail(ctx);
        
        // Spawn animation
        if (this.currentSpawnTime > 0) {
            const spawnProgress = 1 - (this.currentSpawnTime / this.spawnTime);
            ctx.globalAlpha = spawnProgress * this.currentAlpha;
        } else {
            ctx.globalAlpha = this.currentAlpha;
        }
        
        // Flash effect when damaged
        if (this.flashTime > 0 && !this.phaseMode) {
            ctx.shadowColor = '#FFFFFF';
            ctx.shadowBlur = this.glowIntensity;
        }
        
        // Ghostly glow effect
        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.glowIntensity;
        
        // Draw wraith body (floating)
        const renderY = this.y + this.floatOffset;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, renderY, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw wraith details
        this.renderWraithDetails(ctx, renderY);
        
        // Health bar for damaged wraiths (but not during phase)
        if (this.health < this.maxHealth && !this.phaseMode) {
            this.renderHealthBar(ctx, renderY);
        }
        
        ctx.restore();
        
        // Note: Damage numbers now rendered by globalDamageNumberPool
    }
    
    renderPhaseTrail(ctx) {
        if (this.phaseTrail.length === 0) return;
        
        ctx.save();
        
        for (let i = 0; i < this.phaseTrail.length; i++) {
            const point = this.phaseTrail[i];
            const size = this.size * point.opacity * 0.8;
            
            ctx.globalAlpha = point.opacity * 0.5;
            ctx.fillStyle = this.color;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 8;
            
            ctx.beginPath();
            ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    renderWraithDetails(ctx, renderY) {
        // Spectral wisps around the wraith
        if (!this.phaseMode) {
            const wispCount = 4;
            const time = performance.now() * 0.003;
            
            for (let i = 0; i < wispCount; i++) {
                const angle = (i / wispCount) * Math.PI * 2 + time;
                const distance = 15 + Math.sin(time * 2 + i) * 5;
                const wispX = this.x + Math.cos(angle) * distance;
                const wispY = renderY + Math.sin(angle) * distance;
                
                ctx.fillStyle = this.color;
                ctx.globalAlpha = 0.6;
                ctx.beginPath();
                ctx.arc(wispX, wispY, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // Phase mode effect - flickering appearance
        if (this.phaseMode) {
            const flicker = Math.sin(performance.now() * 0.02) * 0.3 + 0.7;
            ctx.globalAlpha *= flicker;
            
            // Draw phase distortion lines
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.4;
            
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const startX = this.x + Math.cos(angle) * this.size;
                const startY = renderY + Math.sin(angle) * this.size;
                const endX = startX + Math.cos(angle) * 15;
                const endY = startY + Math.sin(angle) * 15;
                
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
        }
    }
    
    renderHealthBar(ctx, renderY) {
        const barWidth = this.size * 2;
        const barHeight = 3;
        const barX = this.x - barWidth / 2;
        const barY = renderY - this.size - 10;
        
        // Background
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#333333';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Health
        const healthRatio = this.health / this.maxHealth;
        ctx.fillStyle = healthRatio > 0.5 ? '#9370DB' : '#FF4444';
        ctx.fillRect(barX, barY, barWidth * healthRatio, barHeight);
    }
    
    // Override death to create special wraith death effect
    die() {
        if (!this.active) return;
        
        // Create spectacular wraith death effect
        this.createWraithDeathEffect();
        
        // Call parent die method
        super.die();
    }
    
    createWraithDeathEffect() {
        if (!this.game.systems.particle) return;
        
        // Spectral explosion
        this.game.systems.particle.createBurst(this.x, this.y, 'wraithDeath', {
            color: this.color,
            count: 25,
            intensity: 2.5,
            spread: 60
        });
        
        // Soul release effect
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const angle = Math.random() * Math.PI * 2;
                const distance = 20 + Math.random() * 30;
                const soulX = this.x + Math.cos(angle) * distance;
                const soulY = this.y + Math.sin(angle) * distance;
                
                this.game.systems.particle.create(soulX, soulY, {
                    vx: 0,
                    vy: -100,
                    life: 2.0,
                    size: 6,
                    color: '#FFFFFF',
                    glow: true,
                    fadeOut: true
                });
            }, i * 100);
        }
        
        // Audio effect
        this.playWraithSound('wraith_death');
    }
}