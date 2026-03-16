/**
 * Shadow Dagger — Weapon #10: high-risk / high-reward single-target assassin
 *
 * Teleports a shadow blade to the nearest enemy with a brief visual telegraph,
 * then deals massive burst damage. At higher levels applies Bleed and chains
 * through additional targets. Rewards aggressive, close-quarters play.
 *
 * Level progression:
 *   1–3: single target, no bleed
 *   4–6: bleed on hit, slightly faster
 *   7–8: chains to 2 additional enemies
 *
 * Evolution: Phantom Assassin (+ Wings) — daggers chain through 5 enemies,
 *            each hit spawns a shadow clone that orbits and strikes
 * Synergy:   Shadow Dagger + Spinach → "Death Mark" — +30% damage vs bleeding enemies
 */
import { BaseWeapon } from './BaseWeapon.js';

export class ShadowDagger extends BaseWeapon {
    constructor(game, player, config = {}) {
        const weaponConfig = {
            id:            'shadow_dagger',
            name:          'Shadow Dagger',
            description:   'Teleports a shadow blade to the nearest enemy for massive burst damage',
            type:          'melee',
            damage:        28,
            cooldown:      1.8,
            range:         280,
            speed:         0,         // unused for melee
            duration:      0.25,      // telegraph duration
            projectiles:   1,
            piercing:      0,
            color:         '#8B5CF6',
            size:          8,
            autoTarget:    true,
            targetingRange: 280,
            canEvolve:     true,
            maxLevel:      8,
            ...config
        };
        super(game, player, weaponConfig);

        this.bleedChance    = 0;      // unlocked at L4
        this.bleedDuration  = 3.0;
        this.chainCount     = 0;      // extra targets after primary hit (L7+)
        this.telegraphTime  = 0.25;   // seconds before strike lands
        this.pendingStrikes = [];     // { target, timer, damage, isCrit }

        this.levelProgression = {
            1: { damage: 28, cooldown: 1.8, bleedChance: 0.00, chainCount: 0 },
            2: { damage: 35, cooldown: 1.7, bleedChance: 0.00, chainCount: 0 },
            3: { damage: 43, cooldown: 1.6, bleedChance: 0.00, chainCount: 0 },
            4: { damage: 54, cooldown: 1.5, bleedChance: 0.30, chainCount: 0 },
            5: { damage: 67, cooldown: 1.4, bleedChance: 0.40, chainCount: 0 },
            6: { damage: 84, cooldown: 1.3, bleedChance: 0.50, chainCount: 0 },
            7: { damage: 105, cooldown: 1.2, bleedChance: 0.60, chainCount: 1 },
            8: { damage: 132, cooldown: 1.0, bleedChance: 0.70, chainCount: 2 }
        };
    }

    onFire() {
        const target = this.findTarget();
        if (!target) return;

        const baseDmg   = this.currentStats.damage;
        const isCrit    = Math.random() < 0.15;
        const damage    = isCrit ? baseDmg * 2 : baseDmg;

        // Show telegraph at target position
        this._showTelegraph(target.x, target.y);

        // Queue the strike with a short delay
        this.pendingStrikes.push({ target, timer: this.telegraphTime, damage, isCrit });
    }

    update(dt) {
        // Run BaseWeapon update (cooldown + auto-fire)
        super.update(dt);

        // Resolve pending strikes
        for (let i = this.pendingStrikes.length - 1; i >= 0; i--) {
            const strike = this.pendingStrikes[i];
            strike.timer -= dt;

            if (strike.timer <= 0) {
                this._resolveStrike(strike);
                this.pendingStrikes.splice(i, 1);
            }
        }
    }

