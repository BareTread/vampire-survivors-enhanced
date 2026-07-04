import { globalDamageNumberPool } from '../core/DamageNumberPool.js';

/**
 * RunTimerSystem — 30-minute run timer with Death/Reaper spawn.
 *
 * Features:
 *  - Visible run timer counting up on the HUD
 *  - At 25 minutes: warning text, music shifts, enemies get desperate
 *  - At 30 minutes: Death spawns — unkillable, slowly chases player, instant kill
 *  - Death gets faster over time (30-35 min range)
 *  - Timer creates pacing and "how long can I last" stories
 *
 * Wire into VampireSurvivorsGame.systems.runTimer.
 */
export class RunTimerSystem {
    constructor(game) {
        this.game = game;
        this.runTime = 0; // seconds elapsed

        // Thresholds
        this.warningTime = 25 * 60; // 25 minutes
        this.deathTime = 30 * 60; // 30 minutes

        // Warning state
        this.warningActive = false;
        this.warningTextAlpha = 0;
        this.warningPulsePhase = 0;

        // Death entity
        this.deathSpawned = false;
        this.death = null;

        // Endless mode — skip Death spawn, escalate difficulty indefinitely
        this.endlessMode = false;
        this._endlessScaleTick = 0;
    }

    update(dt) {
        if (!this.game.player || !this.game.player.isAlive()) return;

        this.runTime += dt;

        // ── 25-Minute Warning ──────────────────────────────
        if (this.runTime >= this.warningTime && !this.warningActive) {
            this.warningActive = true;
            this.triggerWarning();
        }

        if (this.warningActive && !this.deathSpawned) {
            this.warningPulsePhase += dt * 2.0;
            this.warningTextAlpha = 0.3 + 0.3 * Math.sin(this.warningPulsePhase);
        }

        // ── 30-Minute Death Spawn ──────────────────────────
        if (this.runTime >= this.deathTime && !this.deathSpawned && !this.endlessMode) {
            this.deathSpawned = true;
            this.spawnDeath();
        }

        // ── Endless Mode: post-30min difficulty escalation ──
        if (this.endlessMode && this.runTime >= this.deathTime) {
            this._endlessScaleTick += dt;
            // Every 5 minutes past 30 min, further boost difficulty
            if (this._endlessScaleTick >= 300) {
                this._endlessScaleTick = 0;
                const es = this.game.systems.enemy;
                if (es) {
                    es.maxActiveEnemies = Math.min(500, es.maxActiveEnemies + 40);
                    es.spawnRate = Math.min(10, es.spawnRate * 1.25);
                }
            }
        }

        // ── Death Chase Logic ──────────────────────────────
        if (this.death && this.death.active) {
            this.updateDeath(dt);
        }
    }

    triggerWarning() {
        // Camera effect
        if (this.game.camera) {
            this.game.camera.flash('#330000', 0.8);
            this.game.camera.shake(6, 1.0, 'heavy');
        }

        // Audio cue
        if (this.game.audioManager) {
            this.game.audioManager.playVampireSound('demonRoar', 0.4);
        }

        // Floating text
        const player = this.game.player;
        if (player && globalDamageNumberPool) {
            globalDamageNumberPool.spawn(player.x, player.y - 60, '死亡将至...', '#FF0000', 'WARNING');
        }
    }

    spawnDeath() {
        const player = this.game.player;
        if (!player) return;

        // Spawn death at a distance from the player
        const angle = Math.random() * Math.PI * 2;
        const spawnDist = 600;

        this.death = {
            active: true,
            x: player.x + Math.cos(angle) * spawnDist,
            y: player.y + Math.sin(angle) * spawnDist,
            size: 30,
            speed: 40, // Starts slow, gets faster
            maxSpeed: 200,
            acceleration: 2, // Speed increase per second
            pulsePhase: 0,
            trailTimer: 0
        };

        // Dramatic entrance
        if (this.game.camera) {
            this.game.camera.flash('#000000', 1.2);
            this.game.camera.shake(20, 0.8, 'massive');
        }

        if (this.game.audioManager) {
            this.game.audioManager.playVampireSound('bossDefeat', 0.6);
        }

        if (globalDamageNumberPool) {
            globalDamageNumberPool.spawn(player.x, player.y - 80, '死亡已降临', '#FF0000', 'BOSS');
        }
    }

    updateDeath(dt) {
        const player = this.game.player;
        if (!player || !player.isAlive()) return;

        const death = this.death;

        // Accelerate over time
        death.speed = Math.min(death.maxSpeed, death.speed + death.acceleration * dt);

        // Chase player
        const dx = player.x - death.x;
        const dy = player.y - death.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 1) {
            death.x += (dx / dist) * death.speed * dt;
            death.y += (dy / dist) * death.speed * dt;
        }

        // Visual pulse
        death.pulsePhase += dt * 4;

        // Trail particles
        death.trailTimer -= dt;
        if (death.trailTimer <= 0 && this.game.systems.particle) {
            death.trailTimer = 0.08;
            this.game.systems.particle.create({
                x: death.x + (Math.random() - 0.5) * 20,
                y: death.y + (Math.random() - 0.5) * 20,
                vx: (Math.random() - 0.5) * 30,
                vy: -20 - Math.random() * 30,
                color: '#440044',
                size: 4 + Math.random() * 6,
                lifetime: 0.6 + Math.random() * 0.4,
                decay: 0.95,
                type: 'circle'
            });
        }

