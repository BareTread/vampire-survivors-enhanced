/**
 * GroundDecalSystem — the battlefield remembers.
 *
 * Every kill leaves a splat of blood / ichor on the flagstones that
 * slowly soaks away. Splat shapes are baked once (a few random variants,
 * white), then tinted per creature color into a small cache. Rendering is
 * a ring buffer of drawImage calls with alpha, culled to the view.
 */
const MAX_DECALS = 140;
const VARIANTS = 5;
const SPLAT_PX = 64;

export class GroundDecalSystem {
    constructor(game) {
        this.game = game;
        this.decals = [];
        this.cursor = 0;
        this._shapes = null;
        this._tinted = new Map();
    }

    reset() {
        this.decals.length = 0;
        this.cursor = 0;
    }

    /** Add a kill splat at (x, y) — y should be the creature's feet. */
    addSplat(x, y, size, color, kind = 'blood') {
        const decal = {
            x,
            y,
            r: Math.max(8, size * (1.4 + Math.random() * 0.6)),
            rot: Math.random() * Math.PI * 2,
            variant: (Math.random() * VARIANTS) | 0,
            color: this._decalColor(color, kind),
            life: 1,
            decay: kind === 'ash' ? 0.22 : 0.14 // fraction per second
        };
        if (this.decals.length < MAX_DECALS) {
            this.decals.push(decal);
        } else {
            this.decals[this.cursor] = decal;
            this.cursor = (this.cursor + 1) % MAX_DECALS;
        }
    }

    update(dt) {
        for (const d of this.decals) {
            if (d.life > 0) d.life -= d.decay * dt;
        }
    }

    render(ctx) {
        if (!this.decals.length) return;
        this._ensureShapes();
        if (!this._shapes) return;

        const cam = this.game.camera;
        const b = cam ? cam.getWorldBounds(40) : null;

        ctx.save();
        for (const d of this.decals) {
            if (d.life <= 0) continue;
            if (b && (d.x < b.left || d.x > b.right || d.y < b.top || d.y > b.bottom)) continue;
            const sprite = this._tintedShape(d.variant, d.color);
            if (!sprite) continue;
            // Fresh splats are glossy-dark; they soak in and fade
            ctx.globalAlpha = Math.min(0.7, d.life * 0.9);
            ctx.save();
            ctx.translate(d.x, d.y);
            ctx.rotate(d.rot);
            ctx.scale(1, 0.55); // lie flat on the floor
            ctx.drawImage(sprite, -d.r, -d.r, d.r * 2, d.r * 2);
            ctx.restore();
        }
        ctx.restore();
    }

    // ------------------------------------------------------------------

    _decalColor(color, kind) {
        if (kind === 'ash') return '#2a2630';
        // Darken & desaturate the creature color toward old blood
        const m = /^#([0-9a-f]{6})$/i.exec(color || '');
        const n = m ? parseInt(m[1], 16) : 0x8a2020;
        let r = n >> 16;
        let g = (n >> 8) & 0xff;
        let bl = n & 0xff;
        const grey = (r + g + bl) / 3;
        r = (r * 0.5 + grey * 0.2 + 90 * 0.3) * 0.55;
        g = (g * 0.5 + grey * 0.2 + 10 * 0.3) * 0.45;
        bl = (bl * 0.5 + grey * 0.2 + 20 * 0.3) * 0.5;
        const q = (v) => Math.max(0, Math.min(255, Math.round(v / 16) * 16));
        return `rgb(${q(r)}, ${q(g)}, ${q(bl)})`; // quantized → small tint cache
    }

    _ensureShapes() {
        if (this._shapes !== null) return;
        this._shapes = undefined;
        if (typeof document === 'undefined') return;
        const shapes = [];
        for (let v = 0; v < VARIANTS; v++) {
            const c = document.createElement('canvas');
            c.width = c.height = SPLAT_PX;
            const g = c.getContext && c.getContext('2d');
            if (!g) return;
            const cx = SPLAT_PX / 2;
            g.fillStyle = '#ffffff';
            // Core pool
            g.beginPath();
            const lobes = 7 + v;
            for (let i = 0; i <= lobes; i++) {
                const a = (i / lobes) * Math.PI * 2;
                const rr = cx * (0.42 + Math.random() * 0.18);
                const x = cx + Math.cos(a) * rr;
                const y = cx + Math.sin(a) * rr;
                if (i === 0) g.moveTo(x, y);
                else g.quadraticCurveTo(cx + Math.cos(a - 0.3) * rr * 1.15, cx + Math.sin(a - 0.3) * rr * 1.15, x, y);
            }
            g.fill();
            // Droplets flung outward
            for (let i = 0; i < 6 + v; i++) {
                const a = Math.random() * Math.PI * 2;
                const d = cx * (0.55 + Math.random() * 0.4);
                g.beginPath();
                g.arc(cx + Math.cos(a) * d, cx + Math.sin(a) * d, 1 + Math.random() * 3, 0, Math.PI * 2);
                g.fill();
            }
            shapes.push(c);
        }
        this._shapes = shapes;
    }

    _tintedShape(variant, color) {
        const key = variant + '|' + color;
        let c = this._tinted.get(key);
        if (c) return c;
        const base = this._shapes[variant];
        c = document.createElement('canvas');
        c.width = c.height = SPLAT_PX;
        const g = c.getContext('2d');
        g.drawImage(base, 0, 0);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = color;
        g.fillRect(0, 0, SPLAT_PX, SPLAT_PX);
        // Glossy highlight rim
        g.globalCompositeOperation = 'source-atop';
        const hl = g.createRadialGradient(SPLAT_PX * 0.4, SPLAT_PX * 0.38, 0, SPLAT_PX * 0.4, SPLAT_PX * 0.38, SPLAT_PX * 0.3);
        hl.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
        hl.addColorStop(1, 'rgba(255, 255, 255, 0)');
        g.fillStyle = hl;
        g.fillRect(0, 0, SPLAT_PX, SPLAT_PX);
        this._tinted.set(key, c);
        return c;
    }
}
