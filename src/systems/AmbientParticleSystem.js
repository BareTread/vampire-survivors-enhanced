/**
 * AmbientParticleSystem — Persistent atmospheric particles for visual depth.
 *
 * Three particle types rendered in world space (within camera transform):
 *   - Fog wisps: large soft mist banks (baked gradient sprite), slow drift
 *   - Dust motes: tiny bright specks, brownian motion, alpha pulse
 *   - Floating embers: additive glowing sparks rising and swaying
 *
 * ~60 total particles — negligible performance impact.
 * World-anchored, wrapped in a torus around the camera view.
 */
export class AmbientParticleSystem {
    constructor(game) {
        this.game = game;

        this.fogWisps = [];
        this.dustMotes = [];
        this.embers = [];

        this.init();
    }

    init() {
        // Particles live in world units inside a torus that wraps around the
        // camera view, so they stay world-anchored (no "dirt on the lens")
        // while always covering the screen.

        // Fog wisps: 14 large, soft, horizontally stretched mist banks
        this.fogWisps = [];
        for (let i = 0; i < 14; i++) {
            this.fogWisps.push({
                x: Math.random() * 2000,
                y: Math.random() * 2000,
                vx: 4 + Math.random() * 8, // slow drift, rightward
                vy: (Math.random() - 0.5) * 3,
                size: 70 + Math.random() * 90,
                stretch: 1.6 + Math.random() * 0.8,
                alpha: 0.05 + Math.random() * 0.06,
                phase: Math.random() * Math.PI * 2
            });
        }

        // Dust motes: 35 tiny bright dots
        this.dustMotes = [];
        for (let i = 0; i < 35; i++) {
            this.dustMotes.push({
                x: Math.random() * 2000,
                y: Math.random() * 2000,
                vx: 0,
                vy: 0,
                size: 0.8 + Math.random() * 1.0,
                alpha: 0.12 + Math.random() * 0.2,
                phase: Math.random() * Math.PI * 2,
                brownianTimer: 0
            });
        }

        // Floating embers: 14 glowing sparks rising from the crypt floor
        this.embers = [];
        for (let i = 0; i < 14; i++) {
            this.embers.push(this._newEmber({ x: Math.random() * 2000, y: Math.random() * 2000 }));
            this.embers[i].life = Math.random();
        }
    }

    _newEmber(p) {
        p.vx = (Math.random() - 0.5) * 10;
        p.vy = -(12 + Math.random() * 18);
        p.size = 1 + Math.random() * 1.2;
        p.alpha = 0.35 + Math.random() * 0.35;
        p.life = 0.7 + Math.random() * 0.3;
        p.wobble = Math.random() * Math.PI * 2;
        return p;
    }

    _sprites() {
        if (this._fogSprite !== undefined) return;
        this._fogSprite = null;
        this._emberSprite = null;
        if (typeof document === 'undefined') return;
        const make = (size, stops) => {
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const g = c.getContext && c.getContext('2d');
            if (!g) return null;
            const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
            for (const [o, col] of stops) grad.addColorStop(o, col);
            g.fillStyle = grad;
            g.fillRect(0, 0, size, size);
            return c;
        };
        this._fogSprite = make(128, [
            [0, 'rgba(190, 180, 215, 1)'],
            [0.45, 'rgba(170, 160, 200, 0.45)'],
            [1, 'rgba(160, 150, 190, 0)']
        ]);
        this._emberSprite = make(32, [
            [0, 'rgba(255, 230, 170, 1)'],
            [0.25, 'rgba(255, 150, 60, 0.8)'],
            [1, 'rgba(255, 70, 20, 0)']
        ]);
    }

    update(dt) {
        const cam = this.game.camera;
        if (!cam) return;

        // Fog wisps
        for (const p of this.fogWisps) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.phase += dt * 0.5;
        }

        // Dust motes — brownian motion
        for (const p of this.dustMotes) {
            p.brownianTimer -= dt;
            if (p.brownianTimer <= 0) {
                p.vx = (Math.random() - 0.5) * 12;
                p.vy = (Math.random() - 0.5) * 12;
                p.brownianTimer = 0.3 + Math.random() * 0.5;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.phase += dt * 3;
        }

        // Embers — rise, sway, fade and respawn somewhere in view
        const bounds = cam.getWorldBounds();
        for (const p of this.embers) {
            p.wobble += dt * 2.5;
            p.x += (p.vx + Math.sin(p.wobble) * 8) * dt;
            p.y += p.vy * dt;
            p.life -= dt * 0.18;
            if (p.life <= 0) {
                p.x = bounds.left + Math.random() * (bounds.right - bounds.left);
                p.y = bounds.top + (0.3 + Math.random() * 0.7) * (bounds.bottom - bounds.top);
                this._newEmber(p);
            }
        }
    }

    render(ctx) {
        const cam = this.game.camera;
        if (!cam) return;
        this._sprites();

        const bounds = cam.getWorldBounds();
        const pad = 200;
        const left = bounds.left - pad;
        const top = bounds.top - pad;
        const vw = bounds.right - bounds.left + pad * 2;
        const vh = bounds.bottom - bounds.top + pad * 2;
        const wrapX = (x) => left + ((((x - left) % vw) + vw) % vw);
        const wrapY = (y) => top + ((((y - top) % vh) + vh) % vh);

        ctx.save();

        // Fog wisps — soft mist banks
        if (this._fogSprite) {
            for (const p of this.fogWisps) {
                const wx = wrapX(p.x);
                const wy = wrapY(p.y);
                ctx.globalAlpha = Math.max(0, p.alpha * (0.75 + 0.25 * Math.sin(p.phase)));
                const w = p.size * p.stretch;
                ctx.drawImage(this._fogSprite, wx - w / 2, wy - p.size / 2, w, p.size);
            }
        }

        // Dust motes
        ctx.fillStyle = '#D4C4A0';
        for (const p of this.dustMotes) {
            const wx = wrapX(p.x);
            const wy = wrapY(p.y);
            const pulse = p.alpha * (0.5 + 0.5 * Math.sin(p.phase));
            ctx.globalAlpha = Math.max(0, pulse);
            ctx.fillRect(wx - p.size / 2, wy - p.size / 2, p.size, p.size);
        }

        // Embers — additive glow sprites
        ctx.globalCompositeOperation = 'lighter';
        for (const p of this.embers) {
            const fade = p.life > 0.85 ? (1 - p.life) / 0.15 : Math.min(1, p.life / 0.4);
            ctx.globalAlpha = Math.max(0, p.alpha * fade);
            if (this._emberSprite) {
                const r = p.size * 4;
                ctx.drawImage(this._emberSprite, p.x - r, p.y - r, r * 2, r * 2);
            } else {
                ctx.fillStyle = '#FF8C00';
                ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            }
        }

        ctx.restore();
    }

    reset() {
        this.init();
    }
}
