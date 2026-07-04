import { BaseWeapon } from './BaseWeapon.js';

export class GreatSword extends BaseWeapon {
    constructor(game, player, config = {}) {
        const weaponConfig = {
            id: 'greatsword',
            name: '大剑',
            description: '近战肉搏，攻防双修',
            type: 'melee',
            damage: 15,
            cooldown: 1.0,
            range: 75,
            speed: 0, // Not applicable for melee
            duration: 0.3, // Attack animation duration
            area: 1.0,
            projectiles: 0, // Not applicable
            piercing: 999, // Hits all enemies in arc
            color: '#A0A0A0',
            size: 12,
            autoTarget: true,
            targetingRange: 200,
            canEvolve: true,
            maxLevel: 7,
            ...config
        };
        
        super(game, player, weaponConfig);
        
        // GreatSword specific properties
        this.arcAngle = Math.PI / 2; // 90 degree arc initially
        this.knockback = 80;
        this.attackAnimations = [];
        this.maxSimultaneousAttacks = 1;
        
        // Visual properties
        this.bladeColor = '#A0A0A0';
        this.hiltColor = '#8B4513';
        this.glowColor = '#FFD700';
        
        // Level progression
        this.levelProgression = {
            1: { damage: 15, cooldown: 1.0, range: 75, arcAngle: Math.PI / 2 },
            2: { damage: 25, cooldown: 1.0, range: 75, arcAngle: Math.PI / 2 },
            3: { damage: 35, cooldown: 1.0, range: 75, arcAngle: Math.PI / 2 },
            4: { damage: 45, cooldown: 1.0, range: 75, arcAngle: Math.PI / 2 },
            5: { damage: 55, cooldown: 1.0, range: 75, arcAngle: Math.PI / 2 },
            6: { damage: 65, cooldown: 1.0, range: 75, arcAngle: Math.PI / 2 },
            7: { damage: 175, cooldown: 1.0, range: 75, arcAngle: Math.PI / 2 } // 75 + 100 bonus
        };
    }
    
    onFire() {
        // Find best direction to attack
        const attackDirection = this.findBestAttackDirection();
        
        // Create greatsword attack
        this.createGreatSwordAttack(attackDirection);
    }
    
    findBestAttackDirection() {
        const enemies = this.game.systems.enemy.getEnemiesInRange(
            this.player.x,
            this.player.y,
            this.currentStats.range
        );
        
        if (enemies.length === 0) {
            // Default to player's facing direction
            return this.player.direction || 0;
        }
        
        // Find direction that hits the most enemies
        let bestDirection = 0;
        let maxHits = 0;
        
        // Test 16 different directions
        for (let i = 0; i < 16; i++) {
            const testDirection = (i / 16) * Math.PI * 2;
            const hits = this.countEnemiesInArc(testDirection, enemies);
            
            if (hits > maxHits) {
                maxHits = hits;
                bestDirection = testDirection;
            }
        }
        
        return bestDirection;
    }
    
    countEnemiesInArc(direction, enemies) {
        let count = 0;
        const halfArc = this.arcAngle / 2;
        
        for (const enemy of enemies) {
            const angleToEnemy = this.getAngleToTarget(enemy);
            const angleDiff = Math.abs(this.normalizeAngle(angleToEnemy - direction));
            
            if (angleDiff <= halfArc) {
                count++;
            }
        }
        
        return count;
    }
    
    createGreatSwordAttack(direction) {
        const attack = {
            id: Math.random().toString(36).substr(2, 9),
            startTime: performance.now(),
            duration: this.currentStats.duration * 1000, // Convert to milliseconds
            direction: direction,
            range: this.currentStats.range,
            arcAngle: this.effectiveArcAngle || this.arcAngle, // 使用受范围加成的攻击角度
            damage: this.getEffectiveDamage(),
            hitEnemies: new Set(),
            progress: 0
        };
        
        // Store attack for rendering and collision
        this.attackAnimations.push(attack);
        
        // Immediately check for hits
        this.checkGreatSwordCollisions(attack);
        
        // Create impact effect at tip
        const tipX = this.player.x + Math.cos(direction) * this.currentStats.range;
        const tipY = this.player.y + Math.sin(direction) * this.currentStats.range;
        this.game.systems.particle.createMeleeHitEffect(tipX, tipY, this.bladeColor);
    }
    
