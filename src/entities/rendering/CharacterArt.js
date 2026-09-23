/**
 * CharacterArt.js
 *
 * Shared procedural art for every living thing in the world: the hunter
 * (player) and all enemy archetypes. One visual language:
 *
 *   - Upright 3/4 side view, facing +X, feet on the origin (y = 0, up = -y).
 *   - Dark gothic base tones, a single saturated accent per creature
 *     (enemy type color / character color), ember or accent-glow eyes.
 *   - Every frame is baked once with a crisp dark outline so silhouettes
 *     read against any floor tile, then drawn with cheap per-frame
 *     transforms (bob, squash, lean, flip) for animation.
 *
 * Bake cost is paid once per (kind, color, size, frame, variant) key.
 */

const SS = 2; // supersample factor for baked sprites
const OUTLINE = '#07050b';

// ----------------------------------------------------------------------
// Color helpers
// ----------------------------------------------------------------------

function parseHex(hex) {
    if (typeof hex !== 'string') return [138, 138, 138];
    let h = hex.trim();
    if (/^#[0-9a-fA-F]{3}$/.test(h)) {
        h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(h)) return [138, 138, 138];
    const n = parseInt(h.slice(1), 16);
    return [n >> 16, (n >> 8) & 0xff, n & 0xff];
}

function toRgb(c) {
    return `rgb(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0})`;
}

export function mix(a, b, t) {
    const ca = parseHex(a);
    const cb = parseHex(b);
    return toRgb([ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]);
}

export function shade(hex, f) {
    const c = parseHex(hex);
    if (f < 0) return toRgb(c.map((v) => v * (1 + f)));
    return toRgb(c.map((v) => v + (255 - v) * f));
}

export function rgba(hex, a) {
    const c = parseHex(hex);
    return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}

// ----------------------------------------------------------------------
// Drawing primitives (all in painter space)
// ----------------------------------------------------------------------

function ellipse(ctx, x, y, rx, ry, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
    ctx.fill();
}

function limb(ctx, x1, y1, x2, y2, w, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.8, w);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function bentLimb(ctx, x1, y1, kx, ky, x2, y2, w, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.8, w);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(kx, ky);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function poly(ctx, pts, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
}

function glowEye(ctx, x, y, r, color) {
    ctx.fillStyle = rgba(color, 0.35);
    ellipse(ctx, x, y, r * 2.2, r * 2.2);
    ctx.fillStyle = color;
    ellipse(ctx, x, y, r, r);
    ctx.fillStyle = '#fff6e0';
    ellipse(ctx, x + r * 0.2, y - r * 0.2, r * 0.4, r * 0.4);
}

// ----------------------------------------------------------------------
// Bake: paint → outline → optional white flash
// ----------------------------------------------------------------------

function makeCanvas(w, h) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    const ctx = c.getContext && c.getContext('2d');
    return ctx ? { c, ctx } : null;
}

/**
 * Bake a sprite. `box` is in painter units: { l, r, t, b } extents
 * around the feet origin. Returns { canvas, w, h, ax, ay } where
 * (ax, ay) is the feet anchor inside the drawn (logical) sprite.
 */
export function bakeSprite(box, paint, { outline = 1.2, flash = false, tint = null } = {}) {
    const pad = Math.ceil(outline) + 2;
    const w = box.r - box.l + pad * 2;
    const h = box.b - box.t + pad * 2;
    const ax = -box.l + pad;
    const ay = -box.t + pad;

    const base = makeCanvas(w * SS, h * SS);
    if (!base) return null;
    base.ctx.scale(SS, SS);
    base.ctx.translate(ax, ay);
    paint(base.ctx);

    // Silhouette in outline color
    const sil = makeCanvas(w * SS, h * SS);
    sil.ctx.drawImage(base.c, 0, 0);
    sil.ctx.globalCompositeOperation = 'source-in';
    sil.ctx.fillStyle = OUTLINE;
    sil.ctx.fillRect(0, 0, sil.c.width, sil.c.height);

    const out = makeCanvas(w * SS, h * SS);
    const o = outline * SS;
    const steps = 8;
    for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        out.ctx.drawImage(sil.c, Math.cos(a) * o, Math.sin(a) * o);
    }
    out.ctx.drawImage(base.c, 0, 0);

    if (flash || tint) {
        out.ctx.globalCompositeOperation = 'source-atop';
        out.ctx.fillStyle = flash ? 'rgba(255, 255, 255, 0.92)' : tint;
        out.ctx.fillRect(0, 0, out.c.width, out.c.height);
        out.ctx.globalCompositeOperation = 'source-over';
    }

    return { canvas: out.c, w, h, ax, ay };
}

// ======================================================================
// HUNTER (player)
// ======================================================================

const HUNTER_FRAMES = 3; // 0 = stand, 1 = stride A, 2 = stride B

/**
 * Paint the hunter facing +X, feet at origin. `u` is the size unit
 * (player.size). `frame` 0 stand / 1 / 2 stride poses.
 */
