export class BaseWeapon {
    constructor(game, player, config = {}) {
        this.game = game;
        this.player = player;
        
        // Weapon identification
        this.id = config.id || `weapon_${Math.random().toString(36).substr(2, 9)}`;
        this.name = config.name || 'Base Weapon';
        this.description = config.description || 'A basic weapon';
        this.type = config.type || 'projectile'; // projectile, melee, aura, etc.
        
        // Base stats (level 1)
        this.baseStats = {
            damage: config.damage || 7,
            cooldown: config.cooldown || 1.0, // seconds
            range: config.range || 200,
            speed: config.speed || 200,
            duration: config.duration || 3.0,
            area: config.area || 1.0,
            projectiles: config.projectiles || 1,
            piercing: config.piercing || 0
        };
        
        // Current level and stats
        this.level = 1;
        this.maxLevel = config.maxLevel || 8;
        this.currentStats = { ...this.baseStats };
        
        // Cooldown tracking
        this.cooldownTimer = 0;
        this.ready = true;
        
        // Auto-targeting
        this.autoTarget = config.autoTarget !== false; // Default true
        this.targetingRange = config.targetingRange || 300;
        this.lastTarget = null;
        
        // Evolution
        this.canEvolve = config.canEvolve || false;
        this.evolutionRequirements = config.evolutionRequirements || {};
        this.evolutionResult = config.evolutionResult || null;
        
        // Visual properties
        this.color = config.color || '#FFD700';
        this.size = config.size || 8;
        
        // Performance
        this.enabled = true;
        this.lastFireTime = 0;
        
        this.updateStats();
    }
    
    update(dt) {
        if (!this.enabled) return;
        
        // Update cooldown
        if (this.cooldownTimer > 0) {
            this.cooldownTimer -= dt;
            if (this.cooldownTimer <= 0) {
                this.ready = true;
            }
        }
        
        // Auto-fire if ready
        if (this.ready && this.shouldFire()) {
            this.fire();
        }
    }
    
    shouldFire() {
        // Default behavior: fire when enemies are in range
        if (!this.autoTarget) return false;
        
        const enemies = this.game.systems.enemy.getEnemiesInRange(
            this.player.x, 
            this.player.y, 
            this.targetingRange
        );
        
        return enemies.length > 0;
    }
    
    fire() {
        if (!this.ready) return false;
        
        // Start cooldown
        this.cooldownTimer = this.getEffectiveCooldown();
        this.ready = false;
        this.lastFireTime = performance.now();
        
        // Enhanced visual and audio feedback
        this.createFireEffects();
        
        // Execute weapon-specific firing logic
        this.onFire();
        
        return true;
    }
    
    createFireEffects() {
        // Enhanced screen shake based on weapon type and level
        this.game.camera.shakeWeaponFire(this.type, this.level);
        
        // Enhanced audio feedback with layering
        this.playEnhancedFireSound();
        
        // Enhanced visual muzzle flash
        this.createEnhancedMuzzleFlash();
        
        // Additional weapon-specific effects
        this.createWeaponSpecificEffects();
    }
    
    playEnhancedFireSound() {
        if (this.game.audioManager && this.game.audioManager.playEnhancedWeaponFire) {
            const isRapidFire = this.getEffectiveCooldown() < 0.3;
            this.game.audioManager.playEnhancedWeaponFire(this.type, this.level, isRapidFire);
        }
    }
    
    playFireSound() {
        // Fallback method for compatibility
        if (this.game.audioManager && this.game.audioManager.playVampireSound) {
            const soundName = this.getSoundName();
            const volume = this.getSoundVolume();
            const pitch = this.getSoundPitch();
            
            this.game.audioManager.playVampireSound(soundName, volume, pitch);
        }
    }
    
    getSoundName() {
        // Override in subclasses for specific weapon sounds
        switch (this.type) {
            case 'projectile': return 'magicMissile';
            case 'melee': return 'whipCrack';
            case 'throwing': return 'knifeThrowing';
            default: return 'magicMissile';
        }
    }
    
