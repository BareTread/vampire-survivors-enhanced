import { globalDamageNumberPool } from '../core/DamageNumberPool.js';

/**
 * DynamicEventSystem — Timed narrative events that punctuate runs.
 *
 * Four event types on independent timers fire sequentially, one at a time:
 *
 *   TREASURE   (~3-4 min cycle, first at ~180s)
 *     Glowing chest spawns near player. Elite guardians protect it.
 *     Player weapons damage the chest via proximity each frame.
 *     On death: gold shower + XP gem explosion.
 *
 *   GOLDEN SWARM   (~5-6 min cycle, first at ~300s)
 *     30s: sets goldenSwarmActive flag (EnemySystem reads this to tint
 *     newly-spawned enemies). Golden enemies have 50% HP, 3x XP, bonus gold.
 *
 *   BLOOD MOON   (~7-8 min cycle, first at ~420s)
 *     30s: sets bloodMoonActive flag (Enemy.js can read for speed/dmg bonus).
 *     Red screen tint overlay. Surviving rewards full heal + large XP dump.
 *
 *   CALM EYE   (~10 min cycle, first at ~600s)
 *     10s: sets calmEyeActive flag. Enemies within 400px retreat from player.
 *     Player heals 25% maxHP. Soft blue-white aura visual.
 *
 * Wire into VampireSurvivorsGame.systems.dynamicEvents.
 *
 * External flag reads:
 *   this.game.systems.dynamicEvents.goldenSwarmActive  (EnemySystem spawn)
 *   this.game.systems.dynamicEvents.bloodMoonActive    (Enemy update)
 *   this.game.systems.dynamicEvents.calmEyeActive      (Enemy AI)
 */
export class DynamicEventSystem {
    constructor(game) {
        this.game = game;

        // ── Event schedule ────────────────────────────────────────────────
        this.events = [
            {
                type: 'treasure',
                interval: [180, 240],
                nextTime: 180 + Math.random() * 60
            },
            {
                type: 'goldenSwarm',
                interval: [300, 360],
                nextTime: 300 + Math.random() * 60
            },
            {
                type: 'bloodMoon',
                interval: [420, 480],
                nextTime: 420 + Math.random() * 60
            },
            {
                type: 'calmEye',
                interval: [600, 660],
                nextTime: 600 + Math.random() * 60
            }
        ];

        // ── Active event state ────────────────────────────────────────────
        this.activeEvent = null;  // { type, timer, data: {} }
        this.eventHistory = [];   // [{ type, gameTime }] for scaling

        // ── Public flags (read by other systems) ─────────────────────────
        this.goldenSwarmActive = false;
        this.bloodMoonActive = false;
        this.calmEyeActive = false;

        // ── Treasure chest ────────────────────────────────────────────────
        // { x, y, health, maxHealth, pulsePhase, guardians: [] }
        this.activeChest = null;

        // ── HUD notification ──────────────────────────────────────────────
        this.notification = null; // { text, color, alpha, duration, timer }

        // ── Blood moon scaling ────────────────────────────────────────────
        this._bloodMoonOccurrences = 0;
    }

    // ══════════════════════════════════════════════════════════════════════
    // UPDATE
    // ══════════════════════════════════════════════════════════════════════

    update(dt) {
        if (this.game.gameState !== 'playing') return;
        if (!this.game.player || !this.game.player.isAlive()) return;

        const gameTime = this.game.systems.runTimer
            ? this.game.systems.runTimer.runTime
            : (this.game.gameTime || 0);

        // Tick notification fade
        this._updateNotification(dt);

        // Check event schedule
        if (!this.activeEvent) {
            this._checkSchedule(gameTime);
        }

        // Update active event
        if (this.activeEvent) {
            this._updateActiveEvent(dt, gameTime);
        }

        // Calm eye enemy retreat (independent of notification)
        if (this.calmEyeActive) {
            this._applyCalmEyeRetreat(dt);
        }
    }

    // ── Schedule check ────────────────────────────────────────────────────

