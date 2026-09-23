/**
 * EnemyRenderer.js
 *
 * Upright, animated enemy rendering built on CharacterArt. Each
 * (archetype, color, size, frame, variant) sprite is baked once with a
 * dark outline; per frame we only apply cheap transforms:
 *
 *   - walk cycle: 2 baked stride frames + hop bob + squash/stretch
 *   - facing flip toward the player (with hysteresis — no jitter)
 *   - lean into movement, recoil + white flash on hit
 *   - rise-from-the-grave spawn, squash-and-fade death pop
 *   - frost tint while frozen (StatusEffectSystem sets _frozenVisual)
 *
 * Active path: Enemy.render(renderer, detailLevel) delegates here.
 * The renderer argument may be a renderer ({ctx}) or a raw 2d context.
 *
 * Archetype language (readable without color):
 *   basic → ghoul · fast → bat · tank → shield knight · ranged → cultist
 *   elite → horned dreadlord · berserker → werebeast · summoner → necromancer
 *   juggernaut → stone golem · wraith → shroud · demon → winged imp
 */
import { ENEMY_LAYOUT, getEnemySprite, enemyVisualTop, clearCharacterArtCache, artKind } from './CharacterArt.js';

const TAU = Math.PI * 2;

export class EnemyRenderer {
    static render(enemy, renderer, detailLevel = 'high') {
        if (!enemy.active) return;

        const ctx = renderer && renderer.ctx ? renderer.ctx : renderer;
        if (!ctx) return;

        const kind = artKind(enemy);
        const layout = ENEMY_LAYOUT[kind] || ENEMY_LAYOUT.basic;
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
        const anim = EnemyRenderer._anim(enemy, now);

        ctx.save();

        // Spawn: rise out of the ground
        let rise = 1;
        if (enemy.currentSpawnTime > 0 && enemy.spawnTime > 0) {
            rise = Math.max(0, Math.min(1, 1 - enemy.currentSpawnTime / enemy.spawnTime));
            ctx.globalAlpha *= 0.35 + rise * 0.65;
        }

        // Death: squash flat + fade
        let deathSX = 1;
        let deathSY = 1;
        if (enemy.dying && enemy.deathScaleDuration > 0) {
            const t = Math.max(0, enemy.deathScaleTimer / enemy.deathScaleDuration); // 1 → 0
            deathSX = 1 + (1 - t) * 0.5;
            deathSY = t;
            ctx.globalAlpha *= Math.max(0, t);
        }

        const feetY = enemy.y + enemy.size * layout.feet;

        // Ground shadow (flyers get a smaller, detached shadow)
        const shadowScale = layout.fly ? 0.6 - anim.float * 0.02 : 1;
        ctx.fillStyle = 'rgba(6, 3, 10, 0.38)';
        ctx.beginPath();
        ctx.ellipse(
            enemy.x,
            layout.fly ? enemy.y + enemy.size * 1.1 : feetY,
            Math.max(2, enemy.size * 0.95 * shadowScale * deathSX),
            Math.max(1, enemy.size * 0.34 * shadowScale),
            0,
            0,
            TAU
        );
        ctx.fill();

        // Champion variant sigil sits on the ground, under the body
        if (enemy.variant && detailLevel !== 'low' && typeof enemy.renderVariantIndicator === 'function') {
            enemy.renderVariantIndicator(ctx);
        }

        // Boss: pulsing sigil pooled on the ground beneath them
        if (enemy.isBoss && detailLevel !== 'low') {
            const pulse = 0.5 + 0.5 * Math.sin(now * 3);
            const glow = enemy.bossGlowColor || enemy.color;
            ctx.save();
            ctx.globalAlpha *= 0.35 + pulse * 0.25;
            ctx.strokeStyle = glow;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(enemy.x, feetY, enemy.size * 1.6, enemy.size * 0.55, 0, 0, TAU);
            ctx.stroke();
            ctx.setLineDash([6, 8]);
            ctx.lineDashOffset = -now * 30;
            ctx.beginPath();
            ctx.ellipse(enemy.x, feetY, enemy.size * 2.0, enemy.size * 0.7, 0, 0, TAU);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        // Pick sprite variant
        const isFlashing = enemy.flashTime > 0;
        const isGoldenSwarm = enemy.game?.systems?.dynamicEvents?.goldenSwarmActive;
        const frozen = enemy._frozenVisual;
        const variant = isFlashing ? 'flash' : isGoldenSwarm ? 'gold' : frozen ? 'frost' : 'normal';
        const sprite = getEnemySprite(kind, enemy.color, enemy.size, anim.frame, variant);

        if (sprite) {
            ctx.save();
            ctx.translate(enemy.x, feetY - anim.hop + anim.float);

            // Spawn: sink below the ground line and clip
            if (rise < 1) {
                ctx.beginPath();
                ctx.rect(-sprite.w, -sprite.h * 2, sprite.w * 2, sprite.h * 2 + 1);
                ctx.clip();
                ctx.translate(0, (1 - rise) * sprite.h * 0.9);
            }

            ctx.rotate(anim.lean);
            ctx.scale(anim.facing * anim.sx * deathSX, anim.sy * deathSY);
            if (isGoldenSwarm && detailLevel !== 'low') {
                ctx.shadowColor = '#FFD700';
                ctx.shadowBlur = 8;
            }
            ctx.drawImage(sprite.canvas, -sprite.ax, -sprite.ay, sprite.w, sprite.h);
            ctx.restore();

            // Dirt ring while clawing out of the ground
            if (rise < 1 && !layout.fly) {
                ctx.strokeStyle = `rgba(70, 52, 40, ${0.7 * (1 - rise)})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.ellipse(enemy.x, feetY, enemy.size * (0.8 + rise * 0.6), enemy.size * 0.3, 0, 0, TAU);
                ctx.stroke();
            }
        } else {
            // Headless fallback: plain body circle
            ctx.fillStyle = isFlashing ? '#FFFFFF' : isGoldenSwarm ? '#FFD700' : enemy.color;
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.size, 0, TAU);
            ctx.fill();
        }

        // Gameplay overlays (auras, telegraphs) stay owned by the enemy
        if (typeof enemy.renderTypeDetails === 'function') {
            enemy.renderTypeDetails(ctx, detailLevel);
        }
        if (!enemy.dying) {
            EnemyRenderer.drawHealthBar(ctx, enemy, detailLevel);
        }

        ctx.restore();
    }

    /**
     * Per-enemy animation state. Everything derives from wall time plus a
     * per-enemy seed, so no update() hooks are needed and pooled enemies
     * animate correctly after reuse.
     */
    static _anim(enemy, now) {
        let a = enemy._anim;
        if (!a || a.owner !== enemy.id) {
            a = enemy._anim = {
                owner: enemy.id,
                seed: Math.random() * 100,
                facing: 1,
                lastHit: 0
            };
        }

        const layout = ENEMY_LAYOUT[artKind(enemy)] || ENEMY_LAYOUT.basic;
        const vx = enemy.velocity ? enemy.velocity.x : 0;
        const vy = enemy.velocity ? enemy.velocity.y : 0;
        const speed = Math.sqrt(vx * vx + vy * vy);
        const frozen = enemy._frozenVisual || enemy._stunned || enemy.freezeTimer > 0;

        // Face the player (enemies are always hunting them), hysteresis 4px
        const player = enemy.game && enemy.game.player;
        const dx = player ? player.x - enemy.x : vx;
        if (dx > 4) a.facing = 1;
        else if (dx < -4) a.facing = -1;

        const moving = !frozen && speed > 4;
        const rate = layout.fly ? 9 : 5 + Math.min(8, speed * 0.06);
        const phase = frozen ? a.frozenPhase || 0 : now * rate + a.seed;
        if (!frozen) a.frozenPhase = phase;

        const s = Math.sin(phase);
        const c = Math.cos(phase * 2);

        let hop = 0;
        let float = 0;
        let sx = 1;
        let sy = 1;
        let lean = 0;
        let frame = 0;

        if (layout.fly) {
            frame = s > 0 ? 0 : 1;
            float = Math.sin(phase * 0.5) * enemy.size * 0.25;
        } else if (moving) {
            frame = s > 0 ? 0 : 1;
            hop = Math.abs(s) * enemy.size * 0.22;
            sx = 1 + c * 0.05;
            sy = 1 - c * 0.05;
            lean = a.facing * 0.07 * Math.min(1, speed / 60);
        } else {
            // Idle breathing
            const b = Math.sin(now * 2.2 + a.seed);
            sx = 1 - b * 0.025;
            sy = 1 + b * 0.025;
        }

        // Hit recoil: squash + tilt away from the player
        if (enemy.flashTime > 0) {
            sx *= 1.14;
            sy *= 0.86;
            lean -= a.facing * 0.18;
        }

        return { facing: a.facing, frame, hop, float, sx, sy, lean };
    }

    /**
     * Slim health bar above the sprite. Hidden at full health for rank and
     * file enemies so swarms stay readable; always shown for elites.
     */
    static drawHealthBar(ctx, enemy, detailLevel = 'high') {
        if (enemy.isBoss) return; // bosses get the big HUD bar instead
        const ratio = enemy.maxHealth > 0 ? Math.max(0, enemy.health / enemy.maxHealth) : 0;
        const important = enemy.type === 'elite' || enemy.isElite || enemy.isBoss;
        if (ratio >= 1 && !important) return;
        if (detailLevel === 'low' && !important && ratio > 0.5) return;

        const w = Math.max(18, enemy.size * 2.2);
        const h = important ? 4 : 3;
        const x = enemy.x - w / 2;
        const y = enemyVisualTop(enemy) - h - 4;

        ctx.fillStyle = 'rgba(8, 4, 10, 0.8)';
        ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
        ctx.fillStyle = '#3a0f14';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = important ? '#e8b64a' : ratio > 0.35 ? '#d8423a' : '#ff7a3a';
        ctx.fillRect(x, y, w * ratio, h);
        if (h > 3) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.fillRect(x, y, w * ratio, 1);
        }
    }

    static clearCache() {
        clearCharacterArtCache();
    }
}
