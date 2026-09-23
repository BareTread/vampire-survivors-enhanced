import { BaseWeapon } from './BaseWeapon.js';

export class Whip extends BaseWeapon {
    constructor(game, player, config = {}) {
        const weaponConfig = {
            id: 'whip',
            name: 'Whip',
            description: 'Strikes in an arc, hitting multiple enemies',
            type: 'melee',
            damage: 15,
            cooldown: 0.8,
            range: 100,
            speed: 0, // Not applicable for melee
            duration: 0.3, // Attack animation duration
            area: 1.0,
            projectiles: 0, // Not applicable
            piercing: 999, // Hits all enemies in arc
            color: '#8B4513',
            size: 12,
            autoTarget: true,
            targetingRange: 200,
            canEvolve: true,
            maxLevel: 8,
            ...config
        };
        
        super(game, player, weaponConfig);
        
        // Whip specific properties
        this.arcAngle = Math.PI / 2; // 90 degree arc
        this.knockback = 50;
        this.attackAnimations = [];
        this.maxSimultaneousAttacks = 1;
        
        // Visual properties
        this.whipColor = '#8B4513';
        this.tipColor = '#FFD700';
        this.segments = 8;
        
        // Level progression
        this.levelProgression = {
            1: { damage: 15, cooldown: 0.8, range: 100, arcAngle: Math.PI / 2 },
            2: { damage: 19, cooldown: 0.75, range: 110, arcAngle: Math.PI / 2 },
            3: { damage: 23, cooldown: 0.7, range: 120, arcAngle: Math.PI / 1.8 },
            4: { damage: 28, cooldown: 0.65, range: 130, arcAngle: Math.PI / 1.8 },
            5: { damage: 33, cooldown: 0.6, range: 140, arcAngle: Math.PI / 1.6 },
            6: { damage: 39, cooldown: 0.55, range: 150, arcAngle: Math.PI / 1.5 },
            7: { damage: 46, cooldown: 0.5, range: 160, arcAngle: Math.PI / 1.4 },
            8: { damage: 55, cooldown: 0.4, range: 180, arcAngle: Math.PI / 1.2 }
        };
    }
    
