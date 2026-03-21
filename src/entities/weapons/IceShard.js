/**
 * Ice Shard — Weapon #9: crowd-control specialist
 *
 * Fires slow-moving ice projectiles that apply Freeze on hit. At higher levels
 * a secondary AoE ice burst erupts at impact, spreading freeze to nearby enemies.
 *
 * Level progression:
 *   1–3: single slow ice shard, short freeze
 *   4–6: two shards, wider AoE, longer freeze
 *   7–8: three shards, strong slow, full freeze AoE burst
 *
 * Evolution: Blizzard (+ Empty Tome) — constant ice storm around player
 * Synergy:   Ice Shard + Armor → "Permafrost" — frozen enemies take +35% damage
 */
import { BaseWeapon } from './BaseWeapon.js';

export class IceShard extends BaseWeapon {
    constructor(game, player, config = {}) {
        const weaponConfig = {
            id:            'ice_shard',
            name:          'Ice Shard',
            description:   'Slow ice projectiles that freeze enemies on impact',
            type:          'projectile',
            damage:        14,
            cooldown:      1.5,
            range:         240,
            speed:         130,
            duration:      4.0,
            projectiles:   1,
            piercing:      0,
            color:         '#88DDFF',
            size:          7,
            autoTarget:    true,
            targetingRange: 240,
            canEvolve:     true,
            maxLevel:      8,
            ...config
        };
        super(game, player, weaponConfig);

        this.freezeDuration  = 1.5;   // seconds of freeze applied on hit
        this.aoeRadius       = 0;      // AoE freeze radius (px) — unlocked at L4
        this.aoeDamage       = 0;

        // Level progression
        this.levelProgression = {
            1: { damage: 14, cooldown: 1.5, projectiles: 1, freezeDuration: 1.5, aoeRadius:   0 },
            2: { damage: 17, cooldown: 1.4, projectiles: 1, freezeDuration: 1.8, aoeRadius:   0 },
            3: { damage: 20, cooldown: 1.3, projectiles: 1, freezeDuration: 2.0, aoeRadius:   0 },
            4: { damage: 25, cooldown: 1.2, projectiles: 2, freezeDuration: 2.2, aoeRadius:  55 },
            5: { damage: 30, cooldown: 1.1, projectiles: 2, freezeDuration: 2.5, aoeRadius:  65 },
            6: { damage: 36, cooldown: 1.0, projectiles: 2, freezeDuration: 2.8, aoeRadius:  75 },
            7: { damage: 44, cooldown: 0.9, projectiles: 3, freezeDuration: 3.0, aoeRadius:  90 },
            8: { damage: 55, cooldown: 0.8, projectiles: 3, freezeDuration: 3.5, aoeRadius: 110 }
        };
    }

    onFire() {
        const count = Math.floor(this.currentStats.projectiles);
        if (count === 1) {
            this._fireShardAt(this.findTarget());
        } else {
            const targets = this.findMultipleTargets(count);
            for (let i = 0; i < count; i++) {
                const target = targets[i % Math.max(targets.length, 1)];
                let angle = target ? this.getAngleToTarget(target) : (this.player.direction || 0);
                if (count > 1) angle += (i - (count - 1) / 2) * 0.35;
                this._fireShardAngle(angle);
            }
        }
    }

    _fireShardAt(target) {
        const angle = target
            ? this.getAngleToTarget(target)
            : (this.player.direction || Math.random() * Math.PI * 2);
        this._fireShardAngle(angle);
    }

    _fireShardAngle(angle) {
        const ps = this.player;
        const proj = this.createProjectile(ps.x, ps.y, angle, {
            type:        'ice_shard',
            damage:      this.currentStats.damage,
            piercing:    this.currentStats.piercing,
            color:       '#88DDFF',
            size:        this.size + 1,
            speed:       this.currentStats.speed,
            lifetime:    this.currentStats.duration,
            trail:       true,
            sourceWeapon: this
        });
        return proj;
    }

    /** Called by Projectile.hitEnemy() via sourceWeapon.onHitEnemy() */
    onHitEnemy(enemy, damage, isCritical) {
        const se = this.game.systems.statusEffect;

        // Permafrost synergy: already-frozen enemies take +35% bonus damage
        if (this._synergyPermafrost && se && se.hasStatusEffect(enemy, 'freeze')) {
            enemy.takeDamage(Math.ceil(damage * 0.35), this, false);
        }

        // Apply freeze status effect
        if (se) {
            se.applyFreezeEffect(enemy, this.freezeDuration, this);
        }

        // AoE ice burst at higher levels
        if (this.aoeRadius > 0) {
            this._triggerIceBurst(enemy.x, enemy.y);
        }

        // Hit VFX
        this._spawnIceParticles(enemy.x, enemy.y, 8);
        if (isCritical && this.game.systems.particle) {
            this.game.systems.particle.createCriticalEffect(enemy.x, enemy.y, '#88DDFF');
        }
    }

    _triggerIceBurst(x, y) {
        const se  = this.game.systems.statusEffect;
        const ps  = this.game.systems.particle;
        const aoe = this.aoeRadius * (this.player.stats?.area || 1);

        // Ice ring particle burst
        this._spawnIceParticles(x, y, 20);
        if (ps) {
            ps.create(x, y, {
                vx: 0, vy: 0,
                life: 0.4,
                size: aoe,
                color: 'rgba(136,221,255,0.25)',
                fadeOut: true
            });
        }

        // Freeze nearby enemies
        if (se) {
            const nearby = this.game.systems.enemy.getEnemiesInRange(x, y, aoe);
            for (const e of nearby) {
                if (!e.active || e._deathProcessed) continue;
                se.applyFreezeEffect(e, this.freezeDuration * 0.7, this);
                // Partial damage for AoE
                e.takeDamage(Math.ceil(this.currentStats.damage * 0.35), this, false);
            }
        }
    }

    _spawnIceParticles(x, y, count) {
        const ps = this.game.systems.particle;
        if (!ps) return;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
            const speed = 50 + Math.random() * 80;
            ps.create(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.4 + Math.random() * 0.3,
                size: 2 + Math.random() * 3,
                color: Math.random() < 0.5 ? '#88DDFF' : '#FFFFFF',
                fadeOut: true
            });
        }
    }

    onUpgrade() {
        const lvl = this.levelProgression[this.level];
        if (!lvl) return;
        this.baseStats.damage      = lvl.damage;
        this.baseStats.cooldown    = lvl.cooldown;
        this.baseStats.projectiles = lvl.projectiles;
        this.freezeDuration        = lvl.freezeDuration;
        this.aoeRadius             = lvl.aoeRadius;
        this.updateStats();
    }

    // --- Overrides ---

    getSoundName() {
        return 'iceShardCast';
    }

    getMuzzleFlashColor() {
        return '#88DDFF';
    }

    getSoundPitch() {
        return 1.05 + (this.level - 1) * 0.025;
    }

    /** Blizzard (evolved): render a persistent ice storm ring around player */
    render(renderer) {
        if (!this.evolved) return;
        const ctx   = renderer.ctx || renderer;
        const p     = this.player;
        const now   = performance.now() * 0.001;
        const r     = 110 * (p.stats?.area || 1);

        ctx.save();
        ctx.globalAlpha = 0.18 + Math.sin(now * 2) * 0.06;
        ctx.strokeStyle = '#88DDFF';
        ctx.lineWidth   = 3;
        ctx.setLineDash([8, 6]);
        ctx.shadowColor = '#88DDFF';
        ctx.shadowBlur  = 12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }
}