export function paintHunter(ctx, u, color, charId, frame, wounded) {
    const coat = '#2a2531';
    const coatDark = '#17141d';
    const coatRim = '#4d4658';
    const boot = '#1b1418';
    const skin = wounded ? '#d9b3a8' : '#eadcc6';
    const accent = color;
    const accentDark = shade(color, -0.45);

    // Stride poses
    const stride = frame === 0 ? 0 : frame === 1 ? 1 : -1;
    const hipY = -u * 0.95;

    // Scarf tail streaming behind (drawn first — behind the body)
    const flutter = stride === 0 ? 0 : stride * u * 0.12;
    ctx.fillStyle = accentDark;
    ctx.beginPath();
    ctx.moveTo(-u * 0.05, -u * 1.95);
    ctx.quadraticCurveTo(-u * 0.7, -u * 1.9 + flutter, -u * 1.15, -u * 1.55 - flutter);
    ctx.lineTo(-u * 1.0, -u * 1.38 - flutter);
    ctx.quadraticCurveTo(-u * 0.6, -u * 1.6, -u * 0.05, -u * 1.7);
    ctx.closePath();
    ctx.fill();

    // Back leg
    const backFoot = -stride * u * 0.38;
    bentLimb(ctx, -u * 0.12, hipY, -u * 0.1 + backFoot * 0.4, -u * 0.45, backFoot - u * 0.05, -u * 0.08, u * 0.26, shade(boot, 0.05));
    ctx.fillStyle = boot;
    ellipse(ctx, backFoot + u * 0.02, -u * 0.06, u * 0.2, u * 0.1);

    // Front leg
    const frontFoot = stride * u * 0.38;
    bentLimb(ctx, u * 0.1, hipY, u * 0.12 + frontFoot * 0.4, -u * 0.45, frontFoot + u * 0.05, -u * 0.08, u * 0.28, boot);
    ctx.fillStyle = boot;
    ellipse(ctx, frontFoot + u * 0.1, -u * 0.06, u * 0.22, u * 0.11);

    // Long coat — shoulders to knee, flared hem that swings with stride
    const hemSwing = -stride * u * 0.1;
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.moveTo(-u * 0.38, -u * 2.0);
    ctx.quadraticCurveTo(u * 0.1, -u * 2.12, u * 0.42, -u * 1.95);
    ctx.quadraticCurveTo(u * 0.55, -u * 1.3, u * 0.6 + hemSwing * 0.5, -u * 0.55);
    ctx.lineTo(u * 0.1, -u * 0.62);
    ctx.lineTo(-u * 0.25 + hemSwing, -u * 0.48);
    ctx.lineTo(-u * 0.72 + hemSwing, -u * 0.58);
    ctx.quadraticCurveTo(-u * 0.6, -u * 1.4, -u * 0.38, -u * 2.0);
    ctx.closePath();
    ctx.fill();

    // Accent lining along the back edge of the coat
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(1, u * 0.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-u * 0.45, -u * 1.75);
    ctx.quadraticCurveTo(-u * 0.62, -u * 1.2, -u * 0.72 + hemSwing, -u * 0.6);
    ctx.stroke();

    // Coat front shadow fold + rim light
    ctx.fillStyle = coatDark;
    ctx.beginPath();
    ctx.moveTo(u * 0.1, -u * 1.85);
    ctx.quadraticCurveTo(u * 0.3, -u * 1.2, u * 0.12, -u * 0.62);
    ctx.lineTo(u * 0.0, -u * 0.62);
    ctx.quadraticCurveTo(u * 0.12, -u * 1.2, u * 0.0, -u * 1.85);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = coatRim;
    ctx.lineWidth = Math.max(0.8, u * 0.07);
    ctx.beginPath();
    ctx.moveTo(u * 0.4, -u * 1.9);
    ctx.quadraticCurveTo(u * 0.52, -u * 1.3, u * 0.58 + hemSwing * 0.5, -u * 0.6);
    ctx.stroke();

    // Belt + brass buckle
    ctx.fillStyle = '#120e12';
    ctx.fillRect(-u * 0.5, -u * 1.22, u * 1.02, u * 0.14);
    ctx.fillStyle = '#c9a045';
    ctx.fillRect(u * 0.18, -u * 1.24, u * 0.16, u * 0.18);

    // Back arm (swings opposite to front leg)
    const armSwing = stride * u * 0.28;
    limb(ctx, -u * 0.2, -u * 1.8, -u * 0.25 - armSwing, -u * 1.15, u * 0.22, coatDark);

    // Scarf wrap around the neck
    ctx.fillStyle = accent;
    ellipse(ctx, u * 0.02, -u * 1.98, u * 0.42, u * 0.16, -0.08);
    ctx.fillStyle = shade(accent, 0.25);
    ellipse(ctx, u * 0.1, -u * 2.02, u * 0.22, u * 0.07, -0.08);

    // Head
    const hx = u * 0.08;
    const hy = -u * 2.35;
    ctx.fillStyle = skin;
    ellipse(ctx, hx, hy, u * 0.34, u * 0.37);
    // Jaw shadow
    ctx.fillStyle = rgba('#000000', 0.18);
    ellipse(ctx, hx - u * 0.1, hy + u * 0.12, u * 0.2, u * 0.2);
    // Eye (facing right)
    ctx.fillStyle = '#1a0f14';
    ellipse(ctx, hx + u * 0.17, hy - u * 0.02, u * 0.055, u * 0.08);
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, hx + u * 0.19, hy - u * 0.05, u * 0.02, u * 0.02);

    paintHeadgear(ctx, u, hx, hy, accent, accentDark, charId);

    // Front arm with stake-blade
    const handX = u * 0.55 + armSwing;
    const handY = -u * 1.25;
    limb(ctx, u * 0.22, -u * 1.82, handX, handY, u * 0.24, coat);
    ctx.fillStyle = skin;
    ellipse(ctx, handX, handY, u * 0.11, u * 0.11);
    // Silver blade angled down-forward
    ctx.strokeStyle = '#d8dce6';
    ctx.lineWidth = Math.max(0.9, u * 0.09);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(handX + u * 0.02, handY + u * 0.02);
    ctx.lineTo(handX + u * 0.62, handY + u * 0.28);
    ctx.stroke();
    ctx.fillStyle = '#b08a38';
    ctx.fillRect(handX - u * 0.04, handY - u * 0.1, u * 0.08, u * 0.22);

    if (wounded) {
        ctx.strokeStyle = 'rgba(150, 25, 30, 0.85)';
        ctx.lineWidth = Math.max(0.8, u * 0.08);
        ctx.beginPath();
        ctx.moveTo(-u * 0.25, -u * 1.7);
        ctx.lineTo(u * 0.05, -u * 1.35);
        ctx.moveTo(-u * 0.1, -u * 1.75);
        ctx.lineTo(u * 0.12, -u * 1.5);
        ctx.stroke();
    }
}

