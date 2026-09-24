/**
 * Timed power-up relics — outlined sprites in the shared art style.
 *
 * Each relic reads by silhouette and colour, so no floating text label is
 * needed: blood vial (heal), holy ward (invincible), feather (speed),
 * burning skull (damage), lodestone (magnet), hourglass (fire rate).
 * Painters draw upright with the base at the origin, like floor items.
 */
import { bakeSprite, rgba } from './CharacterArt.js';

const PAINTERS = {
    health(ctx) {
        // Stoppered flask of blood
        ctx.fillStyle = '#5a1a22';
        ctx.fillRect(-2.5, -21, 5, 4);
        ctx.fillStyle = '#c7a06a';
        ctx.fillRect(-3.5, -23, 7, 3);
        ctx.fillStyle = '#9c1a2a';
        ctx.beginPath();
        ctx.moveTo(-3, -17);
        ctx.lineTo(-3, -14);
        ctx.bezierCurveTo(-11, -11, -11, 0, 0, 0);
        ctx.bezierCurveTo(11, 0, 11, -11, 3, -14);
        ctx.lineTo(3, -17);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#e8374a';
        ctx.beginPath();
        ctx.ellipse(0, -6, 7, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.fillRect(-5, -11, 2, 5);
    },
    invincible(ctx) {
        // Gilded ward shield with a cross
        ctx.fillStyle = '#b8860b';
        ctx.beginPath();
        ctx.moveTo(-9, -20);
        ctx.lineTo(9, -20);
        ctx.lineTo(9, -10);
        ctx.quadraticCurveTo(8, -3, 0, 0);
        ctx.quadraticCurveTo(-8, -3, -9, -10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffd84a';
        ctx.beginPath();
        ctx.moveTo(-6.5, -17.5);
        ctx.lineTo(6.5, -17.5);
        ctx.lineTo(6.5, -10.5);
        ctx.quadraticCurveTo(5.5, -5, 0, -3);
        ctx.quadraticCurveTo(-5.5, -5, -6.5, -10.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff6d0';
        ctx.fillRect(-1.2, -16, 2.4, 11);
        ctx.fillRect(-4.5, -13, 9, 2.4);
    },
    speedBoost(ctx) {
        // Swift feather
        ctx.save();
        ctx.rotate(-0.5);
        ctx.fillStyle = '#1f8fa8';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-8, -6, -7, -18, 0, -24);
        ctx.bezierCurveTo(7, -18, 8, -6, 0, 0);
        ctx.fill();
        ctx.fillStyle = '#6ff2ff';
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.bezierCurveTo(-5, -8, -4, -17, 0, -21);
        ctx.lineTo(0, -3);
        ctx.fill();
        ctx.strokeStyle = '#e9ffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 2);
        ctx.lineTo(0, -22);
        ctx.stroke();
        ctx.restore();
    },
    damageBoost(ctx) {
        // Burning skull
        ctx.fillStyle = '#ff7a1a';
        ctx.beginPath();
        ctx.moveTo(-8, -12);
        ctx.quadraticCurveTo(-9, -22, -3, -26);
        ctx.quadraticCurveTo(-2, -20, 0, -19);
        ctx.quadraticCurveTo(2, -25, 6, -27);
        ctx.quadraticCurveTo(5, -20, 8, -12);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffd35a';
        ctx.beginPath();
        ctx.moveTo(-4, -13);
        ctx.quadraticCurveTo(-4, -19, 0, -21);
        ctx.quadraticCurveTo(4, -19, 4, -13);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#efe6d6';
        ctx.beginPath();
        ctx.arc(0, -10, 8, Math.PI, 0);
        ctx.lineTo(8, -7);
        ctx.quadraticCurveTo(6, -4, 5, -1);
        ctx.lineTo(-5, -1);
        ctx.quadraticCurveTo(-6, -4, -8, -7);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#2a0e08';
        ctx.beginPath();
        ctx.ellipse(-3.2, -8, 2.2, 2.6, 0, 0, Math.PI * 2);
        ctx.ellipse(3.2, -8, 2.2, 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff5a1a';
        ctx.fillRect(-3.8, -8.5, 1.4, 1.4);
        ctx.fillRect(2.6, -8.5, 1.4, 1.4);
        ctx.fillStyle = '#2a0e08';
        ctx.fillRect(-2.5, -2.5, 1, 2);
        ctx.fillRect(-0.5, -2.5, 1, 2);
        ctx.fillRect(1.5, -2.5, 1, 2);
    },
    magnetBoost(ctx) {
        // Lodestone: green crystal circled by an iron ring
        ctx.strokeStyle = '#4d5560';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(0, -11, 11, 4, -0.25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#1f7a3a';
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.lineTo(7, -13);
        ctx.lineTo(4, 0);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-7, -13);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#5cf08a';
        ctx.beginPath();
        ctx.moveTo(0, -22);
        ctx.lineTo(3.5, -13);
        ctx.lineTo(1.5, -2);
        ctx.lineTo(-2, -13);
        ctx.closePath();
        ctx.fill();
        // Front half of the ring passes over the crystal
        ctx.strokeStyle = '#9aa4b0';
        ctx.beginPath();
        ctx.ellipse(0, -11, 11, 4, -0.25, 0.1, Math.PI - 0.1);
        ctx.stroke();
    },
    fireRate(ctx) {
        // Hourglass with violet sand
        ctx.fillStyle = '#6a4a2a';
        ctx.fillRect(-8, -24, 16, 3);
        ctx.fillRect(-8, -3, 16, 3);
        ctx.fillStyle = 'rgba(210, 200, 255, 0.55)';
        ctx.beginPath();
        ctx.moveTo(-6, -21);
        ctx.lineTo(6, -21);
        ctx.lineTo(1.2, -12);
        ctx.lineTo(6, -3);
        ctx.lineTo(-6, -3);
        ctx.lineTo(-1.2, -12);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#e04aff';
        ctx.beginPath();
        ctx.moveTo(-3.5, -17);
        ctx.lineTo(3.5, -17);
        ctx.lineTo(0.6, -12.5);
        ctx.lineTo(-0.6, -12.5);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-5, -3);
        ctx.lineTo(0, -8);
        ctx.lineTo(5, -3);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(-0.5, -12.5, 1, 5);
    }
};

const BOX = { l: -14, r: 14, t: -30, b: 3 };

export const POWER_UP_COLORS = {
    health: '#FF4455',
    invincible: '#FFD700',
    speedBoost: '#40E0FF',
    damageBoost: '#FF7A1A',
    magnetBoost: '#44FF77',
    fireRate: '#E04AFF'
};

const spriteCache = new Map();
const glowCache = new Map();

/** Outlined relic sprite, anchored at its base. Null outside a browser. */
export function getPowerUpSprite(type) {
    if (!spriteCache.has(type)) {
        const paint = PAINTERS[type];
        spriteCache.set(type, paint ? bakeSprite(BOX, paint, { outline: 1.4 }) : null);
    }
    return spriteCache.get(type);
}

/** Soft additive glow disc (radius 32) in the relic's colour. */
export function getPowerUpGlow(type) {
    if (glowCache.has(type)) return glowCache.get(type);
    let c = null;
    if (typeof document !== 'undefined') {
        c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext && c.getContext('2d');
        if (g) {
            const color = POWER_UP_COLORS[type] || '#FFFFFF';
            const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
            grad.addColorStop(0, rgba(color, 0.55));
            grad.addColorStop(0.45, rgba(color, 0.18));
            grad.addColorStop(1, rgba(color, 0));
            g.fillStyle = grad;
            g.fillRect(0, 0, 64, 64);
        } else {
            c = null;
        }
    }
    glowCache.set(type, c);
    return c;
}