    _checkSchedule(gameTime) {
        for (const sched of this.events) {
            if (gameTime >= sched.nextTime) {
                this._startEvent(sched.type, gameTime);
                // Advance to next interval (with variance)
                const [min, max] = sched.interval;
                sched.nextTime = gameTime + min + Math.random() * (max - min);
                return; // Only one event at a time
            }
        }
    }

    // ── Defer helper: push all scheduled times 15s forward ───────────────

    _deferAllEvents(seconds) {
        for (const sched of this.events) {
            sched.nextTime += seconds;
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // EVENT START
    // ══════════════════════════════════════════════════════════════════════

    _startEvent(type, gameTime) {
        // Safety: should not happen, but guard anyway
        if (this.activeEvent) {
            this._deferAllEvents(15);
            return;
        }

        this.eventHistory.push({ type, gameTime });

        switch (type) {
            case 'treasure':     this._startTreasure(gameTime); break;
            case 'goldenSwarm':  this._startGoldenSwarm(gameTime); break;
            case 'bloodMoon':    this._startBloodMoon(gameTime); break;
            case 'calmEye':      this._startCalmEye(gameTime); break;
        }
    }

    // ── Treasure ──────────────────────────────────────────────────────────

    _startTreasure(gameTime) {
        const player = this.game.player;
        const angle = Math.random() * Math.PI * 2;
        const dist = 150 + Math.random() * 100; // 150-250px
        const cx = player.x + Math.cos(angle) * dist;
        const cy = player.y + Math.sin(angle) * dist;

        const chestHealth = 100 + gameTime * 2;

        this.activeChest = {
            x: cx,
            y: cy,
            health: chestHealth,
            maxHealth: chestHealth,
            pulsePhase: 0,
            guardians: []
        };

        // Spawn 4-6 elite guardians around the chest
        const guardianCount = 4 + Math.floor(Math.random() * 3);
        const enemySys = this.game.systems.enemy;
        if (enemySys) {
            for (let i = 0; i < guardianCount; i++) {
                const gAngle = (i / guardianCount) * Math.PI * 2;
                const gDist = 60 + Math.random() * 30;
                const gx = cx + Math.cos(gAngle) * gDist;
                const gy = cy + Math.sin(gAngle) * gDist;

                const guardian = enemySys.getEnemyFromPool('elite');
                if (guardian) {
                    if (guardian.reset) {
                        guardian.reset(gx, gy, 'elite');
                    } else {
                        guardian.x = gx;
                        guardian.y = gy;
                        guardian.active = true;
                    }
                    guardian._isChestGuardian = true;
                    enemySys.activeEnemies.push(guardian);
                    this.activeChest.guardians.push(guardian);
                }
            }
        }

        this.activeEvent = { type: 'treasure', timer: 60, data: {} }; // 60s timeout

        this._showNotification('TREASURE CHEST!', '#FFD700', 3.5);
        this._cameraFlashShake('#FFD700', 0.3, 3, 0.4);

        if (this.game.audioManager) {
            this.game.audioManager.playVampireSound('bossWarning', 0.5);
        }
    }

    // ── Golden Swarm ──────────────────────────────────────────────────────

    _startGoldenSwarm(gameTime) {
        this.goldenSwarmActive = true;
        this.activeEvent = { type: 'goldenSwarm', timer: 30, data: { gameTime } };

        this._showNotification('GOLDEN SWARM!', '#FFD700', 3.5);
        this._cameraFlashShake('#FFD700', 0.25, 2, 0.2);
    }

    // ── Blood Moon ────────────────────────────────────────────────────────

    _startBloodMoon(gameTime) {
        this._bloodMoonOccurrences++;
        this.bloodMoonActive = true;
        this.activeEvent = {
            type: 'bloodMoon',
            timer: 30,
            data: {
                gameTime,
                // Extra damage bonus per occurrence (+5% each time)
                damageBonus: 0.30 + (this._bloodMoonOccurrences - 1) * 0.05
            }
        };

        this._showNotification('BLOOD MOON RISES', '#CC0000', 3.5);
        this._cameraFlashShake('#AA0000', 0.5, 6, 0.6);

        if (this.game.audioManager) {
            this.game.audioManager.playVampireSound('bossWarning', 0.7);
        }
    }

    // ── Calm Eye ─────────────────────────────────────────────────────────

    _startCalmEye(gameTime) {
        this.calmEyeActive = true;
        this.activeEvent = { type: 'calmEye', timer: 10, data: { gameTime } };

        // Immediate 25% heal
        const player = this.game.player;
        if (player) {
            const healAmount = player.maxHealth * 0.25;
            player.health = Math.min(player.maxHealth, player.health + healAmount);
            globalDamageNumberPool.get(player.x, player.y - 20, `+${Math.round(healAmount)} HP`, '#88FFAA', true);
        }

        this._showNotification('MOMENT OF CALM', '#88CCFF', 3.5);
        this._cameraFlashShake('#88CCFF', 0.2, 2, 0.3);
    }

    // ══════════════════════════════════════════════════════════════════════
    // EVENT UPDATE (per-frame while active)
    // ══════════════════════════════════════════════════════════════════════

    _updateActiveEvent(dt, gameTime) {
        const ev = this.activeEvent;
        ev.timer -= dt;

        switch (ev.type) {
            case 'treasure':    this._updateTreasure(dt, gameTime); break;
            case 'goldenSwarm': this._updateGoldenSwarm(dt); break;
            case 'bloodMoon':   this._updateBloodMoon(dt); break;
            case 'calmEye':     this._updateCalmEye(dt); break;
        }

        // Expiry handling is done per-event above (they call _endEvent when done)
        if (ev.timer <= 0 && this.activeEvent) {
            // Fallback: force-end any event that hasn't ended itself
            this._endEvent();
        }
    }

    // ── Treasure update ───────────────────────────────────────────────────

    _updateTreasure(dt) {
        const chest = this.activeChest;
        if (!chest) {
            this._endEvent();
            return;
        }

        // Pulse animation
        chest.pulsePhase += dt * 3;

        // Damage chest from nearby projectiles (proximity check each frame)
        const projectileSys = this.game.systems.projectile;
        if (projectileSys && projectileSys.activeProjectiles) {
            for (const proj of projectileSys.activeProjectiles) {
                if (!proj.active) continue;
                const dx = proj.x - chest.x;
                const dy = proj.y - chest.y;
                const r2 = dx * dx + dy * dy;
                const hitRadius = 28; // chest hitbox radius
                if (r2 < hitRadius * hitRadius) {
                    const dmg = proj.damage || 10;
                    chest.health -= dmg;
                    // Small visual pop
                    this._spawnChestHitParticles(chest.x, chest.y);
                }
            }
        }

        // Check death
        if (chest.health <= 0) {
            this._openChest(chest);
            return;
        }

        // Timeout — chest despawns, no reward
        if (this.activeEvent.timer <= 0) {
            this.activeChest = null;
            this._endEvent();
        }
    }

    _openChest(chest) {
        const gameTime = this.game.systems.runTimer
            ? this.game.systems.runTimer.runTime
            : (this.game.gameTime || 0);

        // Camera drama
        if (this.game.camera) {
            this.game.camera.flash('#FFD700', 0.5);
            this.game.camera.shake(8, 0.5, 'critical');
        }

        // Gold shower: 15-25 coins, value 5-10 each
        const goldSys = this.game.systems.gold;
        if (goldSys && goldSys.spawnCoin) {
            const coinCount = 15 + Math.floor(Math.random() * 11);
            for (let i = 0; i < coinCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const d = Math.random() * 80;
                goldSys.spawnCoin(
                    chest.x + Math.cos(angle) * d,
                    chest.y + Math.sin(angle) * d,
                    5 + Math.floor(Math.random() * 6) // 5-10
                );
            }
        }

        // XP gem explosion
        const expSys = this.game.systems.experience;
        const xpValue = 500 + Math.floor(gameTime * 10);
        if (expSys && expSys.createGemExplosion) {
            expSys.createGemExplosion(chest.x, chest.y, xpValue, 10, 18);
        } else if (expSys && expSys.createGem) {
            for (let i = 0; i < 12; i++) {
                const angle = Math.random() * Math.PI * 2;
                const d = Math.random() * 80;
                expSys.createGem(
                    chest.x + Math.cos(angle) * d,
                    chest.y + Math.sin(angle) * d,
                    Math.ceil(xpValue / 12)
                );
            }
        }

        // Burst particles
        this._spawnChestOpenParticles(chest.x, chest.y);

        globalDamageNumberPool.get(chest.x, chest.y - 30, 'TREASURE!', '#FFD700', true);

        this.activeChest = null;
        this._endEvent();
    }

    // ── Golden Swarm update ───────────────────────────────────────────────

    _updateGoldenSwarm(dt) {
        if (this.activeEvent.timer <= 0) {
            this.goldenSwarmActive = false;
            this._showNotification('SWARM ENDS', '#FFD700', 2);
            this._endEvent();
        }
    }

    // ── Blood Moon update ─────────────────────────────────────────────────

    _updateBloodMoon(dt) {
        if (this.activeEvent.timer <= 0) {
            this.bloodMoonActive = false;

            // Survival reward: full heal + large XP
            const player = this.game.player;
            if (player && player.isAlive()) {
                player.health = player.maxHealth;
                globalDamageNumberPool.get(player.x, player.y - 30, 'SURVIVED!', '#FF4444', true);
                globalDamageNumberPool.get(player.x, player.y - 50, 'FULL HEAL', '#88FFAA', true);

                const gameTime = this.game.systems.runTimer
                    ? this.game.systems.runTimer.runTime
                    : (this.game.gameTime || 0);
                const xpReward = 1000 + Math.floor(gameTime * 5);
                const expSys = this.game.systems.experience;
                if (expSys && expSys.createGemExplosion) {
                    expSys.createGemExplosion(player.x, player.y, xpReward, 8, 15);
                } else if (expSys && expSys.createGem) {
                    expSys.createGem(player.x, player.y, xpReward);
                }
            }

            this._showNotification('BLOOD MOON ENDS', '#CC0000', 2);
            this._endEvent();
        }
    }

    // ── Calm Eye update ───────────────────────────────────────────────────

    _updateCalmEye(dt) {
        if (this.activeEvent.timer <= 0) {
            this.calmEyeActive = false;
            this._showNotification('THE EYE CLOSES', '#88CCFF', 2);
            this._endEvent();
        }
    }

    // ── Calm Eye enemy retreat ────────────────────────────────────────────

    _applyCalmEyeRetreat(dt) {
        const player = this.game.player;
        const enemySys = this.game.systems.enemy;
        if (!player || !enemySys) return;

        const RETREAT_RADIUS = 400;
        const RETREAT_SPEED = 80;

        for (const enemy of enemySys.activeEnemies) {
            if (!enemy.active) continue;
            const dx = enemy.x - player.x;
            const dy = enemy.y - player.y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 < RETREAT_RADIUS * RETREAT_RADIUS && dist2 > 0.0001) {
                const dist = Math.sqrt(dist2);
                enemy.x += (dx / dist) * RETREAT_SPEED * dt;
                enemy.y += (dy / dist) * RETREAT_SPEED * dt;
            }
        }
    }

    // ── End active event ──────────────────────────────────────────────────

    _endEvent() {
        this.activeEvent = null;
    }

    // ══════════════════════════════════════════════════════════════════════
    // HUD NOTIFICATION
    // ══════════════════════════════════════════════════════════════════════

    _showNotification(text, color, duration) {
        this.notification = {
            text,
            color,
            duration,
            timer: duration,
            alpha: 0,   // fades in
            fadeIn: 0.4,
            fadeOut: 0.6
        };
    }

    _updateNotification(dt) {
        if (!this.notification) return;
        const n = this.notification;
        n.timer -= dt;

        if (n.timer <= 0) {
            this.notification = null;
            return;
        }

        const elapsed = n.duration - n.timer;
        if (elapsed < n.fadeIn) {
            n.alpha = elapsed / n.fadeIn;
        } else if (n.timer < n.fadeOut) {
            n.alpha = n.timer / n.fadeOut;
        } else {
            n.alpha = 1;
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // RENDER — screen-space overlays + HUD notification
    // ══════════════════════════════════════════════════════════════════════

    render(ctx) {
        if (this.game.gameState !== 'playing') return;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        const W = ctx.canvas.width;
        const H = ctx.canvas.height;

        // ── Golden Swarm shimmer on screen edges ──────────────────────────
        if (this.goldenSwarmActive && this.activeEvent) {
            const t = (this.activeEvent.timer / 30); // 0→1 as time ticks down
            const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.003);
            const edgeAlpha = (0.08 + pulse * 0.06) * Math.min(1, (1 - t) * 5 + t * 0.5);

            ctx.globalAlpha = edgeAlpha;
            const edgeGrad = ctx.createLinearGradient(0, 0, W, 0);
            edgeGrad.addColorStop(0,    'rgba(255, 215, 0, 0.9)');
            edgeGrad.addColorStop(0.12, 'rgba(255, 215, 0, 0)');
            edgeGrad.addColorStop(0.88, 'rgba(255, 215, 0, 0)');
            edgeGrad.addColorStop(1,    'rgba(255, 215, 0, 0.9)');
            ctx.fillStyle = edgeGrad;
            ctx.fillRect(0, 0, W, H);

            // Top/bottom bars
            const topGrad = ctx.createLinearGradient(0, 0, 0, H);
            topGrad.addColorStop(0,    'rgba(255, 215, 0, 0.7)');
            topGrad.addColorStop(0.08, 'rgba(255, 215, 0, 0)');
            topGrad.addColorStop(0.92, 'rgba(255, 215, 0, 0)');
            topGrad.addColorStop(1,    'rgba(255, 215, 0, 0.7)');
            ctx.fillStyle = topGrad;
            ctx.fillRect(0, 0, W, H);
        }

        // ── Blood Moon red tint overlay ───────────────────────────────────
        if (this.bloodMoonActive && this.activeEvent) {
            const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.002);
            ctx.globalAlpha = 0.12 + pulse * 0.06;
            ctx.fillStyle = '#AA0000';
            ctx.fillRect(0, 0, W, H);
        }

        // ── HUD notification (centered top) ──────────────────────────────
        if (this.notification && this.notification.alpha > 0) {
            this._renderNotification(ctx, W, H);
        }

        // ── Event timer bar (thin strip below notification) ───────────────
        if (this.activeEvent && this.activeEvent.type !== 'treasure') {
            this._renderEventTimerBar(ctx, W, H);
        }

        ctx.restore();
    }

    _renderNotification(ctx, W, H) {
        const n = this.notification;
        const centerX = W / 2;
        const centerY = 72;

        ctx.save();
        ctx.globalAlpha = n.alpha;

        // Text metrics for dynamic sizing
        const fontSize = 22;
        ctx.font = `bold ${fontSize}px monospace`;
        const textW = ctx.measureText(n.text).width;
        const padX = 24;
        const padY = 12;
        const boxW = textW + padX * 2;
        const boxH = fontSize + padY * 2;
        const bx = centerX - boxW / 2;
        const by = centerY - boxH / 2;
        const r = 8;

        // Background panel
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.strokeStyle = n.color;
        ctx.lineWidth = 2;
        ctx.shadowColor = n.color;
        ctx.shadowBlur = 16;

        ctx.beginPath();
        ctx.moveTo(bx + r, by);
        ctx.lineTo(bx + boxW - r, by);
        ctx.quadraticCurveTo(bx + boxW, by, bx + boxW, by + r);
        ctx.lineTo(bx + boxW, by + boxH - r);
        ctx.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - r, by + boxH);
        ctx.lineTo(bx + r, by + boxH);
        ctx.quadraticCurveTo(bx, by + boxH, bx, by + boxH - r);
        ctx.lineTo(bx, by + r);
        ctx.quadraticCurveTo(bx, by, bx + r, by);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Text
        ctx.shadowBlur = 8;
        ctx.fillStyle = n.color;
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(n.text, centerX, centerY);

        ctx.restore();
    }

