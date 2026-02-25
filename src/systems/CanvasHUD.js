/**
 * CanvasHUD — Polished canvas-rendered HUD replacing the DOM-based prototype HUD.
 *
 * Renders directly to canvas in screen-space (after camera restore):
 *   - XP bar: animated fill with glow pulse on gain, smooth interpolation
 *   - Health bar: smooth drain, red flash on hit, green pulse on heal
 *   - Level indicator with glow
 *   - Kill counter with milestone flash
 *   - Weapon cooldown radial pips
 *   - Weapon inventory row (colored icons + level)
 *   - Passive item row with level pips
 *   - Active synergy badges
 *
 * Wire: VampireSurvivorsGame.systems.canvasHUD
 */
export class CanvasHUD {
    constructor(game) {
        this.game = game;

        // ── Animated state ──────────────────────────────────────
        // XP bar
        this.displayXP = 0;           // Smoothly interpolated XP
        this.xpFlash = 0;             // Glow intensity on XP gain (0→1 decays)
        this.lastXP = 0;

        // Health bar
        this.displayHealth = 100;     // Smooth current HP
        this.trailHealth = 100;       // Slow "catch-up" trail (damage drain)
        this.healthFlash = 0;         // Red flash on damage (0→1)
        this.healPulse = 0;           // Green pulse on heal (0→1)
        this.lastHealth = 100;

        // Kill counter
        this.displayKills = 0;
        this.killFlash = 0;           // Flash on milestone numbers

        // Level
        this.levelUpFlash = 0;        // Glow on level up
        this.lastLevel = 1;

        // Weapon fire flash (per weapon id)
        this.weaponFireFlash = new Map();
    }

    update(dt) {
        const player = this.game.player;
        if (!player) return;

        const lerpSpeed = 8;  // Higher = snappier interpolation

        // ── XP interpolation ────────────────────────────────
        const targetXP = player.experience || 0;
        if (targetXP > this.lastXP) {
            this.xpFlash = 1.0;
        }
        this.lastXP = targetXP;
        this.displayXP += (targetXP - this.displayXP) * Math.min(1, lerpSpeed * dt);
        this.xpFlash = Math.max(0, this.xpFlash - dt * 2.5);

        // ── Health interpolation ────────────────────────────
        const targetHP = player.health || 0;
        if (targetHP < this.lastHealth) {
            this.healthFlash = 1.0;   // Damage flash
        } else if (targetHP > this.lastHealth) {
            this.healPulse = 1.0;     // Heal pulse
        }
        this.lastHealth = targetHP;
        // Fast: current HP moves quickly
        this.displayHealth += (targetHP - this.displayHealth) * Math.min(1, lerpSpeed * dt);
        // Slow: trail catches up slowly (damage drain effect)
        this.trailHealth += (targetHP - this.trailHealth) * Math.min(1, 2.0 * dt);
        if (this.trailHealth < this.displayHealth) this.trailHealth = this.displayHealth;
        this.healthFlash = Math.max(0, this.healthFlash - dt * 3.0);
        this.healPulse = Math.max(0, this.healPulse - dt * 2.0);

        // ── Kill counter ────────────────────────────────────
        const kills = this.game.systems.killMilestone
            ? this.game.systems.killMilestone.totalKills : 0;
        if (kills !== this.displayKills && kills % 50 === 0 && kills > 0) {
            this.killFlash = 1.0;
        }
        this.displayKills = kills;
        this.killFlash = Math.max(0, this.killFlash - dt * 2.0);

        // ── Level flash ─────────────────────────────────────
        const level = player.level || 1;
        if (level > this.lastLevel) {
            this.levelUpFlash = 1.0;
        }
        this.lastLevel = level;
        this.levelUpFlash = Math.max(0, this.levelUpFlash - dt * 1.5);

        // ── Weapon fire flash ───────────────────────────────
        for (const weapon of player.weapons.values()) {
            const prevFlash = this.weaponFireFlash.get(weapon.id) || 0;
            if (weapon.cooldownTimer > 0 && weapon.cooldownTimer > weapon.getEffectiveCooldown() - 0.1) {
                this.weaponFireFlash.set(weapon.id, 1.0);
            } else {
                this.weaponFireFlash.set(weapon.id, Math.max(0, prevFlash - dt * 4));
            }
        }
    }

