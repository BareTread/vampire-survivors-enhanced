/**
 * AmbientParticleSystem — Persistent atmospheric particles for visual depth.
 *
 * Three particle types rendered in world space (within camera transform):
 *   - Fog wisps: large translucent blobs, slow drift
 *   - Dust motes: tiny bright dots, brownian motion, alpha pulse
 *   - Floating embers: small orange/red dots drifting upward
 *
 * ~60-70 total particles — negligible performance impact.
 * Positions relative to camera viewport so they're always visible.
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
        // Fog wisps: 18 slow-moving translucent blobs
        this.fogWisps = [];
        for (let i = 0; i < 18; i++) {
            this.fogWisps.push({
                ox: Math.random(),  // 0-1 viewport-relative offset
                oy: Math.random(),
                vx: (Math.random() - 0.3) * 8, // slow drift, bias rightward
                vy: (Math.random() - 0.5) * 4,
                size: 8 + Math.random() * 7,
                alpha: 0.03 + Math.random() * 0.05,
                phase: Math.random() * Math.PI * 2
            });
        }

        // Dust motes: 35 tiny bright dots
        this.dustMotes = [];
        for (let i = 0; i < 35; i++) {
            this.dustMotes.push({
                ox: Math.random(),
                oy: Math.random(),
                vx: 0,
                vy: 0,
                size: 1.5 + Math.random() * 1.5,
                alpha: 0.1 + Math.random() * 0.2,
                phase: Math.random() * Math.PI * 2,
                brownianTimer: 0
            });
        }

        // Floating embers: 10 small orange/red dots
        this.embers = [];
        for (let i = 0; i < 10; i++) {
            this.embers.push({
                ox: Math.random(),
                oy: Math.random(),
                vx: (Math.random() - 0.5) * 6,
                vy: -(10 + Math.random() * 15), // drift upward
                size: 1.5 + Math.random() * 1.5,
                alpha: 0.15 + Math.random() * 0.2,
                life: Math.random() // 0-1 lifecycle for fade/respawn
            });
        }
    }

    update(dt) {
        const cam = this.game.camera;
        if (!cam) return;

        const bounds = cam.getWorldBounds();
        const vw = bounds.right - bounds.left;
        const vh = bounds.bottom - bounds.top;

        // Fog wisps
        for (const p of this.fogWisps) {
            p.ox += (p.vx * dt) / vw;
            p.oy += (p.vy * dt) / vh;
            // Wrap
            if (p.ox < -0.1) p.ox += 1.2;
            if (p.ox > 1.1) p.ox -= 1.2;
            if (p.oy < -0.1) p.oy += 1.2;
            if (p.oy > 1.1) p.oy -= 1.2;
            p.phase += dt * 0.8;
        }

        // Dust motes — brownian motion
        for (const p of this.dustMotes) {
            p.brownianTimer -= dt;
            if (p.brownianTimer <= 0) {
                p.vx = (Math.random() - 0.5) * 12;
                p.vy = (Math.random() - 0.5) * 12;
                p.brownianTimer = 0.3 + Math.random() * 0.5;
            }
            p.ox += (p.vx * dt) / vw;
            p.oy += (p.vy * dt) / vh;
            // Wrap
            if (p.ox < 0) p.ox += 1;
            if (p.ox > 1) p.ox -= 1;
            if (p.oy < 0) p.oy += 1;
            if (p.oy > 1) p.oy -= 1;
            p.phase += dt * 3;
        }

        // Embers — drift upward, fade and respawn
        for (const p of this.embers) {
            p.ox += (p.vx * dt) / vw;
            p.oy += (p.vy * dt) / vh;
            p.life -= dt * 0.15;
            if (p.life <= 0 || p.oy < -0.1) {
                // Respawn at bottom
                p.ox = Math.random();
                p.oy = 0.9 + Math.random() * 0.1;
                p.vx = (Math.random() - 0.5) * 6;
                p.vy = -(10 + Math.random() * 15);
                p.life = 0.7 + Math.random() * 0.3;
            }
        }
    }

    render(ctx) {
        const cam = this.game.camera;
        if (!cam) return;

        const bounds = cam.getWorldBounds();
        const left = bounds.left;
        const top = bounds.top;
        const vw = bounds.right - left;
        const vh = bounds.bottom - top;

        ctx.save();

        // Fog wisps
        for (const p of this.fogWisps) {
            const wx = left + p.ox * vw;
            const wy = top + p.oy * vh;
            const flicker = p.alpha + 0.02 * Math.sin(p.phase);
            ctx.globalAlpha = Math.max(0, flicker);
            ctx.fillStyle = 'rgba(200, 200, 220, 1)';
            ctx.beginPath();
            ctx.arc(wx, wy, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Dust motes
        for (const p of this.dustMotes) {
            const wx = left + p.ox * vw;
            const wy = top + p.oy * vh;
            const pulse = p.alpha * (0.5 + 0.5 * Math.sin(p.phase));
            ctx.globalAlpha = Math.max(0, pulse);
            ctx.fillStyle = '#D4C4A0';
            ctx.beginPath();
            ctx.arc(wx, wy, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Embers
        for (const p of this.embers) {
            const wx = left + p.ox * vw;
            const wy = top + p.oy * vh;
            ctx.globalAlpha = Math.max(0, p.alpha * p.life);
            ctx.fillStyle = Math.random() > 0.5 ? '#FF8C00' : '#FF4500';
            ctx.beginPath();
            ctx.arc(wx, wy, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    reset() {
        this.init();
    }
}