function paintHeadgear(ctx, u, hx, hy, accent, accentDark, charId) {
    switch (charId) {
        case 'imelda': {
            // Pointed mage hat, accent colored
            ctx.fillStyle = accentDark;
            ellipse(ctx, hx - u * 0.02, hy - u * 0.2, u * 0.62, u * 0.12, -0.05);
            poly(ctx, [hx - u * 0.35, hy - u * 0.22, hx + u * 0.32, hy - u * 0.24, hx - u * 0.45, hy - u * 1.2], accent);
            ctx.fillStyle = '#e8d27a';
            ellipse(ctx, hx - u * 0.02, hy - u * 0.5, u * 0.07, u * 0.07);
            // Hair
            ctx.fillStyle = '#5a2c1c';
            ellipse(ctx, hx - u * 0.28, hy + u * 0.05, u * 0.14, u * 0.3);
            break;
        }
        case 'gennaro': {
            // Short hair + accent bandana with knot tails
            ctx.fillStyle = '#2b1c14';
            ellipse(ctx, hx - u * 0.05, hy - u * 0.2, u * 0.36, u * 0.22);
            ctx.fillStyle = accent;
            ctx.fillRect(hx - u * 0.36, hy - u * 0.26, u * 0.7, u * 0.13);
            poly(ctx, [hx - u * 0.34, hy - u * 0.22, hx - u * 0.7, hy - u * 0.34, hx - u * 0.66, hy - u * 0.12], accentDark);
            break;
        }
        case 'mortimer': {
            // Tall crooked wizard hat with a star
            ctx.fillStyle = accentDark;
            ellipse(ctx, hx, hy - u * 0.22, u * 0.58, u * 0.12);
            ctx.fillStyle = accent;
            ctx.beginPath();
            ctx.moveTo(hx - u * 0.32, hy - u * 0.24);
            ctx.quadraticCurveTo(hx - u * 0.1, hy - u * 0.9, hx - u * 0.55, hy - u * 1.35);
            ctx.quadraticCurveTo(hx + u * 0.15, hy - u * 0.9, hx + u * 0.3, hy - u * 0.26);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ffe27a';
            ellipse(ctx, hx - u * 0.02, hy - u * 0.6, u * 0.07, u * 0.07);
            // Beard
            ctx.fillStyle = '#d8d4cc';
            poly(ctx, [hx + u * 0.05, hy + u * 0.12, hx + u * 0.34, hy + u * 0.1, hx + u * 0.12, hy + u * 0.6], '#d8d4cc');
            break;
        }
        case 'sera': {
            // Long braided hair with leaf circlet
            ctx.fillStyle = '#6b3a1e';
            ellipse(ctx, hx - u * 0.08, hy - u * 0.12, u * 0.38, u * 0.3);
            ctx.fillStyle = '#6b3a1e';
            ellipse(ctx, hx - u * 0.32, hy + u * 0.28, u * 0.12, u * 0.36);
            ctx.strokeStyle = accent;
            ctx.lineWidth = Math.max(0.8, u * 0.08);
            ctx.beginPath();
            ctx.arc(hx, hy - u * 0.02, u * 0.34, Math.PI * 1.1, Math.PI * 1.9);
            ctx.stroke();
            break;
        }
        case 'dante': {
            // Spiky white hair crackling with accent
            ctx.fillStyle = '#e6eef5';
            poly(ctx, [
                hx - u * 0.36, hy - u * 0.02,
                hx - u * 0.52, hy - u * 0.35,
                hx - u * 0.2, hy - u * 0.32,
                hx - u * 0.18, hy - u * 0.62,
                hx + u * 0.02, hy - u * 0.36,
                hx + u * 0.2, hy - u * 0.58,
                hx + u * 0.26, hy - u * 0.28,
                hx + u * 0.36, hy - u * 0.18
            ], '#e6eef5');
            ctx.strokeStyle = accent;
            ctx.lineWidth = Math.max(0.7, u * 0.05);
            ctx.beginPath();
            ctx.moveTo(hx - u * 0.18, hy - u * 0.62);
            ctx.lineTo(hx - u * 0.1, hy - u * 0.45);
            ctx.lineTo(hx - u * 0.2, hy - u * 0.4);
            ctx.stroke();
            break;
        }
        case 'luna': {
            // Nun's veil — pale cowl with accent trim
            ctx.fillStyle = '#e9e4ef';
            ctx.beginPath();
            ctx.moveTo(hx + u * 0.3, hy - u * 0.28);
            ctx.quadraticCurveTo(hx - u * 0.1, hy - u * 0.55, hx - u * 0.45, hy - u * 0.2);
            ctx.quadraticCurveTo(hx - u * 0.62, hy + u * 0.4, hx - u * 0.35, hy + u * 0.55);
            ctx.lineTo(hx - u * 0.12, hy + u * 0.2);
            ctx.quadraticCurveTo(hx - u * 0.2, hy - u * 0.2, hx + u * 0.3, hy - u * 0.16);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = accent;
            ctx.lineWidth = Math.max(0.8, u * 0.07);
            ctx.beginPath();
            ctx.moveTo(hx + u * 0.3, hy - u * 0.22);
            ctx.quadraticCurveTo(hx - u * 0.1, hy - u * 0.45, hx - u * 0.4, hy - u * 0.15);
            ctx.stroke();
            break;
        }
        case 'viktor': {
            // Fur ushanka + frosted beard
            ctx.fillStyle = '#6e5a48';
            ellipse(ctx, hx - u * 0.02, hy - u * 0.28, u * 0.44, u * 0.24);
            ctx.fillStyle = '#8a745e';
            ellipse(ctx, hx - u * 0.02, hy - u * 0.16, u * 0.46, u * 0.1);
            ctx.fillStyle = '#6e5a48';
            ellipse(ctx, hx - u * 0.3, hy + u * 0.05, u * 0.12, u * 0.22);
            ctx.fillStyle = shade(accent, 0.5);
            ellipse(ctx, hx + u * 0.16, hy + u * 0.24, u * 0.2, u * 0.13);
            break;
        }
        case 'nyx': {
            // Deep hood with mask — only glowing eyes visible
            ctx.fillStyle = '#1e1628';
            ctx.beginPath();
            ctx.moveTo(hx + u * 0.4, hy + u * 0.3);
            ctx.quadraticCurveTo(hx + u * 0.45, hy - u * 0.55, hx - u * 0.1, hy - u * 0.55);
            ctx.quadraticCurveTo(hx - u * 0.6, hy - u * 0.45, hx - u * 0.45, hy + u * 0.3);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#0b0810';
            ellipse(ctx, hx + u * 0.12, hy + u * 0.02, u * 0.24, u * 0.26);
            glowEye(ctx, hx + u * 0.2, hy - u * 0.04, u * 0.05, accent);
            break;
        }
        case 'antonio':
        default: {
            // Wide-brim hunter hat with accent band
            ctx.fillStyle = '#1c1720';
            ellipse(ctx, hx, hy - u * 0.22, u * 0.66, u * 0.13, -0.06);
            ctx.fillStyle = '#231d28';
            ctx.beginPath();
            ctx.moveTo(hx - u * 0.3, hy - u * 0.24);
            ctx.lineTo(hx - u * 0.26, hy - u * 0.62);
            ctx.quadraticCurveTo(hx, hy - u * 0.7, hx + u * 0.26, hy - u * 0.62);
            ctx.lineTo(hx + u * 0.3, hy - u * 0.26);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = accent;
            ctx.fillRect(hx - u * 0.29, hy - u * 0.36, u * 0.58, u * 0.1);
            // Hair tuft
            ctx.fillStyle = '#3a2418';
            ellipse(ctx, hx - u * 0.26, hy - u * 0.04, u * 0.12, u * 0.18);
            break;
        }
    }
}

const hunterCache = new Map();

/**
 * Baked hunter sprite. `variant`: 'normal' | 'wounded' | 'flash' | 'silhouette'.
 */
export function getHunterSprite(u, color, charId, frame, variant = 'normal') {
    const size = Math.max(6, Math.round(u));
    const key = `${size}|${color}|${charId}|${frame}|${variant}`;
    let s = hunterCache.get(key);
    if (s !== undefined) return s;
    const box = { l: -size * 1.35, r: size * 1.35, t: -size * 3.8, b: size * 0.2 };
    s = bakeSprite(
        box,
        (ctx) => paintHunter(ctx, size, color, charId, frame, variant === 'wounded'),
        {
            outline: Math.max(1, size * 0.09),
            flash: variant === 'flash',
            tint: variant === 'silhouette' ? '#0d0a12' : null
        }
    );
    hunterCache.set(key, s);
    return s;
}

export { HUNTER_FRAMES };

// ======================================================================
// ENEMIES
// ======================================================================

/**
 * Per-archetype layout: visual scale relative to hitbox radius, how high
 * the feet sit below the entity center, whether it flies (no stepping),
 * and the painter-space box.
 */
export const ENEMY_LAYOUT = {
    basic: { scale: 1.4, feet: 1.0, fly: false, box: [-1.3, 1.5, -2.8, 0.2] },
    fast: { scale: 1.55, feet: 0.2, fly: true, box: [-1.7, 1.7, -2.6, -0.4] },
    tank: { scale: 1.1, feet: 1.0, fly: false, box: [-1.4, 1.6, -2.6, 0.2] },
    ranged: { scale: 1.5, feet: 1.0, fly: false, box: [-1.2, 1.5, -2.7, 0.2] },
    elite: { scale: 1.15, feet: 1.0, fly: false, box: [-1.6, 1.8, -3.0, 0.2] },
    berserker: { scale: 1.12, feet: 1.0, fly: false, box: [-1.5, 1.6, -2.4, 0.2] },
    summoner: { scale: 1.15, feet: 1.0, fly: false, box: [-1.2, 1.5, -3.1, 0.2] },
    juggernaut: { scale: 1.05, feet: 1.0, fly: false, box: [-1.5, 1.6, -2.5, 0.2] },
    wraith: { scale: 1.35, feet: 0.4, fly: true, box: [-1.4, 1.4, -2.6, 0.2] },
    demon: { scale: 1.05, feet: 0.9, fly: false, box: [-1.9, 1.9, -2.9, 0.2] }
};

function enemyPalette(color) {
    return {
        accent: color,
        accentDark: shade(color, -0.5),
        accentLight: shade(color, 0.35),
        eye: mix(color, '#ffb347', 0.55)
    };
}

