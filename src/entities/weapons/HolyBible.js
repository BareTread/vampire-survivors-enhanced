import { BaseWeapon } from './BaseWeapon.js';

/**
 * Holy Bible / Orbiter — Weapon #6
 *
 * Glowing crosses orbit the player in a circle, damaging and knocking back
 * enemies on contact.  Direct-damage weapon (like GarlicAura) — no
 * projectiles, queries EnemySystem directly each tick.
 *
 * 8-level progression: more orbiters, faster orbit, larger radius,
 * bigger crosses, knockback, trail particles, double knockback.
 */
export class HolyBible extends BaseWeapon {
    constructor(game, player, config = {}) {
        const weaponConfig = {
            id: 'holy_bible',
            name: 'Holy Bible',
            description: 'Orbiting crosses that circle the player, damaging enemies on contact',
            type: 'orbital',
            damage: 8,
            cooldown: 0.25,          // damage tick rate (how often each orbiter can hit)
            range: 60,               // orbit radius
            speed: 2.0,              // radians per second
            duration: Infinity,
            projectiles: 1,          // orbiter count
            piercing: 0,
            color: '#FFD700',
            size: 10,                // orbiter collision/visual radius
            autoTarget: false,
            targetingRange: 0,
            canEvolve: true,
            maxLevel: 8,
            ...config
        };

        super(game, player, weaponConfig);

        // Orbital state
        this.orbitAngle = 0;                     // current rotation (radians)
        this.orbiterCount = 1;
        this.orbitRadius = 60;
        this.orbitSpeed = 2.0;                   // rad/s
        this.orbiterSize = 10;
        this.knockbackForce = 0;
        this.showTrail = false;
        this.showHitGlow = false;
        this.sizeMultiplier = 1.0;

        // Per-orbiter hit cooldown: Map<enemyId, lastHitTime>  per orbiter
        this.hitCooldowns = new Map();
        this.hitCooldownDuration = 0.5;          // seconds between hits on same enemy

        // Visual trail history (ring of recent positions per orbiter)
        this.trailHistory = [];                   // [ [{x,y,alpha}, ...], ... ] per orbiter
        this.maxTrailLength = 8;

        // Pulse animation
        this.pulsePhase = 0;

        // Level progression
        this.levelProgression = {
            1: { damage: 8, orbiterCount: 1, orbitRadius: 60, orbitSpeed: 2.0, orbiterSize: 10, knockback: 0, trail: false, hitGlow: false, sizeMult: 1.0 },
            2: { damage: 10, orbiterCount: 1, orbitRadius: 65, orbitSpeed: 2.2, orbiterSize: 11, knockback: 0, trail: false, hitGlow: false, sizeMult: 1.0 },
            3: { damage: 12, orbiterCount: 2, orbitRadius: 70, orbitSpeed: 2.4, orbiterSize: 12, knockback: 0, trail: false, hitGlow: false, sizeMult: 1.0 },
            4: { damage: 15, orbiterCount: 2, orbitRadius: 80, orbitSpeed: 2.6, orbiterSize: 13, knockback: 80, trail: false, hitGlow: false, sizeMult: 1.0 },
            5: { damage: 18, orbiterCount: 3, orbitRadius: 90, orbitSpeed: 2.8, orbiterSize: 14, knockback: 100, trail: false, hitGlow: false, sizeMult: 1.0 },
            6: { damage: 22, orbiterCount: 3, orbitRadius: 100, orbitSpeed: 3.0, orbiterSize: 15, knockback: 120, trail: true, hitGlow: false, sizeMult: 1.0 },
            7: { damage: 26, orbiterCount: 4, orbitRadius: 110, orbitSpeed: 3.2, orbiterSize: 16, knockback: 140, trail: true, hitGlow: true, sizeMult: 1.0 },
            8: { damage: 35, orbiterCount: 4, orbitRadius: 120, orbitSpeed: 3.5, orbiterSize: 18, knockback: 200, trail: true, hitGlow: true, sizeMult: 1.5 },
        };
    }

    // ── Overrides ────────────────────────────────────────────────

    /**
     * shouldFire() — always true if cooldown elapsed (passive weapon, no
     * target-proximity check needed).
     */
    shouldFire() {
        if (this.cooldownTimer > 0) return false;
        return true;
    }

