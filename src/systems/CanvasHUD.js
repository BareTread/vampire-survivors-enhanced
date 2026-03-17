/**
 * CanvasHUD — Gothic Dark Fantasy HUD
 *
 * Full layout (screen-space, below XP bar):
 *
 *   ┌─[XP BAR — full width, 12px amber gradient]────────────────┐
 *   │ ┌─CHAR PANEL──────────┐   [RunTimer]  ┌─ECONOMY PANEL──┐  │
 *   │ │ ♥ ████████ 93/93   │               │ ♦ 109   GOLD   │  │
 *   │ │ Lv 14  ·  Wave 4   │               │ ☠ 38    KILLS  │  │
 *   │ │ [challenge dots]    │               │ [Power-up pills]│  │
 *   │ └─────────────────────┘               └────────────────┘  │
 *   │                        [GAMEPLAY]                          │
 *   │                                                            │
 *   │ ┌─INVENTORY PANEL──────────────────┐  ┌─MINIMAP────────┐  │
 *   │ │ WEAPONS  [W][W][W][W][W][W]      │  │   [mini-map]   │  │
 *   │ │ ITEMS    [I][I][I]               │  └────────────────┘  │
 *   │ │ [Synergy-A]  [Synergy-B]         │                      │
 *   │ └──────────────────────────────────┘                      │
 *   └────────────────────────────────────────────────────────────┘
 *
 * GoldSystem.renderHUD() is suppressed when this HUD is active.
 */
export class CanvasHUD {

    // ─── Design tokens ──────────────────────────────────────────────────
    static C = {
        // Panels  — noticeably darker/more purple than the game bg (#0f0f23)
        panelBg:         'rgba(16, 9, 30, 0.96)',
        panelBorder:     'rgba(210, 155, 45, 0.90)',
        panelGlow:       'rgba(200, 145, 40, 0.28)',   // shadow colour for border glow

        // XP bar
        xpTrack:         'rgba(35, 26, 8, 0.75)',
        xpA:             '#4A3500',
        xpB:             '#B87A00',
        xpC:             '#FFD966',
        xpEdge:          '#FFE890',

        // HP
        hpTrack:         'rgba(70, 0, 0, 0.65)',
        hpHigh:          '#1D9954',
        hpMid:           '#C47A00',
        hpLow:           '#B81000',
        hpTrail:         'rgba(195, 35, 35, 0.52)',

        // Economy
        gold:            '#FFD700',
        goldDim:         'rgba(200, 160, 60, 0.80)',   // visible label
        kills:           '#E07A00',
        killsDim:        'rgba(190, 120, 40, 0.80)',   // visible label
        bank:            'rgba(155, 125, 55, 0.72)',

        // Text
        labelBright:     '#EDE1C0',
        labelDim:        'rgba(165, 145, 105, 0.62)',

        // Level / Wave
        levelColor:      '#FFD700',
        waveColor:       'rgba(185, 148, 230, 0.92)',

        // Inventory
        slotBg:          'rgba(14, 9, 28, 0.92)',
        slotBorder:      'rgba(95, 68, 128, 0.65)',
        evolvedBorder:   '#C8A020',

        // Minimap
        minimapBg:       'rgba(10, 6, 22, 0.92)',
        minimapBorder:   'rgba(200, 148, 42, 0.88)',
        minimapGrid:     'rgba(255,255,255,0.06)',
    };

    constructor(game) {
        this.game = game;
        this.version = '20260317-hudfix2';

        if (typeof window !== 'undefined') {
            window.__HUD_VERSION = this.version;
            console.log(`[CanvasHUD] loaded ${this.version}`);
        }

        // XP animation
        this.displayXP = 0;
        this.xpFlash   = 0;
        this.lastXP    = 0;

        // Health animation
        this.displayHealth = 100;
        this.trailHealth   = 100;
        this.healthFlash   = 0;
        this.healPulse     = 0;
        this.lastHealth    = 100;

        // Kill counter
        this.displayKills = 0;
        this.killFlash    = 0;

        // Gold counter
        this.displayGold = 0;
        this.goldFlash   = 0;
        this.lastGold    = 0;

        // Level flash
        this.levelUpFlash = 0;
        this.lastLevel    = 1;

        // Per-weapon fire flash
        this.weaponFireFlash = new Map();
    }