    _renderEventTimerBar(ctx, W, H) {
        const ev = this.activeEvent;
        const maxTime = ev.type === 'goldenSwarm' ? 30
                      : ev.type === 'bloodMoon'   ? 30
                      : ev.type === 'calmEye'     ? 10
                      : 60;

        const progress = Math.max(0, ev.timer / maxTime);
        const barW = 180;
        const barH = 4;
        const barX = (W - barW) / 2;
        const barY = 90; // Just below notification

        const colors = {
            goldenSwarm: '#FFD700',
            bloodMoon:   '#CC0000',
            calmEye:     '#88CCFF'
        };
        const barColor = colors[ev.type] || '#FFFFFF';

        ctx.save();
        ctx.globalAlpha = 0.8;

        // Track
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(barX, barY, barW, barH);

        // Fill
        ctx.fillStyle = barColor;
        ctx.shadowColor = barColor;
        ctx.shadowBlur = 6;
        ctx.fillRect(barX, barY, barW * progress, barH);

        ctx.restore();
    }

    // ══════════════════════════════════════════════════════════════════════
    // RENDER — world-space (within camera transform)
    // ══════════════════════════════════════════════════════════════════════

    renderWorld(ctx) {
        if (this.game.gameState !== 'playing') return;

        // Chest
        if (this.activeChest) {
            this._renderChest(ctx, this.activeChest);
        }

        // Calm Eye aura around player
        if (this.calmEyeActive && this.game.player) {
            this._renderCalmEyeAura(ctx);
        }
    }