    _resolveStrike(strike) {
        const { target, damage, isCrit } = strike;
        if (!target.active || target._deathProcessed) return;

        // Primary hit
        this._hitTarget(target, damage, isCrit);

        // Chain hits — queue as pending strikes with short staggered timers
        if (this.chainCount > 0) {
            const chainTargets = this.game.systems.enemy
                .getEnemiesInRange(target.x, target.y, 180)
                .filter(e => e !== target && e.active && !e._deathProcessed)
                .slice(0, this.chainCount);

            for (let ci = 0; ci < chainTargets.length; ci++) {
                const ct = chainTargets[ci];
                this._showTelegraph(ct.x, ct.y);
                this.pendingStrikes.push({
                    target:  ct,
                    timer:   0.08 + ci * 0.05, // stagger: 80 ms, 130 ms, …
                    damage:  damage * 0.65,
                    isCrit:  false
                });
            }
        }
    }

    _hitTarget(enemy, damage, isCrit) {
        if (!enemy.active || enemy._deathProcessed) return;

        const se = this.game.systems.statusEffect;

        // Death Mark synergy: +30% damage to bleeding enemies
        const deathMarkBoost = (this._synergyDeathMark && se && se.hasStatusEffect(enemy, 'bleed'))
            ? 1.30
            : 1.00;

        // Apply damage
        const applied = this.calculateDamageWithPsychology();
        const base = isCrit ? applied.damage * 2 : applied.damage;
        enemy.takeDamage(base * deathMarkBoost, this, isCrit);

        // Bleed
        if (se && Math.random() < this.bleedChance) {
            se.applyStatusEffect(enemy, 'bleed', {
                duration: this.bleedDuration,
                damagePerSecond: Math.ceil(damage * 0.08),
                source: this
            });
        }

        // VFX at enemy position
        this._spawnStrikeParticles(enemy.x, enemy.y, isCrit);

        if (isCrit && this.game.systems.particle) {
            this.game.systems.particle.createCriticalEffect(enemy.x, enemy.y, '#8B5CF6');
        }

        if (this.game.camera) this.game.camera.shake(isCrit ? 5 : 3, 0.15);
    }

    _showTelegraph(x, y) {
        const ps = this.game.systems.particle;
        if (!ps) return;
        // Converging shadow motes
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const dist  = 40 + Math.random() * 30;
            ps.create(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, {
                vx: -Math.cos(angle) * 120,
                vy: -Math.sin(angle) * 120,
                life: this.telegraphTime,
                size: 3 + Math.random() * 2,
                color: '#8B5CF6',
                fadeOut: true,
                glow:  false
            });
        }
    }

    _spawnStrikeParticles(x, y, isCrit) {
        const ps = this.game.systems.particle;
        if (!ps) return;
        const count = isCrit ? 18 : 10;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const speed = (isCrit ? 120 : 80) + Math.random() * 60;
            ps.create(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.35 + Math.random() * 0.2,
                size: 2 + Math.random() * (isCrit ? 4 : 2),
                color: isCrit ? '#CC99FF' : '#8B5CF6',
                fadeOut: true
            });
        }
    }

    onUpgrade() {
        const lvl = this.levelProgression[this.level];
        if (!lvl) return;
        this.baseStats.damage = lvl.damage;
        this.baseStats.cooldown = lvl.cooldown;
        this.bleedChance  = lvl.bleedChance;
        this.chainCount   = lvl.chainCount;
        this.updateStats();
    }

    /** Render evolved shadow aura */
    render(renderer) {
        if (!this.evolved) return;
        const ctx = renderer.ctx || renderer;
        const p   = this.player;
        const now = performance.now() * 0.001;

        // Orbiting shadow wisps
        ctx.save();
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < 3; i++) {
            const angle = now * 2.5 + (i / 3) * Math.PI * 2;
            const r     = 45;
            const wx    = p.x + Math.cos(angle) * r;
            const wy    = p.y + Math.sin(angle) * r;
            ctx.shadowColor = '#8B5CF6';
            ctx.shadowBlur  = 10;
            ctx.fillStyle   = '#8B5CF6';
            ctx.beginPath();
            ctx.arc(wx, wy, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}