    getSoundVolume() {
        // Vary volume based on weapon level and damage
        const baseVolume = 0.6;
        const levelBonus = (this.level - 1) * 0.05;
        const damageBonus = Math.min(0.3, this.currentStats.damage * 0.01);
        return Math.min(1.0, baseVolume + levelBonus + damageBonus);
    }
    
    getSoundPitch() {
        // Vary pitch based on weapon speed and level
        const basePitch = 1.0;
        const speedVariation = (this.currentStats.speed - 200) * 0.001;
        const levelVariation = (this.level - 1) * 0.02;
        return Math.max(0.5, Math.min(2.0, basePitch + speedVariation + levelVariation));
    }
    
    createEnhancedMuzzleFlash() {
        if (this.game.systems.particle && this.game.systems.particle.createEnhancedMuzzleFlash) {
            const flashIntensity = this.getMuzzleFlashIntensity();
            const options = {
                color: this.getMuzzleFlashColor(),
                angle: this.getFireAngle()
            };
            
            this.game.systems.particle.createEnhancedMuzzleFlash(
                this.player.x,
                this.player.y,
                this.type,
                this.level,
                options
            );
        } else {
            // Fallback to original method
            this.createMuzzleFlash();
        }
    }
    
    createMuzzleFlash() {
        // Original method for compatibility
        const flashColor = this.getMuzzleFlashColor();
        const flashIntensity = this.getMuzzleFlashIntensity();
        
        if (this.game.systems.particle) {
            this.game.systems.particle.createBurst(
                this.player.x, 
                this.player.y, 
                'weaponFire', 
                { 
                    color: flashColor, 
                    count: Math.floor(flashIntensity * 8),
                    intensity: flashIntensity
                }
            );
        }
    }
    
    createWeaponSpecificEffects() {
        // Override in subclasses for weapon-specific visual effects
        switch (this.type) {
            case 'magicMissile':
                this.createMagicChargeEffect();
                break;
            case 'whip':
                this.createWhipTrailEffect();
                break;
            case 'throwingKnife':
                this.createKnifeGlintEffect();
                break;
        }
    }
    