// --- Ghoul: hunched shambler, arms reaching ---------------------------
function paintGhoul(ctx, u, p, frame) {
    const skin = mix('#7e8a6c', p.accent, 0.18);
    const skinDark = shade(skin, -0.35);
    const rag = mix('#3a2f3a', p.accent, 0.3);
    const step = frame === 0 ? 1 : -1;

    // Legs
    bentLimb(ctx, -u * 0.15, -u * 0.95, -u * 0.2 - step * u * 0.15, -u * 0.5, -u * 0.25 - step * u * 0.3, -u * 0.05, u * 0.24, skinDark);
    bentLimb(ctx, u * 0.1, -u * 0.95, u * 0.15 + step * u * 0.15, -u * 0.5, u * 0.2 + step * u * 0.3, -u * 0.05, u * 0.26, skin);

    // Back arm
    limb(ctx, u * 0.0, -u * 1.7, u * 0.85, -u * 1.45 + step * u * 0.08, u * 0.2, skinDark);

    // Hunched torso
    ctx.fillStyle = skin;
    ellipse(ctx, u * 0.02, -u * 1.45, u * 0.58, u * 0.62, 0.35);
    // Tattered shirt
    ctx.fillStyle = rag;
    ctx.beginPath();
    ctx.moveTo(-u * 0.55, -u * 1.55);
    ctx.quadraticCurveTo(u * 0.1, -u * 2.0, u * 0.5, -u * 1.5);
    ctx.lineTo(u * 0.45, -u * 1.0);
    ctx.lineTo(u * 0.25, -u * 0.85);
    ctx.lineTo(u * 0.1, -u * 1.0);
    ctx.lineTo(-u * 0.12, -u * 0.8);
    ctx.lineTo(-u * 0.3, -u * 1.0);
    ctx.lineTo(-u * 0.5, -u * 0.88);
    ctx.closePath();
    ctx.fill();
    // Rib slash
    ctx.strokeStyle = skinDark;
    ctx.lineWidth = Math.max(0.6, u * 0.06);
    ctx.beginPath();
    ctx.moveTo(u * 0.05, -u * 1.45);
    ctx.lineTo(u * 0.3, -u * 1.3);
    ctx.stroke();

    // Head thrust forward
    const hx = u * 0.5;
    const hy = -u * 1.95;
    ctx.fillStyle = skin;
    ellipse(ctx, hx, hy, u * 0.38, u * 0.36);
    ctx.fillStyle = skinDark;
    ellipse(ctx, hx + u * 0.12, hy + u * 0.2, u * 0.22, u * 0.12);
    // Sparse hair
    ctx.strokeStyle = '#2a2224';
    ctx.lineWidth = Math.max(0.6, u * 0.05);
    ctx.beginPath();
    ctx.moveTo(hx - u * 0.2, hy - u * 0.3);
    ctx.lineTo(hx - u * 0.35, hy - u * 0.5);
    ctx.moveTo(hx - u * 0.05, hy - u * 0.34);
    ctx.lineTo(hx - u * 0.1, hy - u * 0.55);
    ctx.stroke();
    glowEye(ctx, hx + u * 0.2, hy - u * 0.06, u * 0.08, p.eye);

    // Front arm reaching
    limb(ctx, u * 0.15, -u * 1.6, u * 1.05, -u * 1.55 - step * u * 0.08, u * 0.22, skin);
    ctx.fillStyle = skin;
    ellipse(ctx, u * 1.1, -u * 1.55 - step * u * 0.08, u * 0.13, u * 0.11);
}

// --- Bat: flapping, wide membranous wings ------------------------------
function paintBat(ctx, u, p, frame) {
    const body = mix('#2c2230', p.accent, 0.25);
    const wing = mix('#3a2440', p.accent, 0.35);
    const wingDark = shade(wing, -0.35);
    const cy = -u * 1.45;
    const up = frame === 0;

    const tipY = up ? cy - u * 1.0 : cy + u * 0.35;
    const midY = up ? cy - u * 0.55 : cy + u * 0.1;
    for (const side of [-1, 1]) {
        ctx.fillStyle = side < 0 ? wingDark : wing;
        ctx.beginPath();
        ctx.moveTo(side * u * 0.2, cy - u * 0.15);
        ctx.quadraticCurveTo(side * u * 0.8, midY - u * 0.25, side * u * 1.5, tipY);
        // scalloped trailing edge
        ctx.quadraticCurveTo(side * u * 1.2, tipY + u * 0.35, side * u * 1.0, midY + u * 0.25);
        ctx.quadraticCurveTo(side * u * 0.75, midY + u * 0.2, side * u * 0.55, midY + u * 0.45);
        ctx.quadraticCurveTo(side * u * 0.4, cy + u * 0.1, side * u * 0.2, cy + u * 0.2);
        ctx.closePath();
        ctx.fill();
        // wing bone
        limb(ctx, side * u * 0.2, cy - u * 0.12, side * u * 1.5, tipY, u * 0.08, shade(wing, 0.3));
    }

    // Body + ears
    ctx.fillStyle = body;
    ellipse(ctx, 0, cy, u * 0.42, u * 0.46);
    poly(ctx, [-u * 0.28, cy - u * 0.25, -u * 0.18, cy - u * 0.75, -u * 0.02, cy - u * 0.32], body);
    poly(ctx, [u * 0.08, cy - u * 0.32, u * 0.26, cy - u * 0.78, u * 0.34, cy - u * 0.22], body);
    // Fangs
    ctx.fillStyle = '#f2ece0';
    poly(ctx, [u * 0.12, cy + u * 0.18, u * 0.18, cy + u * 0.34, u * 0.22, cy + u * 0.16], '#f2ece0');
    glowEye(ctx, u * 0.2, cy - u * 0.05, u * 0.09, p.eye);
    glowEye(ctx, -u * 0.04, cy - u * 0.05, u * 0.07, p.eye);
}

