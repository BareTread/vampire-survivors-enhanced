import { BaseWeapon } from './BaseWeapon.js';

export class GarlicAura extends BaseWeapon {
    constructor(game, player, config = {}) {
        const weaponConfig = {
            id: 'garlic_aura',
            name: 'Garlic Aura',
            description: 'Damages nearby enemies with a pulsing aura of garlic essence',
            type: 'aura',
            damage: 5,
            cooldown: 0.5,   // Tick rate — NOT weapon cooldown in the traditional sense
            range: 60,       // Aura radius
            speed: 0,
            duration: 0,
            projectiles: 0,
            piercing: 0,
            color: '#7CFC00',
            size: 60,
            autoTarget: true,
            targetingRange: 60,
            canEvolve: true,
            maxLevel: 8,
            ...config
        };

        super(game, player, weaponConfig);

        // Aura-specific properties
        this.auraRadius = 60;
        this.tickRate = 0.5;
        this.knockbackForce = 0;
        this.slowEffect = false;
        this.dotEffect = false;
        this.dotDamagePerSecond = 0;

        // Visual state
        this.pulsePhase = 0;      // 0 → 1 oscillation for pulsing ring
        this.lastDamageTime = 0;   // For visual damage flash
        this.hitFlashAlpha = 0;    // Brief flash when damage ticks

        // Level progression
        this.levelProgression = {
            1: { damage: 5, radius: 60, tickRate: 0.50 },
            2: { damage: 7, radius: 70, tickRate: 0.50 },
            3: { damage: 9, radius: 80, tickRate: 0.45 },
            4: { damage: 12, radius: 90, tickRate: 0.40, knockback: 80 },
            5: { damage: 15, radius: 105, tickRate: 0.35 },
            6: { damage: 18, radius: 120, tickRate: 0.30, slow: true },
            7: { damage: 22, radius: 140, tickRate: 0.25 },
            8: { damage: 30, radius: 160, tickRate: 0.20, dot: true, dotDps: 8 }
        };
    }

    /**
     * Override shouldFire — the aura fires on its tick rate whenever
     * the weapon is ready (no enemy proximity check needed; the aura
     * simply pulses).
     */
    shouldFire() {
        return true; // Always pulse when cooldown is ready
    }

    /**
     * The "fire" for Garlic Aura is a damage tick: hurt all enemies
     * inside the radius, apply knockback/slow/DoT as appropriate.
     */
    onFire() {
        const px = this.player.x;
        const py = this.player.y;
        const radius = this.getEffectiveRadius();

        const enemies = this.game.systems.enemy.getEnemiesInRange(px, py, radius);
        if (enemies.length === 0) return;

        const baseDamageResult = this.calculateDamageWithPsychology();
        const damage = Math.round(baseDamageResult.damage);

        let hitCount = 0;

        for (const enemy of enemies) {
            if (!enemy.active) continue;

            // Deal damage
            if (typeof enemy.takeDamage === 'function') {
                enemy.takeDamage(damage, this.player);
            }
            hitCount++;

            // Knockback
            if (this.knockbackForce > 0) {
                const dx = enemy.x - px;
                const dy = enemy.y - py;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const nx = dx / dist;
                const ny = dy / dist;
                enemy.x += nx * this.knockbackForce * 0.1;
                enemy.y += ny * this.knockbackForce * 0.1;
            }

            // Slow effect (via StatusEffectSystem if available)
            if (this.slowEffect && this.game.systems.statusEffect) {
                this.game.systems.statusEffect.applyEffect(enemy, {
                    type: 'slow',
                    value: 0.5,       // 50% slow
                    duration: 0.8,
                    source: 'garlic_aura'
                });
            }

            // DoT effect
            if (this.dotEffect && this.game.systems.statusEffect) {
                this.game.systems.statusEffect.applyEffect(enemy, {
                    type: 'dot',
                    value: this.dotDamagePerSecond,
                    duration: 1.5,
                    source: 'garlic_burn'
                });
            }

            // Compact hit feedback — just damage numbers, no full onHitEnemy
            // to avoid excessive particles at close range
            this.createAuraDamageNumber(enemy, damage, baseDamageResult.isCritical);

            // Notify systems
            if (enemy.health <= 0) {
                if (this.game.systems.flowState && this.game.systems.flowState.onEnemyKilled) {
                    this.game.systems.flowState.onEnemyKilled(enemy);
                }
                if (this.game.systems.achievement) {
                    this.game.systems.achievement.onEnemyKilled(enemy);
                }
            }
        }

        // Treasure chest damage (direct-damage weapon support)
        const chest = this.game.systems.dynamicEvents?.activeChest;
        if (chest && chest.health > 0) {
            const cdx = chest.x - px;
            const cdy = chest.y - py;
            const chestDist = Math.sqrt(cdx * cdx + cdy * cdy);
            if (chestDist <= radius + 20) {
                chest.health -= damage;
                hitCount++;
            }
        }

        // Audio feedback
        if (hitCount > 0) {
            this.playAuraPulseSound(hitCount);
            this.hitFlashAlpha = 0.6;  // Trigger visual flash
        }

        // Edge particle burst
        this.createPulseEdgeParticles(radius, hitCount);
    }

    getEffectiveRadius() {
        return this.auraRadius * (this.player.stats ? this.player.stats.area : 1.0);
    }

    getEffectiveCooldown() {
        // Tick rate is the "cooldown" for aura weapons
        const cdMultiplier = this.player.stats ? this.player.stats.cooldown : 1.0;
        return this.tickRate / cdMultiplier;
    }

    // --- Visual rendering ---

