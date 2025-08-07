import { BaseWeapon } from './BaseWeapon.js';

export class ThrowingKnife extends BaseWeapon {
    constructor(game, player, config = {}) {
        const weaponConfig = {
            id: 'throwing_knife',
            name: 'Throwing Knife',
            description: 'Fast projectiles that pierce through enemies',
            type: 'projectile',
            damage: 13,
            cooldown: 0.6,
            range: 200,
            speed: 300,
            duration: 2.5,
            projectiles: 1,
            piercing: 2,
            color: '#C0C0C0',
            size: 5,
            autoTarget: true,
            targetingRange: 200,
            canEvolve: true,
            maxLevel: 8,
            ...config
        };
        
        super(game, player, weaponConfig);
        
        // Throwing Knife specific properties
        this.spinSpeed = 8; // Rotation speed of knife
        this.criticalChance = 0.1; // 10% crit chance
        this.criticalMultiplier = 2.0;
        this.ricochetChance = 0; // Unlocked at higher levels
        this.maxRicochets = 0;
        
        // Visual properties
        this.bladeColor = '#C0C0C0';
        this.handleColor = '#8B4513';
        this.criticalColor = '#FF0000';
        
        // Level progression
        this.levelProgression = {
            1: { damage: 13, cooldown: 0.6, piercing: 2, projectiles: 1 },
            2: { damage: 16, cooldown: 0.55, piercing: 2, projectiles: 1 },
            3: { damage: 19, cooldown: 0.5, piercing: 3, projectiles: 1 },
            4: { damage: 23, cooldown: 0.45, piercing: 3, projectiles: 2 },
            5: { damage: 27, cooldown: 0.4, piercing: 4, projectiles: 2 },
            6: { damage: 33, cooldown: 0.35, piercing: 4, projectiles: 2 },
            7: { damage: 39, cooldown: 0.3, piercing: 5, projectiles: 3 },
            8: { damage: 49, cooldown: 0.25, piercing: 6, projectiles: 3 }
        };
    }
    
    onFire() {
        const projectileCount = Math.floor(this.currentStats.projectiles);
        
        if (projectileCount === 1) {
            this.throwSingleKnife();
        } else {
            this.throwMultipleKnives(projectileCount);
        }
        
        // Sound effect
        // this.game.audioManager.playSound('knifeThrow', 0.3);
    }
    
    throwSingleKnife() {
        const target = this.findTarget();
        if (!target) {
            // Throw in player's facing direction if no target
            const angle = this.player.direction || 0;
            this.createKnife(angle, false);
        } else {
            const angle = this.getAngleToTarget(target);
            const isCritical = Math.random() < this.criticalChance;
            this.createKnife(angle, isCritical);
        }
    }
    
    throwMultipleKnives(count) {
        const targets = this.findMultipleTargets(count);
        
        for (let i = 0; i < count; i++) {
            let angle;
            
            if (targets.length > 0) {
                // Target specific enemies
                const target = targets[i % targets.length];
                angle = this.getAngleToTarget(target);
                
                // Add spread for multiple knives
                if (count > 1) {
                    const spread = (i - (count - 1) / 2) * 0.2;
                    angle += spread;
                }
            } else {
                // Spread pattern
                const baseAngle = this.player.direction || 0;
                const spreadAngle = Math.PI / 4; // 45 degrees
                angle = baseAngle + (i - (count - 1) / 2) * (spreadAngle / (count - 1));
            }
            
            const isCritical = Math.random() < this.criticalChance;
            
            // Slight delay between throws for visual effect
            setTimeout(() => {
                this.createKnife(angle, isCritical);
            }, i * 50);
        }
    }
    
    createKnife(angle, isCritical = false) {
        // Calculate spawn position
        const spawnDistance = 12;
        const spawnX = this.player.x + Math.cos(angle) * spawnDistance;
        const spawnY = this.player.y + Math.sin(angle) * spawnDistance;
        
        // Calculate damage (with critical hit)
        let damage = this.getEffectiveDamage();
        if (isCritical) {
            damage *= this.criticalMultiplier;
        }
        
        const projectile = this.createProjectile(spawnX, spawnY, angle, {
            type: 'knife',
            damage: damage,
            piercing: this.currentStats.piercing,
            color: isCritical ? this.criticalColor : this.bladeColor,
            size: this.size,
            spin: true,
            spinSpeed: this.spinSpeed,
            ricochet: this.ricochetChance > 0,
            maxRicochets: this.maxRicochets,
            critical: isCritical
        });
        
        // Add ricochet behavior if enabled
        if (projectile && this.ricochetChance > 0) {
            projectile.ricochetChance = this.ricochetChance;
            projectile.ricochetCount = 0;
            projectile.maxRicochets = this.maxRicochets;
        }
        
        // Enhanced visual effects for critical hits
        if (isCritical) {
            this.game.systems.particle.createCriticalEffect(spawnX, spawnY, this.criticalColor);
        }
        
        return projectile;
    }
    
