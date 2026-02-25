import { BaseWeapon } from './BaseWeapon.js';

export class BoneBoomerang extends BaseWeapon {
    constructor(game, player, config = {}) {
        const weaponConfig = {
            id: 'bone_boomerang',
            name: 'Bone Boomerang',
            description: 'Thrown bone that returns to the player, hitting enemies both ways',
            type: 'boomerang',
            damage: 10,
            cooldown: 1.4,
            range: 200,
            speed: 250,
            duration: 3.0,
            projectiles: 1,
            piercing: 1,
            color: '#E8D5B7',
            size: 7,
            autoTarget: true,
            targetingRange: 250,
            canEvolve: true,
            maxLevel: 8,
            ...config
        };

        super(game, player, weaponConfig);

        // Boomerang-specific properties
        this.throwDistance = 180; // Max outward travel distance
        this.returnPiercing = 2; // Extra piercing on return trip
        this.arcWidth = 40; // Lateral arc offset (parabolic width)
        this.spinSpeed = 12; // Visual rotation speed (rad/s)
        this.returnSpeedMultiplier = 1.3; // Return trip is faster

        // Active boomerangs tracked for custom update/render
        this.activeBoomerangs = [];

        // Level progression
        this.levelProgression = {
            1: { damage: 10, cooldown: 1.4, projectiles: 1, throwDist: 180, arcWidth: 40, returnPiercing: 2 },
            2: { damage: 13, cooldown: 1.3, projectiles: 1, throwDist: 200, arcWidth: 45, returnPiercing: 2 },
            3: { damage: 16, cooldown: 1.2, projectiles: 1, throwDist: 220, arcWidth: 55, returnPiercing: 3 },
            4: { damage: 20, cooldown: 1.1, projectiles: 2, throwDist: 240, arcWidth: 60, returnPiercing: 3 },
            5: { damage: 24, cooldown: 1.0, projectiles: 2, throwDist: 260, arcWidth: 70, returnPiercing: 4 },
            6: { damage: 29, cooldown: 0.9, projectiles: 2, throwDist: 280, arcWidth: 80, returnPiercing: 5 },
            7: { damage: 35, cooldown: 0.8, projectiles: 3, throwDist: 300, arcWidth: 90, returnPiercing: 6 },
            8: { damage: 44, cooldown: 0.6, projectiles: 3, throwDist: 340, arcWidth: 100, returnPiercing: 8 }
        };
    }

    onFire() {
        const projectileCount = Math.floor(this.currentStats.projectiles);
        const targets = this.findMultipleTargets(projectileCount);

        for (let i = 0; i < projectileCount; i++) {
            let angle;
            if (targets.length > 0) {
                const target = targets[i % targets.length];
                angle = this.getAngleToTarget(target);
                if (projectileCount > 1) {
                    const spread = (i - (projectileCount - 1) / 2) * 0.4;
                    angle += spread;
                }
            } else {
                const baseAngle = this.player.direction || 0;
                if (projectileCount > 1) {
                    const spread = (i - (projectileCount - 1) / 2) * 0.5;
                    angle = baseAngle + spread;
                } else {
                    angle = baseAngle;
                }
            }

            // Alternate arc direction for visual variety
            const arcDir = i % 2 === 0 ? 1 : -1;
            this.launchBoomerang(angle, arcDir);
        }

        // Sound
        this.playBoomerangSound();
    }