    /**
     * onFire() — tick damage for each orbiter against nearby enemies.
     */
    onFire() {
        const now = this.game.gameTime;
        const positions = this._getOrbiterPositions();

        let totalHits = 0;

        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            const hitRadius = this.orbiterSize * this.sizeMultiplier * (this.player.stats?.area || 1);

            // Query enemies near this orbiter
            const enemies = this.game.systems.enemy.getEnemiesInRange(
                pos.x, pos.y, hitRadius + 20  // small padding for edge cases
            );

            for (const enemy of enemies) {
                if (!enemy || !enemy.active) continue;

                // Distance check
                const dx = enemy.x - pos.x;
                const dy = enemy.y - pos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const combinedRadius = hitRadius + (enemy.size || 10);
                if (dist > combinedRadius) continue;

                // Per-enemy hit cooldown
                const key = `${i}_${enemy.id || enemy.x}`;
                const lastHit = this.hitCooldowns.get(key) || 0;
                if (now - lastHit < this.hitCooldownDuration) continue;
                this.hitCooldowns.set(key, now);

                // Calculate damage
                const damage = this.getEffectiveDamage();
                const isCrit = this.game.systems.rewards?.rollForCritical?.() || false;
                const finalDamage = isCrit ? damage * 2 : damage;

                enemy.takeDamage(finalDamage, this.player);
                totalHits++;

                // Knockback
                if (this.knockbackForce > 0 && dist > 0) {
                    const kbX = (dx / dist) * this.knockbackForce;
                    const kbY = (dy / dist) * this.knockbackForce;
                    if (typeof enemy.applyKnockback === 'function') {
                        enemy.applyKnockback(kbX, kbY);
                    } else {
                        enemy.x += kbX * 0.02;
                        enemy.y += kbY * 0.02;
                    }
                }

                // Hit effects
                this.onHitEnemy(enemy, finalDamage, isCrit);

                // Hit glow particle
                if (this.showHitGlow && this.game.systems.particle) {
                    this.game.systems.particle.create(enemy.x, enemy.y, {
                        vx: (Math.random() - 0.5) * 40,
                        vy: (Math.random() - 0.5) * 40,
                        life: 0.3,
                        size: 6,
                        color: '#FFFFAA',
                        glow: true,
                        fadeOut: true
                    });
                }
            }
        }

        // Treasure chest damage — orbiters can hit the chest
        const chest = this.game.systems.dynamicEvents?.activeChest;
        if (chest && chest.health > 0) {
            for (const pos of positions) {
                const hitRadius = this.orbiterSize * this.sizeMultiplier * (this.player.stats?.area || 1);
                const cdx = chest.x - pos.x;
                const cdy = chest.y - pos.y;
                if (Math.sqrt(cdx * cdx + cdy * cdy) <= hitRadius + 20) {
                    chest.health -= this.getEffectiveDamage();
                    totalHits++;
                    break; // One orbiter hit per tick is enough
                }
            }
        }

        // Play orbiter whoosh sound (throttled — only if at least one hit)
        if (totalHits > 0) {
            this.playOrbiterHitSound(totalHits);
        }

