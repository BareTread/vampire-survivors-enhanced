export class StatusEffectSystem {
    constructor(game) {
        this.game = game;
        
        // Active status effects on all entities
        this.activeEffects = new Map(); // entityId -> array of effects
        
        // Status effect definitions
        this.effectDefinitions = {
            burn: {
                name: 'Burn',
                color: '#FF4500',
                icon: '🔥',
                stackable: true,
                maxStacks: 5,
                refreshable: true, // Can be refreshed by new applications
                tickRate: 1.0, // Damage every 1 second
                damageType: 'fire'
            },
            
            freeze: {
                name: 'Freeze',
                color: '#00BFFF',
                icon: '❄️',
                stackable: false,
                maxStacks: 1,
                refreshable: true,
                speedReduction: 0.7, // 70% speed reduction
                damageType: 'cold'
            },
            
            poison: {
                name: 'Poison',
                color: '#9ACD32',
                icon: '☠️',
                stackable: true,
                maxStacks: 10,
                refreshable: true,
                tickRate: 0.5, // Damage every 0.5 seconds
                damageReduction: 0.15, // 15% damage reduction while poisoned
                damageType: 'poison'
            },
            
            stun: {
                name: 'Stun',
                color: '#FFD700',
                icon: '⚡',
                stackable: false,
                maxStacks: 1,
                refreshable: false, // Cannot refresh stun
                immobilize: true,
                damageType: 'lightning'
            },
            
            bleed: {
                name: 'Bleed',
                color: '#8B0000',
                icon: '🩸',
                stackable: true,
                maxStacks: 8,
                refreshable: true,
                tickRate: 0.8,
                damageType: 'physical'
            },
            
            weakness: {
                name: 'Weakness',
                color: '#696969',
                icon: '🥀',
                stackable: false,
                maxStacks: 1,
                refreshable: true,
                damageReduction: 0.3, // 30% damage reduction
                speedReduction: 0.2, // 20% speed reduction
                damageType: 'curse'
            },
            
            regeneration: {
                name: 'Regeneration',
                color: '#00FF00',
                icon: '💚',
                stackable: true,
                maxStacks: 3,
                refreshable: true,
                tickRate: 1.0,
                healingEffect: true,
                damageType: 'healing'
            },
            
            rage: {
                name: 'Rage',
                color: '#FF0000',
                icon: '😡',
                stackable: false,
                maxStacks: 1,
                refreshable: true,
                damageBonus: 0.5, // 50% damage increase
                speedBonus: 0.3, // 30% speed increase
                damageType: 'buff'
            }
        };
        
        // Visual effect pools for performance
        this.effectParticles = [];
        this.maxParticles = 200;
        
        // Tick timing
        this.lastTickTime = 0;
        this.tickInterval = 100; // Check every 100ms
    }
    
    update(dt) {
        const currentTime = performance.now();
        
        // Process effect ticks
        if (currentTime - this.lastTickTime >= this.tickInterval) {
            this.processEffectTicks(this.tickInterval / 1000);
            this.lastTickTime = currentTime;
        }
        
        // Update effect durations
        this.updateEffectDurations(dt);
        
        // Update visual effects
        this.updateVisualEffects(dt);
        
        // Clean up expired effects
        this.cleanupExpiredEffects();
    }
    
    applyStatusEffect(target, effectType, config = {}) {
        if (!target || !target.id) return false;
        
        const definition = this.effectDefinitions[effectType];
        if (!definition) {
            console.warn(`Unknown status effect type: ${effectType}`);
            return false;
        }
        
        // Get or create effect array for this entity
        if (!this.activeEffects.has(target.id)) {
            this.activeEffects.set(target.id, []);
        }
        
        const effects = this.activeEffects.get(target.id);
        
        // Check for existing effect of this type
        const existingEffect = effects.find(effect => effect.type === effectType);
        
        if (existingEffect) {
            if (definition.stackable && existingEffect.stacks < definition.maxStacks) {
                // Stack the effect
                existingEffect.stacks++;
                existingEffect.intensity = Math.min(existingEffect.intensity * 1.2, 3.0);
                
                if (definition.refreshable) {
                    existingEffect.duration = config.duration || 3.0;
                }
            } else if (definition.refreshable) {
                // Refresh the duration
                existingEffect.duration = config.duration || 3.0;
            }
            
            this.createEffectApplicationVisual(target, effectType, true);
            return true;
        }
        
        // Create new effect
        const newEffect = {
            type: effectType,
            target: target,
            duration: config.duration || 3.0,
            stacks: 1,
            intensity: 1.0,
            damagePerSecond: config.damagePerSecond || 0,
            healPerSecond: config.healPerSecond || 0,
            source: config.source || null,
            lastTickTime: 0,
            definition: definition,
            
            // Effect-specific properties
            ...config.customProperties
        };
        
        effects.push(newEffect);
        
        // Apply immediate effects
        this.applyEffectStart(target, newEffect);
        
        // Create visual feedback
        this.createEffectApplicationVisual(target, effectType, false);
        
        return true;
    }
    
    removeStatusEffect(target, effectType) {
        if (!target || !target.id) return false;
        
        const effects = this.activeEffects.get(target.id);
        if (!effects) return false;
        
        const effectIndex = effects.findIndex(effect => effect.type === effectType);
        if (effectIndex === -1) return false;
        
        const effect = effects[effectIndex];
        
        // Apply removal effects
        this.applyEffectEnd(target, effect);
        
        // Remove from array
        effects.splice(effectIndex, 1);
        
        // Create removal visual
        this.createEffectRemovalVisual(target, effectType);
        
        return true;
    }
    
    hasStatusEffect(target, effectType) {
        if (!target || !target.id) return false;
        
        const effects = this.activeEffects.get(target.id);
        if (!effects) return false;
        
        return effects.some(effect => effect.type === effectType);
    }
    
    getStatusEffect(target, effectType) {
        if (!target || !target.id) return null;
        
        const effects = this.activeEffects.get(target.id);
        if (!effects) return null;
        
        return effects.find(effect => effect.type === effectType) || null;
    }
    
    getActiveEffects(target) {
        if (!target || !target.id) return [];
        
        return this.activeEffects.get(target.id) || [];
    }
    
    processEffectTicks(deltaTime) {
        for (const [entityId, effects] of this.activeEffects) {
            for (const effect of effects) {
                const timeSinceLastTick = performance.now() / 1000 - effect.lastTickTime;
                const definition = effect.definition;
                
                if (definition.tickRate && timeSinceLastTick >= definition.tickRate) {
                    this.processEffectTick(effect);
                    effect.lastTickTime = performance.now() / 1000;
                }
            }
        }
    }
    
    processEffectTick(effect) {
        const target = effect.target;
        if (!target || !target.active) return;
        
        const definition = effect.definition;
        const stacks = effect.stacks;
        
        switch (effect.type) {
            case 'burn':
                this.processBurnTick(target, effect, stacks);
                break;
                
            case 'poison':
                this.processPoisonTick(target, effect, stacks);
                break;
                
            case 'bleed':
                this.processBleedTick(target, effect, stacks);
                break;
                
            case 'regeneration':
                this.processRegenerationTick(target, effect, stacks);
                break;
        }
    }
    
    processBurnTick(target, effect, stacks) {
        const baseDamage = effect.damagePerSecond || 10;
        const finalDamage = baseDamage * stacks * effect.intensity;
        
        if (target.takeDamage) {
            target.takeDamage(finalDamage, effect.source, false);
        }
        
        // Create burn visual effect
        this.createBurnTickVisual(target, finalDamage);
        
        // Chance to spread to nearby enemies
        if (Math.random() < 0.1 * stacks) {
            this.spreadBurnEffect(target, effect);
        }
    }
    
    processPoisonTick(target, effect, stacks) {
        const baseDamage = effect.damagePerSecond || 8;
        const finalDamage = baseDamage * stacks * effect.intensity;
        
        if (target.takeDamage) {
            target.takeDamage(finalDamage, effect.source, false);
        }
        
        // Create poison visual effect
        this.createPoisonTickVisual(target, finalDamage);
    }
    
    processBleedTick(target, effect, stacks) {
        const baseDamage = effect.damagePerSecond || 12;
        const finalDamage = baseDamage * stacks * effect.intensity;
        
        if (target.takeDamage) {
            target.takeDamage(finalDamage, effect.source, false);
        }
        
        // Create bleed visual effect
        this.createBleedTickVisual(target, finalDamage);
    }
    
    processRegenerationTick(target, effect, stacks) {
        const baseHealing = effect.healPerSecond || 15;
        const finalHealing = baseHealing * stacks * effect.intensity;
        
        if (target.heal) {
            target.heal(finalHealing);
        }
        
        // Create healing visual effect
        this.createHealingTickVisual(target, finalHealing);
    }
    
    spreadBurnEffect(sourceTarget, sourceEffect) {
        // Find nearby enemies to spread burn to
        const nearbyEnemies = this.game.systems.enemy.getNearbyEnemies(
            sourceTarget.x, sourceTarget.y, 60
        );
        
        for (const enemy of nearbyEnemies) {
            if (enemy === sourceTarget) continue;
            if (this.hasStatusEffect(enemy, 'burn')) continue;
            
            // Spread with reduced intensity
            this.applyStatusEffect(enemy, 'burn', {
                duration: sourceEffect.duration * 0.6,
                damagePerSecond: sourceEffect.damagePerSecond * 0.8,
                source: sourceEffect.source
            });
            
            // Visual spread effect
            this.createSpreadEffect(sourceTarget, enemy, 'burn');
        }
    }
    
    updateEffectDurations(dt) {
        for (const [entityId, effects] of this.activeEffects) {
            for (let i = effects.length - 1; i >= 0; i--) {
                const effect = effects[i];
                effect.duration -= dt;
                
                if (effect.duration <= 0) {
                    this.applyEffectEnd(effect.target, effect);
                    effects.splice(i, 1);
                    
                    // Create expiration visual
                    this.createEffectRemovalVisual(effect.target, effect.type);
                }
            }
        }
    }
    
    applyEffectStart(target, effect) {
        const definition = effect.definition;
        
        // Apply stat modifications
        if (definition.speedReduction && target.speed !== undefined) {
            target._originalSpeed = target._originalSpeed || target.speed;
            target.speed = target._originalSpeed * (1 - definition.speedReduction);
        }
        
        if (definition.speedBonus && target.speed !== undefined) {
            target._originalSpeed = target._originalSpeed || target.speed;
            target.speed = target._originalSpeed * (1 + definition.speedBonus);
        }
        
        if (definition.damageBonus && target.damage !== undefined) {
            target._originalDamage = target._originalDamage || target.damage;
            target.damage = target._originalDamage * (1 + definition.damageBonus);
        }
        
        if (definition.immobilize) {
            target._originalVelocity = { ...target.velocity };
            target.velocity = { x: 0, y: 0 };
            target._stunned = true;
        }
    }
    
    applyEffectEnd(target, effect) {
        const definition = effect.definition;
        
        // Restore original stats
        if (definition.speedReduction || definition.speedBonus) {
            if (target._originalSpeed !== undefined) {
                target.speed = target._originalSpeed;
                delete target._originalSpeed;
            }
        }
        
        if (definition.damageBonus) {
            if (target._originalDamage !== undefined) {
                target.damage = target._originalDamage;
                delete target._originalDamage;
            }
        }
        
        if (definition.immobilize) {
            if (target._originalVelocity) {
                target.velocity = target._originalVelocity;
                delete target._originalVelocity;
            }
            target._stunned = false;
        }
        
        // Special end effects
        if (effect.type === 'freeze') {
            this.createShatterEffect(target, effect);
        }
    }
    
    // Visual effect methods
    createEffectApplicationVisual(target, effectType, isStack) {
        if (!this.game.systems.particle) return;
        
        const definition = this.effectDefinitions[effectType];
        const particleType = isStack ? 'statusStack' : 'statusApply';
        
        this.game.systems.particle.createBurst(target.x, target.y, particleType, {
            color: definition.color,
            count: isStack ? 6 : 10,
            intensity: isStack ? 1.2 : 1.5,
            spread: 25
        });
    }
    
    createEffectRemovalVisual(target, effectType) {
        if (!this.game.systems.particle) return;
        
        const definition = this.effectDefinitions[effectType];
        
        this.game.systems.particle.createBurst(target.x, target.y, 'statusRemove', {
            color: definition.color,
            count: 8,
            intensity: 1.0,
            spread: 30,
            outward: true
        });
    }
    
    createBurnTickVisual(target, damage) {
        if (!this.game.systems.particle) return;
        
        // Fire particles rising from target
        for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * target.size;
            
            this.game.systems.particle.create(
                target.x + Math.cos(angle) * distance,
                target.y + Math.sin(angle) * distance,
                {
                    vx: (Math.random() - 0.5) * 20,
                    vy: -30 - Math.random() * 20,
                    life: 0.8,
                    size: 4,
                    color: '#FF4500',
                    glow: true,
                    fadeOut: true
                }
            );
        }
        
        // Damage number
        if (target.addDamageNumber) {
            target.addDamageNumber(Math.floor(damage), '#FF4500');
        }
    }
    
    createPoisonTickVisual(target, damage) {
        if (!this.game.systems.particle) return;
        
        // Poison bubbles
        for (let i = 0; i < 2; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * target.size;
            
            this.game.systems.particle.create(
                target.x + Math.cos(angle) * distance,
                target.y + Math.sin(angle) * distance,
                {
                    vx: (Math.random() - 0.5) * 15,
                    vy: -20 - Math.random() * 15,
                    life: 1.0,
                    size: 3,
                    color: '#9ACD32',
                    glow: true,
                    fadeOut: true,
                    pulse: true
                }
            );
        }
        
        // Damage number
        if (target.addDamageNumber) {
            target.addDamageNumber(Math.floor(damage), '#9ACD32');
        }
    }
    
    createBleedTickVisual(target, damage) {
        if (!this.game.systems.particle) return;
        
        // Blood droplets
        for (let i = 0; i < 4; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * target.size * 0.8;
            
            this.game.systems.particle.create(
                target.x + Math.cos(angle) * distance,
                target.y + Math.sin(angle) * distance,
                {
                    vx: (Math.random() - 0.5) * 30,
                    vy: Math.random() * 20,
                    life: 0.6,
                    size: 2,
                    color: '#8B0000',
                    fadeOut: true,
                    gravity: 100
                }
            );
        }
        
        // Damage number
        if (target.addDamageNumber) {
            target.addDamageNumber(Math.floor(damage), '#8B0000');
        }
    }
    
    createHealingTickVisual(target, healing) {
        if (!this.game.systems.particle) return;
        
        // Healing sparkles
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * target.size;
            
            this.game.systems.particle.create(
                target.x + Math.cos(angle) * distance,
                target.y + Math.sin(angle) * distance,
                {
                    vx: (Math.random() - 0.5) * 10,
                    vy: -40 - Math.random() * 20,
                    life: 1.2,
                    size: 3,
                    color: '#00FF00',
                    glow: true,
                    fadeOut: true
                }
            );
        }
        
        // Healing number
        if (target.addDamageNumber) {
            target.addDamageNumber('+' + Math.floor(healing), '#00FF00');
        }
    }
    
    createShatterEffect(target, effect) {
        if (!this.game.systems.particle) return;
        
        // Ice shatter explosion
        this.game.systems.particle.createBurst(target.x, target.y, 'iceShatter', {
            color: '#00BFFF',
            count: 15,
            intensity: 2.0,
            spread: 40
        });
        
        // Bonus damage on shatter
        if (target.takeDamage) {
            const shatterDamage = target.maxHealth * 0.1; // 10% of max health
            target.takeDamage(shatterDamage, effect.source, true);
        }
    }
    
    createSpreadEffect(source, target, effectType) {
        if (!this.game.systems.particle) return;
        
        const definition = this.effectDefinitions[effectType];
        
        // Line of particles from source to target
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.floor(distance / 10);
        
        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const x = source.x + dx * t;
            const y = source.y + dy * t;
            
            setTimeout(() => {
                this.game.systems.particle.create(x, y, {
                    vx: (Math.random() - 0.5) * 20,
                    vy: (Math.random() - 0.5) * 20,
                    life: 0.5,
                    size: 3,
                    color: definition.color,
                    glow: true,
                    fadeOut: true
                });
            }, i * 30);
        }
    }
    
    updateVisualEffects(dt) {
        // Update continuous visual effects for active status effects
        for (const [entityId, effects] of this.activeEffects) {
            for (const effect of effects) {
                if (effect.target && effect.target.active) {
                    this.updateEffectAura(effect.target, effect, dt);
                }
            }
        }
    }
    
    updateEffectAura(target, effect, dt) {
        // Create continuous aura effects based on effect type
        if (Math.random() < 0.1) { // 10% chance per frame
            switch (effect.type) {
                case 'burn':
                    this.createBurnAura(target);
                    break;
                case 'freeze':
                    this.createFreezeAura(target);
                    break;
                case 'poison':
                    this.createPoisonAura(target);
                    break;
                case 'regeneration':
                    this.createRegenerationAura(target);
                    break;
            }
        }
    }
    
    createBurnAura(target) {
        if (!this.game.systems.particle || Math.random() > 0.3) return;
        
        const angle = Math.random() * Math.PI * 2;
        const distance = target.size + Math.random() * 5;
        
        this.game.systems.particle.create(
            target.x + Math.cos(angle) * distance,
            target.y + Math.sin(angle) * distance,
            {
                vx: (Math.random() - 0.5) * 10,
                vy: -15 - Math.random() * 10,
                life: 0.6,
                size: 2,
                color: '#FF4500',
                glow: true,
                fadeOut: true
            }
        );
    }
    
    createFreezeAura(target) {
        if (!this.game.systems.particle || Math.random() > 0.2) return;
        
        const angle = Math.random() * Math.PI * 2;
        const distance = target.size + Math.random() * 8;
        
        this.game.systems.particle.create(
            target.x + Math.cos(angle) * distance,
            target.y + Math.sin(angle) * distance,
            {
                vx: 0,
                vy: -5,
                life: 1.0,
                size: 3,
                color: '#00BFFF',
                glow: true,
                fadeOut: true
            }
        );
    }
    
    createPoisonAura(target) {
        if (!this.game.systems.particle || Math.random() > 0.25) return;
        
        const angle = Math.random() * Math.PI * 2;
        const distance = target.size + Math.random() * 6;
        
        this.game.systems.particle.create(
            target.x + Math.cos(angle) * distance,
            target.y + Math.sin(angle) * distance,
            {
                vx: (Math.random() - 0.5) * 5,
                vy: -10 - Math.random() * 5,
                life: 0.8,
                size: 2,
                color: '#9ACD32',
                glow: true,
                fadeOut: true,
                pulse: true
            }
        );
    }
    
    createRegenerationAura(target) {
        if (!this.game.systems.particle || Math.random() > 0.3) return;
        
        const angle = Math.random() * Math.PI * 2;
        const distance = target.size + Math.random() * 10;
        
        this.game.systems.particle.create(
            target.x + Math.cos(angle) * distance,
            target.y + Math.sin(angle) * distance,
            {
                vx: 0,
                vy: -20,
                life: 1.0,
                size: 4,
                color: '#00FF00',
                glow: true,
                fadeOut: true
            }
        );
    }
    
    cleanupExpiredEffects() {
        // Remove empty effect arrays
        for (const [entityId, effects] of this.activeEffects) {
            if (effects.length === 0) {
                this.activeEffects.delete(entityId);
            }
        }
    }
    
    // Utility methods for weapons and abilities
    applyBurnEffect(target, duration = 3.0, damagePerSecond = 10, source = null) {
        return this.applyStatusEffect(target, 'burn', {
            duration,
            damagePerSecond,
            source
        });
    }
    
    applyFreezeEffect(target, duration = 2.0, source = null) {
        return this.applyStatusEffect(target, 'freeze', {
            duration,
            source
        });
    }
    
    applyPoisonEffect(target, duration = 4.0, damagePerSecond = 8, source = null) {
        return this.applyStatusEffect(target, 'poison', {
            duration,
            damagePerSecond,
            source
        });
    }
    
    applyStunEffect(target, duration = 1.5, source = null) {
        return this.applyStatusEffect(target, 'stun', {
            duration,
            source
        });
    }
    
    // Debug and utility methods
    getDebugInfo() {
        let totalEffects = 0;
        const effectCounts = {};
        
        for (const [entityId, effects] of this.activeEffects) {
            totalEffects += effects.length;
            
            for (const effect of effects) {
                effectCounts[effect.type] = (effectCounts[effect.type] || 0) + 1;
            }
        }
        
        return {
            totalActiveEffects: totalEffects,
            affectedEntities: this.activeEffects.size,
            effectBreakdown: effectCounts,
            effectTypes: Object.keys(this.effectDefinitions)
        };
    }
    
    clearAllEffects(target = null) {
        if (target && target.id) {
            // Clear effects for specific target
            const effects = this.activeEffects.get(target.id);
            if (effects) {
                for (const effect of effects) {
                    this.applyEffectEnd(target, effect);
                }
                this.activeEffects.delete(target.id);
            }
        } else {
            // Clear all effects
            for (const [entityId, effects] of this.activeEffects) {
                for (const effect of effects) {
                    this.applyEffectEnd(effect.target, effect);
                }
            }
            this.activeEffects.clear();
        }
    }
}