    render(ctx) {
        const player = this.game.player;
        if (!player) return;

        const W = this.game.canvas.width;
        const H = this.game.canvas.height;

        ctx.save();

        this.renderXPBar(ctx, player, W, H);
        this.renderHealthBar(ctx, player, W, H);
        this.renderLevelBadge(ctx, player, W, H);
        this.renderKillCounter(ctx, W, H);
        this.renderPowerUps(ctx, player, W, H);
        this.renderWeaponInventory(ctx, player, W, H);
        this.renderPassiveItems(ctx, W, H);
        this.renderSynergyBadges(ctx, W, H);

        ctx.restore();
    }

    // ── XP Bar (top of screen, full width) ──────────────────

    renderXPBar(ctx, player, W, H) {
        const barH = 6;
        const y = 0;
        const xpNeeded = player.experienceToNext || 100;
        const xpRatio = Math.min(1, this.displayXP / xpNeeded);

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, y, W, barH);

        // Trail (slightly ahead of fill for anticipation feel)
        const trailRatio = Math.min(1, (this.displayXP + 5) / xpNeeded);
        ctx.fillStyle = 'rgba(64, 224, 208, 0.2)';
        ctx.fillRect(0, y, W * trailRatio, barH);

        // Fill
        const gradient = ctx.createLinearGradient(0, y, W * xpRatio, y);
        gradient.addColorStop(0, '#1a8a7a');
        gradient.addColorStop(0.5, '#40E0D0');
        gradient.addColorStop(1, '#7FFFD4');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, y, W * xpRatio, barH);

        // Glow pulse on XP gain
        if (this.xpFlash > 0.01) {
            ctx.shadowColor = '#40E0D0';
            ctx.shadowBlur = 12 * this.xpFlash;
            ctx.fillStyle = `rgba(64, 224, 208, ${0.4 * this.xpFlash})`;
            ctx.fillRect(0, y, W * xpRatio, barH);
            ctx.shadowBlur = 0;
        }

        // Thin bright edge
        ctx.fillStyle = `rgba(127, 255, 212, ${0.6 + 0.4 * this.xpFlash})`;
        ctx.fillRect(W * xpRatio - 2, y, 2, barH);
    }

    // ── Health Bar (below XP bar, left side) ────────────────

    renderHealthBar(ctx, player, W, H) {
        const barW = 180;
        const barH = 10;
        const x = 16;
        const y = 14;
        const maxHP = player.maxHealth || 100;
        const hpRatio = Math.min(1, this.displayHealth / maxHP);
        const trailRatio = Math.min(1, this.trailHealth / maxHP);

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this._roundRect(ctx, x, y, barW, barH, 3);
        ctx.fill();

        // Trail (slow drain — shows recent damage as fading red)
        if (trailRatio > hpRatio) {
            ctx.fillStyle = 'rgba(255, 80, 80, 0.5)';
            this._roundRect(ctx, x, y, barW * trailRatio, barH, 3);
            ctx.fill();
        }

        // Fill — color shifts from green to yellow to red
        let barColor;
        if (hpRatio > 0.6) {
            barColor = '#4ade80';
        } else if (hpRatio > 0.3) {
            const t = (hpRatio - 0.3) / 0.3;
            barColor = `rgb(${Math.floor(255 - 181 * t)}, ${Math.floor(173 + 49 * t)}, ${Math.floor(80 * t)})`;
        } else {
            barColor = '#ef4444';
        }

        const fillGrad = ctx.createLinearGradient(x, y, x, y + barH);
        fillGrad.addColorStop(0, barColor);
        fillGrad.addColorStop(1, this._darken(barColor, 0.3));
        ctx.fillStyle = fillGrad;
        this._roundRect(ctx, x, y, barW * hpRatio, barH, 3);
        ctx.fill();

        // Damage flash (red pulse overlay)
        if (this.healthFlash > 0.01) {
            ctx.fillStyle = `rgba(255, 50, 50, ${0.4 * this.healthFlash})`;
            this._roundRect(ctx, x, y, barW, barH, 3);
            ctx.fill();
        }

        // Heal pulse (green glow)
        if (this.healPulse > 0.01) {
            ctx.shadowColor = '#4ade80';
            ctx.shadowBlur = 10 * this.healPulse;
            ctx.strokeStyle = `rgba(74, 222, 128, ${0.6 * this.healPulse})`;
            ctx.lineWidth = 1.5;
            this._roundRect(ctx, x, y, barW, barH, 3);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        this._roundRect(ctx, x, y, barW, barH, 3);
        ctx.stroke();

        // HP text
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            `${Math.ceil(this.displayHealth)}/${maxHP}`,
            x + barW / 2, y + barH / 2 + 1
        );
    }

    // ── Level Badge ─────────────────────────────────────────

    renderLevelBadge(ctx, player, W, H) {
        const x = 16;
        const y = 30;
        const level = player.level || 1;

        ctx.save();

        // Glow on level up
        if (this.levelUpFlash > 0.01) {
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 20 * this.levelUpFlash;
        }

        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`Lv ${level}`, x, y);

        ctx.restore();

        // Wave number
        const wave = this.game.systems.enemy ? this.game.systems.enemy.getCurrentWave() : 1;
        ctx.font = '11px monospace';
        ctx.fillStyle = 'rgba(221, 160, 221, 0.8)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`Wave ${wave}`, x + 72, y + 4);
    }

    // ── Kill Counter (top-right) ────────────────────────────

    renderKillCounter(ctx, W, H) {
        const kills = this.displayKills;
        const x = W - 16;
        const y = 14;

        ctx.save();
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';

        // Flash on milestone
        if (this.killFlash > 0.01) {
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 15 * this.killFlash;
            const scale = 1 + 0.15 * this.killFlash;
            ctx.translate(x, y + 8);
            ctx.scale(scale, scale);
            ctx.translate(-x, -(y + 8));
        }

        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = this.killFlash > 0.01 ? '#FFD700' : 'rgba(255, 165, 0, 0.9)';
        ctx.fillText(`${kills}`, x, y);

        ctx.font = '9px monospace';
        ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
        ctx.fillText('KILLS', x, y + 16);

        ctx.restore();
    }

    // ── Power-Up Timer Pills (top-right, below kill counter) ─

    renderPowerUps(ctx, player, W, H) {
        if (!player.powerUps) return;

        const powerUpConfig = [
            { key: 'invincible',  label: 'INVINCIBLE', color: '#FFD700' },
            { key: 'speedBoost',  label: 'SPEED',      color: '#00FFFF' },
            { key: 'damageBoost', label: 'DAMAGE',     color: '#FF6600' },
            { key: 'fireRate',    label: 'FIRE RATE',  color: '#FF44FF' },
            { key: 'magnetBoost', label: 'MAGNET',     color: '#44FF44' },
        ];

        // Collect active power-ups
        const active = [];
        for (const config of powerUpConfig) {
            const pu = player.powerUps[config.key];
            if (!pu || !pu.active) continue;

            let timer = pu.timer;
            // For magnet, use whichever timer is larger (player vs system)
            if (config.key === 'magnetBoost') {
                const sysTimer = this.game.systems.experience?.globalMagnetTimer || 0;
                timer = Math.max(timer, sysTimer);
            }
            if (timer <= 0) continue;

            active.push({ ...config, timer });
        }

        if (active.length === 0) return;

        // Position: top-right, below kill counter (kills label sits at y=30)
        const startX = W - 16;
        const startY = 46;
        const pillH = 16;
        const pillGap = 3;

        ctx.save();
        ctx.textBaseline = 'middle';

        for (let i = 0; i < active.length; i++) {
            const pu = active[i];
            const y = startY + i * (pillH + pillGap);
            const timerText = pu.timer.toFixed(1) + 's';
            const labelText = pu.label;

            ctx.font = 'bold 9px monospace';
            const labelWidth = ctx.measureText(labelText).width;
            const timerWidth = ctx.measureText(timerText).width;
            const totalWidth = labelWidth + timerWidth + 12; // 6px left pad + 6px between

            const pillX = startX - totalWidth;

            // Fade out when expiring (< 2s)
            const alpha = pu.timer < 2 ? 0.4 + 0.6 * (pu.timer / 2) : 1.0;
            // Pulse when about to expire (< 3s)
            const pulse = pu.timer < 3 ? 0.7 + 0.3 * Math.sin(performance.now() * 0.01) : 1.0;

            ctx.globalAlpha = alpha * pulse;

            // Pill background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            this._roundRect(ctx, pillX, y, totalWidth, pillH, 4);
            ctx.fill();

            // Left color accent bar
            ctx.fillStyle = pu.color;
            ctx.fillRect(pillX, y + 2, 2, pillH - 4);

            // Label text
            ctx.fillStyle = pu.color;
            ctx.textAlign = 'left';
            ctx.fillText(labelText, pillX + 6, y + pillH / 2);

            // Timer text (right-aligned to pill edge)
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'right';
            ctx.fillText(timerText, startX - 4, y + pillH / 2);
        }

        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // ── Weapon Inventory (bottom-left) ──────────────────────

    renderWeaponInventory(ctx, player, W, H) {
        const weapons = Array.from(player.weapons.values());
        if (weapons.length === 0) return;

        const iconSize = 28;
        const gap = 6;
        const startX = 16;
        const startY = H - 70;

        for (let i = 0; i < weapons.length; i++) {
            const weapon = weapons[i];
            const x = startX + i * (iconSize + gap);
            const y = startY;

            // Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            this._roundRect(ctx, x, y, iconSize, iconSize, 4);
            ctx.fill();

            // Border (evolved = gold, normal = weapon color)
            ctx.strokeStyle = weapon.evolved
                ? '#FFD700'
                : (weapon.color || '#888');
            ctx.lineWidth = weapon.evolved ? 2 : 1;
            this._roundRect(ctx, x, y, iconSize, iconSize, 4);
            ctx.stroke();

            // Weapon icon shape (colored distinctive shape per weapon type)
            this._renderWeaponIcon(ctx, weapon, x + iconSize / 2, y + iconSize / 2, iconSize * 0.32);

            // Cooldown radial overlay
            if (weapon.cooldownTimer > 0 && weapon.getEffectiveCooldown) {
                const cdRatio = weapon.cooldownTimer / weapon.getEffectiveCooldown();
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.beginPath();
                ctx.moveTo(x + iconSize / 2, y + iconSize / 2);
                ctx.arc(
                    x + iconSize / 2, y + iconSize / 2,
                    iconSize / 2,
                    -Math.PI / 2,
                    -Math.PI / 2 + Math.PI * 2 * cdRatio,
                    false
                );
                ctx.closePath();
                ctx.fill();
            }

            // Fire flash
            const flash = this.weaponFireFlash.get(weapon.id) || 0;
            if (flash > 0.01) {
                ctx.fillStyle = `rgba(255, 255, 255, ${0.3 * flash})`;
                this._roundRect(ctx, x, y, iconSize, iconSize, 4);
                ctx.fill();
            }

            // Level number
            ctx.font = 'bold 9px monospace';
            ctx.fillStyle = weapon.evolved ? '#FFD700' : '#fff';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`${weapon.level}`, x + iconSize - 2, y + iconSize - 1);
        }

        // Label
        ctx.font = '8px monospace';
        ctx.fillStyle = 'rgba(200, 200, 200, 0.4)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText('WEAPONS', startX, startY - 3);
    }

    // ── Passive Items (bottom-left, below weapons) ──────────

    renderPassiveItems(ctx, W, H) {
        const passiveSystem = this.game.systems.passiveItems;
        if (!passiveSystem) return;
        const items = passiveSystem.getOwnedItems();
        if (items.length === 0) return;

        const iconSize = 22;
        const gap = 4;
        const startX = 16;
        const startY = H - 32;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const x = startX + i * (iconSize + gap);
            const y = startY;

            // Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this._roundRect(ctx, x, y, iconSize, iconSize, 3);
            ctx.fill();

            // Border in item color
            ctx.strokeStyle = item.color || '#888';
            ctx.lineWidth = 1;
            this._roundRect(ctx, x, y, iconSize, iconSize, 3);
            ctx.stroke();

            // Item icon (colored circle with first letter)
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(x + iconSize / 2, y + iconSize / 2, iconSize * 0.3, 0, Math.PI * 2);
            ctx.fill();

            // Level pips along bottom
            const pipW = (iconSize - 4) / item.maxLevel;
            for (let lvl = 0; lvl < item.maxLevel; lvl++) {
                ctx.fillStyle = lvl < item.currentLevel
                    ? item.color
                    : 'rgba(255,255,255,0.15)';
                ctx.fillRect(x + 2 + lvl * pipW, y + iconSize - 3, pipW - 1, 2);
            }
        }

        // Label
        ctx.font = '8px monospace';
        ctx.fillStyle = 'rgba(200, 200, 200, 0.4)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText('ITEMS', startX, startY - 3);
    }

    // ── Synergy Badges (bottom-left, beside passive items) ──

    renderSynergyBadges(ctx, W, H) {
        const synergySystem = this.game.systems.synergy;
        if (!synergySystem) return;
        const synergies = synergySystem.getActiveSynergies();
        if (synergies.length === 0) return;

        const startX = 16;
        const startY = H - 8;

        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';

        let offsetX = 0;
        for (const synergy of synergies) {
            const text = `${synergy.icon}${synergy.name}`;
            const tw = ctx.measureText(text).width;

            // Pill background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this._roundRect(ctx, startX + offsetX, startY - 13, tw + 8, 14, 3);
            ctx.fill();

            // Pill border
            ctx.strokeStyle = synergy.color;
            ctx.lineWidth = 1;
            this._roundRect(ctx, startX + offsetX, startY - 13, tw + 8, 14, 3);
            ctx.stroke();

            // Text
            ctx.fillStyle = synergy.color;
            ctx.fillText(text, startX + offsetX + 4, startY - 2);

            offsetX += tw + 14;
        }
    }

    // ── Weapon Icon Shapes ──────────────────────────────────

    _renderWeaponIcon(ctx, weapon, cx, cy, size) {
        const color = weapon.evolved ? (weapon.evolvedColor || weapon.color) : weapon.color;
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;

        switch (weapon.id) {
            case 'magic_missile':
                // Diamond/orb
                ctx.beginPath();
                ctx.arc(cx, cy, size * 0.7, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.beginPath();
                ctx.arc(cx - size * 0.2, cy - size * 0.2, size * 0.25, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'whip':
                // Curved line
                ctx.beginPath();
                ctx.moveTo(cx - size, cy + size * 0.5);
                ctx.quadraticCurveTo(cx, cy - size, cx + size, cy);
                ctx.stroke();
                // Tip
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(cx + size, cy, 2, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'throwing_knife':
                // Triangle blade
                ctx.beginPath();
                ctx.moveTo(cx, cy - size);
                ctx.lineTo(cx + size * 0.4, cy + size * 0.6);
                ctx.lineTo(cx - size * 0.4, cy + size * 0.6);
                ctx.closePath();
                ctx.fill();
                // Handle
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(cx - size * 0.15, cy + size * 0.5, size * 0.3, size * 0.5);
                break;

            case 'lightning_chain':
                // Zigzag bolt
                ctx.beginPath();
                ctx.moveTo(cx - size * 0.3, cy - size);
                ctx.lineTo(cx + size * 0.3, cy - size * 0.3);
                ctx.lineTo(cx - size * 0.1, cy);
                ctx.lineTo(cx + size * 0.5, cy + size);
                ctx.stroke();
                break;

            case 'garlic_aura':
                // Ring
                ctx.beginPath();
                ctx.arc(cx, cy, size * 0.7, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(cx, cy, size * 0.35, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'holy_bible':
                // Cross
                ctx.fillRect(cx - size * 0.15, cy - size * 0.7, size * 0.3, size * 1.4);
                ctx.fillRect(cx - size * 0.6, cy - size * 0.15, size * 1.2, size * 0.3);
                break;

            case 'fire_wand':
                // Flame shape
                ctx.beginPath();
                ctx.moveTo(cx, cy - size);
                ctx.quadraticCurveTo(cx + size * 0.8, cy, cx, cy + size * 0.5);
                ctx.quadraticCurveTo(cx - size * 0.8, cy, cx, cy - size);
                ctx.closePath();
                ctx.fill();
                // Inner bright core
                ctx.fillStyle = '#FFAA00';
                ctx.beginPath();
                ctx.arc(cx, cy - size * 0.2, size * 0.25, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'bone_boomerang':
                // Boomerang V shape
                ctx.beginPath();
                ctx.moveTo(cx - size, cy - size * 0.3);
                ctx.quadraticCurveTo(cx, cy + size * 0.5, cx + size, cy - size * 0.3);
                ctx.stroke();
                // Knobs
                ctx.beginPath();
                ctx.arc(cx - size, cy - size * 0.3, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(cx + size, cy - size * 0.3, 2, 0, Math.PI * 2);
                ctx.fill();
                break;

            default:
                // Generic circle
                ctx.beginPath();
                ctx.arc(cx, cy, size * 0.6, 0, Math.PI * 2);
                ctx.fill();
        }
    }

    // ── Utilities ────────────────────────────────────────────

    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, w, h, r);
        } else {
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.arcTo(x + w, y, x + w, y + r, r);
            ctx.lineTo(x + w, y + h - r);
            ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
            ctx.lineTo(x + r, y + h);
            ctx.arcTo(x, y + h, x, y + h - r, r);
            ctx.lineTo(x, y + r);
            ctx.arcTo(x, y, x + r, y, r);
            ctx.closePath();
        }
    }

    _darken(color, amount) {
        // Simple darken for hex or named colors
        if (color.startsWith('#') && color.length === 7) {
            const r = Math.max(0, parseInt(color.slice(1, 3), 16) * (1 - amount));
            const g = Math.max(0, parseInt(color.slice(3, 5), 16) * (1 - amount));
            const b = Math.max(0, parseInt(color.slice(5, 7), 16) * (1 - amount));
            return `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`;
        }
        return color;
    }

    reset() {
        this.displayXP = 0;
        this.xpFlash = 0;
        this.lastXP = 0;
        this.displayHealth = this.game.player ? this.game.player.maxHealth : 100;
        this.trailHealth = this.displayHealth;
        this.healthFlash = 0;
        this.healPulse = 0;
        this.lastHealth = this.displayHealth;
        this.displayKills = 0;
        this.killFlash = 0;
        this.levelUpFlash = 0;
        this.lastLevel = 1;
        this.weaponFireFlash.clear();
    }
}
