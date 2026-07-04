import { BaseWeapon } from './BaseWeapon.js';

export class MagicMissile extends BaseWeapon {
    constructor(game, player, config = {}) {
        const weaponConfig = {
            id: 'magic_missile',
            name: '魔法飞弹',
            description: '自动向附近敌人发射追踪弹',
            type: 'projectile',
            damage: 10,
            cooldown: 1.2,
            range: 250,
            speed: 180,
            duration: 4.0,
            projectiles: 1,
            piercing: 0,
            color: '#9B59B6',
            size: 6,
            autoTarget: true,
            targetingRange: 250,
            canEvolve: true,
            maxLevel: 8,
            ...config
        };
        
        super(game, player, weaponConfig);
        
        // Magic Missile specific properties
        this.homingStrength = 150;
        this.trailEnabled = true;
        this.sparkleEffect = true;
        
        // Level progression
        this.levelProgression = {
            1: { damage: 10, cooldown: 1.2, projectiles: 1 },
            2: { damage: 12, cooldown: 1.1, projectiles: 1 },
            3: { damage: 14, cooldown: 1.0, projectiles: 1 },
            4: { damage: 17, cooldown: 0.9, projectiles: 2 },
            5: { damage: 20, cooldown: 0.8, projectiles: 2 },
            6: { damage: 23, cooldown: 0.7, projectiles: 2 },
            7: { damage: 26, cooldown: 0.6, projectiles: 3 },
            8: { damage: 33, cooldown: 0.5, projectiles: 3 }
        };
    }
    
    onFire() {
        const projectileCount = Math.floor(this.currentStats.projectiles);
        
        if (projectileCount === 1) {
            this.fireSingleMissile();
        } else {
            this.fireMultipleMissiles(projectileCount);
        }
        
        // Enhanced sound effect handled by BaseWeapon
        // Additional magic-specific effects
        this.createMagicCastingEffect();
    }
    
    fireSingleMissile() {
        const target = this.findTarget();
        if (!target) {
            // Fire in random direction if no target
            const angle = Math.random() * Math.PI * 2;
            this.createMagicMissile(angle, null);
        } else {
            const angle = this.getAngleToTarget(target);
            this.createMagicMissile(angle, target);
        }
    }
    
    fireMultipleMissiles(count) {
        const targets = this.findMultipleTargets(count);
        
        if (targets.length === 0) {
            // Fire in spread pattern if no targets
            this.fireSpreadPattern(count);
            return;
        }
        
        // Fire at specific targets
        for (let i = 0; i < count; i++) {
            const target = targets[i % targets.length];
            const angle = this.getAngleToTarget(target);
            
            // Add slight spread for multiple projectiles
            const spread = (i - (count - 1) / 2) * 0.3;
            this.createMagicMissile(angle + spread, target);
        }
    }
    
    fireSpreadPattern(count) {
        // Fire in a fan pattern
        const baseAngle = this.player.direction || 0;
        const spreadAngle = Math.PI / 3; // 60 degrees
        
        for (let i = 0; i < count; i++) {
            const angle = baseAngle + (i - (count - 1) / 2) * (spreadAngle / (count - 1));
            this.createMagicMissile(angle, null);
        }
    }
    
    createMagicMissile(angle, target) {
        // Calculate spawn position (slightly in front of player)
        const spawnDistance = 15;
        const spawnX = this.player.x + Math.cos(angle) * spawnDistance;
        const spawnY = this.player.y + Math.sin(angle) * spawnDistance;
        
        const projectile = this.createProjectile(spawnX, spawnY, angle, {
            type: 'magic',
            homing: true,
            homingStrength: this.homingStrength,
            trail: this.trailEnabled,
            color: this.color,
            size: this.size,
            piercing: this.currentStats.piercing
        });
        
        // Set specific target for homing
        if (projectile && target) {
            projectile.homingTarget = target;
        }
        
        // Create launch effect
        this.game.systems.particle.createMagicLaunchEffect(spawnX, spawnY, this.color);
        
        return projectile;
    }
    
    onUpgrade() {
        // Apply level-specific stats
        const levelStats = this.levelProgression[this.level];
        if (levelStats) {
            this.baseStats.damage = levelStats.damage;
            this.baseStats.cooldown = levelStats.cooldown;
            this.baseStats.projectiles = levelStats.projectiles;
            this.updateStats();
        }
        
        // Special upgrade effects
        switch (this.level) {
            case 3:
                this.homingStrength += 50;
                this.description += ' - Improved homing';
                break;
            case 5:
                this.baseStats.piercing = 1;
                this.description += ' - Pierces 1 enemy';
                break;
            case 7:
                this.baseStats.duration += 1.0;
                this.description += ' - Longer range';
                break;
            case 8:
                this.homingStrength += 100;
                this.baseStats.speed += 50;
                this.description += ' - Maximum power';
                break;
        }
    }
    
    render(renderer) {
        // Magic missiles don't render at weapon level, projectiles handle their own rendering
        // Could add a charging effect or aura around player here
        
        if (this.cooldownTimer > 0 && this.sparkleEffect) {
            this.renderChargingEffect(renderer);
        }
    }
    
