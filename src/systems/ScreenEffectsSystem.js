/**
 * ScreenEffectsSystem — Automatic screen-wide visual effects driven by game state.
 *
 * Features:
 *  - Red pulsing vignette when player health < 30%
 *  - Desaturation + contrast boost during boss fights
 *  - Screen flash on level-up (gold/white)
 *  - Slow-motion on weapon evolution or chest pickup
 *
 * Reads game state each frame and drives Camera effects accordingly.
 * Wire into VampireSurvivorsGame.systems.screenEffects.
 */
export class ScreenEffectsSystem {
    constructor(game) {
        this.game = game;

        // Low health vignette state
        this.lowHealthActive = false;
        this.lowHealthVignette = 0;
        this.lowHealthPulsePhase = 0;

        // Boss fight state
        this.bossActive = false;
        this.bossDesaturation = 0;

        // Slow-motion state
        this.slowMoActive = false;
        this.slowMoTimer = 0;
        this.slowMoTargetScale = 1;
        this.slowMoRecoverSpeed = 3.0; // How fast timeScale returns to 1

        // Level-up flash tracking (avoid double-flash)
        this._lastPlayerLevel = 0;
    }

    update(dt) {
        const player = this.game.player;
        const camera = this.game.camera;
        if (!player || !camera) return;

        // ── Low Health Vignette ──────────────────────────────
        const healthRatio = player.health / player.maxHealth;
        if (healthRatio < 0.3) {
            this.lowHealthActive = true;
            this.lowHealthPulsePhase += dt * 3.0; // Pulse ~3 Hz

            // Pulsing red vignette: intensity scales with danger
            const danger = 1 - healthRatio / 0.3; // 0 at 30%, 1 at 0%
            const pulse = 0.5 + 0.5 * Math.sin(this.lowHealthPulsePhase);
            this.lowHealthVignette = 0.2 + danger * 0.4 * pulse;

            camera.addVignette(this.lowHealthVignette);

            // Add chromatic aberration at very low health for disorientation feel
            if (healthRatio < 0.15) {
                camera.addChromaticAberration(2 + danger * 3);
            }
        } else if (this.lowHealthActive) {
            // Smoothly fade out vignette when health recovers
            this.lowHealthVignette *= 0.9;
            if (this.lowHealthVignette < 0.01) {
                this.lowHealthActive = false;
                this.lowHealthVignette = 0;
                this.lowHealthPulsePhase = 0;
            }
            camera.addVignette(this.lowHealthVignette);
            camera.effects.chromaticAberration *= 0.85;
            if (camera.effects.chromaticAberration < 0.1) {
                camera.effects.chromaticAberration = 0;
            }
        }

        // ── Boss Fight Visual Shift ──────────────────────────
        // Check if any boss is alive (future-proof: look for enemy with isBoss flag)
        const enemies = this.game.systems.enemy;
        let bossPresent = false;
        if (enemies && enemies.activeEnemies) {
            for (const e of enemies.activeEnemies) {
                if (e.active && (e.isBoss || e.type === 'boss')) {
                    bossPresent = true;
                    break;
                }
            }
        }

        if (bossPresent && !this.bossActive) {
            this.bossActive = true;
        } else if (!bossPresent && this.bossActive) {
            this.bossActive = false;
        }

        if (this.bossActive) {
            this.bossDesaturation = Math.min(0.35, this.bossDesaturation + dt * 0.5);
            camera.effects.desaturation = this.bossDesaturation;
        } else if (this.bossDesaturation > 0) {
            this.bossDesaturation = Math.max(0, this.bossDesaturation - dt * 0.8);
            camera.effects.desaturation = this.bossDesaturation;
        }

        // ── Level-Up Flash ───────────────────────────────────
        if (player.level > this._lastPlayerLevel && this._lastPlayerLevel > 0) {
            camera.flash('#FFD700', 0.35);
            camera.shakeLevelUp();
        }
        this._lastPlayerLevel = player.level;

        // ── Heartbeat Zoom Pulse (low health) ────────────────
        if (healthRatio < 0.25 && camera) {
            // Pulse frequency increases as health drops: 3 Hz at 25% → 5 Hz at 5%
            const freqHz = 3.0 + (1 - healthRatio / 0.25) * 2.0;
            const pulse = 0.5 + 0.5 * Math.sin(this.lowHealthPulsePhase * (freqHz / 3.0));
            camera.targetZoom = camera.baseZoom * (1 + 0.012 * pulse);
            this._heartbeatZoomActive = true;
        } else if (this._heartbeatZoomActive) {
            // Clean reset when health recovers
            if (camera) camera.targetZoom = camera.baseZoom;
            this._heartbeatZoomActive = false;
        }

        // ── Slow-Motion Recovery ─────────────────────────────
        // Guard: hit-stop takes priority over slow-mo recovery
        if (this.slowMoActive && !(camera && camera.hitStopFrames > 0)) {
            this.slowMoTimer -= dt;
            if (this.slowMoTimer <= 0) {
                // Smooth recovery back to normal speed
                this.slowMoActive = false;
            }

            if (!this.slowMoActive) {
                // Lerp timeScale back to 1
                const ts = this.game.timeScale;
                this.game.timeScale = ts + (1 - ts) * Math.min(1, dt * this.slowMoRecoverSpeed);
                if (this.game.timeScale > 0.98) {
                    this.game.timeScale = 1;
                }
            }
        }
    }