    // ════════════════════════════════════════════════════════════════════
    //  UPDATE
    // ════════════════════════════════════════════════════════════════════
    update(dt) {
        const player = this.game.player;
        if (!player) return;

        const L = 8; // lerp speed

        // XP
        const targetXP = player.experience || 0;
        if (targetXP > this.lastXP) this.xpFlash = 1.0;
        this.lastXP = targetXP;
        this.displayXP += (targetXP - this.displayXP) * Math.min(1, L * dt);
        this.xpFlash = Math.max(0, this.xpFlash - dt * 2.5);

        // Health
        const targetHP = player.health || 0;
        if (targetHP < this.lastHealth)      this.healthFlash = 1.0;
        else if (targetHP > this.lastHealth) this.healPulse   = 1.0;
        this.lastHealth = targetHP;
        this.displayHealth += (targetHP - this.displayHealth) * Math.min(1, L * dt);
        this.trailHealth   += (targetHP - this.trailHealth)   * Math.min(1, 1.8 * dt);
        if (this.trailHealth < this.displayHealth) this.trailHealth = this.displayHealth;
        this.healthFlash = Math.max(0, this.healthFlash - dt * 3.0);
        this.healPulse   = Math.max(0, this.healPulse   - dt * 2.0);

        // Kills
        const kills = this.game.systems.killMilestone?.totalKills || 0;
        if (kills !== this.displayKills && kills % 50 === 0 && kills > 0) this.killFlash = 1.0;
        this.displayKills = kills;
        this.killFlash = Math.max(0, this.killFlash - dt * 2.0);

        // Gold
        const targetGold = this.game.systems.gold?.runGold || 0;
        if (targetGold > this.lastGold) this.goldFlash = 1.0;
        this.lastGold = targetGold;
        this.displayGold += (targetGold - this.displayGold) * Math.min(1, L * dt);
        this.goldFlash = Math.max(0, this.goldFlash - dt * 3.0);

        // Level
        const level = player.level || 1;
        if (level > this.lastLevel) this.levelUpFlash = 1.0;
        this.lastLevel = level;
        this.levelUpFlash = Math.max(0, this.levelUpFlash - dt * 1.5);

        // Weapon fire flash
        for (const weapon of player.weapons.values()) {
            const prev = this.weaponFireFlash.get(weapon.id) || 0;
            if (weapon.cooldownTimer > 0 && weapon.getEffectiveCooldown &&
                weapon.cooldownTimer > weapon.getEffectiveCooldown() - 0.1) {
                this.weaponFireFlash.set(weapon.id, 1.0);
            } else {
                this.weaponFireFlash.set(weapon.id, Math.max(0, prev - dt * 4));
            }
        }
    }

    // ════════════════════════════════════════════════════════════════════
    //  RENDER (screen-space — called after camera.restore())
    // ════════════════════════════════════════════════════════════════════
    render(ctx) {
        const player = this.game.player;
        if (!player) return;

        const W = this.game.canvas.width;
        const H = this.game.canvas.height;

        ctx.save();
        // Ensure we are always in clean screen-space regardless of prior dirty state
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.filter = 'none';

        this._renderXPBar(ctx, player, W, H);
        this._renderCharPanel(ctx, player, W, H);
        this._renderEconomyPanel(ctx, player, W, H);
        this._renderInventoryPanel(ctx, player, W, H);
        this._renderMinimap(ctx, W, H);

        ctx.restore();
    }

    // ════════════════════════════════════════════════════════════════════
    //  XP BAR  (full-width, 12 px, at y=0)
    // ════════════════════════════════════════════════════════════════════
    _renderXPBar(ctx, player, W, H) {
        const C  = CanvasHUD.C;
        const BH = 12;
        const xpNeeded = player.experienceToNext || 100;
        const ratio     = Math.min(1, this.displayXP / xpNeeded);

        // Track
        ctx.fillStyle = C.xpTrack;
        ctx.fillRect(0, 0, W, BH);

        // Soft look-ahead shimmer
        ctx.fillStyle = 'rgba(170, 125, 20, 0.14)';
        ctx.fillRect(0, 0, W * Math.min(1, ratio + 0.025), BH);

        // Filled portion
        if (ratio > 0) {
            const grad = ctx.createLinearGradient(0, 0, W * ratio, 0);
            grad.addColorStop(0,   C.xpA);
            grad.addColorStop(0.5, C.xpB);
            grad.addColorStop(1,   C.xpC);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W * ratio, BH);

            // Bright leading edge
            ctx.fillStyle = C.xpEdge;
            ctx.fillRect(W * ratio - 2, 0, 2, BH);
        }

        // Gain pulse
        if (this.xpFlash > 0.01) {
            ctx.save();
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur  = 16 * this.xpFlash;
            ctx.fillStyle   = `rgba(255, 215, 80, ${0.32 * this.xpFlash})`;
            ctx.fillRect(0, 0, W * ratio, BH);
            ctx.restore();
        }