    renderChargingEffect(renderer) {
        const ctx = renderer.ctx;
        const chargeProgress = 1 - (this.cooldownTimer / this.getEffectiveCooldown());
        const time = performance.now() * 0.003;
        const px = this.player.x;
        const py = this.player.y;

        ctx.save();

        // Phase 1 (30-70%): Faint orbiting motes gathering
        if (chargeProgress > 0.3) {
            const moteAlpha = Math.min(1, (chargeProgress - 0.3) / 0.4) * 0.5;
            const moteCount = 6 + Math.floor(this.level / 2);
            for (let i = 0; i < moteCount; i++) {
                const a = (i / moteCount) * Math.PI * 2 + time * (1 + i * 0.15);
                const r = 22 - 8 * chargeProgress + Math.sin(time * 4 + i) * 3;
                const mx = px + Math.cos(a) * r;
                const my = py + Math.sin(a) * r;
                ctx.globalAlpha = moteAlpha;
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(mx, my, 1.5 + chargeProgress, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Phase 2 (70-100%): Glowing arcane ring + central orb
        if (chargeProgress > 0.7) {
            const intensity = (chargeProgress - 0.7) / 0.3; // 0→1

            // Outer ring glow
            ctx.globalAlpha = 0.15 * intensity;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2 + intensity * 2;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 10 * intensity;
            ctx.beginPath();
            ctx.arc(px, py, 18 + 4 * Math.sin(time * 5), 0, Math.PI * 2);
            ctx.stroke();

            // Central orb
            const orbRadius = 4 + 3 * intensity;
            const gradient = ctx.createRadialGradient(px, py, 0, px, py, orbRadius);
            gradient.addColorStop(0, `rgba(255, 255, 255, ${0.7 * intensity})`);
            gradient.addColorStop(0.5, this.color);
            gradient.addColorStop(1, 'rgba(155, 89, 182, 0)');
            ctx.globalAlpha = 0.6 * intensity;
            ctx.shadowBlur = 15 * intensity;
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(px, py, orbRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;
        }

        ctx.restore();
    }
    
    // Override targeting to prefer different enemy types
    findTarget() {
        const enemies = this.game.systems.enemy.getEnemiesInRange(
            this.player.x,
            this.player.y,
            this.targetingRange
        );
        
        if (enemies.length === 0) return null;
        
        // Prioritize enemies by type and distance
        enemies.sort((a, b) => {
            // Priority: ranged > fast > basic > tank
            const priorityA = this.getEnemyPriority(a);
            const priorityB = this.getEnemyPriority(b);
            
            if (priorityA !== priorityB) {
                return priorityB - priorityA; // Higher priority first
            }
            
            // If same priority, sort by distance
            const distA = this.getDistanceToPlayer(a);
            const distB = this.getDistanceToPlayer(b);
            return distA - distB;
        });
        
        return enemies[0];
    }
    
    getEnemyPriority(enemy) {
        switch (enemy.type) {
            case 'ranged': return 4;
            case 'fast': return 3;
            case 'basic': return 2;
            case 'tank': return 1;
            default: return 1;
        }
    }
    
    // Serialization
    static deserialize(game, player, data) {
        const weapon = new MagicMissile(game, player);
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
            cooldown: this.currentStats.cooldown.toFixed(1),
            projectiles: Math.floor(this.currentStats.projectiles),
            piercing: this.currentStats.piercing,
            description: this.description
        };
    }
    
    // Enhanced visual effects
    createMagicCastingEffect() {
        if (!this.game.systems.particle) return;
        
        // Create arcane runes around player
        const runeCount = Math.min(8, 3 + this.level);
        for (let i = 0; i < runeCount; i++) {
            const angle = (i / runeCount) * Math.PI * 2;
            const distance = 25 + Math.random() * 10;
            const runeX = this.player.x + Math.cos(angle) * distance;
            const runeY = this.player.y + Math.sin(angle) * distance;
            
            this.game.systems.particle.create(runeX, runeY, {
                vx: Math.cos(angle) * 30,
                vy: Math.sin(angle) * 30,
                life: 0.8,
                size: 5,
                color: this.color,
                glow: true,
                fadeOut: true
            });
        }
        
        // Magic circle effect for higher levels
        if (this.level >= 5) {
            this.createMagicCircle();
        }
    }
    
    createMagicCircle() {
        const circleRadius = 35;
        const particleCount = 16;
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const x = this.player.x + Math.cos(angle) * circleRadius;
            const y = this.player.y + Math.sin(angle) * circleRadius;
            
            this.game.systems.particle.create(x, y, {
                vx: 0,
                vy: -20,
                life: 0.6,
                size: 3,
                color: '#9B59B6',
                glow: true,
                fadeOut: true
            });
        }
    }
    
    // Override BaseWeapon methods for magic-specific effects
    getSoundName() {
        return 'magicMissile';
    }
    
    getMuzzleFlashColor() {
        return '#9B59B6';
    }
    
    getSoundPitch() {
        // Higher pitch for magic
        return 1.1 + (this.level - 1) * 0.05;
    }
}