// --- Armored brute: plate, shield, visor -------------------------------
function paintBrute(ctx, u, p, frame) {
    const steel = mix('#56606e', p.accent, 0.22);
    const steelDark = shade(steel, -0.45);
    const steelLight = shade(steel, 0.35);
    const step = frame === 0 ? 1 : -1;

    // Legs — thick greaves
    limb(ctx, -u * 0.25, -u * 0.8, -u * 0.3 - step * u * 0.18, -u * 0.08, u * 0.34, steelDark);
    limb(ctx, u * 0.2, -u * 0.8, u * 0.25 + step * u * 0.18, -u * 0.08, u * 0.36, steel);
    ctx.fillStyle = steelDark;
    ellipse(ctx, -u * 0.3 - step * u * 0.18, -u * 0.06, u * 0.24, u * 0.1);
    ellipse(ctx, u * 0.3 + step * u * 0.18, -u * 0.06, u * 0.26, u * 0.1);

    // Torso — broad plated barrel
    ctx.fillStyle = steel;
    ctx.beginPath();
    ctx.moveTo(-u * 0.8, -u * 1.75);
    ctx.quadraticCurveTo(0, -u * 2.05, u * 0.75, -u * 1.75);
    ctx.lineTo(u * 0.6, -u * 0.75);
    ctx.quadraticCurveTo(0, -u * 0.6, -u * 0.62, -u * 0.75);
    ctx.closePath();
    ctx.fill();
    // Plate seams
    ctx.strokeStyle = steelDark;
    ctx.lineWidth = Math.max(0.7, u * 0.06);
    ctx.beginPath();
    ctx.moveTo(-u * 0.68, -u * 1.3);
    ctx.quadraticCurveTo(0, -u * 1.45, u * 0.66, -u * 1.3);
    ctx.moveTo(-u * 0.62, -u * 1.0);
    ctx.quadraticCurveTo(0, -u * 1.12, u * 0.62, -u * 1.0);
    ctx.stroke();
    // Rim light
    ctx.strokeStyle = steelLight;
    ctx.lineWidth = Math.max(0.7, u * 0.07);
    ctx.beginPath();
    ctx.moveTo(-u * 0.6, -u * 1.82);
    ctx.quadraticCurveTo(0, -u * 2.0, u * 0.6, -u * 1.8);
    ctx.stroke();

    // Pauldrons
    ctx.fillStyle = steelLight;
    ellipse(ctx, -u * 0.72, -u * 1.7, u * 0.34, u * 0.26);
    ctx.fillStyle = steel;
    ellipse(ctx, u * 0.68, -u * 1.72, u * 0.34, u * 0.26);

    // Helm
    const hx = u * 0.12;
    const hy = -u * 2.1;
    ctx.fillStyle = steelDark;
    ellipse(ctx, hx, hy, u * 0.36, u * 0.36);
    ctx.fillStyle = steel;
    ellipse(ctx, hx, hy - u * 0.08, u * 0.34, u * 0.26);
    ctx.fillStyle = '#0a0709';
    ctx.fillRect(hx - u * 0.08, hy - u * 0.04, u * 0.42, u * 0.1);
    ctx.fillStyle = p.eye;
    ctx.fillRect(hx + u * 0.1, hy - u * 0.03, u * 0.22, u * 0.07);
    // Helm crest
    poly(ctx, [hx - u * 0.3, hy - u * 0.2, hx - u * 0.05, hy - u * 0.62, hx + u * 0.05, hy - u * 0.3], p.accent);

    // Tower shield held forward
    const sx = u * 0.95;
    ctx.fillStyle = mix('#3a2e2a', p.accent, 0.35);
    ctx.beginPath();
    ctx.moveTo(sx - u * 0.25, -u * 1.9);
    ctx.lineTo(sx + u * 0.3, -u * 1.9);
    ctx.lineTo(sx + u * 0.3, -u * 1.0);
    ctx.quadraticCurveTo(sx + u * 0.05, -u * 0.55, sx - u * 0.25, -u * 1.0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#b09048';
    ctx.lineWidth = Math.max(0.8, u * 0.07);
    ctx.stroke();
    ctx.fillStyle = p.accent;
    ellipse(ctx, sx + u * 0.03, -u * 1.4, u * 0.1, u * 0.14);
}

// --- Cultist acolyte: hooded robe, glowing orb --------------------------
function paintAcolyte(ctx, u, p, frame) {
    const robe = mix('#3a2436', p.accent, 0.3);
    const robeDark = shade(robe, -0.45);
    const sway = frame === 0 ? u * 0.08 : -u * 0.08;

    // Robe bell
    ctx.fillStyle = robe;
    ctx.beginPath();
    ctx.moveTo(-u * 0.3, -u * 1.95);
    ctx.quadraticCurveTo(u * 0.3, -u * 2.05, u * 0.42, -u * 1.7);
    ctx.quadraticCurveTo(u * 0.6, -u * 0.8, u * 0.72 + sway, -u * 0.02);
    ctx.lineTo(u * 0.25 + sway, -u * 0.12);
    ctx.lineTo(-u * 0.1 + sway, 0);
    ctx.lineTo(-u * 0.45 + sway, -u * 0.12);
    ctx.lineTo(-u * 0.75 + sway, -u * 0.02);
    ctx.quadraticCurveTo(-u * 0.6, -u * 1.0, -u * 0.3, -u * 1.95);
    ctx.closePath();
    ctx.fill();
    // Robe fold + trim
    ctx.fillStyle = robeDark;
    ctx.beginPath();
    ctx.moveTo(-u * 0.05, -u * 1.7);
    ctx.quadraticCurveTo(-u * 0.15, -u * 0.9, -u * 0.1 + sway, -u * 0.05);
    ctx.lineTo(-u * 0.3 + sway, -u * 0.1);
    ctx.quadraticCurveTo(-u * 0.3, -u * 1.0, -u * 0.05, -u * 1.7);
    ctx.fill();
    ctx.strokeStyle = '#b08a3e';
    ctx.lineWidth = Math.max(0.7, u * 0.06);
    ctx.beginPath();
    ctx.moveTo(-u * 0.75 + sway, -u * 0.05);
    ctx.lineTo(-u * 0.45 + sway, -u * 0.15);
    ctx.lineTo(-u * 0.1 + sway, -u * 0.03);
    ctx.lineTo(u * 0.25 + sway, -u * 0.15);
    ctx.lineTo(u * 0.72 + sway, -u * 0.05);
    ctx.stroke();

    // Hood
    const hx = u * 0.1;
    const hy = -u * 2.05;
    ctx.fillStyle = robe;
    ctx.beginPath();
    ctx.moveTo(hx + u * 0.45, hy + u * 0.25);
    ctx.quadraticCurveTo(hx + u * 0.4, hy - u * 0.5, hx - u * 0.15, hy - u * 0.62);
    ctx.quadraticCurveTo(hx - u * 0.55, hy - u * 0.3, hx - u * 0.45, hy + u * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#08060a';
    ellipse(ctx, hx + u * 0.15, hy, u * 0.24, u * 0.28);
    glowEye(ctx, hx + u * 0.26, hy - u * 0.04, u * 0.06, p.eye);
    glowEye(ctx, hx + u * 0.08, hy - u * 0.04, u * 0.05, p.eye);

    // Arms forward cupping the orb
    limb(ctx, u * 0.1, -u * 1.65, u * 0.72, -u * 1.25, u * 0.2, robeDark);
    ctx.fillStyle = rgba(p.accent, 0.35);
    ellipse(ctx, u * 0.95, -u * 1.3, u * 0.36, u * 0.36);
    ctx.fillStyle = p.accentLight;
    ellipse(ctx, u * 0.95, -u * 1.3, u * 0.2, u * 0.2);
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, u * 0.9, -u * 1.36, u * 0.07, u * 0.07);
    limb(ctx, u * 0.2, -u * 1.6, u * 0.78, -u * 1.15, u * 0.2, robe);
}

// --- Dreadlord: horned knight, cape, greatsword ------------------------
function paintDreadlord(ctx, u, p, frame) {
    const armor = '#2a2430';
    const armorLight = '#5a5064';
    const cape = shade(p.accent, -0.3);
    const step = frame === 0 ? 1 : -1;

    // Cape behind
    ctx.fillStyle = cape;
    ctx.beginPath();
    ctx.moveTo(-u * 0.2, -u * 2.2);
    ctx.quadraticCurveTo(-u * 1.1, -u * 1.6, -u * 1.35 - step * u * 0.1, -u * 0.1);
    ctx.lineTo(-u * 0.9, -u * 0.3);
    ctx.lineTo(-u * 0.6 - step * u * 0.05, -u * 0.05);
    ctx.lineTo(-u * 0.2, -u * 0.6);
    ctx.closePath();
    ctx.fill();

    // Legs
    limb(ctx, -u * 0.18, -u * 0.95, -u * 0.25 - step * u * 0.25, -u * 0.08, u * 0.3, '#18141c');
    limb(ctx, u * 0.15, -u * 0.95, u * 0.2 + step * u * 0.25, -u * 0.08, u * 0.32, armor);

    // Torso
    ctx.fillStyle = armor;
    ctx.beginPath();
    ctx.moveTo(-u * 0.6, -u * 2.15);
    ctx.lineTo(u * 0.6, -u * 2.15);
    ctx.lineTo(u * 0.42, -u * 0.9);
    ctx.lineTo(-u * 0.42, -u * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = armorLight;
    ctx.lineWidth = Math.max(0.7, u * 0.06);
    ctx.beginPath();
    ctx.moveTo(0, -u * 2.05);
    ctx.lineTo(0, -u * 1.0);
    ctx.stroke();
    ctx.fillStyle = p.accent;
    ellipse(ctx, 0, -u * 1.7, u * 0.12, u * 0.12);

    // Pauldrons with spikes
    ctx.fillStyle = armorLight;
    ellipse(ctx, -u * 0.58, -u * 2.08, u * 0.3, u * 0.2);
    ellipse(ctx, u * 0.58, -u * 2.08, u * 0.3, u * 0.2);
    poly(ctx, [-u * 0.75, -u * 2.2, -u * 0.95, -u * 2.55, -u * 0.55, -u * 2.25], '#cfc6b4');
    poly(ctx, [u * 0.55, -u * 2.25, u * 0.95, -u * 2.55, u * 0.75, -u * 2.2], '#cfc6b4');

    // Horned helm
    const hx = u * 0.08;
    const hy = -u * 2.45;
    ctx.fillStyle = armor;
    ellipse(ctx, hx, hy, u * 0.32, u * 0.34);
    ctx.strokeStyle = '#d9cfb8';
    ctx.lineWidth = Math.max(1, u * 0.13);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx - u * 0.2, hy - u * 0.2);
    ctx.quadraticCurveTo(hx - u * 0.6, hy - u * 0.4, hx - u * 0.5, hy - u * 0.85);
    ctx.moveTo(hx + u * 0.2, hy - u * 0.2);
    ctx.quadraticCurveTo(hx + u * 0.6, hy - u * 0.4, hx + u * 0.55, hy - u * 0.85);
    ctx.stroke();
    ctx.fillStyle = '#060407';
    ctx.fillRect(hx - u * 0.05, hy - u * 0.05, u * 0.34, u * 0.1);
    glowEye(ctx, hx + u * 0.2, hy, u * 0.06, p.eye);

    // Greatsword
    const gx = u * 0.7;
    const gy = -u * 1.4;
    limb(ctx, u * 0.3, -u * 1.9, gx, gy, u * 0.24, armor);
    ctx.strokeStyle = '#c9ccd6';
    ctx.lineWidth = Math.max(1, u * 0.14);
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + u * 0.9, gy - u * 1.0);
    ctx.stroke();
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = Math.max(0.6, u * 0.04);
    ctx.beginPath();
    ctx.moveTo(gx + u * 0.1, gy - u * 0.1);
    ctx.lineTo(gx + u * 0.85, gy - u * 0.93);
    ctx.stroke();
    ctx.fillStyle = '#b08a3e';
    poly(ctx, [gx - u * 0.12, gy - u * 0.12, gx + u * 0.12, gy + u * 0.12, gx + u * 0.02, gy + u * 0.02], '#b08a3e');
    limb(ctx, gx - u * 0.18, gy + u * 0.02, gx + u * 0.16, gy - u * 0.22, u * 0.08, '#b08a3e');
}