    createMagicChargeEffect() {
        if (this.game.systems.particle) {
            // Magical energy gathering
            for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2;
                const radius = 25;
                const startX = this.player.x + Math.cos(angle) * radius;
                const startY = this.player.y + Math.sin(angle) * radius;
                
                this.game.systems.particle.create(startX, startY, {
                    vx: -Math.cos(angle) * 60,
                    vy: -Math.sin(angle) * 60,
                    life: 0.3,
                    size: 3,
                    color: this.color,
                    glow: true,
                    fadeOut: true
                });
            }
        }
    }
    
    createWhipTrailEffect() {
        if (this.game.systems.particle) {
            // Dust trail from whip movement
            for (let i = 0; i < 5; i++) {
                this.game.systems.particle.create(
                    this.player.x + (Math.random() - 0.5) * 30,
                    this.player.y + (Math.random() - 0.5) * 30,
                    {
                        vx: (Math.random() - 0.5) * 60,
                        vy: (Math.random() - 0.5) * 60,
                        life: 0.8,
                        size: 4,
                        color: '#D2B48C',
                        fadeOut: true,
                        ay: 40
                    }
                );
            }
        }
    }
    
    createKnifeGlintEffect() {
        if (this.game.systems.particle) {
            // Metallic shine effect
            this.game.systems.particle.create(this.player.x, this.player.y, {
                vx: 0,
                vy: 0,
                life: 0.2,
                size: 8,
                color: '#FFFFFF',
                glow: true,
                fadeOut: true
            });
        }
    }
    
    getFireAngle() {
        // Get the angle at which the weapon fires
        const target = this.findTarget();
        if (target) {
            return this.getAngleToTarget(target);
        }
        return 0; // Default to right
    }
    
    getMuzzleFlashColor() {
        // Override in subclasses for weapon-specific colors
        return this.color || '#FFD700';
    }
    
    getMuzzleFlashIntensity() {
        // Scale flash intensity with weapon power and level
        const basePower = 0.5;
        const damageFactor = Math.min(2.0, this.currentStats.damage * 0.02);
        const levelFactor = Math.min(1.5, 1.0 + (this.level - 1) * 0.1);
        return basePower * damageFactor * levelFactor;
    }
    
    onFire() {
        // Override in subclasses
    }
    
    findTarget() {
        // Check for manual aiming target first
        const manualTarget = this.player.getManualAimTarget();
        if (manualTarget && this.supportsManualAiming()) {
            return this.findManualAimTarget(manualTarget);
        }
        
        // Find nearest enemy in range
        const enemies = this.game.systems.enemy.getEnemiesInRange(
            this.player.x,
            this.player.y,
            this.targetingRange
        );
        
        if (enemies.length === 0) return null;
        
        // Sort by distance
        enemies.sort((a, b) => {
            const distA = this.getDistanceToPlayer(a);
            const distB = this.getDistanceToPlayer(b);
            return distA - distB;
        });
        
        return enemies[0];
    }
    
    supportsManualAiming() {
        // Override in subclasses to disable manual aiming for specific weapon types
        return this.type === 'projectile' || this.type === 'throwing';
    }
    
    findManualAimTarget(manualAimData) {
        // Find enemy closest to manual aim position
        const enemies = this.game.systems.enemy.getActiveEnemies();
        if (enemies.length === 0) return null;
        
        let closestEnemy = null;
        let closestDistance = Infinity;
        
        for (const enemy of enemies) {
            const dx = enemy.x - manualAimData.x;
            const dy = enemy.y - manualAimData.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestEnemy = enemy;
            }
        }
        
        // Return the target with manual aim data attached
        if (closestEnemy) {
            closestEnemy.manualAimData = manualAimData;
        }
        
        return closestEnemy;
    }
    
    findMultipleTargets(count) {
        const enemies = this.game.systems.enemy.getEnemiesInRange(
            this.player.x,
            this.player.y,
            this.targetingRange
        );
        
        if (enemies.length === 0) return [];
        
        // Sort by distance and return up to count
        enemies.sort((a, b) => {
            const distA = this.getDistanceToPlayer(a);
            const distB = this.getDistanceToPlayer(b);
            return distA - distB;
        });
        
        return enemies.slice(0, count);
    }
    
    // OPTIMIZED: Return squared distance to avoid expensive Math.sqrt()
    getDistanceToPlayer(enemy) {
        const dx = enemy.x - this.player.x;
        const dy = enemy.y - this.player.y;
        return dx * dx + dy * dy; // Squared distance for performance
    }
    
    upgrade() {
        if (this.level >= this.maxLevel) return false;
        
        this.level++;
        this.updateStats();
        
        // Weapon-specific upgrade effects
        this.onUpgrade();
        
        return true;
    }
    
    onUpgrade() {
        // Override in subclasses for special upgrade effects
    }
    
    updateStats() {
        // Apply level scaling to base stats
        const levelMultiplier = this.level;
        
        // Apply player stat bonuses
        const playerStats = this.player.stats;
        
        this.currentStats = {
            damage: this.baseStats.damage * levelMultiplier * playerStats.damage,
            cooldown: this.baseStats.cooldown / playerStats.cooldown,
            range: this.baseStats.range,
            speed: this.baseStats.speed,
            duration: this.baseStats.duration * playerStats.duration,
            area: this.baseStats.area * playerStats.area,
            projectiles: this.baseStats.projectiles + playerStats.projectiles,
            piercing: this.baseStats.piercing
        };
    }
    
    getEffectiveCooldown() {
        return this.currentStats.cooldown;
    }
    
    getEffectiveDamage() {
        let damage = this.currentStats.damage;
        
        // Apply manual aiming bonus if active
        const aimingBonus = this.player.getManualAimingBonus();
        if (aimingBonus > 1.0) {
            damage *= aimingBonus;
        }
        
        return damage;
    }
    
    calculateDamageWithPsychology() {
        let baseDamage = this.getEffectiveDamage();
        
        // Check for critical hit using reward psychology system
        let isCritical = false;
        if (this.game.systems.rewards) {
            isCritical = this.game.systems.rewards.rollForCritical();
        } else {
            // Fallback to basic critical calculation
            isCritical = Math.random() < 0.15;
        }
        
        let finalDamage = baseDamage;
        
        if (isCritical) {
            finalDamage *= 2.0; // Critical hits do double damage
        }
        
        // Apply experience multiplier from reward system
        if (this.game.systems.rewards) {
            const expMultiplier = this.game.systems.rewards.calculateExperienceMultiplier();
            finalDamage *= Math.min(expMultiplier, 2.0); // Cap damage bonus from exp multiplier
        }
        
        return {
            damage: finalDamage,
            isCritical: isCritical,
            baseDamage: baseDamage
        };
    }
    
    canEvolveCheck() {
        if (!this.canEvolve || this.level < this.maxLevel) return false;
        
        // Check evolution requirements
        for (const [requirement, value] of Object.entries(this.evolutionRequirements)) {
            switch (requirement) {
                case 'level':
                    if (this.player.level < value) return false;
                    break;
                case 'hasWeapon':
                    if (!this.player.weapons.has(value)) return false;
                    break;
                case 'stat':
                    const [statName, minValue] = value;
                    if (this.player.stats[statName] < minValue) return false;
                    break;
            }
        }
        
        return true;
    }
    
    evolve() {
        if (!this.canEvolveCheck()) return false;
        
        // Create evolved weapon
        const EvolvedWeaponClass = this.evolutionResult;
        if (!EvolvedWeaponClass) return false;
        
        // Remove this weapon and add evolved version
        this.player.weapons.delete(this.id);
        const evolvedWeapon = new EvolvedWeaponClass(this.game, this.player);
        this.player.weapons.set(evolvedWeapon.id, evolvedWeapon);
        
        // Visual effect
        this.game.systems.particle.createEvolutionEffect(this.player.x, this.player.y);
        this.game.camera.flash('#FFD700', 1.0);
        
        return true;
    }
    
    render(renderer) {
        // Most weapons don't need to render anything
        // Override in subclasses for weapons that have visual components
    }
    
    // Utility methods
    getAngleToTarget(target) {
        // If target has manual aim data, use precise angle to aim point
        if (target && target.manualAimData) {
            return this.getAngleToPoint(target.manualAimData.x, target.manualAimData.y);
        }
        
        const dx = target.x - this.player.x;
        const dy = target.y - this.player.y;
        return Math.atan2(dy, dx);
    }
    
    getAngleToPoint(x, y) {
        const dx = x - this.player.x;
        const dy = y - this.player.y;
        return Math.atan2(dy, dx);
    }
    
    createProjectile(x, y, angle, config = {}) {
        // Apply area multiplier to projectile size for consistent AoE scaling
        const baseSize = config.size || this.size;
        const effectiveSize = baseSize * this.player.stats.area;
        
        return this.game.systems.projectile.createProjectile(x, y, {
            direction: angle,
            damage: this.getEffectiveDamage(),
            speed: this.currentStats.speed,
            size: effectiveSize,
            color: this.color,
            piercing: this.currentStats.piercing,
            lifetime: this.currentStats.duration,
            source: 'player',
            weaponId: this.id,
            sourceWeapon: this, // Reference to this weapon for psychology calculations
            // Apply area multiplier to damage radius for AoE weapons
            damageRadius: config.damageRadius ? config.damageRadius * this.player.stats.area : undefined,
            explosionRadius: config.explosionRadius ? config.explosionRadius * this.player.stats.area : undefined,
            ...config
        });
    }
    
    // Serialization for save/load
    serialize() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            level: this.level,
            enabled: this.enabled
        };
    }
    
    static deserialize(game, player, data) {
        // This should be implemented by each weapon class
        throw new Error('deserialize method must be implemented by weapon subclasses');
    }
    
    // Enhanced hit feedback methods
    onHitEnemy(enemy, damage, critical = false, combo = 1) {
        // Check for manual aiming bonus effects
        const wasManualAim = enemy.manualAimData && this.player.manualAiming && this.player.manualAiming.enabled;
        const accuracyBonus = wasManualAim ? enemy.manualAimData.bonus : 1.0;
        
        // Enhanced hit effects with weapon-specific styling
        this.createEnhancedHitEffects(enemy, damage, critical, wasManualAim, accuracyBonus, combo);
        
        // Enhanced layered audio feedback
        this.playLayeredHitSound(damage, critical, wasManualAim, combo);
        
        // Enhanced damage numbers with better visibility
        this.createEnhancedDamageNumber(enemy, damage, critical, wasManualAim, accuracyBonus);
        
        // Screen effects for significant hits
        if (critical || damage > 50 || wasManualAim) {
            this.createCriticalHitEffects(enemy, damage, critical, wasManualAim);
        }
        
        // Manual aiming skill rewards
        if (wasManualAim && accuracyBonus > 1.5) {
            this.rewardSkillfulAiming(enemy, accuracyBonus);
        }
    }
    
    createEnhancedHitEffects(enemy, damage, critical, wasManualAim = false, accuracyBonus = 1.0, combo = 1) {
        if (!this.game.systems.particle) return;
        
        // Use the new enhanced hit effect system
        if (this.game.systems.particle.createEnhancedHitEffect) {
            const options = {
                color: this.getHitEffectColor(critical, wasManualAim),
                bloodColor: this.getBloodColor(enemy),
                criticalColor: '#FFD700',
                combo: combo
            };
            
            this.game.systems.particle.createEnhancedHitEffect(
                enemy.x, enemy.y, damage, this.type, critical, options
            );
        } else {
            // Fallback to original method
            this.createHitEffects(enemy, damage, critical, wasManualAim, accuracyBonus);
        }
        
        // Special manual aiming precision effects
        if (wasManualAim && accuracyBonus > 2.0 && this.game.systems.particle.createSkillShotEffect) {
            this.game.systems.particle.createSkillShotEffect(
                enemy.x, enemy.y, accuracyBonus
            );
        }
    }
    
    createHitEffects(enemy, damage, critical, wasManualAim = false, accuracyBonus = 1.0) {
        // Original method for compatibility
        if (!this.game.systems.particle) return;
        
        const effectType = critical ? 'critical' : wasManualAim ? 'skillshot' : 'hit';
        const intensity = this.calculateHitIntensity(damage, critical, accuracyBonus);
        
        // Main hit effect
        if (this.game.systems.particle.createEnhancedBurst) {
            this.game.systems.particle.createEnhancedBurst(
                enemy.x, enemy.y, effectType, 
                { 
                    color: this.getHitEffectColor(critical, wasManualAim),
                    intensity: intensity,
                    count: Math.floor(intensity * (wasManualAim ? 15 : 12))
                }
            );
        }
        
        // Special manual aiming precision effects
        if (wasManualAim && accuracyBonus > 2.0 && this.game.systems.particle.createPrecisionRing) {
            this.game.systems.particle.createPrecisionRing(
                enemy.x, enemy.y, 
                '#00FFFF', 
                accuracyBonus
            );
        }
        
        // Blood splatter for vampire theme
        if (damage > 20) {
            this.game.systems.particle.createBloodSplatter(
                enemy.x, enemy.y, 
                Math.min(15, damage * 0.3), 
                this.getBloodColor(enemy)
            );
        }
    }
    
    playLayeredHitSound(damage, critical, wasManualAim = false, combo = 1) {
        if (!this.game.audioManager) return;
        
        // Use enhanced layered audio system
        if (this.game.audioManager.playLayeredHitSound) {
            this.game.audioManager.playLayeredHitSound(damage, this.type, critical, combo);
        } else {
            // Fallback to original method
            this.playHitSound(damage, critical, wasManualAim);
        }
    }
    
    playHitSound(damage, critical, wasManualAim = false) {
        // Original method for compatibility
        if (!this.game.audioManager || !this.game.audioManager.playVampireSound) return;
        
        let soundName = 'vampireBite';
        if (critical) soundName = 'criticalHit';
        else if (wasManualAim) soundName = 'skillShot';
        
        const volume = Math.min(1.0, 0.4 + damage * 0.01);
        const pitch = critical ? 0.8 : 
                      wasManualAim ? 1.2 : 
                      1.0 + (Math.random() - 0.5) * 0.2;
        
        this.game.audioManager.playVampireSound(soundName, volume, pitch);
    }
    
    createEnhancedDamageNumber(enemy, damage, critical, wasManualAim = false, accuracyBonus = 1.0) {
        if (!this.game.systems.particle) return;
        
        let color = this.getDamageNumberColor(damage);
        let size = this.getDamageNumberSize(damage);
        
        // Enhanced special cases with better scaling
        if (critical) {
            color = '#FF0000';  // Always red for crits
            size = Math.max(size * 1.4, 24); // At least 40% bigger for crits
        } else if (wasManualAim && accuracyBonus > 2.0) {
            color = '#00FFFF';  // Cyan for precision shots
            size = Math.max(size * 1.2, 20);
        } else if (wasManualAim) {
            color = '#FFAA00';  // Gold for manual aim
            size = Math.max(size * 1.1, 19);
        }
        
        const intensity = this.calculateHitIntensity(damage, critical, accuracyBonus);
        
        this.game.systems.particle.createEnhancedDamageNumber(
            enemy.x, enemy.y, damage, critical, color, size, intensity
        );
    }
    
    createCriticalHitEffects(enemy, damage, critical, wasManualAim = false) {
        // Enhanced camera effects
        if (critical) {
            this.game.camera.onCriticalHit(damage);
        } else {
            this.game.camera.shakeHit(damage, false);
        }
        
        // Screen flash for different hit types
        if (critical) {
            this.game.camera.flash('#FFD700', 0.15); // Gold for critical
        } else if (wasManualAim) {
            this.game.camera.flash('#00FFFF', 0.12); // Cyan for skill shot
        }
        
        // Ring explosion for high damage
        if (damage > 75) {
            if (this.game.systems.particle.createExplosionEffect) {
                this.game.systems.particle.createExplosionEffect(
                    enemy.x, enemy.y, 
                    Math.min(60, damage * 0.5), 
                    this.getExplosionColor(critical, wasManualAim)
                );
            }
        }
    }
    
    calculateHitIntensity(damage, critical, accuracyBonus = 1.0) {
        const baseDamage = this.baseStats.damage;
        const damageRatio = damage / baseDamage;
        const criticalMultiplier = critical ? 2.0 : 1.0;
        const levelMultiplier = 1.0 + (this.level - 1) * 0.1;
        const aimingMultiplier = accuracyBonus > 1.0 ? 1.0 + (accuracyBonus - 1.0) * 0.5 : 1.0;
        
        return Math.min(4.0, damageRatio * criticalMultiplier * levelMultiplier * aimingMultiplier);
    }
    
    getHitEffectColor(critical, wasManualAim = false) {
        if (critical) return '#FFD700'; // Gold for critical
        if (wasManualAim) return '#00FFFF'; // Cyan for manual aim
        return this.color || '#FFFF00';
    }
    
    getBloodColor(enemy) {
        // Vary blood color based on enemy type - using purple theme
        switch (enemy.type) {
            case 'undead': return '#4A0080';
            case 'demon': return '#4B0082'; // Changed from red to indigo
            case 'beast': return '#8B4513'; // Saddle brown
            default: return '#4B0082'; // Changed from red to indigo
        }
    }
    
    getDamageNumberColor(damage) {
        // Enhanced color coding with more granular tiers
        if (damage >= 200) return '#FF00FF';    // Magenta for epic damage (200+)
        if (damage >= 150) return '#FF0066';    // Hot pink for massive damage (150-199)
        if (damage >= 100) return '#FF3300';    // Red-orange for very high damage (100-149)
        if (damage >= 75) return '#FF6600';     // Orange for high damage (75-99)
        if (damage >= 50) return '#FF9900';     // Light orange for medium-high damage (50-74)
        if (damage >= 30) return '#FFCC00';     // Gold for medium damage (30-49)
        if (damage >= 15) return '#FFFF00';     // Yellow for low-medium damage (15-29)
        if (damage >= 5) return '#CCFF00';      // Lime for low damage (5-14)
        return '#FFFFFF';                       // White for minimal damage (1-4)
    }

    
    getDamageNumberSize(damage) {
        // Enhanced size scaling based on damage amount
        if (damage >= 200) return 32;      // Epic damage gets huge numbers
        if (damage >= 150) return 28;      // Massive damage
        if (damage >= 100) return 26;      // Very high damage
        if (damage >= 75) return 24;       // High damage
        if (damage >= 50) return 22;       // Medium-high damage
        if (damage >= 30) return 20;       // Medium damage
        if (damage >= 15) return 18;       // Low-medium damage (base size)
        if (damage >= 5) return 16;        // Low damage
        return 14;                         // Minimal damage gets smaller text
    }
    
    getExplosionColor(critical, wasManualAim = false) {
        if (critical) return '#FF0000';
        if (wasManualAim) return '#00FFFF';
        return '#FF8800';
    }
    
    rewardSkillfulAiming(enemy, accuracyBonus) {
        // Reward player for skillful manual aiming
        const bonusExp = Math.floor(25 * accuracyBonus);
        this.player.gainExperience(bonusExp);
        
        // Show skill bonus feedback
        this.player.addDamageNumber(
            `SKILL x${accuracyBonus.toFixed(1)}!`, 
            '#00FFFF', 
            'PRECISION'
        );
        
        // Achievement tracking
        if (this.game.systems.achievement) {
            this.game.systems.achievement.updateStats('skillfulShots', 1);
        }
        
        // Flow state feedback
        if (this.game.systems.flowState) {
            this.game.systems.flowState.onSkillfulAction('precision_shot', accuracyBonus);
        }
    }
    
    // Enhanced weapon upgrade effects
    onUpgradeComplete() {
        // Enhanced visual celebration for weapon upgrade
        if (this.game.systems.particle) {
            this.game.systems.particle.createEvolutionEffect(this.player.x, this.player.y);
        }
        
        // Enhanced audio feedback
        if (this.game.audioManager) {
            if (this.game.audioManager.playEnhancedUISound) {
                this.game.audioManager.playEnhancedUISound('weaponUpgrade', 'important');
            } else if (this.game.audioManager.playWeaponUpgrade) {
                this.game.audioManager.playWeaponUpgrade();
            }
        }
        
        // Enhanced screen effects
        this.game.camera.flash('#00FFFF', 0.3);
        this.game.camera.shake(8, 0.4, 'normal');
        
        // Camera distortion for dramatic effect
        if (this.game.camera.activateDistortion) {
            this.game.camera.activateDistortion('zoom', 5, 0.4);
        }
    }
    
    canUpgrade() {
        return this.level < this.maxLevel;
    }
}