    update(dt) {
        super.update(dt);

        // Pulse animation
        this.pulsePhase = (this.pulsePhase + dt * 2.5) % (Math.PI * 2);

        // Decay hit flash
        if (this.hitFlashAlpha > 0) {
            this.hitFlashAlpha = Math.max(0, this.hitFlashAlpha - dt * 4);
        }
    }

    render(renderer) {
        const ctx = renderer.ctx;
        const px = this.player.x;
        const py = this.player.y;
        const radius = this.getEffectiveRadius();

        ctx.save();

        // Pulsing glow
        const pulseScale = 1.0 + Math.sin(this.pulsePhase) * 0.06;
        const r = radius * pulseScale;

        // Outer glow ring
        const gradient = ctx.createRadialGradient(px, py, r * 0.6, px, py, r);
        gradient.addColorStop(0, 'rgba(124, 252, 0, 0.0)');
        gradient.addColorStop(0.7, `rgba(124, 252, 0, ${0.04 + this.hitFlashAlpha * 0.15})`);
        gradient.addColorStop(1.0, `rgba(124, 252, 0, ${0.12 + this.hitFlashAlpha * 0.2})`);

        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Border ring
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(124, 252, 0, ${0.35 + this.hitFlashAlpha * 0.4})`;
        ctx.lineWidth = 1.5 + this.hitFlashAlpha * 2;
        ctx.shadowColor = '#7CFC00';
        ctx.shadowBlur = 8 + this.hitFlashAlpha * 12;
        ctx.stroke();

        // Inner dashed ring at 60% radius for visual depth
        ctx.beginPath();
        ctx.arc(px, py, r * 0.6, 0, Math.PI * 2);
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = `rgba(124, 252, 0, ${0.15 + this.hitFlashAlpha * 0.2})`;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        ctx.stroke();
        ctx.setLineDash([]);

        // Damage flash overlay (brief white flash when hitting)
        if (this.hitFlashAlpha > 0.1) {
            ctx.beginPath();
            ctx.arc(px, py, r * 0.95, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${this.hitFlashAlpha * 0.08})`;
            ctx.fill();
        }

        ctx.restore();
    }

    // --- Particles ---

    createPulseEdgeParticles(radius, hitCount) {
        if (!this.game.systems.particle) return;

        const count = Math.min(6, 2 + hitCount);
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const edgeX = this.player.x + Math.cos(angle) * radius;
            const edgeY = this.player.y + Math.sin(angle) * radius;
            const outSpeed = 20 + Math.random() * 30;

            this.game.systems.particle.create(edgeX, edgeY, {
                vx: Math.cos(angle) * outSpeed,
                vy: Math.sin(angle) * outSpeed,
                life: 0.4 + Math.random() * 0.3,
                size: 2 + Math.random() * 2,
                color: Math.random() > 0.4 ? '#7CFC00' : '#ADFF2F',
                glow: true,
                fadeOut: true
            });
        }
    }

    createAuraDamageNumber(enemy, damage, critical) {
        if (!this.game.systems.particle) return;

        const color = critical ? '#FF0000' : '#7CFC00';
        const size = critical ? 20 : 14;

        if (this.game.systems.particle.createEnhancedDamageNumber) {
            this.game.systems.particle.createEnhancedDamageNumber(
                enemy.x, enemy.y, damage, critical, color, size, 1.0
            );
        }
    }

    // --- Audio ---

    playAuraPulseSound(hitCount) {
        if (!this.game.audioManager) return;

        const vol = Math.min(0.6, 0.3 + hitCount * 0.03);
        const pitch = 0.9 + (this.level - 1) * 0.02 + Math.min(0.2, hitCount * 0.02);

        this.game.audioManager.playVampireSound('garlicPulse', vol, pitch);
    }

    // --- Upgrades ---

    onUpgrade() {
        const levelStats = this.levelProgression[this.level];
        if (levelStats) {
            this.baseStats.damage = levelStats.damage;
            this.auraRadius = levelStats.radius;
            this.tickRate = levelStats.tickRate;
            this.baseStats.cooldown = levelStats.tickRate;
            this.targetingRange = levelStats.radius;
            this.updateStats();

            if (levelStats.knockback !== undefined) {
                this.knockbackForce = levelStats.knockback;
            }
            if (levelStats.slow !== undefined) {
                this.slowEffect = levelStats.slow;
            }
            if (levelStats.dot !== undefined) {
                this.dotEffect = levelStats.dot;
                this.dotDamagePerSecond = levelStats.dotDps || 0;
            }
        }

        switch (this.level) {
            case 4:
                this.description = 'Pushes enemies back';
                break;
            case 6:
                this.description = 'Slows nearby enemies';
                break;
            case 8:
                this.description = 'Burns enemies on contact';
                break;
        }
    }

    // --- Overrides ---

    getSoundName() {
        return 'garlicPulse';
    }

    getMuzzleFlashColor() {
        return '#7CFC00';
    }

    getSoundPitch() {
        return 0.9 + (this.level - 1) * 0.03;
    }

    /**
     * Override createFireEffects to skip muzzle flash and screen shake —
     * the aura is passive; screen-shaking every tick would be awful.
     */
    createFireEffects() {
        // Intentionally empty — aura uses its own render() for visuals
    }

    getInfo() {
        return {
            name: this.name,
            level: this.level,
            damage: Math.floor(this.currentStats.damage),
            tickRate: this.tickRate.toFixed(2),
            radius: this.auraRadius,
            description: this.description
        };
    }

    static deserialize(game, player, data) {
        const weapon = new GarlicAura(game, player);
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
