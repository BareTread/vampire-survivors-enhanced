import { BaseWeapon } from './BaseWeapon.js';

export class FireWand extends BaseWeapon {
    constructor(game, player, config = {}) {
        const weaponConfig = {
            id: 'fire_wand',
            name: 'Fire Wand',
            description: 'Launches fireballs that explode on impact, leaving burning ground',
            type: 'fireball',
            damage: 12,
            cooldown: 1.6,
            range: 280,
            speed: 220,
            duration: 3.0,
            projectiles: 1,
            piercing: 0,
            color: '#FF6600',
            size: 8,
            autoTarget: true,
            targetingRange: 280,
            canEvolve: true,
            maxLevel: 8,
            ...config
        };

        super(game, player, weaponConfig);

        // Fire Wand-specific properties
        this.explosionRadius = 40;
        this.burnDuration = 2.0; // seconds ground zone persists
        this.burnDamagePerTick = 3; // per 0.5s tick
        this.burnTickRate = 0.5;
        this.maxBurnZones = 3; // capped burn zones on the field

        // Active burn zones: { x, y, radius, timer, tickTimer, damage }
        this.burnZones = [];

        // Visual state
        this.burnZoneFlicker = 0;

        // Level progression
        this.levelProgression = {
            1: {
                damage: 12,
                cooldown: 1.6,
                projectiles: 1,
                explosionRadius: 40,
                burnDuration: 2.0,
                burnDps: 3,
                maxZones: 3
            },
            2: {
                damage: 15,
                cooldown: 1.5,
                projectiles: 1,
                explosionRadius: 45,
                burnDuration: 2.5,
                burnDps: 4,
                maxZones: 3
            },
            3: {
                damage: 18,
                cooldown: 1.4,
                projectiles: 1,
                explosionRadius: 55,
                burnDuration: 3.0,
                burnDps: 5,
                maxZones: 4
            },
            4: {
                damage: 22,
                cooldown: 1.3,
                projectiles: 2,
                explosionRadius: 60,
                burnDuration: 3.0,
                burnDps: 6,
                maxZones: 4
            },
            5: {
                damage: 26,
                cooldown: 1.2,
                projectiles: 2,
                explosionRadius: 70,
                burnDuration: 3.5,
                burnDps: 7,
                maxZones: 5
            },
            6: {
                damage: 30,
                cooldown: 1.0,
                projectiles: 2,
                explosionRadius: 80,
                burnDuration: 4.0,
                burnDps: 9,
                maxZones: 6
            },
            7: {
                damage: 36,
                cooldown: 0.9,
                projectiles: 3,
                explosionRadius: 90,
                burnDuration: 4.5,
                burnDps: 11,
                maxZones: 7
            },
            8: {
                damage: 45,
                cooldown: 0.7,
                projectiles: 3,
                explosionRadius: 110,
                burnDuration: 5.0,
                burnDps: 15,
                maxZones: 8
            }
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
                // Add spread for multiple fireballs
                if (projectileCount > 1) {
                    const spread = (i - (projectileCount - 1) / 2) * 0.25;
                    angle += spread;
                }
            } else {
                const baseAngle = this.player.direction || 0;
                if (projectileCount > 1) {
                    const spread = (i - (projectileCount - 1) / 2) * 0.3;
                    angle = baseAngle + spread;
                } else {
                    angle = baseAngle;
                }
            }

            this.launchFireball(angle);
        }