    onFire() {
        // Find best direction to attack
        const attackDirection = this.findBestAttackDirection();
        
        // Create whip attack
        this.createWhipAttack(attackDirection);
        
        // Enhanced sound effect handled by BaseWeapon
        // Additional whip-specific effects
        this.createWhipCrackEffect(attackDirection);
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
    
    createWhipAttack(direction) {
        const attack = {
            id: Math.random().toString(36).substr(2, 9),
            startTime: performance.now(),
            duration: this.currentStats.duration * 1000, // Convert to milliseconds
            direction: direction,
            range: this.currentStats.range,
            arcAngle: this.arcAngle,
            damage: this.getEffectiveDamage(),
            hitEnemies: new Set(),
            segments: [],
            progress: 0,
            flip: (this._flip = !this._flip)
        };
        
        // Generate whip segments
        this.generateWhipSegments(attack);
        
        // Store attack for rendering and collision
        this.attackAnimations.push(attack);
        
        // Immediately check for hits
        this.checkWhipCollisions(attack);
        
        // Create impact effect at tip
        const tipX = this.player.x + Math.cos(direction) * this.currentStats.range;
        const tipY = this.player.y + Math.sin(direction) * this.currentStats.range;
        this.game.systems.particle.createWhipCrackEffect(tipX, tipY, this.whipColor);
    }
    
    generateWhipSegments(attack) {
        attack.segments = [];
        
        for (let i = 0; i < this.segments; i++) {
            const t = i / (this.segments - 1);
            const distance = t * attack.range;
            
            // Add slight curve to make it look more like a whip
            const curve = Math.sin(t * Math.PI) * 10;
            const perpDirection = attack.direction + Math.PI / 2;
            
            const baseX = this.player.x + Math.cos(attack.direction) * distance;
            const baseY = this.player.y + Math.sin(attack.direction) * distance;
            
            const x = baseX + Math.cos(perpDirection) * curve;
            const y = baseY + Math.sin(perpDirection) * curve;
            
            attack.segments.push({ x, y, t });
        }
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
                // Update whip position for animation
                this.updateWhipAnimation(attack);
                this.attackAnimations[writeIndex++] = attack;
            }
            // Attack finished - just don't copy to writeIndex
        }
        this.attackAnimations.length = writeIndex;
    }
    
    updateWhipAnimation(attack) {
        // Animate whip segments with wave motion
        const waveProgress = attack.progress * 2; // Wave travels along whip
        
        for (let i = 0; i < attack.segments.length; i++) {
            const segment = attack.segments[i];
            const wavePhase = waveProgress - segment.t;
            
            if (wavePhase > 0 && wavePhase < 1) {
                // Add whip crack motion
                const amplitude = 15 * Math.sin(wavePhase * Math.PI);
                const perpDirection = attack.direction + Math.PI / 2;
                
                segment.x += Math.cos(perpDirection) * amplitude;
                segment.y += Math.sin(perpDirection) * amplitude;
            }
        }
    }
    
    checkWhipCollisions(attack) {
        const enemies = this.game.systems.enemy.getEnemiesInRange(
            this.player.x,
            this.player.y,
            attack.range
        );

        for (const enemy of enemies) {
            if (attack.hitEnemies.has(enemy.id)) continue;

            if (this.isEnemyInWhipArc(enemy, attack)) {
                this.hitEnemy(enemy, attack);
                attack.hitEnemies.add(enemy.id);
            }
        }
    }

    isEnemyInWhipArc(enemy, attack) {
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
        this.game.systems.particle.createMeleeHitEffect(enemy.x, enemy.y, this.whipColor);
        
        // Screen shake for powerful hits (with safety check)
        if (attack.damage > 60 && this.game && this.game.camera && typeof this.game.camera.shake === 'function') {
            this.game.camera.shake(2, 0.1);
        }
    }
    
    normalizeAngle(angle) {
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;
        return angle;
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
            case 3:
                this.knockback += 25;
                this.description += ' - Increased knockback';
                break;
            case 5:
                this.maxSimultaneousAttacks = 2;
                this.description += ' - Can attack twice simultaneously';
                break;
            case 7:
                this.segments += 4;
                this.description += ' - Longer whip';
                break;
            case 8:
                this.maxSimultaneousAttacks = 3;
                this.knockback += 50;
                this.description += ' - Maximum power';
                break;
        }
    }
    
    shouldFire() {
        // Only fire if we have fewer than max simultaneous attacks
        if (this.attackAnimations.length >= this.maxSimultaneousAttacks) return false;
        
        return super.shouldFire();
    }
    
    render(renderer) {
        // Render active whip attacks
        for (const attack of this.attackAnimations) {
            this.renderWhipAttack(renderer, attack);
        }
    }
    
    /**
     * Sweeping crescent slash: a bright blade of air races across the arc
     * (alternating side each crack), trailed by the leather lash with a
     * gold spark at the tip. The hit is instant; the visual sells the arc.
     */
    renderWhipAttack(renderer, attack) {
        const ctx = renderer.ctx;
        const p = Math.min(1, Math.max(0, attack.progress));
        const px = this.player.x;
        const py = this.player.y - this.player.size * 0.4; // swing from hand height
        const R = attack.range;
        const half = attack.arcAngle / 2;
        const dirSign = attack.flip ? -1 : 1;
        const start = attack.direction - half * dirSign;
        const span = attack.arcAngle * dirSign;

        const easeOut = (t) => 1 - Math.pow(1 - t, 3);
        const lead = easeOut(Math.min(1, p / 0.4));
        const trail = Math.max(0, (p - 0.08) / 0.92);
        const a1 = start + span * lead;
        const a0 = start + span * Math.min(lead, easeOut(trail) * 0.95);
        const fade = Math.pow(1 - p, 0.6);
        const evolved = this.evolved || this.isEvolved || this.level >= 8;
        const edge = evolved ? '255, 120, 110' : '255, 238, 205';
        const body = evolved ? '190, 30, 40' : '200, 150, 90';

        ctx.save();

        // Crescent slash band
        if (Math.abs(a1 - a0) > 0.01) {
            const lo = Math.min(a0, a1);
            const hi = Math.max(a0, a1);
            const grad = ctx.createRadialGradient(px, py, R * 0.45, px, py, R * 1.02);
            grad.addColorStop(0, `rgba(${body}, 0)`);
            grad.addColorStop(0.6, `rgba(${body}, ${0.28 * fade})`);
            grad.addColorStop(0.9, `rgba(${edge}, ${0.85 * fade})`);
            grad.addColorStop(1, `rgba(${edge}, 0)`);
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(px, py, R * 1.02, lo, hi);
            ctx.arc(px, py, R * 0.55, hi, lo, true);
            ctx.closePath();
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        }

        // Leather lash: hand → leading tip, bowed back against the swing
        if (p < 0.7) {
            const lashAlpha = 1 - p / 0.7;
            const tipX = px + Math.cos(a1) * R;
            const tipY = py + Math.sin(a1) * R;
            const bow = a1 - dirSign * 0.35;
            const cxp = px + Math.cos(bow) * R * 0.6;
            const cyp = py + Math.sin(bow) * R * 0.6;
            ctx.globalAlpha = lashAlpha;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#1a0e08';
            ctx.lineWidth = 4.5;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.quadraticCurveTo(cxp, cyp, tipX, tipY);
            ctx.stroke();
            ctx.strokeStyle = evolved ? '#a8222e' : '#8a5a32';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255, 220, 170, 0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Crack spark at the tip
            ctx.globalCompositeOperation = 'lighter';
            const sparkR = 4 + (1 - lead) * 6;
            const spark = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, sparkR * 2.2);
            spark.addColorStop(0, 'rgba(255, 245, 200, 1)');
            spark.addColorStop(0.4, 'rgba(255, 200, 80, 0.7)');
            spark.addColorStop(1, 'rgba(255, 140, 40, 0)');
            ctx.fillStyle = spark;
            ctx.beginPath();
            ctx.arc(tipX, tipY, sparkR * 2.2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    // Serialization
    static deserialize(game, player, data) {
        const weapon = new Whip(game, player);
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
    
    // Enhanced visual effects
    createWhipCrackEffect(direction) {
        if (!this.game.systems.particle) return;
        
        // Create dust particles at crack point
        const crackDistance = this.currentStats.range * 0.8;
        const crackX = this.player.x + Math.cos(direction) * crackDistance;
        const crackY = this.player.y + Math.sin(direction) * crackDistance;
        
        // Dust burst at tip
        this.game.systems.particle.createBurst(crackX, crackY, 'whipCrack', {
            color: '#D2B48C',
            count: 8,
            spread: 30
        });
        
        // Sonic boom effect for higher levels
        if (this.level >= 4) {
            this.createSonicBoom(crackX, crackY);
        }
        
        // Trail particles along whip path
        this.createWhipTrail(direction);
    }
    
    createSonicBoom(x, y) {
        // Shockwave ring
        const ringParticles = 12;
        for (let i = 0; i < ringParticles; i++) {
            const angle = (i / ringParticles) * Math.PI * 2;
            this.game.systems.particle.create(x, y, {
                vx: Math.cos(angle) * 150,
                vy: Math.sin(angle) * 150,
                life: 0.4,
                size: 3,
                color: '#FFFFFF',
                glow: true,
                fadeOut: true
            });
        }
    }
    
    createWhipTrail(direction) {
        const trailSegments = 6;
        for (let i = 0; i < trailSegments; i++) {
            const distance = (i / trailSegments) * this.currentStats.range;
            const x = this.player.x + Math.cos(direction) * distance;
            const y = this.player.y + Math.sin(direction) * distance;
            
            this.game.systems.particle.create(x, y, {
                vx: (Math.random() - 0.5) * 40,
                vy: (Math.random() - 0.5) * 40,
                life: 0.3,
                size: 2,
                color: this.whipColor,
                fadeOut: true
            });
        }
    }
    
    // Override BaseWeapon methods for whip-specific effects
    getSoundName() {
        return 'whipCrack';
    }
    
    getMuzzleFlashColor() {
        return '#8B4513';
    }
    
    getSoundVolume() {
        // Whip should be loud and impactful
        return Math.min(1.0, 0.8 + (this.level - 1) * 0.05);
    }
    
    getSoundPitch() {
        // Lower pitch for whip crack
        return 0.9 + (this.level - 1) * 0.02;
    }
    
    // Enhanced hit feedback
    onHitEnemy(enemy, damage, critical = false) {
        super.onHitEnemy(enemy, damage, critical);
        
        // Additional whip-specific effects
        this.createWhipImpactEffect(enemy, damage, critical);
    }
    
    createWhipImpactEffect(enemy, damage, critical) {
        if (!this.game.systems.particle) return;
        
        // Dust explosion on impact
        this.game.systems.particle.createBurst(enemy.x, enemy.y, 'dustExplosion', {
            color: '#F3DDB0',
            count: Math.floor(damage * 0.2),
            spread: 40
        });
        
        // Crack lines effect for critical hits
        if (critical) {
            this.createCrackLines(enemy);
        }
    }
    
    createCrackLines(enemy) {
        const lineCount = 6;
        for (let i = 0; i < lineCount; i++) {
            const angle = (i / lineCount) * Math.PI * 2;
            const length = 20 + Math.random() * 15;
            
            for (let j = 0; j < 3; j++) {
                const distance = (j / 3) * length;
                const x = enemy.x + Math.cos(angle) * distance;
                const y = enemy.y + Math.sin(angle) * distance;
                
                this.game.systems.particle.create(x, y, {
                    vx: 0,
                    vy: 0,
                    life: 0.8,
                    size: 1,
                    color: '#FFFFFF',
                    fadeOut: true
                });
            }
        }
    }
}