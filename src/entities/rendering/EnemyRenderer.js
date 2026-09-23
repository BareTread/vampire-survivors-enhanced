/**
 * EnemyRenderer.js
 *
 * Sprite-cached enemy rendering. Each (type, color, size, variant) body is
 * baked once to an offscreen canvas — per-frame cost is a shadow ellipse,
 * one rotated drawImage, and the live overlays (health bar, telegraphs,
 * auras) which stay delegated to the enemy's own methods so gameplay
 * visuals keep a single source of truth.
 *
 * Active path: Enemy.render(renderer, detailLevel) delegates wholesale:
 *     EnemyRenderer.render(this, renderer, detailLevel);
 * The renderer argument may be a renderer ({ctx}) or a raw 2d context.
 *
 * Silhouette language (readable without color):
 *   basic     — slouched husk, hunched shoulders
 *   fast      — lean darting imp, swept-back horns
 *   tank      — broad plated brute
 *   ranged    — robed acolyte, pale diamond core
 *   elite     — horned dreadlord with mantle
 *   berserker — jagged spiked silhouette
 *   summoner  — tall hooded robe with staff
 *   juggernaut— massive fortress slab
 */
export class EnemyRenderer {
    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /**
     * Full enemy render: shadow, body sprite, type details, health bar.
     * Mirrors the semantics of Enemy.render — spawn/death/freeze transforms,
     * golden swarm tint, hit flash — so it is a drop-in replacement.
     */
    static render(enemy, renderer, detailLevel = 'high') {
        if (!enemy.active) return;

        const ctx = renderer && renderer.ctx ? renderer.ctx : renderer;
        if (!ctx) return;

        ctx.save();

        // Death scale pop animation: scale up to 1.3x then shrink to 0
        if (enemy.dying) {
            const t = enemy.deathScaleTimer / enemy.deathScaleDuration; // 1→0
            const scale = t > 0.5 ? 1.0 + (1 - t) * 0.6 : t * 2.6;
            ctx.translate(enemy.x, enemy.y);
            ctx.scale(scale, scale);
            ctx.translate(-enemy.x, -enemy.y);
            ctx.globalAlpha = Math.max(0, t);
        }

        // Hit freeze-frame: enlarge slightly
        if (enemy.freezeTimer > 0 && !enemy.dying) {
            ctx.translate(enemy.x, enemy.y);
            ctx.scale(1.1, 1.1);
            ctx.translate(-enemy.x, -enemy.y);
        }

        // Spawn animation
        if (enemy.currentSpawnTime > 0) {
            const spawnProgress = 1 - enemy.currentSpawnTime / enemy.spawnTime;
            ctx.globalAlpha = spawnProgress;
            ctx.translate(enemy.x, enemy.y);
            ctx.scale(spawnProgress, spawnProgress);
            ctx.translate(-enemy.x, -enemy.y);
        }

        // Ground shadow
        ctx.fillStyle = 'rgba(10, 6, 14, 0.28)';
        ctx.beginPath();
        ctx.ellipse(
            enemy.x, enemy.y + enemy.size * 0.42,
            enemy.size * 0.92, enemy.size * 0.44,
            0, 0, Math.PI * 2
        );
        ctx.fill();

        // Body sprite — baked per (type, color, size, variant)
        const isFlashing = enemy.flashTime > 0;
        const isGoldenSwarm = enemy.game?.systems?.dynamicEvents?.goldenSwarmActive;
        const variant = isFlashing ? 'flash' : (isGoldenSwarm ? 'gold' : 'normal');
        const sprite = EnemyRenderer._sprite(enemy, variant);

        if (sprite) {
            if (isGoldenSwarm) {
                ctx.shadowColor = '#FFD700';
                ctx.shadowBlur = 6;
            }
            ctx.save();
            ctx.translate(enemy.x, enemy.y);
            ctx.rotate(enemy.direction || 0);
            ctx.drawImage(sprite.canvas, -sprite.w / 2, -sprite.h / 2, sprite.w, sprite.h);
            ctx.restore();
            ctx.shadowBlur = 0;
        } else {
            // Headless fallback: plain body circle (same as old simplify path)
            ctx.fillStyle = isFlashing ? '#FFFFFF' : (isGoldenSwarm ? '#FFD700' : enemy.color);
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Type-specific details + telegraphs stay on the enemy (single
        // source of truth for gameplay-readable overlays)
        if (typeof enemy.renderTypeDetails === 'function') {
            enemy.renderTypeDetails(ctx, detailLevel);
        }
        if (typeof enemy.renderHealthBar === 'function') {
            enemy.renderHealthBar(ctx, detailLevel);
        }

        ctx.restore();
    }

    static clearCache() {
        EnemyRenderer._cache.clear();
    }

    // ------------------------------------------------------------------
    // Sprite cache + baking
    // ------------------------------------------------------------------

    static _sprite(enemy, variant) {
        if (typeof document === 'undefined') return null;

        const size = Math.max(4, Math.round(enemy.size));
        const key = `${enemy.type}|${enemy.color}|${size}|${variant}`;

        let sprite = EnemyRenderer._cache.get(key);
        if (sprite === undefined) {
            sprite = EnemyRenderer._bake(enemy.type, enemy.color, size, variant);
            EnemyRenderer._cache.set(key, sprite);
        }
        return sprite; // may be null if canvas unsupported
    }

    /**
     * Bake a body sprite facing +X. Supersampled 2x then drawn at half size
     * for crisp edges at normal zoom.
     */
    static _bake(type, color, size, variant) {
        const SS = 2;
        const pad = Math.ceil(size * 0.7) + 4;
        const logical = size * 2 + pad * 2;      // drawn size in world px
        const canvas = document.createElement('canvas');
        canvas.width = logical * SS;
        canvas.height = logical * SS;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        ctx.scale(SS, SS);
        ctx.translate(logical / 2, logical / 2);

        const pal = EnemyRenderer._palette(color, variant);
        const paint = EnemyRenderer._painters[type] || EnemyRenderer._painters.basic;
        paint(ctx, size, pal);

        return { canvas, w: logical, h: logical };
    }

    static _palette(color, variant) {
        if (variant === 'flash') {
            return { body: '#FFFFFF', dark: '#DDDDDD', rim: '#FFFFFF', accent: '#FFFFFF', eye: '#FFFFFF' };
        }
        if (variant === 'gold') {
            return {
                body: '#8a6a1a', dark: '#4a380e', rim: '#d8b04a',
                accent: '#FFD700', eye: '#FFF3B0'
            };
        }
        const c = EnemyRenderer._norm(color);
        return {
            body: EnemyRenderer._shade(c, -0.12),   // near-true type color
            dark: EnemyRenderer._shade(c, -0.45),
            rim: EnemyRenderer._shade(c, 0.3),      // lit edge
            accent: c,                              // archetype accent
            eye: '#FFB35C'                          // ember eyes
        };
    }

    // ------------------------------------------------------------------
    // Archetype painters — all draw facing +X, centered on origin,
    // silhouette inside ~size radius so sprites never lie about hitboxes.
    // ------------------------------------------------------------------

    static get _painters() {
        if (!EnemyRenderer._painterMap) {
            EnemyRenderer._painterMap = {
                basic: EnemyRenderer._paintHusk,
                fast: EnemyRenderer._paintImp,
                tank: EnemyRenderer._paintBrute,
                ranged: EnemyRenderer._paintAcolyte,
                elite: EnemyRenderer._paintDreadlord,
                berserker: EnemyRenderer._paintBerserker,
                summoner: EnemyRenderer._paintSummoner,
                juggernaut: EnemyRenderer._paintJuggernaut
            };
        }
        return EnemyRenderer._painterMap;
    }

    // Slouched husk — hunched shambling corpse
    static _paintHusk(ctx, s, p) {
        // Body: hunched mass, wider at the shoulders (rear), tapering forward
        ctx.fillStyle = p.body;
        ctx.beginPath();
        ctx.moveTo(s * 0.95, 0);
        ctx.quadraticCurveTo(s * 0.7, -s * 0.75, -s * 0.1, -s * 0.85);
        ctx.quadraticCurveTo(-s * 0.9, -s * 0.9, -s * 0.95, -s * 0.2);
        ctx.quadraticCurveTo(-s * 1.0, s * 0.5, -s * 0.4, s * 0.85);
        ctx.quadraticCurveTo(s * 0.4, s * 0.95, s * 0.95, 0);
        ctx.closePath();
        ctx.fill();

        // Rim light on the upper edge
        ctx.strokeStyle = p.rim;
        ctx.lineWidth = Math.max(1, s * 0.12);
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(-s * 0.7, -s * 0.55);
        ctx.quadraticCurveTo(-s * 0.1, -s * 0.85, s * 0.6, -s * 0.4);
        ctx.stroke();
        ctx.globalAlpha = 1;
        // Ragged hem
        ctx.fillStyle = p.dark;
        ctx.beginPath();
        ctx.moveTo(-s * 0.9, s * 0.3);
        ctx.lineTo(-s * 0.6, s * 0.8);
        ctx.lineTo(-s * 0.3, s * 0.5);
        ctx.lineTo(0, s * 0.9);
        ctx.lineTo(s * 0.3, s * 0.6);
        ctx.lineTo(s * 0.5, s * 0.85);
        ctx.lineTo(s * 0.8, s * 0.4);
        ctx.closePath();
        ctx.fill();

        // Ember eyes, forward side
        ctx.fillStyle = p.eye;
        ctx.beginPath();
        ctx.arc(s * 0.45, -s * 0.22, Math.max(1, s * 0.13), 0, Math.PI * 2);
        ctx.arc(s * 0.45, s * 0.22, Math.max(1, s * 0.13), 0, Math.PI * 2);
        ctx.fill();
    }

    // Lean darting imp — narrow body, swept-back horns, forward snout
    static _paintImp(ctx, s, p) {
        // Swept horns
        ctx.strokeStyle = p.dark;
        ctx.lineWidth = Math.max(1, s * 0.18);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s * 0.15, -s * 0.35);
        ctx.quadraticCurveTo(-s * 0.5, -s * 0.7, -s * 0.95, -s * 0.55);
        ctx.moveTo(s * 0.15, s * 0.35);
        ctx.quadraticCurveTo(-s * 0.5, s * 0.7, -s * 0.95, s * 0.55);
        ctx.stroke();

        // Narrow dart body
        ctx.fillStyle = p.body;
        ctx.beginPath();
        ctx.moveTo(s * 1.05, 0);
        ctx.quadraticCurveTo(s * 0.3, -s * 0.6, -s * 0.55, -s * 0.45);
        ctx.lineTo(-s * 0.85, 0);
        ctx.lineTo(-s * 0.55, s * 0.45);
        ctx.quadraticCurveTo(s * 0.3, s * 0.6, s * 1.05, 0);
        ctx.closePath();
        ctx.fill();

        // Rim
        ctx.strokeStyle = p.rim;
        ctx.lineWidth = Math.max(1, s * 0.1);
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, -s * 0.4);
        ctx.quadraticCurveTo(s * 0.3, -s * 0.55, s * 0.95, -s * 0.05);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Single forward eye
        ctx.fillStyle = p.eye;
        ctx.beginPath();
        ctx.arc(s * 0.5, 0, Math.max(1, s * 0.16), 0, Math.PI * 2);
        ctx.fill();
    }