    launchBoomerang(angle, arcDirection) {
        const startX = this.player.x;
        const startY = this.player.y;

        // We track the boomerang ourselves rather than using ProjectileSystem,
        // because boomerangs have a parabolic arc + return trip that standard
        // projectiles can't handle.
        const boomerang = {
            active: true,
            x: startX,
            y: startY,
            startX: startX,
            startY: startY,
            angle: angle,
            arcDirection: arcDirection,

            // Phase: 'outbound' or 'return'
            phase: 'outbound',
            progress: 0, // 0→1 along the path
            speed: this.currentStats.speed,
            throwDistance: this.throwDistance,
            arcWidth: this.arcWidth,

            // Hit tracking (separate sets for outbound and return)
            outboundHits: new Set(),
            returnHits: new Set(),

            // Outbound piercing uses base piercing, return uses bonus
            outboundPiercing: this.currentStats.piercing,
            returnPiercing: this.returnPiercing,
            outboundHitCount: 0,
            returnHitCount: 0,

            // Damage
            damage: this.getEffectiveDamage(),
            returnDamageMultiplier: 1.2, // Return trip does +20% damage

            // Visual
            rotation: Math.random() * Math.PI * 2,
            spinSpeed: this.spinSpeed,
            size: this.size,
            trail: [], // Afterimage trail points
            trailMaxLength: 8,

            // Lifetime safety
            maxLifetime: 4.0,
            lifetime: 0
        };

        this.activeBoomerangs.push(boomerang);
    }

    update(dt) {
        super.update(dt);

        // Update active boomerangs
        for (let i = this.activeBoomerangs.length - 1; i >= 0; i--) {
            const b = this.activeBoomerangs[i];
            if (!b.active) {
                this.activeBoomerangs.splice(i, 1);
                continue;
            }

            this.updateBoomerang(b, dt);
        }
    }

    updateBoomerang(b, dt) {
        b.lifetime += dt;
        if (b.lifetime >= b.maxLifetime) {
            b.active = false;
            return;
        }

        // Store previous position for trail
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > b.trailMaxLength) {
            b.trail.shift();
        }

        // Spin
        b.rotation += b.spinSpeed * dt;

        // Move along parabolic arc
        const travelSpeed = b.phase === 'return' ? b.speed * this.returnSpeedMultiplier : b.speed;

        // Progress along path (0→1 each phase)
        const progressDelta = (travelSpeed / b.throwDistance) * dt;
        b.progress += progressDelta;

        if (b.phase === 'outbound') {
            if (b.progress >= 1.0) {
                // Switch to return phase
                b.phase = 'return';
                b.progress = 0;
                // Update start position for return trip
                b.startX = b.x;
                b.startY = b.y;
            }
        } else {
            // Return phase: target is current player position
            if (b.progress >= 1.0) {
                // Arrived back at player — deactivate
                b.active = false;
                return;
            }
        }

        // Calculate position using parabolic arc
        this.calculateBoomerangPosition(b);