        // Bottom separator
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, BH, W, 1);

        // Progress % (subtle, right-aligned, inside bar)
        if (ratio > 0.06) {
            ctx.font        = `9px "Courier New", monospace`;
            ctx.fillStyle   = `rgba(255, 215, 90, ${0.45 + 0.25 * this.xpFlash})`;
            ctx.textAlign   = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${Math.floor(ratio * 100)}%`, W - 6, BH / 2);
        }
    }

    // ════════════════════════════════════════════════════════════════════
    //  CHARACTER PANEL  (top-left)
    //  Contains: HP bar, level, wave, and optional challenge dots
    // ════════════════════════════════════════════════════════════════════
    _renderCharPanel(ctx, player, W, H) {
        const C = CanvasHUD.C;

        // Dimensions — grow slightly if challenge modifiers are active
        const challenge = this.game.systems.challenge;
        const hasChallenge = challenge && challenge.activeModifiers.size > 0;
        const PX = 8, PY = 16;
        const PW = 222, PH = hasChallenge ? 72 : 64;

        this._panel(ctx, PX, PY, PW, PH, 5, C.panelBg, C.panelBorder);

        // ── HP bar ──────────────────────────────────────────
        this._renderHPBar(ctx, player, PX + 18, PY + 6, PW - 24, 18);

        // ── Level badge ─────────────────────────────────────
        ctx.save();
        if (this.levelUpFlash > 0.01) {
            ctx.shadowColor = C.levelColor;
            ctx.shadowBlur  = 20 * this.levelUpFlash;
        }
        ctx.font        = `bold 17px "Georgia", "Times New Roman", serif`;
        ctx.fillStyle   = C.levelColor;
        ctx.textAlign   = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`Lv ${player.level || 1}`, PX + 18, PY + 31);
        ctx.restore();

        // ── Wave indicator ──────────────────────────────────
        const wave = this.game.systems.enemy?.getCurrentWave?.() || 1;
        ctx.font        = `11px "Georgia", "Times New Roman", serif`;
        ctx.fillStyle   = C.waveColor;
        ctx.textAlign   = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`∙  Wave ${wave}`, PX + 72, PY + 35);

        // ── Challenge modifier dots ──────────────────────────
        if (hasChallenge) {
            let dotX = PX + 18;
            const dotY = PY + PH - 10;
            ctx.font        = `8px "Georgia", serif`;
            ctx.textBaseline = 'middle';
            for (const id of challenge.activeModifiers) {
                const mod = challenge.modifiers.find(m => m.id === id);
                if (!mod) continue;
                // Small colored pill badge
                const label = `${mod.icon} ${mod.name}`;
                ctx.font = `7px "Georgia", serif`;
                const tw = ctx.measureText(label).width;
                const bw = tw + 8, bh = 11;

                ctx.fillStyle = 'rgba(0,0,0,0.55)';
                this._roundRect(ctx, dotX, dotY - bh / 2, bw, bh, 3);
                ctx.fill();

                ctx.strokeStyle = mod.color;
                ctx.lineWidth   = 0.8;
                this._roundRect(ctx, dotX, dotY - bh / 2, bw, bh, 3);
                ctx.stroke();

                ctx.fillStyle   = mod.color;
                ctx.textAlign   = 'left';
                ctx.fillText(label, dotX + 4, dotY);

                dotX += bw + 5;
            }
        }
    }

    // ─── HP bar sub-render ──────────────────────────────────────────────
    _renderHPBar(ctx, player, bx, by, bw, bh) {
        const C     = CanvasHUD.C;
        const maxHP = player.maxHealth || 100;
        const hpR   = Math.min(1, Math.max(0, this.displayHealth / maxHP));
        const trailR = Math.min(1, Math.max(0, this.trailHealth  / maxHP));

        // Track
        this._roundRect(ctx, bx, by, bw, bh, 4);
        ctx.fillStyle = C.hpTrack;
        ctx.fill();

        // Damage trail
        if (trailR > hpR) {
            this._roundRect(ctx, bx, by, bw * trailR, bh, 4);
            ctx.fillStyle = C.hpTrail;
            ctx.fill();
        }

        // Fill
        let barCol = hpR > 0.6 ? C.hpHigh : hpR > 0.3 ? C.hpMid : C.hpLow;
        if (hpR > 0) {
            const g = ctx.createLinearGradient(bx, by, bx, by + bh);
            g.addColorStop(0, barCol);
            g.addColorStop(1, this._darken(barCol, 0.38));
            ctx.fillStyle = g;
            this._roundRect(ctx, bx, by, bw * hpR, bh, 4);
            ctx.fill();
        }

        // Damage flash overlay
        if (this.healthFlash > 0.01) {
            this._roundRect(ctx, bx, by, bw, bh, 4);
            ctx.fillStyle = `rgba(255, 40, 40, ${0.40 * this.healthFlash})`;
            ctx.fill();
        }

        // Heal glow
        if (this.healPulse > 0.01) {
            ctx.save();
            ctx.shadowColor = '#44FF88';
            ctx.shadowBlur  = 12 * this.healPulse;
            ctx.strokeStyle = `rgba(68, 255, 136, ${0.55 * this.healPulse})`;
            ctx.lineWidth   = 1.5;
            this._roundRect(ctx, bx, by, bw, bh, 4);
            ctx.stroke();
            ctx.restore();
        }

        // Track border
        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
        ctx.lineWidth   = 1;
        this._roundRect(ctx, bx, by, bw, bh, 4);
        ctx.stroke();

        // HP text centred inside bar
        ctx.font        = `bold 10px "Courier New", monospace`;
        ctx.fillStyle   = hpR < 0.3 ? '#FF9999' : '#FFFFFF';
        ctx.textAlign   = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.ceil(this.displayHealth)} / ${maxHP}`, bx + bw / 2, by + bh / 2 + 0.5);

        // Heart icon to the left of bar
        ctx.font        = `12px Arial, sans-serif`;
        ctx.fillStyle   = hpR < 0.3 ? '#FF4444' : '#FF7777';
        ctx.textAlign   = 'right';
        ctx.fillText('♥', bx - 3, by + bh / 2 + 1);
    }

    // ════════════════════════════════════════════════════════════════════
    //  ECONOMY PANEL  (top-right)
    //  Contains: gold, kills, power-up pills
    // ════════════════════════════════════════════════════════════════════
    _renderEconomyPanel(ctx, player, W, H) {
        const C  = CanvasHUD.C;
        const PW = 188, PH = 56;
        const PX = W - PW - 8, PY = 16;

        this._panel(ctx, PX, PY, PW, PH, 5, C.panelBg, C.panelBorder);

        // Horizontal divider
        ctx.fillStyle = 'rgba(130, 92, 28, 0.3)';
        ctx.fillRect(PX + 8, PY + PH / 2, PW - 16, 1);

        const goldY  = PY + PH * 0.27;
        const killsY = PY + PH * 0.73;

        // ── Gold row ─────────────────────────────────────────
        ctx.save();
        ctx.textBaseline = 'middle';
        if (this.goldFlash > 0.01) {
            ctx.shadowColor = C.gold;
            ctx.shadowBlur  = 10 * this.goldFlash;
        }
        // Diamond icon — always shown even at 0
        ctx.font      = `15px Arial, sans-serif`;
        ctx.fillStyle = C.gold;
        ctx.textAlign = 'left';
        ctx.fillText('♦', PX + 10, goldY);
        // "GOLD" label inline
        ctx.font      = `bold 8px "Courier New", monospace`;
        ctx.fillStyle = C.goldDim;
        ctx.fillText('GOLD', PX + 27, goldY);
        // Value right-aligned
        ctx.font      = `bold 17px "Courier New", monospace`;
        ctx.fillStyle = C.gold;
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.floor(this.displayGold)}`, PX + PW - 8, goldY);
        ctx.restore();

        // Bank sub-text (tiny)
        const bank = this.game.systems.persistence?.getGold?.() || 0;
        if (bank > 0) {
            ctx.font        = `7px "Courier New", monospace`;
            ctx.fillStyle   = C.bank;
            ctx.textAlign   = 'right';
            ctx.textBaseline = 'top';
            ctx.fillText(`Bank ${bank}`, PX + PW - 8, goldY + 9);
        }

        // ── Kills row ────────────────────────────────────────
        ctx.save();
        ctx.textBaseline = 'middle';
        if (this.killFlash > 0.01) {
            ctx.shadowColor = C.kills;
            ctx.shadowBlur  = 12 * this.killFlash;
        }
        // Skull icon
        ctx.font      = `14px Arial, sans-serif`;
        ctx.fillStyle = this.killFlash > 0.01 ? '#FFD700' : C.kills;
        ctx.textAlign = 'left';
        ctx.fillText('☠', PX + 10, killsY);
        // "KILLS" label inline
        ctx.font      = `bold 8px "Courier New", monospace`;
        ctx.fillStyle = C.killsDim;
        ctx.fillText('KILLS', PX + 27, killsY);
        // Value (scales on milestone)
        const kScale = 1 + 0.14 * this.killFlash;
        ctx.save();
        ctx.translate(PX + PW - 8, killsY);
        ctx.scale(kScale, kScale);
        ctx.fillStyle   = this.killFlash > 0.01 ? '#FFD700' : C.kills;
        ctx.textAlign   = 'right';
        ctx.textBaseline = 'middle';
        ctx.font = `bold 17px "Courier New", monospace`;
        ctx.fillText(`${this.displayKills}`, 0, 0);
        ctx.restore();
        ctx.restore();

        // ── Power-up pills (right-anchored, below economy panel) ──
        this._renderPowerUpPills(ctx, player, W, PY + PH + 6);
    }

    // ─── Power-up pills ─────────────────────────────────────────────────
    _renderPowerUpPills(ctx, player, W, startY) {
        if (!player.powerUps) return;

        const configs = [
            { key: 'invincible',  label: 'INVINCIBLE', icon: '◊', color: '#FFD700' },
            { key: 'speedBoost',  label: 'SPEED',      icon: '»', color: '#00E5FF' },
            { key: 'damageBoost', label: 'DAMAGE',     icon: '☄', color: '#FF6622' },
            { key: 'fireRate',    label: 'FIRE RATE',  icon: '‹›', color: '#EE44FF' },
            { key: 'magnetBoost', label: 'MAGNET',     icon: '◎', color: '#44FF99' },
        ];

        const active = [];
        for (const cfg of configs) {
            const pu = player.powerUps[cfg.key];
            if (!pu?.active) continue;
            let timer = pu.timer;
            if (cfg.key === 'magnetBoost') {
                timer = Math.max(timer, this.game.systems.experience?.globalMagnetTimer || 0);
            }
            if (timer <= 0) continue;
            active.push({ ...cfg, timer });
        }
        if (active.length === 0) return;

        ctx.save();

        const PH  = 19;   // pill height
        const GAP = 4;    // gap between pills

        for (let i = 0; i < active.length; i++) {
            const pu = active[i];
            const y  = startY + i * (PH + GAP);

            // Alpha + expiry pulse
            const expiring = pu.timer < 3;
            const alpha = expiring
                ? 0.38 + 0.62 * (pu.timer / 3) * (0.7 + 0.3 * Math.sin(performance.now() * 0.012))
                : 1.0;

            const timerStr = `${pu.timer.toFixed(1)}s`;

            ctx.font = `bold 8px "Georgia", serif`;
            const labelW = ctx.measureText(pu.label).width;
            ctx.font = `bold 9px "Courier New", monospace`;
            const timerW = ctx.measureText(timerStr).width;

            // Pill width: left-stripe(3) + pad(6) + icon(10) + pad(4) + label + pad(6) + timer + pad(6)
            const pillW = 3 + 6 + 10 + 4 + labelW + 6 + timerW + 6;
            const pillX = W - 8 - pillW;

            ctx.globalAlpha = alpha;

            // Background
            ctx.fillStyle = 'rgba(6, 4, 16, 0.86)';
            this._roundRect(ctx, pillX, y, pillW, PH, 4);
            ctx.fill();

            // Right-side dim border
            ctx.strokeStyle = `rgba(${this._hexToRgb(pu.color)}, 0.35)`;
            ctx.lineWidth   = 1;
            this._roundRect(ctx, pillX, y, pillW, PH, 4);
            ctx.stroke();

            // Left color stripe
            ctx.fillStyle = pu.color;
            ctx.fillRect(pillX, y + 3, 3, PH - 6);

            // Rounded left end of stripe (visual candy)
            ctx.beginPath();
            ctx.arc(pillX + 1.5, y + 3, 1.5, 0, Math.PI * 2);
            ctx.arc(pillX + 1.5, y + PH - 3, 1.5, 0, Math.PI * 2);
            ctx.fill();

            // Icon
            ctx.font      = `11px Arial, sans-serif`;
            ctx.fillStyle = pu.color;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(pu.icon, pillX + 7, y + PH / 2 + 0.5);

            // Label
            ctx.font      = `bold 8px "Georgia", serif`;
            ctx.fillStyle = 'rgba(228, 218, 190, 0.92)';
            ctx.textAlign = 'left';
            ctx.fillText(pu.label, pillX + 20, y + PH / 2);

            // Timer
            ctx.font      = `bold 9px "Courier New", monospace`;
            ctx.fillStyle = expiring ? '#FF8888' : '#FFFFFF';
            ctx.textAlign = 'right';
            ctx.fillText(timerStr, pillX + pillW - 5, y + PH / 2);

            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }

    // ════════════════════════════════════════════════════════════════════
    //  INVENTORY PANEL  (bottom-left)
    //  Contains: weapon slots, passive slots, synergy badges
    // ════════════════════════════════════════════════════════════════════
    _renderInventoryPanel(ctx, player, W, H) {
        const C       = CanvasHUD.C;
        const weapons  = Array.from(player.weapons.values());
        const passives = this.game.systems.passiveItems?.getOwnedItems() || [];
        const synergies = this.game.systems.synergy?.getActiveSynergies() || [];

        if (weapons.length === 0 && passives.length === 0) return;

        // Sizes
        const WS  = 38;   // weapon slot size
        const WG  = 7;    // weapon slot gap
        const PS  = 26;   // passive slot size
        const PG  = 5;    // passive slot gap
        const PAD = 10;   // panel inner padding
        const LH  = 12;   // label row height
        const RG  = 8;    // row gap

        // Width of each row
        const weaponRowW  = weapons.length  > 0 ? weapons.length  * (WS + WG) - WG : 0;
        const passiveRowW = passives.length > 0 ? passives.length * (PS + PG) - PG : 0;

        // Synergy badge width estimate
        let synW = 0;
        if (synergies.length > 0) {
            ctx.font = `8px "Georgia", serif`;
            for (const s of synergies) {
                const lbl = `${s.icon}${s.name}`;
                synW += ctx.measureText(lbl).width + 10 + 6; // pill + gap
            }
            synW -= 6;
        }

        const contentW = Math.max(weaponRowW, passiveRowW, synW, 40);
        const panelW   = contentW + PAD * 2;

        // Height
        let panelH = PAD;
        if (weapons.length  > 0) panelH += LH + WS;
        if (passives.length > 0) panelH += RG + LH + PS;
        if (synergies.length > 0) panelH += RG + 14;
        panelH += PAD;

        const PX = 8;
        const PY = H - panelH - 8 - this._getBottomHUDOffset();

        this._panel(ctx, PX, PY, panelW, panelH, 5, C.panelBg, C.panelBorder);

        let rowY = PY + PAD;

        // ── Weapons ──────────────────────────────────────────
        if (weapons.length > 0) {
            ctx.font        = `bold 7px "Georgia", "Times New Roman", serif`;
            ctx.fillStyle   = C.labelDim;
            ctx.textAlign   = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText('WEAPONS', PX + PAD, rowY);
            rowY += LH;

            for (let i = 0; i < weapons.length; i++) {
                this._renderWeaponSlot(ctx, weapons[i], PX + PAD + i * (WS + WG), rowY, WS);
            }
            rowY += WS;
        }

        // ── Passives ──────────────────────────────────────────
        if (passives.length > 0) {
            rowY += RG;
            ctx.font        = `bold 7px "Georgia", "Times New Roman", serif`;
            ctx.fillStyle   = C.labelDim;
            ctx.textAlign   = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText('ITEMS', PX + PAD, rowY);
            rowY += LH;

            for (let i = 0; i < passives.length; i++) {
                this._renderPassiveSlot(ctx, passives[i], PX + PAD + i * (PS + PG), rowY, PS);
            }
            rowY += PS;
        }

        // ── Synergy badges ────────────────────────────────────
        if (synergies.length > 0) {
            rowY += RG;
            ctx.font        = `8px "Georgia", "Times New Roman", serif`;
            ctx.textBaseline = 'top';
            let bx = PX + PAD;
            for (const syn of synergies) {
                const label = `${syn.icon}${syn.name}`;
                const tw    = ctx.measureText(label).width;
                const bw    = tw + 10, bh = 13;

                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                this._roundRect(ctx, bx, rowY, bw, bh, 3);
                ctx.fill();

                ctx.strokeStyle = syn.color;
                ctx.lineWidth   = 0.9;
                this._roundRect(ctx, bx, rowY, bw, bh, 3);
                ctx.stroke();

                ctx.fillStyle = syn.color;
                ctx.textAlign = 'left';
                ctx.fillText(label, bx + 5, rowY + 2);

                bx += bw + 6;
            }
        }
    }

    // ─── Weapon slot ─────────────────────────────────────────────────────
    _renderWeaponSlot(ctx, weapon, wx, wy, size) {
        const C       = CanvasHUD.C;
        const evolved = weapon.evolved;

        // Slot base
        ctx.fillStyle = C.slotBg;
        this._roundRect(ctx, wx, wy, size, size, 5);
        ctx.fill();

        // Border (evolved = gold glow, normal = dim purple)
        if (evolved) {
            ctx.save();
            ctx.shadowColor = C.evolvedBorder;
            ctx.shadowBlur  = 9;
            ctx.strokeStyle = C.evolvedBorder;
            ctx.lineWidth   = 1.8;
            this._roundRect(ctx, wx, wy, size, size, 5);
            ctx.stroke();
            ctx.restore();
        } else {
            ctx.strokeStyle = C.slotBorder;
            ctx.lineWidth   = 1;
            this._roundRect(ctx, wx, wy, size, size, 5);
            ctx.stroke();
        }

        // Weapon icon
        this._renderWeaponIcon(ctx, weapon, wx + size / 2, wy + size / 2, size * 0.34);

        // Cooldown sector overlay
        if (weapon.cooldownTimer > 0 && weapon.getEffectiveCooldown) {
            const cdRatio = weapon.cooldownTimer / weapon.getEffectiveCooldown();
            ctx.fillStyle = 'rgba(0,0,0,0.50)';
            ctx.beginPath();
            ctx.moveTo(wx + size / 2, wy + size / 2);
            ctx.arc(wx + size / 2, wy + size / 2, size / 2,
                    -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cdRatio, false);
            ctx.closePath();
            ctx.fill();
        }

        // Fire flash
        const flash = this.weaponFireFlash.get(weapon.id) || 0;
        if (flash > 0.01) {
            ctx.fillStyle = `rgba(255,255,255,${0.25 * flash})`;
            this._roundRect(ctx, wx, wy, size, size, 5);
            ctx.fill();
        }

        // Level number (bottom-right corner)
        ctx.font        = `bold 9px "Courier New", monospace`;
        ctx.fillStyle   = evolved ? C.evolvedBorder : 'rgba(205, 190, 165, 0.9)';
        ctx.textAlign   = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${weapon.level}`, wx + size - 3, wy + size - 2);
    }

    // ─── Passive slot ────────────────────────────────────────────────────
    _renderPassiveSlot(ctx, item, ix, iy, size) {
        const col = item.color || '#888';

        // Background
        ctx.fillStyle = 'rgba(10, 7, 24, 0.85)';
        this._roundRect(ctx, ix, iy, size, size, 4);
        ctx.fill();

        // Border (item color)
        ctx.strokeStyle = col;
        ctx.lineWidth   = 1;
        this._roundRect(ctx, ix, iy, size, size, 4);
        ctx.stroke();

        // Inner circle
        ctx.fillStyle   = col;
        ctx.globalAlpha = 0.82;
        ctx.beginPath();
        ctx.arc(ix + size / 2, iy + size / 2, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Level pips (bottom edge)
        const maxLvl = item.maxLevel || 5;
        const pipW   = (size - 6) / maxLvl;
        for (let lvl = 0; lvl < maxLvl; lvl++) {
            ctx.fillStyle = lvl < item.currentLevel ? col : 'rgba(255,255,255,0.10)';
            ctx.fillRect(ix + 3 + lvl * pipW, iy + size - 5, pipW - 1, 3);
        }
    }

    // ════════════════════════════════════════════════════════════════════
    //  MINIMAP  (bottom-right)
    // ════════════════════════════════════════════════════════════════════
    _renderMinimap(ctx, W, H) {
        const C = CanvasHUD.C;
        const SIZE = Math.max(96, Math.min(118, Math.floor(Math.min(W, H) * 0.15)));
        const MX = W - SIZE - 10;
        const MY = H - SIZE - 10 - this._getBottomHUDOffset();
        const RANGE = 1800;

        const player = this.game.player;
        if (!player) return;

        ctx.save();

        // Background panel
        ctx.globalAlpha = 0.80;
        ctx.fillStyle   = C.minimapBg;
        this._roundRect(ctx, MX, MY, SIZE, SIZE, 4);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Outer border
        ctx.strokeStyle = C.minimapBorder;
        ctx.lineWidth   = 1;
        this._roundRect(ctx, MX, MY, SIZE, SIZE, 4);
        ctx.stroke();

        // Clip all content to minimap
        ctx.save();
        ctx.beginPath();
        this._roundRect(ctx, MX + 1, MY + 1, SIZE - 2, SIZE - 2, 3);
        ctx.clip();

        // Subtle grid lines
        ctx.strokeStyle = C.minimapGrid;
        ctx.lineWidth   = 0.5;
        for (let i = 1; i < 4; i++) {
            const gx = MX + (SIZE / 4) * i;
            const gy = MY + (SIZE / 4) * i;
            ctx.beginPath(); ctx.moveTo(gx, MY);     ctx.lineTo(gx, MY + SIZE); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(MX, gy);     ctx.lineTo(MX + SIZE, gy); ctx.stroke();
        }

        // Coordinate helper
        const toMap = (wx, wy) => ({
            x: MX + SIZE / 2 + ((wx - player.x) / RANGE) * (SIZE / 2),
            y: MY + SIZE / 2 + ((wy - player.y) / RANGE) * (SIZE / 2),
        });

        // Enemies
        const enemies = this.game.systems.enemy?.activeEnemies || [];
        for (const e of enemies) {
            if (!e.active) continue;
            const { x, y } = toMap(e.x, e.y);
            if (x < MX || x > MX + SIZE || y < MY || y > MY + SIZE) continue;
            ctx.fillStyle   = e.isBoss ? '#FF8800' : e.type === 'elite' ? '#FF4400' : '#FF2222';
            ctx.globalAlpha = 0.78;
            ctx.beginPath();
            ctx.arc(x, y, e.isBoss ? 4 : e.type === 'elite' ? 2.5 : 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Floor items
        const floorItems = this.game.systems.floorItems?.items || [];
        for (const item of floorItems) {
            const { x, y } = toMap(item.x, item.y);
            if (x < MX || x > MX + SIZE || y < MY || y > MY + SIZE) continue;
            ctx.fillStyle   = item.type === 'treasure_chest' ? '#FFD700' : '#44FF88';
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.arc(x, y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Player dot (bright, with small glow)
        const { x: px, y: py } = toMap(player.x, player.y);
        ctx.fillStyle   = '#FFFFFF';
        ctx.shadowColor = '#FFFFFF';
        ctx.shadowBlur  = 5;
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore(); // pop clip

        // "MAP" label
        ctx.font        = `bold 7px "Georgia", serif`;
        ctx.fillStyle   = 'rgba(170, 140, 70, 0.65)';
        ctx.textAlign   = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('MAP', MX + 4, MY + 3);

        ctx.restore();
    }

    // ════════════════════════════════════════════════════════════════════
    //  WEAPON ICON SHAPES
    // ════════════════════════════════════════════════════════════════════
    _renderWeaponIcon(ctx, weapon, cx, cy, size) {
        const color = weapon.evolved
            ? (weapon.evolvedColor || weapon.color || '#FFD700')
            : (weapon.color || '#AAAAAA');
        ctx.fillStyle   = color;
        ctx.strokeStyle = color;
        ctx.lineWidth   = 1.5;

        switch (weapon.id) {
            case 'magic_missile': // Glowing orb with specular
                ctx.beginPath();
                ctx.arc(cx, cy, size * 0.72, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.55)';
                ctx.beginPath();
                ctx.arc(cx - size * 0.22, cy - size * 0.22, size * 0.28, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'whip': // Curved lash
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(cx - size, cy + size * 0.5);
                ctx.quadraticCurveTo(cx, cy - size, cx + size, cy);
                ctx.stroke();
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(cx + size, cy, 2.5, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'throwing_knife': // Blade + handle
                ctx.beginPath();
                ctx.moveTo(cx, cy - size);
                ctx.lineTo(cx + size * 0.42, cy + size * 0.62);
                ctx.lineTo(cx - size * 0.42, cy + size * 0.62);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(cx - size * 0.16, cy + size * 0.5, size * 0.32, size * 0.55);
                break;

            case 'lightning_chain': // Zigzag bolt
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(cx - size * 0.3,  cy - size);
                ctx.lineTo(cx + size * 0.28, cy - size * 0.28);
                ctx.lineTo(cx - size * 0.10, cy + size * 0.05);
                ctx.lineTo(cx + size * 0.5,  cy + size);
                ctx.stroke();
                break;

            case 'garlic_aura': // Concentric rings
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(cx, cy, size * 0.72, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(cx, cy, size * 0.38, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'holy_bible': // Cross
                ctx.fillRect(cx - size * 0.16, cy - size * 0.75, size * 0.32, size * 1.5);
                ctx.fillRect(cx - size * 0.65, cy - size * 0.18, size * 1.3, size * 0.36);
                break;

            case 'fire_wand': // Flame + bright core
                ctx.beginPath();
                ctx.moveTo(cx, cy - size);
                ctx.quadraticCurveTo(cx + size * 0.82, cy, cx, cy + size * 0.52);
                ctx.quadraticCurveTo(cx - size * 0.82, cy, cx, cy - size);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#FFAA00';
                ctx.beginPath();
                ctx.arc(cx, cy - size * 0.22, size * 0.28, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'bone_boomerang': // V-arc with knobs
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(cx - size, cy - size * 0.3);
                ctx.quadraticCurveTo(cx, cy + size * 0.55, cx + size, cy - size * 0.3);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(cx - size, cy - size * 0.3, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(cx + size, cy - size * 0.3, 2.5, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'ice_shard': // Star-crystal
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
                    const r = i % 2 === 0 ? size * 0.78 : size * 0.45;
                    const x = cx + Math.cos(a) * r;
                    const y = cy + Math.sin(a) * r;
                    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.52)';
                ctx.beginPath();
                ctx.arc(cx - size * 0.2, cy - size * 0.2, size * 0.22, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'shadow_dagger': // Angled dagger with purple gleam
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(-Math.PI / 4);
                ctx.beginPath();
                ctx.moveTo(0, -size * 0.92);
                ctx.lineTo(size * 0.28,  size * 0.42);
                ctx.lineTo(0,            size * 0.22);
                ctx.lineTo(-size * 0.28, size * 0.42);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = 'rgba(180, 90, 255, 0.65)';
                ctx.beginPath();
                ctx.arc(0, -size * 0.6, size * 0.20, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                break;

            default:
                ctx.beginPath();
                ctx.arc(cx, cy, size * 0.62, 0, Math.PI * 2);
                ctx.fill();
        }
    }

    // ════════════════════════════════════════════════════════════════════
    //  UTILITIES
    // ════════════════════════════════════════════════════════════════════

    /** Reserve bottom space when other bottom-center HUD cards are active. */
    _getBottomHUDOffset() {
        const mc = this.game.systems?.microChallenge;
        if (mc?.activeChallenge) {
            return 92; // keeps inventory/minimap above the challenge card
        }
        return 0;
    }

    /** Draw filled + stroked rounded rect with a soft glow on the border. */
    _panel(ctx, x, y, w, h, r, bgColor, borderColor) {
        const C = CanvasHUD.C;
        // Background fill
        this._roundRect(ctx, x, y, w, h, r);
        ctx.fillStyle = bgColor;
        ctx.fill();

        // Top-edge highlight (subtle inner light, gives depth)
        const hlGrad = ctx.createLinearGradient(x, y, x, y + 10);
        hlGrad.addColorStop(0,   'rgba(255, 255, 255, 0.07)');
        hlGrad.addColorStop(1,   'rgba(255, 255, 255, 0)');
        this._roundRect(ctx, x, y, w, Math.min(10, h), r);
        ctx.fillStyle = hlGrad;
        ctx.fill();

        // Glowing border
        ctx.save();
        ctx.shadowColor = C.panelGlow;
        ctx.shadowBlur  = 10;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth   = 1.5;
        this._roundRect(ctx, x, y, w, h, r);
        ctx.stroke();
        ctx.restore();
    }

    /** Portable roundRect (uses native if available, else bezier fallback). */
    _roundRect(ctx, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, w, h, rr);
        } else {
            ctx.moveTo(x + rr, y);
            ctx.lineTo(x + w - rr, y);
            ctx.arcTo(x + w, y,     x + w, y + rr, rr);
            ctx.lineTo(x + w, y + h - rr);
            ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
            ctx.lineTo(x + rr, y + h);
            ctx.arcTo(x, y + h,     x, y + h - rr, rr);
            ctx.lineTo(x, y + rr);
            ctx.arcTo(x, y,         x + rr, y, rr);
            ctx.closePath();
        }
    }

    /** Darken a #RRGGBB color by `amount` (0–1). */
    _darken(color, amount) {
        if (color.startsWith('#') && color.length === 7) {
            const r = Math.max(0, parseInt(color.slice(1, 3), 16) * (1 - amount));
            const g = Math.max(0, parseInt(color.slice(3, 5), 16) * (1 - amount));
            const b = Math.max(0, parseInt(color.slice(5, 7), 16) * (1 - amount));
            return `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`;
        }
        return color;
    }

    /** Convert #RRGGBB hex to "R, G, B" string for use in rgba(). */
    _hexToRgb(hex) {
        if (!hex || !hex.startsWith('#') || hex.length < 7) return '255,255,255';
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `${r}, ${g}, ${b}`;
    }

    /** Called at the start of each run to reset animated state. */
    reset() {
        this.displayXP = 0;
        this.xpFlash   = 0;
        this.lastXP    = 0;

        const maxHP = this.game.player?.maxHealth || 100;
        this.displayHealth = maxHP;
        this.trailHealth   = maxHP;
        this.healthFlash   = 0;
        this.healPulse     = 0;
        this.lastHealth    = maxHP;

        this.displayKills = 0;
        this.killFlash    = 0;

        this.displayGold = 0;
        this.goldFlash   = 0;
        this.lastGold    = 0;

        this.levelUpFlash = 0;
        this.lastLevel    = 1;

        this.weaponFireFlash.clear();
    }
}