    // Broad plated brute — heavy shoulders, armored shell
    static _paintBrute(ctx, s, p) {
        // Shoulder pauldrons
        ctx.fillStyle = p.dark;
        ctx.beginPath();
        ctx.arc(-s * 0.1, -s * 0.7, s * 0.42, 0, Math.PI * 2);
        ctx.arc(-s * 0.1, s * 0.7, s * 0.42, 0, Math.PI * 2);
        ctx.fill();

        // Massive torso — wide hexagon
        ctx.fillStyle = p.body;
        ctx.beginPath();
        ctx.moveTo(s * 0.9, 0);
        ctx.lineTo(s * 0.45, -s * 0.7);
        ctx.lineTo(-s * 0.45, -s * 0.8);
        ctx.lineTo(-s * 0.9, -s * 0.35);
        ctx.lineTo(-s * 0.9, s * 0.35);
        ctx.lineTo(-s * 0.45, s * 0.8);
        ctx.lineTo(s * 0.45, s * 0.7);
        ctx.closePath();
        ctx.fill();

        // Armor plate seams
        ctx.strokeStyle = p.dark;
        ctx.lineWidth = Math.max(1, s * 0.09);
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, -s * 0.45);
        ctx.lineTo(s * 0.5, -s * 0.35);
        ctx.moveTo(-s * 0.55, s * 0.45);
        ctx.lineTo(s * 0.5, s * 0.35);
        ctx.stroke();

