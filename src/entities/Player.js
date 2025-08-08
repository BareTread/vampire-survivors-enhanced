import { globalDamageNumberPool } from '../core/DamageNumberPool.js';

export class Player {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        
        // Movement properties
        this.targetX = x;
        this.targetY = y;
        this.velocity = { x: 0, y: 0 };
        this.maxSpeed = 100; // pixels per second
        this.acceleration = 500;
        this.deceleration = 800;
        
        // Health and stats
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.level = 1;
        this.experience = 0;
        this.experienceToNext = 100;
        
        // Player stats (upgradeable)
        this.stats = {
            damage: 1.0,        // Damage multiplier
            speed: 1.0,         // Movement speed multiplier
            health: 1.0,        // Health multiplier
            luck: 1.0,          // Experience/drop rate multiplier
            area: 1.0,          // Weapon area multiplier
            cooldown: 1.0,      // Weapon cooldown multiplier
            duration: 1.0,      // Weapon duration multiplier
            projectiles: 0      // Additional projectiles
        };
        
        // Visual properties
        this.size = 12;
        this.color = '#4A90E2';
        this.direction = 0; // For sprite facing
        
        // Combat properties
        this.invulnerable = false;
        this.invulnerabilityTime = 0;
        this.maxInvulnerabilityTime = 1.0; // 1 second of invulnerability after hit
        
        // Equipment
        this.weapons = new Map();
        this.maxWeapons = 6;
        
        // Collision
        this.hitbox = {
            width: this.size * 1.5,
            height: this.size * 1.5
        };
        
        // Visual effects
        // Note: Damage numbers now handled by globalDamageNumberPool
        this.levelUpEffect = false;
        this.levelUpEffectTime = 0;
        
        // COMBO SYSTEM - Core addiction mechanic
        this.combo = {
            count: 0,
            timer: 0,
            timeWindow: 3.0, // 3 seconds to maintain combo
            multiplier: 1.0,
            maxCombo: 0, // Track personal best
            thresholds: [5, 10, 25, 50, 100, 200, 500], // Celebration thresholds
            lastCelebration: 0
        };
        
        // POWER-UP STATES - Temporary god-mode feelings
        this.powerUps = {
            invincible: { active: false, timer: 0 },
            speedBoost: { active: false, timer: 0, multiplier: 2.0 },
            damageBoost: { active: false, timer: 0, multiplier: 3.0 },
            magnetBoost: { active: false, timer: 0, multiplier: 3.0 },
            fireRate: { active: false, timer: 0, multiplier: 0.3 } // Lower = faster
        };
        
        // ENHANCED DESPERATION MODE - Dramatic comeback mechanics
        this.nearDeath = {
            threshold: 0.25, // Increased from 15% to 25% health for earlier activation
            bonusActive: false,
            damageReduction: 0.3, // Take 70% damage (30% reduction)
            expMultiplier: 3.0, // Triple XP when in desperation
            effectIntensity: 0
        };
        
        this.desperationMode = {
            active: false,
            speedMultiplier: 1.4, // 40% speed boost
            damageMultiplier: 1.6, // 60% damage boost  
            magnetRangeMultiplier: 2.5, // 2.5x magnet range
            iFrameBonus: 0.15, // Additional 0.15s invincibility on movement
            criticalChanceBonus: 0.3 // +30% critical hit chance
        };
        
        // STREAK TRACKING - For various psychological rewards
        this.streaks = {
            noDamage: 0, // Seconds without taking damage
            perfectWaves: 0, // Waves completed without damage
            criticalHits: 0, // Consecutive critical hits
            lastDamageTime: 0,
            killStreak: 0, // Consecutive kills without taking damage
            killStreakBest: 0, // Best kill streak ever
            lastKillTime: 0 // Time of last kill for streak timeout
        };
        
        // Initialize key state
        this.keyPressed = { up: false, down: false, left: false, right: false };
        
        // MANUAL AIMING SYSTEM - Skill-based targeting for increased engagement
        this.manualAiming = {
            enabled: false,
            aimX: 0,
            aimY: 0,
            crosshairSize: 20,
            accuracy: 0.0, // 0.0 to 1.0 based on how close to enemy center
            accuracyBonus: 1.0, // Damage multiplier for accuracy
            maxAccuracyBonus: 2.5, // Maximum 2.5x damage for perfect aim
            aimAssistRadius: 30, // Pixels for aim assist
            skillWindow: 0.3, // Seconds for precision timing bonus
            lastShotTime: 0,
            precisionBonus: false,
            totalShots: 0,
            accurateShots: 0,
            perfectShots: 0
        };
        