        // Sound
        this.playFireballSound();
    }

    launchFireball(angle) {
        const spawnDist = 14;
        const sx = this.player.x + Math.cos(angle) * spawnDist;
        const sy = this.player.y + Math.sin(angle) * spawnDist;

        const projectile = this.createProjectile(sx, sy, angle, {
            type: 'fireball',
            damage: this.getEffectiveDamage(),
            speed: this.currentStats.speed,
            size: this.size * 1.2,
            color: '#FF6600',
            piercing: 0,
            lifetime: this.currentStats.duration,
            explosionRadius: this.explosionRadius,
            onHit: (proj, enemy) => this.onFireballHit(proj, enemy),
            onExpire: (proj) => this.onFireballExpire(proj)
        });

        // Attach explosion callback data to projectile
        if (projectile) {
            projectile._fireWandOwner = this;
            projectile._hasExploded = false;

            // Override the hit handler to trigger explosion
            const origOnHitEnemy = projectile.onHitEnemy;
            projectile.onHitEnemy = (enemy, damage, critical) => {
                if (!projectile._hasExploded) {
                    projectile._hasExploded = true;
                    this.triggerExplosion(projectile.x, projectile.y);
                }
                if (origOnHitEnemy) origOnHitEnemy.call(projectile, enemy, damage, critical);
            };
        }
    }

    /**
     * Trigger explosion at the fireball impact point.
     * Deals AoE damage and creates a burn zone.
     */
    triggerExplosion(x, y) {
        const radius = this.explosionRadius * (this.player.stats ? this.player.stats.area : 1.0);

        // AoE explosion damage to all enemies in radius
        const enemies = this.game.systems.enemy.getEnemiesInRange(x, y, radius);
        const explosionDamage = Math.round(this.getEffectiveDamage() * 0.6);

        for (const enemy of enemies) {
            if (!enemy.active) continue;
            if (typeof enemy.takeDamage === 'function') {
                enemy.takeDamage(explosionDamage, this.player);
            }

            // Knockback from explosion center
            const dx = enemy.x - x;
            const dy = enemy.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const knockbackStrength = 60 * (1 - dist / radius);
            if (knockbackStrength > 0) {
                enemy.x += (dx / dist) * knockbackStrength * 0.15;
                enemy.y += (dy / dist) * knockbackStrength * 0.15;
            }
        }

        // Explosion particles
        this.createExplosionParticles(x, y, radius);

        // Camera shake for explosion
        this.game.camera.shake(4 + this.level * 0.5, 0.15, 'normal');

        // Create burn zone
        this.createBurnZone(x, y, radius);

        // Explosion sound
        if (this.game.audioManager) {
            this.game.audioManager.playVampireSound('fireballExplosion', 0.4, 0.9 + this.level * 0.02);
        }
    }

    createBurnZone(x, y, radius) {
        // Enforce max burn zones
        while (this.burnZones.length >= this.maxBurnZones) {
            this.burnZones.shift(); // Remove oldest
        }

        this.burnZones.push({
            x: x,
            y: y,
            radius: radius * 0.8, // Burn zone slightly smaller than explosion
            timer: this.burnDuration,
            tickTimer: 0,
            damage: this.burnDamagePerTick,
            maxTimer: this.burnDuration
        });
    }

    /**
     * Override update to also tick burn zones.
     */
    update(dt) {
        super.update(dt);

        this.burnZoneFlicker += dt * 8;

        // Update burn zones
        for (let i = this.burnZones.length - 1; i >= 0; i--) {
            const zone = this.burnZones[i];
            zone.timer -= dt;
            zone.tickTimer -= dt;

            if (zone.timer <= 0) {
                this.burnZones.splice(i, 1);
                continue;
            }

            // Tick damage
            if (zone.tickTimer <= 0) {
                zone.tickTimer = this.burnTickRate;
                this.applyBurnZoneDamage(zone);
            }
        }
    }

    applyBurnZoneDamage(zone) {
        const enemies = this.game.systems.enemy.getEnemiesInRange(zone.x, zone.y, zone.radius);
        if (enemies.length === 0) return;

        for (const enemy of enemies) {
            if (!enemy.active) continue;

            if (typeof enemy.takeDamage === 'function') {
                enemy.takeDamage(zone.damage, this.player);
            }

            // Apply burn DoT via StatusEffectSystem if available
            if (this.game.systems.statusEffect) {
                this.game.systems.statusEffect.applyEffect(enemy, {
                    type: 'dot',
                    value: zone.damage * 0.5,
                    duration: this.burnTickRate + 0.1,
                    source: 'fire_wand_burn'
                });
            }
        }
    }

    // --- Visual rendering ---

    render(renderer) {
        const ctx = renderer.ctx;

        // Render burn zones
        for (const zone of this.burnZones) {
            this.renderBurnZone(ctx, zone);
        }
    }

    renderBurnZone(ctx, zone) {
        const fadeRatio = Math.min(1, zone.timer / (zone.maxTimer * 0.3)); // Fade out in last 30%
        const alpha = Math.min(1, zone.timer / zone.maxTimer) * fadeRatio;

        ctx.save();

        // Flickering intensity
        const flicker1 = 0.7 + Math.sin(this.burnZoneFlicker + zone.x * 0.1) * 0.15;
        const flicker2 = 0.8 + Math.cos(this.burnZoneFlicker * 1.3 + zone.y * 0.1) * 0.1;
        const flickerAlpha = alpha * flicker1 * flicker2;

        // Outer glow
        const gradient = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, zone.radius);
        gradient.addColorStop(0, `rgba(255, 100, 0, ${flickerAlpha * 0.25})`);
        gradient.addColorStop(0.4, `rgba(255, 60, 0, ${flickerAlpha * 0.18})`);
        gradient.addColorStop(0.7, `rgba(200, 30, 0, ${flickerAlpha * 0.1})`);
        gradient.addColorStop(1.0, `rgba(100, 10, 0, 0)`);

        ctx.beginPath();
        ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Inner bright core (flickering)
        const coreRadius = zone.radius * 0.3;
        const coreGrad = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, coreRadius);
        coreGrad.addColorStop(0, `rgba(255, 220, 100, ${flickerAlpha * 0.35})`);
        coreGrad.addColorStop(0.5, `rgba(255, 150, 30, ${flickerAlpha * 0.2})`);
        coreGrad.addColorStop(1, `rgba(255, 80, 0, 0)`);

        ctx.beginPath();
        ctx.arc(zone.x, zone.y, coreRadius, 0, Math.PI * 2);
        ctx.fillStyle = coreGrad;
        ctx.fill();

        // Edge ring
        ctx.beginPath();
        ctx.arc(zone.x, zone.y, zone.radius * 0.85, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 80, 0, ${flickerAlpha * 0.4})`;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#FF4400';
        ctx.shadowBlur = 6 * flickerAlpha;
        ctx.stroke();

        // Ember particles (small bright dots along edge)
        const emberCount = 4;
        for (let i = 0; i < emberCount; i++) {
            const emberAngle = (i / emberCount) * Math.PI * 2 + this.burnZoneFlicker * 0.3;
            const emberDist = zone.radius * (0.5 + Math.sin(this.burnZoneFlicker * 2 + i * 1.5) * 0.35);
            const ex = zone.x + Math.cos(emberAngle) * emberDist;
            const ey = zone.y + Math.sin(emberAngle) * emberDist;
            const emberSize = 1.5 + Math.sin(this.burnZoneFlicker * 3 + i) * 0.8;

            ctx.beginPath();
            ctx.arc(ex, ey, emberSize, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 200, 50, ${flickerAlpha * 0.7})`;
            ctx.shadowColor = '#FFAA00';
            ctx.shadowBlur = 4;
            ctx.fill();
        }

        ctx.restore();
    }

    createExplosionParticles(x, y, radius) {
        if (!this.game.systems.particle) return;

        // Burst of fire particles
        const count = 8 + Math.floor(this.level * 1.5);
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 120;
            const dist = Math.random() * radius * 0.3;

            this.game.systems.particle.create(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 20, // Slight upward bias
                life: 0.3 + Math.random() * 0.4,
                size: 3 + Math.random() * 4,
                color: Math.random() > 0.3 ? '#FF6600' : Math.random() > 0.5 ? '#FFAA00' : '#FF3300',
                glow: true,
                fadeOut: true,
                ay: -30 // Float upward
            });
        }

        // Central flash
        this.game.systems.particle.create(x, y, {
            vx: 0,
            vy: 0,
            life: 0.2,
            size: radius * 0.4,
            color: '#FFFFFF',
            glow: true,
            fadeOut: true
        });
    }

    // --- Audio ---

    playFireballSound() {
        if (!this.game.audioManager) return;
        this.game.audioManager.playVampireSound('fireballLaunch', 0.6, 1.0 + (this.level - 1) * 0.03);
    }

    // --- Upgrades ---

    onUpgrade() {
        const levelStats = this.levelProgression[this.level];
        if (levelStats) {
            this.baseStats.damage = levelStats.damage;
            this.baseStats.cooldown = levelStats.cooldown;
            this.baseStats.projectiles = levelStats.projectiles;
            this.explosionRadius = levelStats.explosionRadius;
            this.burnDuration = levelStats.burnDuration;
            this.burnDamagePerTick = levelStats.burnDps;
            this.maxBurnZones = levelStats.maxZones;
            this.updateStats();
        }

        switch (this.level) {
            case 3:
                this.description = 'Larger explosions, longer burn';
                break;
            case 4:
                this.description = 'Launches 2 fireballs';
                break;
            case 6:
                this.description = 'Massive burn zones';
                break;
            case 8:
                this.description = 'Inferno — 3 fireballs, devastating burns';
                break;
        }
    }

    // --- Overrides ---

    getSoundName() {
        return 'fireballLaunch';
    }

    getMuzzleFlashColor() {
        return '#FF6600';
    }

    getSoundPitch() {
        return 0.9 + (this.level - 1) * 0.03;
    }

    /**
     * Override fire effects — the explosion handles screen shake, so
     * we only want a subtle launch shake, not the full weapon-fire shake.
     */
    createFireEffects() {
        this.playEnhancedFireSound();
        // Light muzzle flash without heavy screen shake
        if (this.game.systems.particle) {
            const angle = this.getFireAngle();
            const dist = 16;
            const fx = this.player.x + Math.cos(angle) * dist;
            const fy = this.player.y + Math.sin(angle) * dist;

            for (let i = 0; i < 3; i++) {
                this.game.systems.particle.create(fx, fy, {
                    vx: Math.cos(angle) * (40 + Math.random() * 40) + (Math.random() - 0.5) * 30,
                    vy: Math.sin(angle) * (40 + Math.random() * 40) + (Math.random() - 0.5) * 30,
                    life: 0.2 + Math.random() * 0.15,
                    size: 3 + Math.random() * 3,
                    color: Math.random() > 0.5 ? '#FFAA00' : '#FF6600',
                    glow: true,
                    fadeOut: true
                });
            }
        }
    }

    /**
     * Called when fireball hits an enemy.
     */
    onFireballHit(projectile, enemy) {
        if (!projectile._hasExploded) {
            projectile._hasExploded = true;
            this.triggerExplosion(projectile.x, projectile.y);
        }
    }

    /**
     * Called when fireball expires without hitting anything — still explode.
     */
    onFireballExpire(projectile) {
        if (!projectile._hasExploded) {
            projectile._hasExploded = true;
            this.triggerExplosion(projectile.x, projectile.y);
        }
    }

    getInfo() {
        return {
            name: this.name,
            level: this.level,
            damage: Math.floor(this.currentStats.damage),
            cooldown: this.currentStats.cooldown.toFixed(1),
            projectiles: Math.floor(this.currentStats.projectiles),
            explosionRadius: this.explosionRadius,
            burnDuration: this.burnDuration.toFixed(1),
            burnDps: this.burnDamagePerTick,
            activeZones: this.burnZones.length,
            description: this.description
        };
    }

    static deserialize(game, player, data) {
        const weapon = new FireWand(game, player);
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