    update(dt) {
        super.update(dt);
        
        // Update attack animations
        this.updateAttackAnimations(dt);
    }
    
    updateAttackAnimations(dt) {
        const currentTime = performance.now();

        // Use write-index pattern for performance
        let writeIndex = 0;
        for (let i = 0; i < this.attackAnimations.length; i++) {
            const attack = this.attackAnimations[i];
            const elapsed = currentTime - attack.startTime;
            attack.progress = elapsed / attack.duration;

            if (elapsed < attack.duration) {
                this.attackAnimations[writeIndex++] = attack;
            }
        }
        this.attackAnimations.length = writeIndex;
    }
    
    checkGreatSwordCollisions(attack) {
        const enemies = this.game.systems.enemy.getEnemiesInRange(
            this.player.x,
            this.player.y,
            attack.range
        );

        for (const enemy of enemies) {
            if (attack.hitEnemies.has(enemy.id)) continue;

            if (this.isEnemyInSwordArc(enemy, attack)) {
                this.hitEnemy(enemy, attack);
                attack.hitEnemies.add(enemy.id);
            }
        }
    }

    isEnemyInSwordArc(enemy, attack) {
        // Check if enemy is within range (getDistanceToPlayer returns squared distance)
        const distanceSq = this.getDistanceToPlayer(enemy);
        if (distanceSq > attack.range * attack.range) return false;

        // Check if enemy is within arc
        const angleToEnemy = this.getAngleToTarget(enemy);
        const angleDiff = Math.abs(this.normalizeAngle(angleToEnemy - attack.direction));

        return angleDiff <= attack.arcAngle / 2;
    }
    
    hitEnemy(enemy, attack) {
        // Apply damage
        enemy.takeDamage(attack.damage, this.player);

        // Apply knockback (optimized with squared distance check)
        const dx = enemy.x - this.player.x;
        const dy = enemy.y - this.player.y;
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared > 0.01) {
            const distance = Math.sqrt(distanceSquared);
            const knockbackX = (dx / distance) * this.knockback;
            const knockbackY = (dy / distance) * this.knockback;

            enemy.velocity.x += knockbackX;
            enemy.velocity.y += knockbackY;
        }
        
        // Create hit effect
        this.game.systems.particle.createMeleeHitEffect(enemy.x, enemy.y, this.bladeColor);
        