        // Check for enemy collisions
        this.checkBoomerangCollisions(b);
    }

    calculateBoomerangPosition(b) {
        const t = b.progress;

        if (b.phase === 'outbound') {
            // Outbound: fly from start toward angle direction with parabolic lateral arc
            const targetX = b.startX + Math.cos(b.angle) * b.throwDistance;
            const targetY = b.startY + Math.sin(b.angle) * b.throwDistance;

            // Linear interpolation along main axis
            const linearX = b.startX + (targetX - b.startX) * t;
            const linearY = b.startY + (targetY - b.startY) * t;

            // Parabolic lateral offset (peaks at t=0.5, zero at t=0 and t=1)
            const lateralOffset = 4 * t * (1 - t) * b.arcWidth * b.arcDirection;

            // Perpendicular direction
            const perpX = -Math.sin(b.angle);
            const perpY = Math.cos(b.angle);

            b.x = linearX + perpX * lateralOffset;
            b.y = linearY + perpY * lateralOffset;
        } else {
            // Return: fly from current position back to player with arc
            const targetX = this.player.x;
            const targetY = this.player.y;

            const linearX = b.startX + (targetX - b.startX) * t;
            const linearY = b.startY + (targetY - b.startY) * t;

            // Return arc (opposite direction, decaying)
            const returnAngle = Math.atan2(targetY - b.startX, targetX - b.startX);
            const lateralOffset = 4 * t * (1 - t) * b.arcWidth * 0.6 * -b.arcDirection;

            const perpX = -Math.sin(returnAngle);
            const perpY = Math.cos(returnAngle);

            b.x = linearX + perpX * lateralOffset;
            b.y = linearY + perpY * lateralOffset;
        }
    }

    checkBoomerangCollisions(b) {
        const enemies = this.game.systems.enemy.getEnemiesInRange(b.x, b.y, b.size * 2.5);

        for (const enemy of enemies) {
            if (!enemy.active) continue;

            const dx = enemy.x - b.x;
            const dy = enemy.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const hitRange = b.size + (enemy.size || 10);

            if (dist > hitRange) continue;

            if (b.phase === 'outbound') {
                if (b.outboundHits.has(enemy)) continue;
                b.outboundHits.add(enemy);
                b.outboundHitCount++;

                const damage = Math.round(b.damage);
                this.dealBoomerangDamage(enemy, damage, false);

                if (b.outboundHitCount > b.outboundPiercing) {
                    // Outbound piercing exhausted — start return
                    b.phase = 'return';
                    b.progress = 0;
                    b.startX = b.x;
                    b.startY = b.y;
                    return;
                }
            } else {
                if (b.returnHits.has(enemy)) continue;
                b.returnHits.add(enemy);
                b.returnHitCount++;

                // Return trip does bonus damage
                const damage = Math.round(b.damage * b.returnDamageMultiplier);
                this.dealBoomerangDamage(enemy, damage, true);

                if (b.returnHitCount > b.returnPiercing) {
                    // Return piercing exhausted — still flies back but doesn't hit more
                    b.returnPiercing = -1; // Effectively disable further return hits
                }
            }
        }
    }

    dealBoomerangDamage(enemy, damage, isReturn) {
        if (typeof enemy.takeDamage === 'function') {
            enemy.takeDamage(damage, this.player);
        }

        // Hit feedback
        const isCritical = this.game.systems.rewards
            ? this.game.systems.rewards.rollForCritical()
            : Math.random() < 0.1;

        if (isCritical) {
            damage = Math.round(damage * 2);
        }

        // Damage numbers
        const color = isReturn ? '#FFDD88' : this.color;
        if (this.game.systems.particle && this.game.systems.particle.createEnhancedDamageNumber) {
            this.game.systems.particle.createEnhancedDamageNumber(
                enemy.x,
                enemy.y,
                damage,
                isCritical,
                isCritical ? '#FF0000' : color,
                isCritical ? 22 : 16,
                1.0
            );
        }

        // Hit particles
        if (this.game.systems.particle) {
            const count = isReturn ? 4 : 2;
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                this.game.systems.particle.create(enemy.x, enemy.y, {
                    vx: Math.cos(angle) * (30 + Math.random() * 50),
                    vy: Math.sin(angle) * (30 + Math.random() * 50),
                    life: 0.2 + Math.random() * 0.15,
                    size: 2 + Math.random() * 2,
                    color: isReturn ? '#FFDD88' : '#E8D5B7',
                    glow: false,
                    fadeOut: true
                });
            }
        }

        // System notifications
        if (enemy.health <= 0) {
            if (this.game.systems.flowState && this.game.systems.flowState.onEnemyKilled) {
                this.game.systems.flowState.onEnemyKilled(enemy);
            }
            if (this.game.systems.achievement) {
                this.game.systems.achievement.onEnemyKilled(enemy);
            }
        }
    }

    // --- Visual rendering ---

    render(renderer) {
        const ctx = renderer.ctx;

        for (const b of this.activeBoomerangs) {
            if (!b.active) continue;
            this.renderBoomerang(ctx, b);
        }
    }

    renderBoomerang(ctx, b) {
        ctx.save();

        // Afterimage trail
        for (let i = 0; i < b.trail.length; i++) {
            const t = b.trail[i];
            const trailAlpha = (i / b.trail.length) * 0.25;
            const trailSize = b.size * (0.5 + (i / b.trail.length) * 0.5);

            ctx.save();
            ctx.translate(t.x, t.y);
            ctx.rotate(b.rotation - (b.trail.length - i) * 0.4);
            ctx.globalAlpha = trailAlpha;

            // Cross shape for trail
            ctx.fillStyle = b.phase === 'return' ? '#FFDD88' : '#E8D5B7';
            ctx.fillRect(-trailSize * 0.8, -trailSize * 0.15, trailSize * 1.6, trailSize * 0.3);
            ctx.fillRect(-trailSize * 0.15, -trailSize * 0.8, trailSize * 0.3, trailSize * 1.6);

            ctx.restore();
        }

        // Main boomerang body
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rotation);

        const s = b.size;

        // Glow during return phase
        if (b.phase === 'return') {
            ctx.shadowColor = '#FFDD88';
            ctx.shadowBlur = 8;
        }

        // Cross/bone shape
        ctx.fillStyle = b.phase === 'return' ? '#FFEECC' : '#E8D5B7';
        ctx.strokeStyle = b.phase === 'return' ? '#DDBB88' : '#C4A882';
        ctx.lineWidth = 1;

        // Horizontal bone
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 1.0, s * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Vertical bone
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.22, s * 1.0, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Bone knobs at ends
        const knobSize = s * 0.28;
        const knobPositions = [
            { x: s * 0.9, y: 0 },
            { x: -s * 0.9, y: 0 },
            { x: 0, y: s * 0.9 },
            { x: 0, y: -s * 0.9 }
        ];
        for (const knob of knobPositions) {
            ctx.beginPath();
            ctx.arc(knob.x, knob.y, knobSize, 0, Math.PI * 2);
            ctx.fillStyle = b.phase === 'return' ? '#FFF5E0' : '#F0E0C8';
            ctx.fill();
        }

        // Center dot
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = '#8B7355';
        ctx.fill();

        ctx.restore();
    }

    // --- Audio ---

    playBoomerangSound() {
        if (!this.game.audioManager) return;
        this.game.audioManager.playVampireSound('boomerangThrow', 0.6, 1.0 + (this.level - 1) * 0.03);
    }

    // --- Upgrades ---

    onUpgrade() {
        const levelStats = this.levelProgression[this.level];
        if (levelStats) {
            this.baseStats.damage = levelStats.damage;
            this.baseStats.cooldown = levelStats.cooldown;
            this.baseStats.projectiles = levelStats.projectiles;
            this.throwDistance = levelStats.throwDist;
            this.arcWidth = levelStats.arcWidth;
            this.returnPiercing = levelStats.returnPiercing;
            this.updateStats();
        }

        switch (this.level) {
            case 3:
                this.description = 'Wider arc, more return piercing';
                break;
            case 4:
                this.description = 'Throws 2 bones';
                break;
            case 7:
                this.description = 'Throws 3 bones, massive arc';
                break;
            case 8:
                this.description = 'Bone storm — 3 bones, 8 return pierces';
                break;
        }
    }

    // --- Overrides ---

    getSoundName() {
        return 'boomerangThrow';
    }

    getMuzzleFlashColor() {
        return '#E8D5B7';
    }

    getSoundPitch() {
        return 1.0 + (this.level - 1) * 0.03;
    }

    /**
     * Override fire effects — boomerangs have a subtle whoosh, not heavy shake.
     */
    createFireEffects() {
        this.playEnhancedFireSound();
        this.game.camera.shake(1.5, 0.08, 'subtle');
    }

    getInfo() {
        return {
            name: this.name,
            level: this.level,
            damage: Math.floor(this.currentStats.damage),
            cooldown: this.currentStats.cooldown.toFixed(1),
            projectiles: Math.floor(this.currentStats.projectiles),
            throwDistance: this.throwDistance,
            returnPiercing: this.returnPiercing,
            activeBoomerangs: this.activeBoomerangs.length,
            description: this.description
        };
    }

    static deserialize(game, player, data) {
        const weapon = new BoneBoomerang(game, player);
        weapon.level = data.level || 1;
        weapon.enabled = data.enabled !== false;
        weapon.updateStats();

        for (let i = 2; i <= weapon.level; i++) {
            weapon.level = i;
            weapon.onUpgrade();
        }

        return weapon;
    }
}