    _renderChest(ctx, chest) {
        const pulse = 0.5 + 0.5 * Math.sin(chest.pulsePhase);
        const healthRatio = chest.health / chest.maxHealth;

        ctx.save();

        // Glow
        ctx.globalAlpha = 0.25 + pulse * 0.2;
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 20 + pulse * 15;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(chest.x, chest.y, 22 + pulse * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        // Chest body
        const cw = 32;
        const ch = 24;
        const cx = chest.x - cw / 2;
        const cy = chest.y - ch / 2;

        // Bottom box
        ctx.fillStyle = '#8B6914';
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.fillRect(cx, cy + 8, cw, ch - 8);
        ctx.strokeRect(cx, cy + 8, cw, ch - 8);

        // Lid
        ctx.fillStyle = '#A07820';
        ctx.fillRect(cx, cy, cw, 12);
        ctx.strokeRect(cx, cy, cw, 12);

        // Lock
        ctx.fillStyle = '#FFD700';
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 4 + pulse * 6;
        ctx.beginPath();
        ctx.arc(chest.x, chest.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Health bar above chest
        const barW = 40;
        const barH = 4;
        const barX = chest.x - barW / 2;
        const barY = cy - 10;

        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barW, barH);

        const hColor = healthRatio > 0.5 ? '#00FF44' : healthRatio > 0.25 ? '#FFAA00' : '#FF4444';
        ctx.fillStyle = hColor;
        ctx.fillRect(barX, barY, barW * healthRatio, barH);

        ctx.restore();
    }

    _renderCalmEyeAura(ctx) {
        const player = this.game.player;
        const t = this.activeEvent ? this.activeEvent.timer : 0;
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.002);

        ctx.save();
        ctx.globalAlpha = 0.12 + pulse * 0.08;
        ctx.shadowColor = '#88CCFF';
        ctx.shadowBlur = 30;

        // Outer soft aura
        const grad = ctx.createRadialGradient(
            player.x, player.y, 50,
            player.x, player.y, 400
        );
        grad.addColorStop(0,   'rgba(136, 204, 255, 0.35)');
        grad.addColorStop(0.6, 'rgba(136, 204, 255, 0.08)');
        grad.addColorStop(1,   'rgba(136, 204, 255, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(player.x, player.y, 400, 0, Math.PI * 2);
        ctx.fill();

        // Inner bright ring
        ctx.globalAlpha = 0.25 + pulse * 0.15;
        ctx.strokeStyle = '#AADDFF';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(player.x, player.y, 400, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.restore();
    }

    // ══════════════════════════════════════════════════════════════════════
    // PARTICLE HELPERS
    // ══════════════════════════════════════════════════════════════════════

    _spawnChestHitParticles(x, y) {
        const ps = this.game.systems.particle;
        if (!ps) return;
        for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 40 + Math.random() * 60;
            ps.create(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.25,
                size: 2,
                color: '#FFD700',
                type: 'circle'
            });
        }
    }