        // Screen shake for powerful hits (with safety check)
        if (attack.damage > 60 && this.game && this.game.camera && typeof this.game.camera.shake === 'function') {
            this.game.camera.shake(3, 0.15);
        }
    }
    
    normalizeAngle(angle) {
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;
        return angle;
    }
    
    updateStats() {
        super.updateStats();
        
        // Apply area bonus to arc angle
        // Base arc angle is 90° (Math.PI / 2)
        // Area multiplier increases the arc angle
        const playerStats = 
            typeof this.player.getEffectiveStats === 'function' ? this.player.getEffectiveStats() : this.player.stats;
        const areaMultiplier = playerStats.area || 1.0;
        
        // Calculate effective arc angle with area bonus
        // Each 10% area increase adds about 9° to the arc
        const baseArc = this.arcAngle;
        const areaBonus = (areaMultiplier - 1.0) * (Math.PI / 2); // 90° per 100% area
        this.effectiveArcAngle = Math.min(baseArc + areaBonus, Math.PI * 2); // Cap at 360°
    }
    
    onUpgrade() {
        // Apply level-specific stats
        const levelStats = this.levelProgression[this.level];
        if (levelStats) {
            this.baseStats.damage = levelStats.damage;
            this.baseStats.cooldown = levelStats.cooldown;
            this.baseStats.range = levelStats.range;
            this.arcAngle = levelStats.arcAngle;
            this.updateStats();
        }
        
        // Special upgrade effects
        switch (this.level) {
            case 2:
                this.knockback += 20;
                this.description += ' - 增强击退';
                break;
            case 3:
                this.description += ' - 锋利之刃';
                break;
            case 4:
                this.description += ' - 重击';
                break;
            case 5:
                this.description += ' - 剑气纵横';
                break;
            case 6:
                this.description += ' - 无双乱舞';
                break;
            case 7:
                this.name = '圣剑';
                this.description = '神圣之剑，额外获得100点伤害';
                this.glowColor = '#FFD700';
                break;
        }
    }
    
    shouldFire() {
        // Only fire if we have fewer than max simultaneous attacks
        if (this.attackAnimations.length >= this.maxSimultaneousAttacks) return false;
        
        return super.shouldFire();
    }
    
    render(renderer) {
        // Render active greatsword attacks
        for (const attack of this.attackAnimations) {
            this.renderGreatSwordAttack(renderer, attack);
        }
    }
    
    renderGreatSwordAttack(renderer, attack) {
        const ctx = renderer.ctx;
        ctx.save();
        
        // Calculate opacity based on progress
        const opacity = 1 - attack.progress;
        ctx.globalAlpha = opacity;
        
        // Draw sword slash arc
        const startAngle = attack.direction - attack.arcAngle / 2;
        const endAngle = attack.direction + attack.arcAngle / 2;
        
        // Draw arc fill
        ctx.fillStyle = this.bladeColor;
        ctx.beginPath();
        ctx.moveTo(this.player.x, this.player.y);
        ctx.arc(this.player.x, this.player.y, attack.range, startAngle, endAngle);
        ctx.closePath();
        ctx.fill();
        
        // Draw arc outline
        ctx.strokeStyle = this.level >= 7 ? this.glowColor : '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Draw sword blade
        const bladeLength = attack.range * 0.8;
        const bladeX = this.player.x + Math.cos(attack.direction) * bladeLength;
        const bladeY = this.player.y + Math.sin(attack.direction) * bladeLength;
        
        ctx.strokeStyle = this.bladeColor;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.player.x, this.player.y);
        ctx.lineTo(bladeX, bladeY);
        ctx.stroke();
        
        // Draw hilt
        ctx.fillStyle = this.hiltColor;
        ctx.beginPath();
        ctx.arc(this.player.x, this.player.y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Add glow effect for level 7
        if (this.level >= 7) {
            ctx.shadowColor = this.glowColor;
            ctx.shadowBlur = 15;
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    // Serialization
    static deserialize(game, player, data) {
        const weapon = new GreatSword(game, player);
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
            range: Math.floor(this.currentStats.range),
            arc: Math.floor(this.arcAngle * 180 / Math.PI) + '°',
            knockback: this.knockback,
            description: this.description
        };
    }
    
    // Override BaseWeapon methods for greatsword-specific effects
    getSoundName() {
        return 'swordSlash';
    }
    
    getMuzzleFlashColor() {
        return this.level >= 7 ? this.glowColor : this.bladeColor;
    }
    
    getSoundVolume() {
        return Math.min(1.0, 0.7 + (this.level - 1) * 0.05);
    }
    
    getSoundPitch() {
        return 0.8 + (this.level - 1) * 0.03;
    }
    
    // Enhanced hit feedback
    onHitEnemy(enemy, damage, critical = false) {
        super.onHitEnemy(enemy, damage, critical);
        
        // Additional greatsword-specific effects
        this.createSlashImpactEffect(enemy, damage, critical);
    }
    
    createSlashImpactEffect(enemy, damage, critical) {
        if (!this.game.systems.particle) return;
        
        // Slash impact particles
        this.game.systems.particle.createBurst(enemy.x, enemy.y, 'slashImpact', {
            color: this.level >= 7 ? this.glowColor : this.bladeColor,
            count: Math.floor(damage * 0.15),
            spread: 50
        });
        
        // Slash lines effect for critical hits
        if (critical) {
            this.createSlashLines(enemy);
        }
    }
    
    createSlashLines(enemy) {
        const lineCount = 4;
        for (let i = 0; i < lineCount; i++) {
            const angle = (i / lineCount) * Math.PI * 2;
            const length = 25 + Math.random() * 20;
            
            for (let j = 0; j < 3; j++) {
                const distance = (j / 3) * length;
                const x = enemy.x + Math.cos(angle) * distance;
                const y = enemy.y + Math.sin(angle) * distance;
                
                this.game.systems.particle.create(x, y, {
                    vx: 0,
                    vy: 0,
                    life: 0.6,
                    size: 2,
                    color: this.level >= 7 ? this.glowColor : '#FFFFFF',
                    fadeOut: true
                });
            }
        }
    }
}