    onUpgrade() {
        // Apply level-specific stats
        const levelStats = this.levelProgression[this.level];
        if (levelStats) {
            this.baseStats.damage = levelStats.damage;
            this.baseStats.cooldown = levelStats.cooldown;
            this.baseStats.piercing = levelStats.piercing;
            this.baseStats.projectiles = levelStats.projectiles;
            this.updateStats();
        }
        
        // Special upgrade effects
        switch (this.level) {
            case 2:
                this.criticalChance += 0.05; // 15% total
                this.description += ' - Improved crit chance';
                break;
            case 4:
                this.baseStats.speed += 50;
                this.description += ' - Faster knives';
                break;
            case 5:
                this.ricochetChance = 0.3;
                this.maxRicochets = 1;
                this.description += ' - 30% chance to ricochet';
                break;
            case 6:
                this.criticalChance += 0.05; // 20% total
                this.criticalMultiplier += 0.5; // 2.5x total
                this.description += ' - Enhanced critical hits';
                break;
            case 7:
                this.maxRicochets = 2;
                this.ricochetChance = 0.5;
                this.description += ' - Better ricochet';
                break;
            case 8:
                this.criticalChance += 0.1; // 30% total
                this.maxRicochets = 3;
                this.baseStats.speed += 100;
                this.description += ' - Maximum lethality';
                break;
        }
    }
    
    // Enhanced targeting for throwing knives (prefer closer enemies for accuracy)
    findTarget() {
        const enemies = this.game.systems.enemy.getEnemiesInRange(
            this.player.x,
            this.player.y,
            this.targetingRange
        );
        
        if (enemies.length === 0) return null;
        
        // Sort by distance (prefer closer targets for accuracy)
        enemies.sort((a, b) => {
            const distA = this.getDistanceToPlayer(a);
            const distB = this.getDistanceToPlayer(b);
            return distA - distB;
        });
        
        return enemies[0];
    }
    
    // Override projectile creation to add knife-specific behavior
    createProjectile(x, y, angle, config = {}) {
        const projectile = super.createProjectile(x, y, angle, config);
        
        if (projectile && config.ricochet) {
            // Add ricochet behavior - store original update only once
            if (!projectile._originalUpdate) {
                projectile._originalUpdate = projectile.update.bind(projectile);
                projectile._hasRicochetBehavior = true;
                projectile.update = (dt) => {
                    projectile._originalUpdate(dt);
                    if (projectile._hasRicochetBehavior) {
                        this.updateKnifeRicochet(projectile, dt);
                    }
                };
            }
        }
        
        return projectile;
    }
    
    updateKnifeRicochet(projectile, dt) {
        if (!projectile.active || projectile.ricochetCount >= projectile.maxRicochets) return;
        
        // Check for ricochet when hitting an enemy
        if (projectile.hitTargets.size > projectile.ricochetCount) {
            if (Math.random() < projectile.ricochetChance) {
                this.performRicochet(projectile);
            }
        }
    }
    
    performRicochet(projectile) {
        projectile.ricochetCount++;
        
        // Find new target near the ricochet point
        const nearbyEnemies = this.game.systems.enemy.getEnemiesInRange(
            projectile.x,
            projectile.y,
            100
        ).filter(enemy => !projectile.hitTargets.has(enemy.id));
        
        if (nearbyEnemies.length > 0) {
            // Ricochet to nearest unhit enemy
            const target = nearbyEnemies[0];
            const angle = Math.atan2(target.y - projectile.y, target.x - projectile.x);
            
            // Update projectile direction
            projectile.velocity.x = Math.cos(angle) * projectile.speed;
            projectile.velocity.y = Math.sin(angle) * projectile.speed;
            projectile.direction = angle;
            
            // Visual effect
            this.game.systems.particle.createRicochetEffect(projectile.x, projectile.y, this.bladeColor);
            
            // Extend lifetime slightly
            projectile.lifetime += 0.5;
            
        }
    }
    
    render(renderer) {
        // Throwing knives are rendered as projectiles
        // Could add a charging effect or show next throw preview here
    }
    
    // Serialization
    static deserialize(game, player, data) {
        const weapon = new ThrowingKnife(game, player);
        weapon.level = data.level || 1;
        weapon.enabled = data.enabled !== false;
        weapon.updateStats();
        
        // Apply upgrades
        for (let i = 2; i <= weapon.level; i++) {
            weapon.level = i;
            weapon.onUpgrade();
        }
        
        return weapon;
    }
    
    getInfo() {
        return {
            name: this.name,
            level: this.level,
            damage: Math.floor(this.currentStats.damage),
            cooldown: this.currentStats.cooldown.toFixed(2),
            projectiles: Math.floor(this.currentStats.projectiles),
            piercing: this.currentStats.piercing,
            critChance: (this.criticalChance * 100).toFixed(0) + '%',
            critMultiplier: this.criticalMultiplier.toFixed(1) + 'x',
            ricochetChance: this.ricochetChance > 0 ? (this.ricochetChance * 100).toFixed(0) + '%' : 'None',
            description: this.description
        };
    }
}