        // Prune stale cooldown entries every ~2 seconds
        if (Math.random() < 0.03) {
            for (const [key, time] of this.hitCooldowns) {
                if (now - time > 2.0) this.hitCooldowns.delete(key);
            }
        }
    }

    // ── Update ───────────────────────────────────────────────────

    update(dt) {
        super.update(dt);

        // Advance orbit angle
        this.orbitAngle += this.orbitSpeed * dt;
        if (this.orbitAngle > Math.PI * 200) this.orbitAngle -= Math.PI * 200;  // prevent float overflow

        // Pulse animation
        this.pulsePhase += dt * 4;

        // Maintain trail history
        if (this.showTrail) {
            const positions = this._getOrbiterPositions();
            // Ensure trail arrays exist for each orbiter
            while (this.trailHistory.length < this.orbiterCount) {
                this.trailHistory.push([]);
            }
            for (let i = 0; i < this.orbiterCount; i++) {
                const trail = this.trailHistory[i];
                if (!trail) continue;
                trail.push({ x: positions[i].x, y: positions[i].y, alpha: 1.0 });
                while (trail.length > this.maxTrailLength) trail.shift();
                // Decay alpha
                for (let j = 0; j < trail.length; j++) {
                    trail[j].alpha = (j + 1) / trail.length;
                }
            }
        }
    }

    // ── Rendering ────────────────────────────────────────────────

    render(renderer) {
        const ctx = renderer.ctx;
        const positions = this._getOrbiterPositions();
        const area = this.player.stats?.area || 1;
        const effectiveSize = this.orbiterSize * this.sizeMultiplier * area;
        const pulse = 0.85 + Math.sin(this.pulsePhase) * 0.15;

        ctx.save();

        // Draw orbit ring (subtle guide line)
        const effectiveRadius = this.orbitRadius * area;
        ctx.beginPath();
        ctx.arc(this.player.x, this.player.y, effectiveRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw trails
        if (this.showTrail) {
            for (let i = 0; i < Math.min(this.trailHistory.length, this.orbiterCount); i++) {
                const trail = this.trailHistory[i];
                if (!trail || trail.length < 2) continue;
                ctx.beginPath();
                ctx.moveTo(trail[0].x, trail[0].y);
                for (let j = 1; j < trail.length; j++) {
                    ctx.lineTo(trail[j].x, trail[j].y);
                }
                ctx.strokeStyle = 'rgba(255, 215, 0, 0.15)';
                ctx.lineWidth = effectiveSize * 0.4;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
        }

        // Draw each orbiter as a glowing cross
        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            const s = effectiveSize * pulse;

            // Glow
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, s * 1.8, 0, Math.PI * 2);
            const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, s * 1.8);
            glow.addColorStop(0, 'rgba(255, 255, 200, 0.6)');
            glow.addColorStop(0.5, 'rgba(255, 215, 0, 0.2)');
            glow.addColorStop(1, 'rgba(255, 215, 0, 0)');
            ctx.fillStyle = glow;
            ctx.fill();

            // Cross shape
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = this.color;
            const armW = s * 0.3;
            const armH = s;

            // Rotate the cross to match orbit angle
            const crossAngle = this.orbitAngle + (i / this.orbiterCount) * Math.PI * 2;
            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.rotate(crossAngle);

            // Vertical arm
            ctx.fillRect(-armW / 2, -armH, armW, armH * 2);
            // Horizontal arm
            ctx.fillRect(-armH, -armW / 2, armH * 2, armW);

            // Small center glow
            ctx.beginPath();
            ctx.arc(0, 0, armW * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.globalAlpha = 0.7;
            ctx.fill();

            ctx.restore();
        }

        ctx.restore();
    }

    // ── Helpers ──────────────────────────────────────────────────

    /**
     * Compute world positions of all orbiters.
     */
    _getOrbiterPositions() {
        const area = this.player.stats?.area || 1;
        const r = this.orbitRadius * area;
        const positions = [];
        for (let i = 0; i < this.orbiterCount; i++) {
            const angle = this.orbitAngle + (i / this.orbiterCount) * Math.PI * 2;
            positions.push({
                x: this.player.x + Math.cos(angle) * r,
                y: this.player.y + Math.sin(angle) * r
            });
        }
        return positions;
    }

    playOrbiterHitSound(hitCount) {
        if (!this.game.audioManager) return;
        const volume = Math.min(0.7, 0.3 + hitCount * 0.05);
        this.game.audioManager.playVampireSound('orbiterHit', volume, 1.0 + Math.random() * 0.1);
    }

    // ── Skip muzzle flash / screen shake (passive weapon) ───────
    createFireEffects() {
        // Intentionally empty — orbiters are passive; no muzzle flash.
    }

    // ── Upgrades ─────────────────────────────────────────────────

    onUpgrade() {
        const stats = this.levelProgression[this.level];
        if (!stats) return;

        this.baseStats.damage = stats.damage;
        this.orbiterCount = stats.orbiterCount;
        this.orbitRadius = stats.orbitRadius;
        this.orbitSpeed = stats.orbitSpeed;
        this.orbiterSize = stats.orbiterSize;
        this.knockbackForce = stats.knockback;
        this.showTrail = stats.trail;
        this.showHitGlow = stats.hitGlow;
        this.sizeMultiplier = stats.sizeMult;
        this.updateStats();

        // Reset trail arrays on orbiter count change
        this.trailHistory = [];

        // Level-specific flavour
        switch (this.level) {
            case 3:
                this.description = 'Orbiting crosses — 2 orbiters';
                break;
            case 4:
                this.description = 'Orbiting crosses — knockback';
                break;
            case 5:
                this.description = 'Orbiting crosses — 3 orbiters';
                break;
            case 6:
                this.description = 'Orbiting crosses — trailing light';
                break;
            case 7:
                this.description = 'Orbiting crosses — 4 orbiters, hit glow';
                break;
            case 8:
                this.description = 'Orbiting crosses — MAXIMUM DIVINE POWER';
                break;
        }
    }

    // ── BaseWeapon overrides ─────────────────────────────────────

    getSoundName() {
        return 'orbiterWhoosh';
    }

    getMuzzleFlashColor() {
        return '#FFD700';
    }

    getSoundPitch() {
        return 1.0 + (this.level - 1) * 0.03;
    }

    getInfo() {
        return {
            name: this.name,
            level: this.level,
            damage: Math.floor(this.getEffectiveDamage()),
            orbiters: this.orbiterCount,
            radius: Math.floor(this.orbitRadius * (this.player.stats?.area || 1)),
            speed: this.orbitSpeed.toFixed(1) + ' rad/s',
            description: this.description
        };
    }

    static deserialize(game, player, data) {
        const weapon = new HolyBible(game, player);
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