// --- Berserker: hunched spiked beast, claws ----------------------------
function paintBerserker(ctx, u, p, frame) {
    const fur = mix('#3b2a26', p.accent, 0.3);
    const furDark = shade(fur, -0.45);
    const furLight = shade(fur, 0.3);
    const step = frame === 0 ? 1 : -1;

    // Legs (digitigrade)
    bentLimb(ctx, -u * 0.35, -u * 0.85, -u * 0.55 - step * u * 0.15, -u * 0.45, -u * 0.4 - step * u * 0.25, -u * 0.05, u * 0.26, furDark);
    bentLimb(ctx, u * 0.2, -u * 0.85, u * 0.0 + step * u * 0.15, -u * 0.45, u * 0.25 + step * u * 0.25, -u * 0.05, u * 0.28, fur);

    // Hunched body with dorsal spikes
    ctx.fillStyle = fur;
    ellipse(ctx, -u * 0.05, -u * 1.25, u * 0.8, u * 0.55, -0.2);
    for (let i = 0; i < 5; i++) {
        const t = i / 4;
        const bx = -u * 0.65 + t * u * 0.95;
        const by = -u * 1.6 - Math.sin(t * Math.PI) * u * 0.25;
        poly(ctx, [bx - u * 0.12, by + u * 0.1, bx - u * 0.05, by - u * 0.42, bx + u * 0.12, by + u * 0.08], furLight);
    }
    // Belly fur highlight
    ctx.fillStyle = furDark;
    ellipse(ctx, u * 0.1, -u * 1.0, u * 0.45, u * 0.22, -0.2);

    // Back claw arm
    limb(ctx, u * 0.25, -u * 1.35, u * 0.8, -u * 0.8 + step * u * 0.1, u * 0.22, furDark);

    // Wolf-like head with snout
    const hx = u * 0.7;
    const hy = -u * 1.55;
    ctx.fillStyle = fur;
    ellipse(ctx, hx, hy, u * 0.36, u * 0.32);
    poly(ctx, [hx + u * 0.15, hy - u * 0.15, hx + u * 0.8, hy + u * 0.02, hx + u * 0.15, hy + u * 0.22], fur);
    poly(ctx, [hx - u * 0.2, hy - u * 0.2, hx - u * 0.15, hy - u * 0.62, hx + u * 0.05, hy - u * 0.25], furDark);
    // Jaw + teeth
    ctx.fillStyle = '#1a0a0c';
    poly(ctx, [hx + u * 0.2, hy + u * 0.1, hx + u * 0.72, hy + u * 0.08, hx + u * 0.25, hy + u * 0.25], '#1a0a0c');
    ctx.fillStyle = '#efe6d2';
    poly(ctx, [hx + u * 0.45, hy + u * 0.08, hx + u * 0.5, hy + u * 0.2, hx + u * 0.55, hy + u * 0.08], '#efe6d2');
    glowEye(ctx, hx + u * 0.18, hy - u * 0.08, u * 0.08, '#ff3b2a');

    // Front claw arm
    limb(ctx, u * 0.35, -u * 1.25, u * 1.0, -u * 0.85 - step * u * 0.1, u * 0.24, fur);
    ctx.strokeStyle = '#efe6d2';
    ctx.lineWidth = Math.max(0.6, u * 0.06);
    ctx.beginPath();
    const cx = u * 1.0;
    const cy = -u * 0.85 - step * u * 0.1;
    for (let i = -1; i <= 1; i++) {
        ctx.moveTo(cx, cy + i * u * 0.07);
        ctx.lineTo(cx + u * 0.22, cy + i * u * 0.1 + u * 0.08);
    }
    ctx.stroke();
}