        // Rim on top edge
        ctx.strokeStyle = p.rim;
        ctx.lineWidth = Math.max(1, s * 0.11);
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(-s * 0.45, -s * 0.75);
        ctx.lineTo(s * 0.45, -s * 0.65);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Cyclops slit visor
        ctx.fillStyle = p.eye;
        ctx.fillRect(s * 0.35, -s * 0.1, s * 0.45, s * 0.2);
    }

    // Robed acolyte — hooded diamond silhouette, pale core
    static _paintAcolyte(ctx, s, p) {
        // Robe: diamond tapering to a hem point behind
        ctx.fillStyle = p.body;
        ctx.beginPath();
        ctx.moveTo(s * 0.95, 0);
        ctx.lineTo(s * 0.15, -s * 0.85);
        ctx.lineTo(-s * 0.85, -s * 0.25);
        ctx.lineTo(-s * 0.7, 0);
        ctx.lineTo(-s * 0.85, s * 0.25);
        ctx.lineTo(s * 0.15, s * 0.85);
        ctx.closePath();
        ctx.fill();

        // Hood shadow over the face
        ctx.fillStyle = p.dark;
        ctx.beginPath();
        ctx.moveTo(s * 0.95, 0);
        ctx.lineTo(s * 0.35, -s * 0.45);
        ctx.lineTo(s * 0.35, s * 0.45);
        ctx.closePath();
        ctx.fill();

        // Rim
        ctx.strokeStyle = p.rim;
        ctx.lineWidth = Math.max(1, s * 0.1);
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(-s * 0.8, -s * 0.22);
        ctx.lineTo(s * 0.15, -s * 0.8);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Pale diamond core in the hood shadow
        ctx.fillStyle = p.accent;
        ctx.beginPath();
        ctx.moveTo(s * 0.55, -s * 0.16);
        ctx.lineTo(s * 0.72, 0);
        ctx.lineTo(s * 0.55, s * 0.16);
        ctx.lineTo(s * 0.38, 0);
        ctx.closePath();
        ctx.fill();
    }

    // Horned dreadlord — crowned mantle, broad and regal
    static _paintDreadlord(ctx, s, p) {
        // Horns curving up/back from the crown
        ctx.strokeStyle = p.rim;
        ctx.lineWidth = Math.max(1.5, s * 0.14);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s * 0.35, -s * 0.4);
        ctx.quadraticCurveTo(s * 0.1, -s * 0.95, -s * 0.45, -s * 1.0);
        ctx.moveTo(s * 0.35, s * 0.4);
        ctx.quadraticCurveTo(s * 0.1, s * 0.95, -s * 0.45, s * 1.0);
        ctx.stroke();

        // Mantle: broad shoulders sweeping back
        ctx.fillStyle = p.dark;
        ctx.beginPath();
        ctx.moveTo(s * 0.5, -s * 0.55);
        ctx.quadraticCurveTo(-s * 0.4, -s * 1.0, -s * 1.0, -s * 0.5);
        ctx.lineTo(-s * 0.85, 0);
        ctx.lineTo(-s * 1.0, s * 0.5);
        ctx.quadraticCurveTo(-s * 0.4, s * 1.0, s * 0.5, s * 0.55);
        ctx.closePath();
        ctx.fill();

        // Core body
        ctx.fillStyle = p.body;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.72, 0, Math.PI * 2);
        ctx.fill();

        // Crown band
        ctx.strokeStyle = p.accent;
        ctx.lineWidth = Math.max(1, s * 0.1);
        ctx.beginPath();
        ctx.arc(s * 0.15, 0, s * 0.5, -Math.PI * 0.45, Math.PI * 0.45);
        ctx.stroke();

        // Ember eyes
        ctx.fillStyle = p.eye;
        ctx.beginPath();
        ctx.arc(s * 0.4, -s * 0.18, Math.max(1, s * 0.11), 0, Math.PI * 2);
        ctx.arc(s * 0.4, s * 0.18, Math.max(1, s * 0.11), 0, Math.PI * 2);
        ctx.fill();
    }

    // Jagged berserker — spiked, aggressive silhouette
    static _paintBerserker(ctx, s, p) {
        const spikes = 7;
        ctx.fillStyle = p.body;
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const angle = (i / (spikes * 2)) * Math.PI * 2;
            const r = i % 2 === 0 ? s * 1.0 : s * 0.62;
            const px = Math.cos(angle) * r;
            const py = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // Inner mass
        ctx.fillStyle = p.dark;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2);
        ctx.fill();

        // Rim
        ctx.strokeStyle = p.rim;
        ctx.lineWidth = Math.max(1, s * 0.08);
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.55, -Math.PI * 0.7, -Math.PI * 0.1);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Fury eyes — angled slits
        ctx.strokeStyle = p.eye;
        ctx.lineWidth = Math.max(1, s * 0.12);
        ctx.beginPath();
        ctx.moveTo(s * 0.15, -s * 0.3);
        ctx.lineTo(s * 0.5, -s * 0.15);
        ctx.moveTo(s * 0.15, s * 0.3);
        ctx.lineTo(s * 0.5, s * 0.15);
        ctx.stroke();
    }

    // Tall hooded summoner — robe + raised staff
    static _paintSummoner(ctx, s, p) {
        // Staff held forward
        ctx.strokeStyle = p.dark;
        ctx.lineWidth = Math.max(1.5, s * 0.12);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s * 0.1, s * 0.55);
        ctx.lineTo(s * 0.95, -s * 0.55);
        ctx.stroke();
        // Staff head orb
        ctx.fillStyle = p.accent;
        ctx.beginPath();
        ctx.arc(s * 0.95, -s * 0.55, Math.max(1.5, s * 0.18), 0, Math.PI * 2);
        ctx.fill();

        // Robe: tall triangle flaring to the hem
        ctx.fillStyle = p.body;
        ctx.beginPath();
        ctx.moveTo(s * 0.7, 0);
        ctx.quadraticCurveTo(s * 0.3, -s * 0.7, -s * 0.2, -s * 0.75);
        ctx.lineTo(-s * 0.85, -s * 0.55);
        ctx.lineTo(-s * 0.95, 0);
        ctx.lineTo(-s * 0.85, s * 0.55);
        ctx.lineTo(-s * 0.2, s * 0.75);
        ctx.quadraticCurveTo(s * 0.3, s * 0.7, s * 0.7, 0);
        ctx.closePath();
        ctx.fill();

        // Hood
        ctx.fillStyle = p.dark;
        ctx.beginPath();
        ctx.moveTo(s * 0.7, 0);
        ctx.quadraticCurveTo(s * 0.35, -s * 0.5, s * 0.05, -s * 0.5);
        ctx.quadraticCurveTo(s * 0.05, s * 0.5, s * 0.7, 0);
        ctx.closePath();
        ctx.fill();

        // Rim
        ctx.strokeStyle = p.rim;
        ctx.lineWidth = Math.max(1, s * 0.09);
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(-s * 0.8, -s * 0.5);
        ctx.quadraticCurveTo(-s * 0.2, -s * 0.72, s * 0.3, -s * 0.55);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Eyes in the hood shadow
        ctx.fillStyle = p.eye;
        ctx.beginPath();
        ctx.arc(s * 0.35, -s * 0.12, Math.max(1, s * 0.1), 0, Math.PI * 2);
        ctx.arc(s * 0.35, s * 0.12, Math.max(1, s * 0.1), 0, Math.PI * 2);
        ctx.fill();
    }

    // Massive fortress slab — the juggernaut
    static _paintJuggernaut(ctx, s, p) {
        // Layered slab body — near-rectangular fortress mass
        ctx.fillStyle = p.dark;
        ctx.beginPath();
        ctx.moveTo(s * 0.85, -s * 0.55);
        ctx.lineTo(-s * 0.7, -s * 0.85);
        ctx.lineTo(-s * 0.95, -s * 0.5);
        ctx.lineTo(-s * 0.95, s * 0.5);
        ctx.lineTo(-s * 0.7, s * 0.85);
        ctx.lineTo(s * 0.85, s * 0.55);
        ctx.lineTo(s * 0.95, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = p.body;
        ctx.beginPath();
        ctx.moveTo(s * 0.8, -s * 0.45);
        ctx.lineTo(-s * 0.6, -s * 0.7);
        ctx.lineTo(-s * 0.8, -s * 0.4);
        ctx.lineTo(-s * 0.8, s * 0.4);
        ctx.lineTo(-s * 0.6, s * 0.7);
        ctx.lineTo(s * 0.8, s * 0.45);
        ctx.lineTo(s * 0.85, 0);
        ctx.closePath();
        ctx.fill();

        // Plate seams
        ctx.strokeStyle = p.dark;
        ctx.lineWidth = Math.max(1, s * 0.07);
        ctx.beginPath();
        ctx.moveTo(-s * 0.6, -s * 0.35);
        ctx.lineTo(s * 0.6, -s * 0.25);
        ctx.moveTo(-s * 0.6, s * 0.35);
        ctx.lineTo(s * 0.6, s * 0.25);
        ctx.stroke();

        // Rim
        ctx.strokeStyle = p.rim;
        ctx.lineWidth = Math.max(1, s * 0.09);
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(-s * 0.6, -s * 0.68);
        ctx.lineTo(s * 0.75, -s * 0.42);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Cyclops slit
        ctx.fillStyle = p.eye;
        ctx.fillRect(s * 0.3, -s * 0.08, s * 0.4, s * 0.16);
    }

    // ------------------------------------------------------------------
    // Color helpers
    // ------------------------------------------------------------------

    static _norm(color) {
        if (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) return color;
        return '#8a8a8a';
    }

    static _shade(hex, factor) {
        // factor -1..1: negative darkens, positive lightens
        const num = parseInt(hex.slice(1), 16);
        let r = num >> 16, g = (num >> 8) & 0xff, b = num & 0xff;
        if (factor < 0) {
            r *= 1 + factor; g *= 1 + factor; b *= 1 + factor;
        } else {
            r += (255 - r) * factor; g += (255 - g) * factor; b += (255 - b) * factor;
        }
        return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
    }
}

// Module-level sprite cache shared by all enemies
EnemyRenderer._cache = new Map();
EnemyRenderer._painterMap = null;