    _spawnChestOpenParticles(x, y) {
        const ps = this.game.systems.particle;
        if (!ps) return;
        for (let i = 0; i < 30; i++) {
            const angle = (i / 30) * Math.PI * 2;
            const speed = 80 + Math.random() * 140;
            ps.create(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 30,
                life: 0.6 + Math.random() * 0.4,
                size: 3 + Math.random() * 4,
                color: Math.random() < 0.5 ? '#FFD700' : '#FFEE44',
                type: 'circle'
            });
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // CAMERA HELPERS
    // ══════════════════════════════════════════════════════════════════════

    _cameraFlashShake(color, flashDuration, shakeIntensity, shakeDuration) {
        if (!this.game.camera) return;
        this.game.camera.flash(color, flashDuration);
        this.game.camera.shake(shakeIntensity, shakeDuration, 'event');
    }

    // ══════════════════════════════════════════════════════════════════════
    // PUBLIC HELPERS (for EnemySystem / Enemy to query)
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Returns blood moon speed multiplier for enemy AI.
     * Enemies should call: dynamicEvents?.bloodMoonSpeedMult ?? 1
     */
    get bloodMoonSpeedMult() {
        return this.bloodMoonActive ? 1.50 : 1.0;
    }

    /**
     * Returns blood moon damage multiplier for enemy damage rolls.
     */
    get bloodMoonDamageMult() {
        if (!this.bloodMoonActive || !this.activeEvent) return 1.0;
        return 1 + (this.activeEvent.data?.damageBonus ?? 0.30);
    }

    // ══════════════════════════════════════════════════════════════════════
    // RESET
    // ══════════════════════════════════════════════════════════════════════

    reset() {
        // Re-randomise schedule for fresh run
        this.events = [
            {
                type: 'treasure',
                interval: [180, 240],
                nextTime: 180 + Math.random() * 60
            },
            {
                type: 'goldenSwarm',
                interval: [300, 360],
                nextTime: 300 + Math.random() * 60
            },
            {
                type: 'bloodMoon',
                interval: [420, 480],
                nextTime: 420 + Math.random() * 60
            },
            {
                type: 'calmEye',
                interval: [600, 660],
                nextTime: 600 + Math.random() * 60
            }
        ];

        this.activeEvent = null;
        this.eventHistory = [];
        this.activeChest = null;
        this.notification = null;

        this.goldenSwarmActive = false;
        this.bloodMoonActive = false;
        this.calmEyeActive = false;

        this._bloodMoonOccurrences = 0;
    }

    // ══════════════════════════════════════════════════════════════════════
    // DEBUG INFO
    // ══════════════════════════════════════════════════════════════════════

    getDebugInfo() {
        return {
            activeEvent: this.activeEvent ? `${this.activeEvent.type} (${this.activeEvent.timer.toFixed(1)}s)` : 'None',
            flags: {
                goldenSwarm: this.goldenSwarmActive,
                bloodMoon: this.bloodMoonActive,
                calmEye: this.calmEyeActive
            },
            chest: this.activeChest
                ? `HP ${Math.round(this.activeChest.health)}/${this.activeChest.maxHealth}`
                : 'None',
            historyCount: this.eventHistory.length
        };
    }
}