// --- Necromancer: tall pointed hood, skull staff ------------------------
function paintNecromancer(ctx, u, p, frame) {
    const robe = '#1f1a26';
    const robeTrim = mix('#4a3d56', p.accent, 0.5);
    const sway = frame === 0 ? u * 0.07 : -u * 0.07;

    // Staff behind hand
    const sx = u * 0.85;
    ctx.strokeStyle = '#4a3528';
    ctx.lineWidth = Math.max(1, u * 0.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx - u * 0.1, -u * 0.05);
    ctx.lineTo(sx + u * 0.05, -u * 2.7);
    ctx.stroke();
    // Skull + glow
    ctx.fillStyle = rgba(p.accent, 0.35);
    ellipse(ctx, sx + u * 0.05, -u * 2.8, u * 0.38, u * 0.38);
    ctx.fillStyle = '#e8e0cc';
    ellipse(ctx, sx + u * 0.05, -u * 2.82, u * 0.2, u * 0.18);
    ctx.fillStyle = '#e8e0cc';
    ctx.fillRect(sx - u * 0.06, -u * 2.72, u * 0.22, u * 0.1);
    ctx.fillStyle = p.accentLight;
    ellipse(ctx, sx + u * 0.1, -u * 2.84, u * 0.05, u * 0.05);
    ellipse(ctx, sx - u * 0.02, -u * 2.84, u * 0.05, u * 0.05);

    // Tall robe
    ctx.fillStyle = robe;
    ctx.beginPath();
    ctx.moveTo(-u * 0.25, -u * 2.2);
    ctx.quadraticCurveTo(u * 0.25, -u * 2.3, u * 0.4, -u * 1.95);
    ctx.quadraticCurveTo(u * 0.55, -u * 0.9, u * 0.62 + sway, 0);
    ctx.lineTo(-u * 0.7 + sway, 0);
    ctx.quadraticCurveTo(-u * 0.55, -u * 1.1, -u * 0.25, -u * 2.2);
    ctx.closePath();
    ctx.fill();
    // Trim stripe
    ctx.fillStyle = robeTrim;
    ctx.beginPath();
    ctx.moveTo(u * 0.05, -u * 1.9);
    ctx.lineTo(u * 0.2, -u * 1.9);
    ctx.lineTo(u * 0.25 + sway, 0);
    ctx.lineTo(u * 0.05 + sway, 0);
    ctx.closePath();
    ctx.fill();
    // Hem runes
    ctx.fillStyle = p.accent;
    for (let i = 0; i < 3; i++) {
        ellipse(ctx, -u * 0.45 + i * u * 0.3 + sway, -u * 0.18, u * 0.05, u * 0.05);
    }

    // Pointed hood
    const hx = u * 0.05;
    const hy = -u * 2.35;
    ctx.fillStyle = robe;
    ctx.beginPath();
    ctx.moveTo(hx + u * 0.4, hy + u * 0.25);
    ctx.quadraticCurveTo(hx + u * 0.35, hy - u * 0.35, hx - u * 0.35, hy - u * 0.95);
    ctx.quadraticCurveTo(hx - u * 0.45, hy - u * 0.2, hx - u * 0.4, hy + u * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#07050a';
    ellipse(ctx, hx + u * 0.14, hy + u * 0.02, u * 0.2, u * 0.24);
    glowEye(ctx, hx + u * 0.22, hy - u * 0.02, u * 0.055, p.accentLight);
    glowEye(ctx, hx + u * 0.08, hy - u * 0.02, u * 0.045, p.accentLight);

    // Bony hand on staff
    limb(ctx, u * 0.2, -u * 1.85, sx, -u * 1.55, u * 0.18, robe);
    ctx.fillStyle = '#d8d0bc';
    ellipse(ctx, sx + u * 0.02, -u * 1.55, u * 0.09, u * 0.1);
}

// --- Stone golem: boulder torso, rune cracks, huge fists ----------------
function paintGolem(ctx, u, p, frame) {
    const stone = '#58525a';
    const stoneDark = '#2e2a31';
    const stoneLight = '#8a8290';
    const rune = p.accentLight;
    const step = frame === 0 ? 1 : -1;

    // Stubby legs
    ctx.fillStyle = stoneDark;
    ellipse(ctx, -u * 0.4 - step * u * 0.12, -u * 0.35, u * 0.3, u * 0.38);
    ctx.fillStyle = stone;
    ellipse(ctx, u * 0.35 + step * u * 0.12, -u * 0.35, u * 0.32, u * 0.38);

    // Back fist
    ctx.fillStyle = stoneDark;
    ellipse(ctx, -u * 0.95, -u * 0.95 + step * u * 0.08, u * 0.34, u * 0.32);

    // Boulder torso
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.moveTo(-u * 0.95, -u * 1.2);
    ctx.lineTo(-u * 0.7, -u * 1.95);
    ctx.lineTo(-u * 0.1, -u * 2.2);
    ctx.lineTo(u * 0.65, -u * 2.0);
    ctx.lineTo(u * 0.95, -u * 1.35);
    ctx.lineTo(u * 0.75, -u * 0.6);
    ctx.lineTo(-u * 0.7, -u * 0.55);
    ctx.closePath();
    ctx.fill();
    // Top light facets
    poly(ctx, [-u * 0.7, -u * 1.95, -u * 0.1, -u * 2.2, u * 0.65, -u * 2.0, u * 0.3, -u * 1.75, -u * 0.4, -u * 1.75], stoneLight);
    // Moss
    ctx.fillStyle = '#3d4a30';
    ellipse(ctx, -u * 0.35, -u * 1.92, u * 0.22, u * 0.08);
    // Glowing rune cracks
    ctx.strokeStyle = rune;
    ctx.lineWidth = Math.max(0.7, u * 0.07);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-u * 0.3, -u * 1.55);
    ctx.lineTo(-u * 0.05, -u * 1.25);
    ctx.lineTo(-u * 0.25, -u * 0.95);
    ctx.moveTo(u * 0.3, -u * 1.5);
    ctx.lineTo(u * 0.15, -u * 1.1);
    ctx.stroke();

    // Small head sunk into shoulders
    const hx = u * 0.35;
    const hy = -u * 2.12;
    ctx.fillStyle = stoneDark;
    ellipse(ctx, hx, hy, u * 0.26, u * 0.22);
    ctx.fillStyle = rune;
    ctx.fillRect(hx - u * 0.02, hy - u * 0.04, u * 0.22, u * 0.07);

    // Front fist
    ctx.fillStyle = stone;
    ellipse(ctx, u * 1.0, -u * 0.95 - step * u * 0.08, u * 0.38, u * 0.34);
    ctx.fillStyle = stoneLight;
    ellipse(ctx, u * 1.05, -u * 1.08 - step * u * 0.08, u * 0.18, u * 0.1);
}

// --- Wraith: floating shroud with trailing tatters ----------------------
function paintWraith(ctx, u, p, frame) {
    const shroud = mix('#b8b0d8', p.accent, 0.35);
    const shroudDark = shade(shroud, -0.45);
    const wave = frame === 0 ? 1 : -1;

    // Tattered tail
    ctx.fillStyle = rgba(shroudDark, 0.9);
    ctx.beginPath();
    ctx.moveTo(-u * 0.55, -u * 1.5);
    ctx.quadraticCurveTo(-u * 0.9, -u * 0.8, -u * 1.1, -u * 0.2 + wave * u * 0.1);
    ctx.lineTo(-u * 0.7, -u * 0.45);
    ctx.lineTo(-u * 0.55, -u * 0.05 - wave * u * 0.1);
    ctx.lineTo(-u * 0.3, -u * 0.5);
    ctx.lineTo(-u * 0.05, -u * 0.1 + wave * u * 0.1);
    ctx.lineTo(u * 0.15, -u * 0.6);
    ctx.quadraticCurveTo(u * 0.5, -u * 1.0, u * 0.5, -u * 1.5);
    ctx.closePath();
    ctx.fill();

    // Main shroud
    ctx.fillStyle = shroud;
    ctx.beginPath();
    ctx.moveTo(u * 0.55, -u * 1.55);
    ctx.quadraticCurveTo(u * 0.5, -u * 2.45, -u * 0.05, -u * 2.45);
    ctx.quadraticCurveTo(-u * 0.6, -u * 2.4, -u * 0.62, -u * 1.6);
    ctx.quadraticCurveTo(-u * 0.6, -u * 1.0, -u * 0.25, -u * 0.8);
    ctx.quadraticCurveTo(u * 0.25, -u * 0.95, u * 0.55, -u * 1.55);
    ctx.closePath();
    ctx.fill();

    // Face hollow
    ctx.fillStyle = '#0c0814';
    ellipse(ctx, u * 0.15, -u * 1.85, u * 0.28, u * 0.33);
    glowEye(ctx, u * 0.25, -u * 1.9, u * 0.07, p.accentLight);
    glowEye(ctx, u * 0.05, -u * 1.9, u * 0.06, p.accentLight);
    ctx.fillStyle = '#1a1024';
    ellipse(ctx, u * 0.15, -u * 1.65, u * 0.08, u * 0.1);

    // Reaching arm
    ctx.strokeStyle = shroud;
    ctx.lineWidth = Math.max(0.8, u * 0.2);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(u * 0.3, -u * 1.4);
    ctx.quadraticCurveTo(u * 0.8, -u * 1.3 + wave * u * 0.1, u * 1.1, -u * 1.55 + wave * u * 0.1);
    ctx.stroke();
}