        this.setupInput();
    }
    
    setupInput() {
        // Handle movement input
        this.game.inputManager.on('mouseMove', (e) => {
            if (this.game && this.game.camera && typeof this.game.camera.screenToWorld === 'function') {
                const worldPos = this.game.camera.screenToWorld(e.x, e.y);
                this.setTarget(worldPos.x, worldPos.y);
            }
        });
        
        // Handle WASD movement
        this.game.inputManager.on('keyDown', (key) => {
            this.handleKeyDown(key);
        });
        
        this.game.inputManager.on('keyUp', (key) => {
            this.handleKeyUp(key);
        });
        
        // Manual aiming controls
        this.game.inputManager.on('click', (e) => {
            this.handleAimingClick(e);
        });
        
        this.game.inputManager.on('rightClick', (e) => {
            this.handleAimingRightClick(e);
        });
    }
    
    handleKeyDown(key) {
        // WASD movement support
        switch(key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                this.keyPressed.up = true;
                break;
            case 's':
            case 'arrowdown':
                this.keyPressed.down = true;
                break;
            case 'a':
            case 'arrowleft':
                this.keyPressed.left = true;
                break;
            case 'd':
            case 'arrowright':
                this.keyPressed.right = true;
                break;
            case 'shift':
                // Toggle manual aiming mode
                this.toggleManualAiming();
                break;
        }
    }
    
    handleKeyUp(key) {
        switch(key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                this.keyPressed.up = false;
                break;
            case 's':
            case 'arrowdown':
                this.keyPressed.down = false;
                break;
            case 'a':
            case 'arrowleft':
                this.keyPressed.left = false;
                break;
            case 'd':
            case 'arrowright':
                this.keyPressed.right = false;
                break;
        }
    }
    
    setTarget(x, y) {
        this.targetX = x;
        this.targetY = y;
    }
    
    update(dt) {
        // Update invulnerability
        if (this.invulnerable) {
            this.invulnerabilityTime -= dt;
            if (this.invulnerabilityTime <= 0) {
                this.invulnerable = false;
            }
        }
        
        // Update movement
        this.updateMovement(dt);
        
        // Note: Damage numbers now updated by globalDamageNumberPool
        
        // Update level up effect
        if (this.levelUpEffect) {
            this.levelUpEffectTime -= dt;
            if (this.levelUpEffectTime <= 0) {
                this.levelUpEffect = false;
            }
        }
        
        // ADDICTION MECHANICS UPDATES
        this.updateComboSystem(dt);
        this.updatePowerUps(dt);
        this.updateNearDeathEffects(dt);
        this.updateStreaks(dt);
        
        // Update weapons
        this.updateWeapons(dt);
        
        // Update manual aiming system
        this.updateManualAiming(dt);
    }
    
    updateMovement(dt) {
        // FIXED: Add WASD movement support
        let moveX = 0;
        let moveY = 0;
        
        // Check WASD input
        if (this.keyPressed.up) moveY -= 1;
        if (this.keyPressed.down) moveY += 1;
        if (this.keyPressed.left) moveX -= 1;
        if (this.keyPressed.right) moveX += 1;
        
        // If using WASD, override mouse targeting
        if (moveX !== 0 || moveY !== 0) {
            // Normalize diagonal movement
            const inputMagnitude = Math.sqrt(moveX * moveX + moveY * moveY);
            if (inputMagnitude > 0) {
                moveX /= inputMagnitude;
                moveY /= inputMagnitude;
            }
            
            // Use base maxSpeed here; apply all stat multipliers (incl. speedBoost) later via effective stats
            const speed = this.maxSpeed;
            const desiredVelocityX = moveX * speed;
            const desiredVelocityY = moveY * speed;
            
            // Direct velocity for responsive controls
            this.velocity.x = desiredVelocityX;
            this.velocity.y = desiredVelocityY;
            
            // Update direction for sprite facing
            if (moveX !== 0 || moveY !== 0) {
                this.direction = Math.atan2(moveY, moveX);
            }
        } else {
            // Stop movement when no input
            this.velocity.x = 0;
            this.velocity.y = 0;
        }
        
        // Apply effective speed (including power-up bonuses)
        const effectiveStats = this.getEffectiveStats();
        const speedMultiplier = effectiveStats.speed;
        
        // Apply velocity with coordinate validation
        // FIXED: Add safety checks for mathematical operations
        const deltaX = this.velocity.x * speedMultiplier * dt;
        const deltaY = this.velocity.y * speedMultiplier * dt;
        
        // Validate delta values before applying
        if (isFinite(deltaX) && isFinite(deltaY) && Math.abs(deltaX) < 1000 && Math.abs(deltaY) < 1000) {
            this.x += deltaX;
            this.y += deltaY;
        } else {
            console.warn('Invalid movement delta detected, zeroing velocity');
            this.velocity = { x: 0, y: 0 };
        }
        
        // Validate coordinates and keep player within reasonable bounds
        if (!isFinite(this.x) || !isFinite(this.y)) {
            console.warn('Player coordinate overflow detected, resetting position');
            this.x = 400; // Center of typical screen
            this.y = 300;
            this.velocity = { x: 0, y: 0 };
        }
        
        // Boundary enforcement is handled by TerrainSystem to avoid duplication
        // World bounds will be enforced by the TerrainSystem's checkBounds method
    }
    
    updateWeapons(dt) {
        for (const weapon of this.weapons.values()) {
            weapon.update(dt);
        }
    }
    
    // updateDamageNumbers removed - now handled by globalDamageNumberPool
    
    takeDamage(amount) {
        // Use the enhanced damage system for addictive mechanics
        return this.takeDamageEnhanced(amount);
    }
    
    createDamageEffects(damage) {
        // Show enhanced damage number
        this.addDamageNumber(-damage, '#FF4444');
        
        // Screen effects based on damage severity
        const damagePercent = damage / this.maxHealth;
        const shakeIntensity = Math.min(12, 5 + damage * 0.5);
        const flashIntensity = Math.min(0.4, 0.1 + damagePercent * 0.3); // Reduced flash intensity
        
        // Screen shake (with safety check)
        if (this.game && this.game.camera && typeof this.game.camera.shake === 'function') {
            this.game.camera.shake(shakeIntensity, 0.4);
        }
        
        // Reduced red screen flash to prevent overlay bug (with safety check)
        if (this.game && this.game.camera && typeof this.game.camera.flash === 'function') {
            // Only flash on significant damage to prevent overlapping with level up effects
            if (damagePercent > 0.1) {
                this.game.camera.flash('#FF0000', flashIntensity);
            }
        }
        
        // Particle effects around player
        if (this.game.systems.particle) {
            // Blood splatter effect
            this.game.systems.particle.createBurst(this.x, this.y, 'bloodSplash', {
                color: '#8B0000',
                count: Math.floor(damage * 0.3),
                spread: 40
            });
            
            // Impact sparks
            this.game.systems.particle.createBurst(this.x, this.y, 'hit', {
                color: '#FF4444',
                count: 8,
                intensity: damagePercent * 2
            });
        }
        
        // Audio feedback
        if (this.game.audioManager && this.game.audioManager.playVampireSound) {
            const volume = Math.min(1.0, 0.6 + damagePercent * 0.4);
            const pitch = 0.8 + Math.random() * 0.4;
            this.game.audioManager.playVampireSound('vampireBite', volume, pitch);
        }
        
        // Low health warning effects
        const healthPercent = this.health / this.maxHealth;
        if (healthPercent <= 0.25) {
            this.createLowHealthEffects();
        }
    }
    
    createLowHealthEffects() {
        // Red vignette effect for low health
        if (this.game && this.game.camera && typeof this.game.camera.addVignette === 'function') {
            this.game.camera.addVignette(0.4);
        }
        
        // Pulsing heart particles
        if (this.game.systems.particle) {
            for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2;
                const distance = 25;
                this.game.systems.particle.create(
                    this.x + Math.cos(angle) * distance,
                    this.y + Math.sin(angle) * distance,
                    {
                        vx: 0,
                        vy: -30,
                        life: 1.0,
                        size: 4,
                        color: '#FF0000',
                        glow: true,
                        fadeOut: true,
                        pulse: true
                    }
                );
            }
        }
        
        // Play heartbeat sound
        if (this.game.audioManager && this.game.audioManager.playVampireSound) {
            this.game.audioManager.playVampireSound('heartbeat', 0.8, 1.2);
        }
    }
    
    heal(amount) {
        if (this.health <= 0) return;
        
        const healing = Math.min(amount, this.maxHealth - this.health);
        if (healing > 0) {
            this.health += healing;
            this.addDamageNumber(healing, '#44FF44');
        }
    }
    
    gainExperience(amount) {
        // Use the enhanced experience system for addictive mechanics
        this.gainExperienceEnhanced(amount);
    }
    
    levelUp() {
        this.experience -= this.experienceToNext;
        this.level++;
        
        // REBALANCED: Slightly reduced XP requirements to compensate for lower XP rewards
        // Old: 1.15^level growth was too steep with reduced XP income
        // New: 1.12^level growth for more reasonable progression
        this.experienceToNext = Math.floor(100 * Math.pow(1.12, this.level - 1));
        
        // Full heal on level up
        this.health = this.maxHealth;
        
        // Enhanced level up effects
        this.createLevelUpEffects();
        
        // Show level up UI
        this.game.showLevelUpUI();
    }
    
    createLevelUpEffects() {
        // Level up visual effect
        this.levelUpEffect = true;
        this.levelUpEffectTime = 2.0; // Extended duration
        
        // XP MAGNET EFFECT - Magnetize all XP gems on level up!
        if (this.game.systems.experience) {
            this.game.systems.experience.magnetizeAllGems();
            
            // Create visual effect for the magnet effect
            if (this.game.systems.particle) {
                // Magnetic wave effect
                this.game.systems.particle.createMagnetWave(this.x, this.y, 300); // 300 pixel radius
                
                // Show "+XP MAGNET!" text
                setTimeout(() => {
                    this.game.systems.particle.createEnhancedDamageNumber(
                        this.x, this.y - 60, 
                        '+XP MAGNET!', 
                        false, 
                        '#00FFFF', 
                        24, 
                        2.5
                    );
                }, 200);
            }
        }
        
        // Single gold flash to prevent overlapping effects that cause red overlay bug
        if (this.game && this.game.camera && typeof this.game.camera.flash === 'function') {
            this.game.camera.flash('#FFD700', 1.0);
        }
        
        // Dramatic screen shake
        if (this.game && this.game.camera && typeof this.game.camera.shake === 'function') {
            this.game.camera.shake(15, 0.6);
        }
        
        // Massive particle explosion
        if (this.game.systems.particle) {
            // Golden nova explosion
            this.game.systems.particle.createBurst(this.x, this.y, 'evolution', {
                color: '#FFD700',
                count: 50,
                spread: 80,
                intensity: 3.0
            });
            
            // Secondary burst with different color
            setTimeout(() => {
                this.game.systems.particle.createBurst(this.x, this.y, 'gemExplosion', {
                    color: '#FFA500',
                    count: 30,
                    spread: 60,
                    intensity: 2.0
                });
            }, 150);
            
            // Healing sparkles
            for (let i = 0; i < 20; i++) {
                setTimeout(() => {
                    const angle = Math.random() * Math.PI * 2;
                    const distance = 30 + Math.random() * 40;
                    this.game.systems.particle.create(
                        this.x + Math.cos(angle) * distance,
                        this.y + Math.sin(angle) * distance,
                        {
                            vx: Math.cos(angle) * -50,
                            vy: Math.sin(angle) * -50,
                            life: 1.5,
                            size: 5,
                            color: '#00FF88',
                            glow: true,
                            fadeOut: true
                        }
                    );
                }, i * 50);
            }
            
            // Level number display
            this.game.systems.particle.createEnhancedDamageNumber(
                this.x, this.y - 30, 
                this.level, 
                false, 
                '#FFD700', 
                32, 
                3.0
            );
        }
        
        // Enhanced audio feedback
        if (this.game.audioManager) {
            // Level up fanfare
            if (typeof this.game.audioManager.playLevelUp === 'function') {
                this.game.audioManager.playLevelUp();
            }
            
            // Triumphant chord progression
            if (typeof this.game.audioManager.playVampireSound === 'function') {
                setTimeout(() => {
                    this.game.audioManager.playVampireSound('weaponUpgrade', 0.8, 1.2);
                }, 300);
                
                setTimeout(() => {
                    this.game.audioManager.playVampireSound('experienceGain', 0.6, 1.5);
                }, 600);
            }
        }
        
        // Healing effect numbers
        this.addDamageNumber(this.maxHealth, '#00FF88', 'FULL HEAL');
        this.addDamageNumber(`LEVEL ${this.level}`, '#FFD700', '');
    }
    
    addWeapon(weaponClass, config = {}) {
        if (this.weapons.size >= this.maxWeapons) {
            return false; // Can't add more weapons
        }
        
        const weapon = new weaponClass(this.game, this, config);
        this.weapons.set(weapon.id, weapon);
        return true;
    }
    
    upgradeWeapon(weaponId) {
        const weapon = this.weapons.get(weaponId);
        if (weapon) {
            weapon.upgrade();
            return true;
        }
        return false;
    }
    
    addDamageNumber(amount, color, prefix = '') {
        // Skip zero or invalid damage numbers unless it's a text message
        if (typeof amount === 'number' && (!isFinite(amount) || amount <= 0)) {
            return;
        }
        
        // Use centralized damage number pool
        const isCritical = color === '#FF0000' || color === '#FF69B4' || prefix === 'CRITICAL';
        const displayText = prefix ? `${prefix} ${amount}` : amount;
        return globalDamageNumberPool.get(
            this.x + (Math.random() - 0.5) * 20,
            this.y - 10,
            displayText,
            color,
            isCritical
        );
    }
    
    die() {
        this.game.gameOver();
    }
    
    render(renderer) {
        // Force procedural rendering to ensure player is always visible
        // Sprite system seems to have issues, so using procedural as primary
        this.renderProcedural(renderer);
        
        // Always render UI elements
        this.renderHealthBar(renderer.ctx);
        // Note: Damage numbers now rendered by globalDamageNumberPool
        this.renderManualAiming(renderer);
    }
    
    renderWithSprites(renderer) {
        // Determine sprite variant based on state
        let spriteName = 'player_base';
        let spriteOptions = {};
        
        // Apply invulnerability flashing
        if (this.invulnerable) {
            const flashRate = 10;
            const flash = Math.sin(this.invulnerabilityTime * flashRate * Math.PI * 2);
            spriteOptions.alpha = flash < 0 ? 0.5 : 1.0;
        }
        
        // Apply level up glow effect
        if (this.levelUpEffect) {
            const glowIntensity = this.levelUpEffectTime;
            spriteOptions.glow = true;
            spriteOptions.glowColor = '#FFD700';
            spriteOptions.glowIntensity = 20 * glowIntensity;
        }
        
        // Apply desperation mode effects
        if (this.desperationMode && this.desperationMode.active) {
            spriteOptions.tint = '#FF0000';
            spriteOptions.glow = true;
            spriteOptions.glowColor = '#FF0000';
            spriteOptions.glowIntensity = 8;
        }
        
        // Damage indication
        if (this.health < this.maxHealth * 0.5) {
            spriteName = 'player_damaged';
        }
        
        // Draw the player sprite using the renderer's sprite manager
        if (renderer.spriteManager) {
            // Use the renderer's sprite manager (LayeredRenderer compatibility)
            const originalCtx = renderer.spriteManager.renderer?.ctx;
            if (renderer.spriteManager.renderer) {
                renderer.spriteManager.renderer.ctx = renderer.ctx;
            }
            renderer.spriteManager.drawSprite(spriteName, this.x, this.y, spriteOptions);
            if (renderer.spriteManager.renderer && originalCtx) {
                renderer.spriteManager.renderer.ctx = originalCtx;
            }
        } else if (renderer.drawSprite) {
            // Use renderer's drawSprite method
            renderer.drawSprite(spriteName, this.x, this.y, spriteOptions);
        } else {
            // Fallback to game's sprite manager
            this.game.spriteManager.drawSprite(spriteName, this.x, this.y, spriteOptions);
        }
        
        // Add directional indicator (small sprite or line)
        this.renderDirectionIndicator(renderer);
    }
    
    renderProcedural(renderer) {
        // Fallback to original rendering
        const ctx = renderer.ctx;
        if (!ctx) {
            console.error('No rendering context available for player!');
            return;
        }
        ctx.save();
        
        // Apply invulnerability flashing effect
        if (this.invulnerable) {
            const flashRate = 10;
            const flash = Math.sin(this.invulnerabilityTime * flashRate * Math.PI * 2);
            if (flash < 0) {
                ctx.globalAlpha = 0.5;
            }
        }
        
        // Level up glow effect
        if (this.levelUpEffect) {
            const glowIntensity = this.levelUpEffectTime;
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 20 * glowIntensity;
        }
        
        // Draw player circle with enhanced visual feedback
        let playerColor = this.color;
        if (this.desperationMode && this.desperationMode.active) {
            playerColor = '#FF6B6B'; // Red tint for desperation mode
        }
        
        // Main body with gradient for depth
        const gradient = ctx.createRadialGradient(this.x-3, this.y-3, 0, this.x, this.y, this.size);
        gradient.addColorStop(0, this.lightenColor(playerColor, 0.3));
        gradient.addColorStop(1, playerColor);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Border for definition
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
        
        this.renderDirectionIndicator(renderer);
    }
    
    renderDirectionIndicator(renderer) {
        const ctx = renderer.ctx;
        ctx.save();
        
        // Enhanced direction indicator
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        
        // Main direction line
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        const dirX = this.x + Math.cos(this.direction) * this.size * 0.8;
        const dirY = this.y + Math.sin(this.direction) * this.size * 0.8;
        ctx.lineTo(dirX, dirY);
        ctx.stroke();
        
        // Arrow head for clarity
        const arrowSize = 4;
        const arrowAngle = 0.5;
        ctx.beginPath();
        ctx.moveTo(dirX, dirY);
        ctx.lineTo(
            dirX - Math.cos(this.direction - arrowAngle) * arrowSize,
            dirY - Math.sin(this.direction - arrowAngle) * arrowSize
        );
        ctx.moveTo(dirX, dirY);
        ctx.lineTo(
            dirX - Math.cos(this.direction + arrowAngle) * arrowSize,
            dirY - Math.sin(this.direction + arrowAngle) * arrowSize
        );
        ctx.stroke();
        
        ctx.restore();
    }
    
    // Utility function for color manipulation
    lightenColor(color, amount) {
        // Simple color lightening - assumes hex color
        const colorValue = parseInt(color.replace('#', ''), 16);
        const red = Math.min(255, Math.floor((colorValue >> 16) + 255 * amount));
        const green = Math.min(255, Math.floor(((colorValue >> 8) & 0x00FF) + 255 * amount));
        const blue = Math.min(255, Math.floor((colorValue & 0x0000FF) + 255 * amount));
        
        return `#${((red << 16) | (green << 8) | blue).toString(16).padStart(6, '0')}`;
    }
    
    renderHealthBar(ctx) {
        const barWidth = 40;
        const barHeight = 6;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.size - 15;
        
        // Background
        ctx.fillStyle = '#333333';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Health
        const healthRatio = this.health / this.maxHealth;
        const healthColor = healthRatio > 0.6 ? '#44FF44' : healthRatio > 0.3 ? '#FFAA44' : '#FF4444';
        ctx.fillStyle = healthColor;
        ctx.fillRect(barX, barY, barWidth * healthRatio, barHeight);
        
        // Border
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
    
    // renderDamageNumbers removed - now handled by globalDamageNumberPool
    
    // Helper methods
    lerp(start, end, factor) {
        return start + (end - start) * factor;
    }
    
    getPosition() {
        return { x: this.x, y: this.y };
    }
    
    getBounds() {
        return {
            left: this.x - this.hitbox.width / 2,
            right: this.x + this.hitbox.width / 2,
            top: this.y - this.hitbox.height / 2,
            bottom: this.y + this.hitbox.height / 2
        };
    }
    
    isAlive() {
        return this.health > 0;
    }
    
    // ==============================
    // ADDICTION MECHANICS - The psychological hooks that make players unable to stop
    // ==============================
    
    updateComboSystem(dt) {
        // Decay combo if no kills recently
        if (this.combo.timer > 0) {
            this.combo.timer -= dt;
            if (this.combo.timer <= 0 && this.combo.count > 0) {
                this.breakCombo();
            }
        }
        
        // REBALANCED: Much more conservative combo multiplier to prevent exponential XP inflation
        // Old: 1.0 + (count * 0.1) + Math.pow(count / 50, 1.5) could reach 5x+ easily
        // New: Logarithmic scaling with hard cap to maintain progression balance
        const rawMultiplier = 1.0 + (this.combo.count * 0.02) + Math.log10(Math.max(1, this.combo.count)) * 0.15;
        this.combo.multiplier = Math.min(rawMultiplier, 2.5); // Hard cap at 2.5x multiplier
    }
    
    addKillToCombo() {
        this.combo.count++;
        this.combo.timer = this.combo.timeWindow;
        
        // Track personal best
        if (this.combo.count > this.combo.maxCombo) {
            this.combo.maxCombo = this.combo.count;
            
            // Update achievement system and flow state
            if (this.game.systems.achievement) {
                this.game.systems.achievement.onComboAchieved(this.combo.count);
            }
            if (this.game.systems.flowState) {
                this.game.systems.flowState.onComboAchieved(this.combo.count);
            }
        }
        
        // Check for combo celebration thresholds
        const threshold = this.combo.thresholds.find(t => 
            this.combo.count === t && this.combo.lastCelebration < t
        );
        
        if (threshold) {
            this.celebrateComboMilestone(threshold);
        }
        
        // Continuous small rewards to maintain dopamine
        if (this.combo.count % 5 === 0 && this.combo.count >= 5) {
            this.triggerComboFeedback();
        }
        
        // Update UI
        this.game.updateComboDisplay(this.combo.count, this.combo.multiplier);
    }

    
    addKillToStreak() {
        // Only count kills if player hasn't taken damage recently
        const timeSinceLastDamage = this.game.gameTime - this.streaks.lastDamageTime;
        if (timeSinceLastDamage < 3.0) {
            // Reset kill streak if damaged recently
            if (this.streaks.killStreak > 0) {
                this.addDamageNumber('KILL STREAK BROKEN!', '#FF6666', '');
                this.streaks.killStreak = 0;
            }
            return;
        }
        
        this.streaks.killStreak++;
        this.streaks.lastKillTime = this.game.gameTime;
        
        // Track personal best
        if (this.streaks.killStreak > this.streaks.killStreakBest) {
            this.streaks.killStreakBest = this.streaks.killStreak;
        }
        
        // Kill streak rewards and effects
        this.handleKillStreakRewards();
    }
    
    handleKillStreakRewards() {
        const streak = this.streaks.killStreak;
        
        // Show streak progress every 5 kills
        if (streak % 5 === 0 && streak >= 5) {
            const color = streak < 15 ? '#FFAA00' : streak < 30 ? '#FF6600' : '#FF0066';
            this.addDamageNumber(`${streak} KILL STREAK!`, color, 'STREAK');
            
            // Enhanced camera shake for kill streaks
            if (this.game.camera) {
                this.game.camera.shakeKillStreak(streak);
            }
            
            // Particle celebration
            if (this.game.systems.particle) {
                this.game.systems.particle.createKillStreakEffect(this.x, this.y, streak);
            }
            
            // Audio feedback
            if (this.game.audioManager) {
                this.game.audioManager.playVampireSound('criticalHit', 0.8, 1.0 + (streak / 100));
            }
        }
        
        // Major milestone rewards
        const milestones = [10, 25, 50, 100, 200];
        if (milestones.includes(streak)) {
            this.celebrateKillStreakMilestone(streak);
        }
    }
    
    celebrateKillStreakMilestone(streak) {
        // Escalating rewards for kill streak milestones
        const intensity = Math.min(3.0, 1.0 + streak / 50);
        
        // Bonus experience
        const bonusExp = streak * 5;
        this.gainExperience(bonusExp);
        
        // Temporary power boosts
        if (streak >= 10) {
            this.activatePowerUp('damageBoost', 10.0, 1.5 + (streak / 100));
        }
        if (streak >= 25) {
            this.activatePowerUp('speedBoost', 8.0, 1.3);
        }
        if (streak >= 50) {
            this.activatePowerUp('fireRate', 15.0, 0.7); // Faster fire rate
        }
        if (streak >= 100) {
            this.activatePowerUp('invincible', 5.0, 1.0);
        }
        
        // Visual celebration
        if (this.game.camera) {
            this.game.camera.flash('#FFD700', 0.6 * intensity);
            this.game.camera.shake(8 * intensity, 0.8);
        }
        
        // Massive particle explosion
        if (this.game.systems.particle) {
            this.game.systems.particle.createBurst(this.x, this.y, 'evolution', {
                color: '#FFD700',
                count: 30 + streak / 2,
                spread: 100,
                intensity: intensity
            });
        }
        
        // Big celebration text
        this.addDamageNumber(`${streak} KILL MILESTONE!`, '#FFD700', 'LEGENDARY');
        
        // Audio fanfare
        if (this.game.audioManager) {
            this.game.audioManager.playVampireSound('levelUp', 1.0, 1.2);
            setTimeout(() => {
                this.game.audioManager.playVampireSound('criticalHit', 0.8, 1.5);
            }, 200);
        }
    }
    
    celebrateComboMilestone(threshold) {
        this.combo.lastCelebration = threshold;
        
        // Escalating celebrations for higher thresholds
        const intensity = Math.min(3.0, 1.0 + threshold / 100);
        
        // Screen effects
        if (this.game && this.game.camera && typeof this.game.camera.flash === 'function') {
            this.game.camera.flash('#FFD700', 0.8 * intensity);
        }
        if (this.game && this.game.camera && typeof this.game.camera.shake === 'function') {
            this.game.camera.shake(8 * intensity, 0.6);
        }
        
        // Particle celebration
        if (this.game.systems.particle) {
            this.game.systems.particle.createComboExplosion(
                this.x, this.y, threshold, intensity
            );
        }
        
        // Audio celebration
        if (this.game.audioManager && typeof this.game.audioManager.playCriticalHit === 'function') {
            // Play a general sound effect for combo milestones
            this.game.audioManager.playCriticalHit();
        } else if (this.game.audioManager && typeof this.game.audioManager.playVampireSound === 'function') {
            // Fallback to generic celebration sound
            this.game.audioManager.playVampireSound('criticalHit', 1.0, 1.2);
        }
        
        // Bonus rewards for psychological reinforcement
        const bonusExp = threshold * 2;
        this.gainExperience(bonusExp);
        this.addDamageNumber(`COMBO x${threshold}!`, '#FFD700', 'MILESTONE');
        
        // Temporary power boost for immediate gratification
        this.activatePowerUp('damageBoost', 5.0, 2.0 + intensity * 0.5);
    }
    
    triggerComboFeedback() {
        // Small but frequent positive reinforcement
        if (this.game.systems.particle) {
            this.game.systems.particle.createComboSparks(this.x, this.y, this.combo.count);
        }
        
        // Escalating visual feedback
        const sparkColor = this.combo.count < 25 ? '#FFAA00' : 
                          this.combo.count < 50 ? '#FF6600' : '#FF0066';
        this.addDamageNumber(`x${this.combo.count}`, sparkColor, 'COMBO');
    }
    
    breakCombo() {
        if (this.combo.count >= 10) { // Only show loss for meaningful combos
            this.addDamageNumber('COMBO LOST', '#FF4444', '');
            
            // Mild punishment to create loss aversion
            if (this.game.systems.particle) {
                this.game.systems.particle.createComboBreakEffect(this.x, this.y);
            }
        }
        
        this.combo.count = 0;
        this.combo.multiplier = 1.0;
        this.game.updateComboDisplay(0, 1.0);
    }
    
    updatePowerUps(dt) {
        // Update all active power-ups
        for (const [name, powerUp] of Object.entries(this.powerUps)) {
            if (powerUp.active) {
                powerUp.timer -= dt;
                if (powerUp.timer <= 0) {
                    this.deactivatePowerUp(name);
                }
            }
        }
    }
    
    activatePowerUp(type, duration, intensity = 1.0) {
        const powerUp = this.powerUps[type];
        if (!powerUp) return;
        
        powerUp.active = true;
        powerUp.timer = duration;
        if (powerUp.multiplier !== undefined) {
            powerUp.currentMultiplier = powerUp.multiplier * intensity;
        }
        
        // Visual feedback for power-up activation
        this.createPowerUpEffect(type, intensity);
        
        // Update weapon stats if applicable
        this.updateWeaponStats();
    }
    
    deactivatePowerUp(type) {
        const powerUp = this.powerUps[type];
        if (!powerUp) return;
        
        powerUp.active = false;
        powerUp.timer = 0;
        
        // Update weapon stats
        this.updateWeaponStats();
        
        // Show power-up ending
        this.addDamageNumber(`${type.toUpperCase()} ENDED`, '#888888', '');
    }
    
    createPowerUpEffect(type, intensity) {
        const colors = {
            invincible: '#FFD700',
            speedBoost: '#00FFFF',
            damageBoost: '#FF6600',
            magnetBoost: '#44FF44',
            fireRate: '#FF44FF'
        };
        
        const color = colors[type] || '#FFFFFF';
        
        // Power-up activation celebration
        if (this.game && this.game.camera && typeof this.game.camera.flash === 'function') {
            this.game.camera.flash(color, 0.3 * intensity);
        }
        if (this.game && this.game.camera && typeof this.game.camera.shake === 'function') {
            this.game.camera.shake(3 * intensity, 0.2);
        }
        
        if (this.game.systems.particle) {
            this.game.systems.particle.createPowerUpEffect(this.x, this.y, color, intensity);
        }
        
        this.addDamageNumber(type.toUpperCase(), color, 'POWER UP!');
    }
    
    updateNearDeathEffects(dt) {
        const healthPercent = this.health / this.maxHealth;
        const wasNearDeath = this.nearDeath.bonusActive;
        
        // Activate near-death bonuses
        this.nearDeath.bonusActive = healthPercent <= this.nearDeath.threshold;
        
        // Update effect intensity for visual feedback
        if (this.nearDeath.bonusActive) {
            this.nearDeath.effectIntensity = Math.min(1.0, 
                this.nearDeath.effectIntensity + dt * 2.0
            );
            
            // Dramatic heartbeat effects
            if (this.game.systems.particle && Math.random() < 0.3) {
                this.game.systems.particle.createHeartbeatEffect(this.x, this.y);
            }
        } else {
            this.nearDeath.effectIntensity = Math.max(0, 
                this.nearDeath.effectIntensity - dt * 1.5
            );
        }
        
        // Dramatic entrance/exit of near-death state
        if (this.nearDeath.bonusActive && !wasNearDeath) {
            this.enterNearDeathState();
        } else if (!this.nearDeath.bonusActive && wasNearDeath) {
            this.exitNearDeathState();
        }
    }
    
    enterNearDeathState() {
        // Activate full desperation mode
        this.desperationMode.active = true;
        
        // Track near-death survival for achievements
        if (this.game.systems.achievement) {
            this.game.systems.achievement.onNearDeathSurvival();
        }
        
        // Dramatic 'desperation mode' effect
        this.addDamageNumber('DESPERATION MODE!', '#FF0000', 'LAST STAND');
        
        // Visual drama
        if (this.game && this.game.camera && typeof this.game.camera.addVignette === 'function') {
            this.game.camera.addVignette(0.6);
        }
        
        if (this.game.systems.particle) {
            this.game.systems.particle.createLastStandEffect(this.x, this.y);
        }
        
        // Audio drama
        if (this.game.audioManager && typeof this.game.audioManager.playLastStandActivation === 'function') {
            this.game.audioManager.playLastStandActivation();
        } else if (this.game.audioManager && typeof this.game.audioManager.playVampireSound === 'function') {
            // Fallback to generic dramatic sound
            this.game.audioManager.playVampireSound('vampireBite', 0.9, 0.7);
        }
    }
    
    exitNearDeathState() {
        // Deactivate desperation mode
        this.desperationMode.active = false;
        
        // Triumphant recovery
        this.addDamageNumber('RECOVERED!', '#00FF88', 'TRIUMPH');
        
        // Massive XP reward for surviving desperation mode
        const bonusXP = 150;
        this.gainExperience(bonusXP);
        
        // Celebration effects
        if (this.game && this.game.camera && typeof this.game.camera.flash === 'function') {
            this.game.camera.flash('#00FF88', 0.5);
        }
        
        if (this.game.systems.particle) {
            this.game.systems.particle.createRecoveryEffect(this.x, this.y);
        }
        
        console.log('💪 Player survived desperation mode! Bonus XP granted.');
    }
    
    updateStreaks(dt) {
        // Update no-damage streak
        if (this.health === this.maxHealth) {
            this.streaks.noDamage += dt;
            
            // Reward long streaks
            if (this.streaks.noDamage >= 30 && Math.floor(this.streaks.noDamage) % 30 === 0) {
                this.rewardPerfectStreak();
            }
        } else {
            this.streaks.noDamage = 0;
        }
    }
    
    rewardPerfectStreak() {
        const streakMinutes = Math.floor(this.streaks.noDamage / 60);
        
        // Escalating rewards for longer streaks
        const bonusExp = 100 * streakMinutes;
        this.gainExperience(bonusExp);
        
        // Temporary invincibility as reward
        this.activatePowerUp('invincible', 3.0, 1.0);
        
        this.addDamageNumber(`PERFECT ${streakMinutes}min!`, '#FFD700', 'STREAK');
        
        // Celebration
        if (this.game.systems.particle) {
            this.game.systems.particle.createStreakCelebration(this.x, this.y, streakMinutes);
        }
    }
    
    // Override damage to include near-death bonuses and power-up effects
    takeDamageEnhanced(amount) {
        
        // Invincibility power-up
        if (this.powerUps.invincible.active) {
            this.addDamageNumber('INVINCIBLE!', '#FFD700', '');
            return false;
        }
        
        if (this.invulnerable || this.health <= 0) return false;
        
        let finalDamage = amount;
        
        // Near-death damage reduction for dramatic survivability
        if (this.nearDeath.bonusActive) {
            finalDamage *= this.nearDeath.damageReduction;
            this.addDamageNumber('REDUCED!', '#FFAA00', 'LAST STAND');
        }
        
        const damage = Math.max(1, Math.floor(finalDamage));
        this.health = Math.max(0, this.health - damage);
        
        // Track damage for achievements and flow state
        if (this.game.systems.achievement) {
            this.game.systems.achievement.onDamageTaken(damage);
        }
        if (this.game.systems.flowState) {
            this.game.systems.flowState.onDamageTaken(damage);
        }
        
        // Enhanced damage feedback
        this.createDamageEffects(damage);
        
        // Reset streaks
        this.streaks.noDamage = 0;
        this.streaks.lastDamageTime = this.game.gameTime;
        
        // Break combo on significant damage
        if (damage >= this.maxHealth * 0.15 && this.combo.count >= 5) {
            this.breakCombo();
        }
        
        // Start invulnerability
        this.invulnerable = true;
        this.invulnerabilityTime = this.maxInvulnerabilityTime;
        
        // Death check with dramatic near-miss effects
        if (this.health <= 0) {
            this.die();
            return true;
        }
        
        // Last-second save mechanic (psychological relief)
        if (this.health <= 1 && Math.random() < 0.15) { // 15% chance
            this.triggerLastSecondSave();
        }
        
        return true;
    }
    
    triggerLastSecondSave() {
        // Dramatic last-second health restore
        const saveAmount = Math.floor(this.maxHealth * 0.1);
        this.health = Math.min(this.maxHealth, this.health + saveAmount);
        
        // Massive celebration - this creates powerful psychological relief
        this.addDamageNumber('MIRACULOUS SAVE!', '#00FFFF', 'DIVINE');
        
        if (this.game && this.game.camera && typeof this.game.camera.flash === 'function') {
            this.game.camera.flash('#00FFFF', 1.2);
        }
        if (this.game && this.game.camera && typeof this.game.camera.shake === 'function') {
            this.game.camera.shake(12, 0.8);
        }
        
        if (this.game.systems.particle) {
            this.game.systems.particle.createMiraculousSaveEffect(this.x, this.y);
        }
        
        // Temporary power boost as reward
        this.activatePowerUp('invincible', 2.0, 1.0);
        this.activatePowerUp('damageBoost', 10.0, 2.5);
        
        if (this.game.audioManager && typeof this.game.audioManager.playMiraculousSave === 'function') {
            this.game.audioManager.playMiraculousSave();
        } else if (this.game.audioManager && typeof this.game.audioManager.playVampireSound === 'function') {
            // Fallback to generic triumphant sound
            this.game.audioManager.playVampireSound('levelUp', 1.0, 1.5);
        }
    }
    
    // Enhanced experience gain with combo multipliers
    gainExperienceEnhanced(amount) {
        if (this.health <= 0) return;
        
        let finalExp = amount;
        
        // Apply combo multiplier for addictive growth
        finalExp *= this.combo.multiplier;
        
        // Near-death bonus
        if (this.nearDeath.bonusActive) {
            finalExp *= this.nearDeath.expMultiplier;
        }
        
        // Luck multiplier
        finalExp *= this.stats.luck;
        
        const expGain = Math.floor(finalExp);
        this.experience += expGain;
        
        // Enhanced visual feedback based on multipliers
        const color = this.combo.multiplier > 2.0 ? '#FFD700' : 
                      this.combo.multiplier > 1.5 ? '#FFAA00' : '#44AAFF';
        
        const prefix = this.combo.multiplier > 1.0 ? 
                      `x${this.combo.multiplier.toFixed(1)}` : 'EXP';
        
        this.addDamageNumber(expGain, color, prefix);
        
        // FIXED: Process level-ups ONE AT A TIME with proper queuing
        // Initialize level-up queue if it doesn't exist
        if (!this.levelUpQueue) {
            this.levelUpQueue = [];
        }
        
        // Check for level-ups and queue them
        while (this.experience >= this.experienceToNext) {
            this.experience -= this.experienceToNext;
            this.level++;
            
            // Queue this level-up for processing
            this.levelUpQueue.push({
                level: this.level,
                oldLevel: this.level - 1
            });
            
            // REBALANCED: Slightly reduced XP requirements to compensate for lower XP rewards
            this.experienceToNext = Math.floor(100 * Math.pow(1.12, this.level - 1));
            
            // Full heal on level up
            this.health = this.maxHealth;
        }
        
        // Process the first queued level-up (if any) and not already in level-up UI
        if (this.levelUpQueue.length > 0 && !this.game.levelUpActive) {
            this.processNextLevelUp();
        }
    }

    processNextLevelUp() {
        if (!this.levelUpQueue || this.levelUpQueue.length === 0) return;
        if (this.game.levelUpActive) return; // Already showing level-up UI
        
        // Get the next level-up from queue
        const levelUpData = this.levelUpQueue.shift();
        
        // Create level-up effects for this specific level
        this.createLevelUpEffects();
        
        // Show level-up message
        this.addDamageNumber(`LEVEL ${levelUpData.level}!`, '#FFD700', 'LEVEL UP');
        
        // Show the level-up UI for this specific level
        this.game.showLevelUpUI();
    }
    
    completeLevelUpSelection() {
        // Called when player makes a selection in the level-up UI
        // Check if there are more level-ups queued
        if (this.levelUpQueue && this.levelUpQueue.length > 0) {
            // Process the next level-up after a short delay
            setTimeout(() => {
                this.processNextLevelUp();
            }, 500); // Half second delay between level-ups
        }
    }
    
    // Get effective stats including power-up bonuses
    getEffectiveStats() {
        const stats = { ...this.stats };
        
        if (this.powerUps.speedBoost.active) {
            stats.speed *= this.powerUps.speedBoost.currentMultiplier || this.powerUps.speedBoost.multiplier;
        }
        
        if (this.powerUps.damageBoost.active) {
            stats.damage *= this.powerUps.damageBoost.currentMultiplier || this.powerUps.damageBoost.multiplier;
        }
        
        // Fire-rate boosts reduce weapon cooldown. Our weapons compute
        // effective cooldown as: baseCooldown / stats.cooldown.
        // Interpret fireRate.currentMultiplier as a cooldown reduction fraction (e.g. 0.3 => 30% faster).
        if (this.powerUps.fireRate.active) {
            const raw = (this.powerUps.fireRate.currentMultiplier != null)
                ? this.powerUps.fireRate.currentMultiplier
                : this.powerUps.fireRate.multiplier;
            // Clamp to a sane range to avoid extreme values
            const reduction = Math.max(0.0, Math.min(0.75, raw)); // max 75% faster
            // Convert reduction fraction to a multiplier for stats.cooldown (bigger => faster firing)
            // Example: reduction=0.3 -> factor = 1 / (1 - 0.3) = ~1.428x faster
            const factor = 1.0 / (1.0 - reduction);
            stats.cooldown *= factor;
        }
        
        // DESPERATION MODE BONUSES - Dramatic comeback mechanics
        if (this.desperationMode.active) {
            stats.speed *= this.desperationMode.speedMultiplier; // 40% speed boost
            stats.damage *= this.desperationMode.damageMultiplier; // 60% damage boost
            stats.luck += this.desperationMode.criticalChanceBonus; // +30% crit chance
        }
        
        return stats;
    }
    
    // ==============================
    // MANUAL AIMING SYSTEM - Skill-based targeting mechanics
    // ==============================
    
    toggleManualAiming() {
        this.manualAiming.enabled = !this.manualAiming.enabled;
        
        // Visual feedback for mode toggle
        const modeText = this.manualAiming.enabled ? 'MANUAL AIM ON' : 'AUTO AIM ON';
        const color = this.manualAiming.enabled ? '#00FFFF' : '#FFAA00';
        this.addDamageNumber(modeText, color, 'MODE');
        
        // Audio feedback
        if (this.game.audioManager && typeof this.game.audioManager.playVampireSound === 'function') {
            this.game.audioManager.playVampireSound('weaponUpgrade', 0.6, this.manualAiming.enabled ? 1.2 : 0.8);
        }
        
        // Flash effect
        if (this.game && this.game.camera && typeof this.game.camera.flash === 'function') {
            this.game.camera.flash(color, 0.3);
        }
        
        console.log(`🎯 Manual aiming ${this.manualAiming.enabled ? 'ENABLED' : 'DISABLED'}`);
    }
    
    updateManualAiming(dt) {
        if (!this.manualAiming.enabled) return;
        
        // Update aim position to mouse world coordinates
        if (this.game.inputManager && this.game.inputManager.mouse) {
            if (this.game.camera) {
                const worldPos = this.game.camera.screenToWorld(
                    this.game.inputManager.mouse.x, 
                    this.game.inputManager.mouse.y
                );
                this.manualAiming.aimX = worldPos.x;
                this.manualAiming.aimY = worldPos.y;
            }
        }
        
        // Calculate accuracy based on nearest enemy
        this.calculateAimingAccuracy();
    }

    updateLevelUpEffects(dt) {
        // FIXED: Separate method for updating only visual effects during level-up pause
        // This prevents gameplay mechanics from updating while keeping UI smooth
        
        // Update invulnerability visual effects
        if (this.invulnerable) {
            this.invulnerabilityTime -= dt;
            if (this.invulnerabilityTime <= 0) {
                this.invulnerable = false;
            }
        }
        
        // Update level up effect
        if (this.levelUpEffect) {
            this.levelUpEffectTime -= dt;
            if (this.levelUpEffectTime <= 0) {
                this.levelUpEffect = false;
            }
        }
        
        // Update power-up visual effects only (no gameplay effects)
        for (const [name, powerUp] of Object.entries(this.powerUps)) {
            if (powerUp.active) {
                // Don't decrease timers during pause, just maintain visual state
            }
        }
        
        // Note: No movement, combat, or gameplay updates during pause
    }
    
    calculateAimingAccuracy() {
        const nearestEnemy = this.findNearestEnemyToCrosshair();
        
        if (!nearestEnemy) {
            this.manualAiming.accuracy = 0.0;
            this.manualAiming.accuracyBonus = 1.0;
            return;
        }
        
        // Calculate distance from crosshair to enemy center
        const dx = this.manualAiming.aimX - nearestEnemy.x;
        const dy = this.manualAiming.aimY - nearestEnemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate accuracy (1.0 = perfect center, 0.0 = far away)
        const maxAccuracyDistance = nearestEnemy.size + this.manualAiming.aimAssistRadius;
        this.manualAiming.accuracy = Math.max(0, 1.0 - (distance / maxAccuracyDistance));
        
        // Calculate damage bonus based on accuracy
        this.manualAiming.accuracyBonus = 1.0 + (this.manualAiming.accuracy * (this.manualAiming.maxAccuracyBonus - 1.0));
        
        // Perfect shot detection (within enemy hitbox)
        if (distance <= nearestEnemy.size) {
            this.manualAiming.accuracyBonus = this.manualAiming.maxAccuracyBonus;
            this.manualAiming.accuracy = 1.0;
        }
    }
    
    findNearestEnemyToCrosshair() {
        if (!this.game.systems.enemy) return null;
        
        const enemies = this.game.systems.enemy.getActiveEnemies();
        let nearestEnemy = null;
        let nearestDistance = Infinity;
        
        for (const enemy of enemies) {
            const dx = this.manualAiming.aimX - enemy.x;
            const dy = this.manualAiming.aimY - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestEnemy = enemy;
            }
        }
        
        return nearestEnemy;
    }
    
    handleAimingClick(e) {
        if (!this.manualAiming.enabled) return;
        
        // Record shot for statistics
        this.manualAiming.totalShots++;
        this.manualAiming.lastShotTime = performance.now();
        
        // Check if this was an accurate shot
        if (this.manualAiming.accuracy > 0.7) {
            this.manualAiming.accurateShots++;
            
            // Perfect shot bonus
            if (this.manualAiming.accuracy >= 1.0) {
                this.manualAiming.perfectShots++;
                this.triggerPerfectShotBonus();
            }
        }
        
        // Apply precision timing bonus
        const timeSinceLastShot = (performance.now() - this.manualAiming.lastShotTime) / 1000;
        if (timeSinceLastShot <= this.manualAiming.skillWindow) {
            this.manualAiming.precisionBonus = true;
        }
    }
    
    handleAimingRightClick(e) {
        if (!this.manualAiming.enabled) return;
        
        // Right click for special aim-dependent abilities
        this.triggerAimingSpecialAbility();
    }
    
    triggerPerfectShotBonus() {
        // Visual celebration for perfect aim
        this.addDamageNumber('PERFECT AIM!', '#00FFFF', 'SKILL');
        
        // Enhanced visual effects
        if (this.game.systems.particle) {
            this.game.systems.particle.createPerfectAimEffect(
                this.manualAiming.aimX, 
                this.manualAiming.aimY
            );
        }
        
        // Screen flash
        if (this.game && this.game.camera && typeof this.game.camera.flash === 'function') {
            this.game.camera.flash('#00FFFF', 0.4);
        }
        
        // Bonus experience for skilled play
        const bonusExp = 50;
        this.gainExperience(bonusExp);
        
        // Achievement tracking
        if (this.game.systems.achievement) {
            this.game.systems.achievement.updateStats('perfectAimShots', 1);
        }
        
        // Micro-challenge tracking
        if (this.game.systems.microChallenge) {
            this.game.systems.microChallenge.onPerfectAimShot();
        }
    }
    
    triggerAimingSpecialAbility() {
        const nearestEnemy = this.findNearestEnemyToCrosshair();
        if (!nearestEnemy) return;
        
        // Special ability: Precision Strike - high damage single target attack
        if (this.manualAiming.accuracy > 0.8) {
            const damage = 200 * this.manualAiming.accuracyBonus;
            nearestEnemy.takeDamage(damage, this, true); // Force critical
            
            this.addDamageNumber('PRECISION STRIKE!', '#FF0066', 'SPECIAL');
            
            // Cooldown visual feedback
            if (this.game.systems.particle) {
                this.game.systems.particle.createPrecisionStrikeEffect(
                    this.manualAiming.aimX, 
                    this.manualAiming.aimY
                );
            }
        }
    }
    
    // Get manual aiming stats for weapon damage calculation
    getManualAimingBonus() {
        if (!this.manualAiming.enabled) return 1.0;
        
        let bonus = this.manualAiming.accuracyBonus;
        
        // Precision timing bonus
        if (this.manualAiming.precisionBonus) {
            bonus *= 1.3; // 30% bonus for rapid precise shots
            this.manualAiming.precisionBonus = false; // Reset after use
        }
        
        return bonus;
    }
    
    // Get manual aim target for weapons
    getManualAimTarget() {
        if (!this.manualAiming.enabled) return null;
        
        return {
            x: this.manualAiming.aimX,
            y: this.manualAiming.aimY,
            accuracy: this.manualAiming.accuracy,
            bonus: this.getManualAimingBonus()
        };
    }
    
    // Render manual aiming crosshair and UI
    renderManualAiming(renderer) {
        if (!this.manualAiming.enabled) return;
        
        const ctx = renderer.ctx;
        ctx.save();
        
        // Crosshair
        const crosshairSize = this.manualAiming.crosshairSize;
        const accuracyAlpha = 0.3 + (this.manualAiming.accuracy * 0.7);
        
        // Crosshair color based on accuracy
        const color = this.manualAiming.accuracy > 0.8 ? '#00FF00' : 
                     this.manualAiming.accuracy > 0.5 ? '#FFAA00' : '#FF4444';
        
        ctx.globalAlpha = accuracyAlpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        
        // Draw crosshair
        ctx.beginPath();
        ctx.moveTo(this.manualAiming.aimX - crosshairSize, this.manualAiming.aimY);
        ctx.lineTo(this.manualAiming.aimX + crosshairSize, this.manualAiming.aimY);
        ctx.moveTo(this.manualAiming.aimX, this.manualAiming.aimY - crosshairSize);
        ctx.lineTo(this.manualAiming.aimX, this.manualAiming.aimY + crosshairSize);
        ctx.stroke();
        
        // Accuracy circle
        ctx.globalAlpha = 0.2 + (this.manualAiming.accuracy * 0.3);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.manualAiming.aimX, this.manualAiming.aimY, this.manualAiming.aimAssistRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Center dot for precise aiming
        if (this.manualAiming.accuracy > 0.9) {
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = '#00FFFF';
            ctx.beginPath();
            ctx.arc(this.manualAiming.aimX, this.manualAiming.aimY, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    // Get aiming statistics for UI display
    getAimingStats() {
        if (!this.manualAiming.enabled) return null;
        
        const totalShots = this.manualAiming.totalShots;
        const accuracy = totalShots > 0 ? (this.manualAiming.accurateShots / totalShots) * 100 : 0;
        const perfectRate = totalShots > 0 ? (this.manualAiming.perfectShots / totalShots) * 100 : 0;
        
        return {
            enabled: true,
            currentAccuracy: (this.manualAiming.accuracy * 100).toFixed(1) + '%',
            damageBonus: this.manualAiming.accuracyBonus.toFixed(1) + 'x',
            overallAccuracy: accuracy.toFixed(1) + '%',
            perfectShotRate: perfectRate.toFixed(1) + '%',
            totalShots: totalShots,
            accurateShots: this.manualAiming.accurateShots,
            perfectShots: this.manualAiming.perfectShots
        };
    }
    
    updateWeaponStats() {
        // Update all weapons with current effective stats
        for (const weapon of this.weapons.values()) {
            if (weapon.updateStats) {
                weapon.updateStats();
            }
        }
    }
}