    /**
     * Trigger a brief slow-motion effect.
     * @param {number} duration — How long the slowdown lasts (seconds)
     * @param {number} timeScale — The reduced time scale (e.g. 0.25 for quarter speed)
     */
    triggerSlowMo(duration = 0.3, timeScale = 0.25) {
        this.slowMoActive = true;
        this.slowMoTimer = duration;
        this.slowMoTargetScale = timeScale;
        this.game.timeScale = timeScale;
    }

    /**
     * Trigger a dramatic screen effect for weapon evolution.
     * White flash + slow-mo + heavy camera shake.
     */
    triggerEvolutionReveal() {
        const camera = this.game.camera;
        if (camera) {
            camera.flash('#FFFFFF', 0.8);
            camera.shake(18, 0.6, 'massive');
            // Use hit-stop instead of slow-mo for snappier evolution feel
            camera.hitStop(5, 0.7);
        }

        if (this.game.audioManager) {
            this.game.audioManager.playVampireSound('weaponEvolution', 0.6);
        }
    }

    /**
     * Trigger effect for chest/treasure pickup.
     */
    triggerChestPickup() {
        const camera = this.game.camera;
        if (camera) {
            camera.flash('#FFD700', 0.3);
        }
        this.triggerSlowMo(0.2, 0.3);
    }

    /**
     * Render danger effects (screen-edge glow, edge-only chromatic aberration).
     * Called from VampireSurvivorsGame.render() after camera post-effects.
     */
    renderDangerEffects(ctx) {
        const player = this.game.player;
        const camera = this.game.camera;
        if (!player || !camera || !camera.effectsEnabled) return;

        const healthRatio = player.health / player.maxHealth;
        if (healthRatio >= 0.3) return; // No danger effects above 30% HP

        const w = camera.width;
        const h = camera.height;
        const danger = 1 - healthRatio / 0.3; // 0 at 30%, 1 at 0%

        ctx.save();

        // ── Red screen-edge glow (below 30% HP) ──────────────
        const glowAlpha = danger * 0.25;
        const gradient = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
        gradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
        gradient.addColorStop(1, `rgba(255, 20, 0, ${glowAlpha})`);
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);

        // ── Edge-only chromatic aberration (below 20% HP) ────
        if (healthRatio < 0.2 && camera.performanceMode !== 'low') {
            const abIntensity = (1 - healthRatio / 0.2);
            const pulse = 0.5 + 0.5 * Math.sin(this.lowHealthPulsePhase);
            const aberration = (2 + abIntensity * 4) * pulse;

            // Radial mask: full effect at edges, zero in center
            const maskGrad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
            maskGrad.addColorStop(0, 'rgba(0,0,0,0)');
            maskGrad.addColorStop(1, `rgba(0,0,0,${0.12 * abIntensity * pulse})`);

            ctx.globalCompositeOperation = 'screen';
            // Red channel shifts outward
            ctx.globalAlpha = 0.08 * abIntensity * pulse;
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(-aberration, 0, w, h);
            // Blue channel shifts inward
            ctx.fillStyle = '#0000FF';
            ctx.fillRect(aberration, 0, w, h);
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }

    reset() {
        this.lowHealthActive = false;
        this.lowHealthVignette = 0;
        this.lowHealthPulsePhase = 0;
        this.bossActive = false;
        this.bossDesaturation = 0;
        this.slowMoActive = false;
        this.slowMoTimer = 0;
        this._lastPlayerLevel = 0;
        if (this.game) {
            this.game.timeScale = 1;
        }
    }
}