// --- Demon: horned, bat-winged, tailed -----------------------------------
function paintDemon(ctx, u, p, frame) {
    const skin = mix('#8a1f24', p.accent, 0.3);
    const skinDark = shade(skin, -0.45);
    const skinLight = shade(skin, 0.3);
    const wing = '#2a1218';
    const up = frame === 0;
    const step = up ? 1 : -1;

    // Wings (behind)
    const tipY = up ? -u * 2.85 : -u * 1.6;
    for (const side of [-1, 0.6]) {
        ctx.fillStyle = side < 0 ? shade(wing, -0.2) : wing;
        ctx.beginPath();
        ctx.moveTo(-u * 0.1, -u * 1.85);
        ctx.quadraticCurveTo(side * u * 1.0, tipY + u * 0.1, side * u * 1.75, tipY);
        ctx.quadraticCurveTo(side * u * 1.5, tipY + u * 0.55, side * u * 1.25, tipY + u * 0.7);
        ctx.quadraticCurveTo(side * u * 0.9, tipY + u * 0.6, side * u * 0.7, -u * 1.25);
        ctx.quadraticCurveTo(side * u * 0.3, -u * 1.3, -u * 0.1, -u * 1.4);
        ctx.closePath();
        ctx.fill();
        limb(ctx, -u * 0.1, -u * 1.85, side * u * 1.75, tipY, u * 0.08, '#5a2a30');
    }

    // Tail
    ctx.strokeStyle = skinDark;
    ctx.lineWidth = Math.max(0.8, u * 0.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-u * 0.3, -u * 0.95);
    ctx.quadraticCurveTo(-u * 1.1, -u * 0.8, -u * 1.2, -u * 0.35 - step * u * 0.1);
    ctx.stroke();
    poly(ctx, [-u * 1.2, -u * 0.5 - step * u * 0.1, -u * 1.42, -u * 0.25 - step * u * 0.1, -u * 1.05, -u * 0.25 - step * u * 0.1], skinDark);

    // Legs (goat-like)
    bentLimb(ctx, -u * 0.15, -u * 0.95, -u * 0.35 - step * u * 0.1, -u * 0.5, -u * 0.2 - step * u * 0.2, -u * 0.05, u * 0.24, skinDark);
    bentLimb(ctx, u * 0.15, -u * 0.95, -u * 0.05 + step * u * 0.1, -u * 0.5, u * 0.2 + step * u * 0.2, -u * 0.05, u * 0.26, skin);

    // Torso
    ctx.fillStyle = skin;
    ellipse(ctx, 0, -u * 1.45, u * 0.5, u * 0.62);
    ctx.fillStyle = skinLight;
    ellipse(ctx, u * 0.15, -u * 1.5, u * 0.22, u * 0.35);

    // Head + horns
    const hx = u * 0.18;
    const hy = -u * 2.15;
    ctx.fillStyle = skin;
    ellipse(ctx, hx, hy, u * 0.33, u * 0.32);
    ctx.fillStyle = '#e6d9b8';
    ctx.beginPath();
    ctx.moveTo(hx - u * 0.15, hy - u * 0.2);
    ctx.quadraticCurveTo(hx - u * 0.35, hy - u * 0.6, hx - u * 0.1, hy - u * 0.75);
    ctx.quadraticCurveTo(hx - u * 0.15, hy - u * 0.45, hx + u * 0.02, hy - u * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx + u * 0.12, hy - u * 0.25);
    ctx.quadraticCurveTo(hx + u * 0.2, hy - u * 0.65, hx + u * 0.45, hy - u * 0.72);
    ctx.quadraticCurveTo(hx + u * 0.3, hy - u * 0.45, hx + u * 0.28, hy - u * 0.2);
    ctx.closePath();
    ctx.fill();
    glowEye(ctx, hx + u * 0.18, hy - u * 0.02, u * 0.07, '#ffd24a');
    ctx.fillStyle = '#1a0608';
    ctx.fillRect(hx + u * 0.05, hy + u * 0.14, u * 0.24, u * 0.05);

    // Claw arm
    limb(ctx, u * 0.2, -u * 1.75, u * 0.8, -u * 1.35 + step * u * 0.08, u * 0.2, skin);
    ctx.fillStyle = '#ffb040';
    ctx.fillStyle = rgba('#ff8a2a', 0.45);
    ellipse(ctx, u * 0.88, -u * 1.35 + step * u * 0.08, u * 0.2, u * 0.2);
}

const ENEMY_PAINTERS = {
    basic: paintGhoul,
    fast: paintBat,
    tank: paintBrute,
    ranged: paintAcolyte,
    elite: paintDreadlord,
    berserker: paintBerserker,
    summoner: paintNecromancer,
    juggernaut: paintGolem,
    wraith: paintWraith,
    demon: paintDemon
};

const enemyCache = new Map();

/**
 * Get (baking on first use) the sprite for an enemy archetype.
 * `size` is the enemy hitbox radius; `variant` is 'normal' | 'flash' | 'gold' | 'frost'.
 */
export function getEnemySprite(type, color, size, frame, variant = 'normal') {
    const kind = ENEMY_PAINTERS[type] ? type : 'basic';
    const r = Math.max(3, Math.round(size));
    const key = `${kind}|${color}|${r}|${frame}|${variant}`;
    let s = enemyCache.get(key);
    if (s !== undefined) return s;

    const layout = ENEMY_LAYOUT[kind];
    const u = r * layout.scale;
    const [l, rr, t, b] = layout.box;
    const box = { l: l * u, r: rr * u, t: t * u, b: b * u };
    const pal = enemyPalette(variant === 'gold' ? '#FFD24A' : color);
    let tint = null;
    if (variant === 'frost') tint = 'rgba(150, 210, 255, 0.45)';
    s = bakeSprite(box, (ctx) => ENEMY_PAINTERS[kind](ctx, u, pal, frame), {
        outline: Math.max(0.9, u * 0.1),
        flash: variant === 'flash',
        tint
    });
    enemyCache.set(key, s);
    return s;
}

/** Visual top of an enemy (world y), used to place health bars / markers. */
export function enemyVisualTop(enemy) {
    const kind = ENEMY_PAINTERS[enemy.type] ? enemy.type : 'basic';
    const layout = ENEMY_LAYOUT[kind];
    const u = enemy.size * layout.scale;
    return enemy.y + enemy.size * layout.feet + layout.box[2] * u * 0.92;
}

export function clearCharacterArtCache() {
    enemyCache.clear();
    hunterCache.clear();
}