        // Kill check: instant kill on contact
        const killRange = death.size + player.size;
        if (dist < killRange) {
            // Set damage source before killing
            player.lastDamageSource = { type: 'death', name: '死亡', damage: 9999, time: this.runTime };

            // Instant kill
            player.health = 0;
            if (player.die) {
                player.die();
            }

            // Dramatic death
            if (this.game.camera) {
                this.game.camera.flash('#FF0000', 1.5);
                this.game.camera.shake(30, 1.0, 'massive');
            }

            if (globalDamageNumberPool) {
                globalDamageNumberPool.spawn(player.x, player.y - 40, '被死亡带走', '#FF0000', 'DEATH');
            }
        }
    }

    render(ctx) {
        // ── HUD Timer ──────────────────────────────────────
        const minutes = Math.floor(this.runTime / 60);
        const seconds = Math.floor(this.runTime % 60);
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        ctx.save();

        // Timer display (top center)
        const canvas = this.game.canvas;
        const cx = canvas.width / 2;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Timer color shifts as we approach death
        let timerColor = 'rgba(220, 220, 235, 0.9)';
        let pillBg = 'rgba(10, 8, 18, 0.55)';
        let pillBorder = 'rgba(80, 60, 120, 0.3)';
        if (this.runTime >= this.deathTime) {
            timerColor = '#FF0000';
            pillBg = 'rgba(40, 0, 0, 0.65)';
            pillBorder = 'rgba(255, 0, 0, 0.4)';
        } else if (this.runTime >= this.warningTime) {
            const pulse = 0.5 + 0.5 * Math.sin(this.warningPulsePhase * 2);
            timerColor = `rgb(255, ${Math.floor(100 * (1 - pulse))}, ${Math.floor(50 * (1 - pulse))})`;
            pillBg = 'rgba(30, 0, 0, 0.6)';
            pillBorder = 'rgba(255, 60, 60, 0.35)';
        }

        // Background pill — positioned below XP bar (12px bar + 1px separator)
        const pillW = 110, pillH = 30;
        const pillX = cx - pillW / 2, pillY = 18;
        ctx.fillStyle = pillBg;
        ctx.strokeStyle = pillBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 18px "Courier New", monospace';
        ctx.fillStyle = timerColor;
        ctx.shadowColor = timerColor;
        ctx.shadowBlur = this.runTime >= this.warningTime ? 8 : 0;
        ctx.fillText(timeStr, cx, pillY + pillH / 2);

        // Warning text
        if (this.warningActive && !this.deathSpawned) {
            ctx.globalAlpha = this.warningTextAlpha;
            ctx.font = 'bold 14px "Courier New", monospace';
            ctx.fillStyle = '#FF3333';
            ctx.shadowBlur = 12;
            ctx.fillText('死亡将至...', cx, pillY + pillH + 16);
        }

        ctx.restore();
    }

    /**
     * Render Death entity in world space (call within camera transform).
     */
    renderDeath(ctx) {
        if (!this.death || !this.death.active) return;

        const death = this.death;
        const pulse = 1 + 0.1 * Math.sin(death.pulsePhase);
        const size = death.size * pulse;

        ctx.save();

        // Death aura (dark purple glow)
        const gradient = ctx.createRadialGradient(death.x, death.y, 0, death.x, death.y, size * 3);
        gradient.addColorStop(0, 'rgba(80, 0, 80, 0.4)');
        gradient.addColorStop(0.5, 'rgba(40, 0, 40, 0.15)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(death.x - size * 3, death.y - size * 3, size * 6, size * 6);

        // Death body (dark hooded figure silhouette)
        // Cloak body
        ctx.fillStyle = '#1A001A';
        ctx.beginPath();
        ctx.moveTo(death.x, death.y - size);
        ctx.lineTo(death.x - size * 0.8, death.y + size);
        ctx.lineTo(death.x + size * 0.8, death.y + size);
        ctx.closePath();
        ctx.fill();

        // Hood
        ctx.beginPath();
        ctx.arc(death.x, death.y - size * 0.4, size * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // Glowing eyes
        const eyeGlow = 0.6 + 0.4 * Math.sin(death.pulsePhase * 2);
        ctx.fillStyle = `rgba(255, 0, 0, ${eyeGlow})`;
        ctx.shadowColor = '#FF0000';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(death.x - 6, death.y - size * 0.5, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(death.x + 6, death.y - size * 0.5, 3, 0, Math.PI * 2);
        ctx.fill();

        // Scythe
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(death.x + size * 0.3, death.y + size);
        ctx.lineTo(death.x + size * 0.3, death.y - size * 1.2);
        ctx.stroke();

        // Scythe blade
        ctx.fillStyle = '#999999';
        ctx.beginPath();
        ctx.moveTo(death.x + size * 0.3, death.y - size * 1.2);
        ctx.quadraticCurveTo(death.x + size * 1.2, death.y - size * 1.4, death.x + size * 0.8, death.y - size * 0.6);
        ctx.fill();

        ctx.restore();
    }

    reset() {
        this.runTime = 0;
        this.warningActive = false;
        this.warningTextAlpha = 0;
        this.warningPulsePhase = 0;
        this.deathSpawned = false;
        this.death = null;
        this.endlessMode = false;
        this._endlessScaleTick = 0;
    }
}
