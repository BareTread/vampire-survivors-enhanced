import { CHARACTERS } from '../data/characters.js';

/**
 * RunSummarySystem - Canvas-rendered post-death run statistics screen.
 *
 * Overlays the frozen game scene with animated stat reveals, record badges,
 * a gold count-up, and play-again / main-menu buttons.
 *
 * Active during gameState === 'summary'.
 */
export class RunSummarySystem {
    constructor(game) {
        this.game = game;

        // State
        this.active = false;
        this.runData = null;
        this.newRecords = new Set();
        this.revealTimer = 0;
        this.goldCounter = 0;
        this.selectedButton = 0; // 0 = Play Again, 1 = Main Menu
        this.hoveredButton = -1;

        // Layout cache
        this._buttonRects = [];

        // Floating particles for visual flair
        this._particles = [];

        // Stat definitions (order of reveal)
        this.statDefs = [
            {
                key: 'survivalTime',
                label: 'TIME SURVIVED',
                format: 'time',
                recordKey: 'longestSurvival',
                icon: 'hourglass'
            },
            { key: 'kills', label: 'ENEMIES SLAIN', format: 'number', recordKey: 'highestKillCount', icon: 'skull' },
            { key: 'level', label: 'LEVEL REACHED', format: 'number', recordKey: 'maxLevel', icon: 'star' },
            { key: 'combo', label: 'BEST COMBO', format: 'number', recordKey: 'highestCombo', icon: 'bolt' },
            {
                key: 'goldEarned',
                label: 'GOLD EARNED',
                format: 'number',
                recordKey: 'mostGoldSingleRun',
                icon: 'coin'
            },
            {
                key: 'damageDealt',
                label: 'DAMAGE DEALT',
                format: 'number',
                recordKey: 'totalDamageDealt',
                icon: 'swords'
            }
        ];
    }

    /**
     * Show the summary screen with stats from the just-ended run.
     * Must be called BEFORE persistence.recordRunEnd() so record
     * comparisons are against pre-update values.
     */
    show(runData) {
        this.active = true;
        this.runData = runData;
        this.revealTimer = 0;
        this.goldCounter = 0;
        this.selectedButton = 0;
        this.hoveredButton = -1;

        // Seed particles
        this._particles = [];
        for (let i = 0; i < 30; i++) {
            this._particles.push({
                x: Math.random(),
                y: Math.random(),
                vx: (Math.random() - 0.5) * 0.02,
                vy: -Math.random() * 0.015 - 0.005,
                size: 1 + Math.random() * 2,
                alpha: 0.1 + Math.random() * 0.2,
                color: Math.random() > 0.6 ? '#C03828' : Math.random() > 0.3 ? '#E8C96A' : '#8A8070'
            });
        }

        // Compare against current records (before save)
        this.newRecords = new Set();
        const persistence = this.game.systems.persistence;
        if (persistence) {
            const records = persistence.data.records;
            for (const def of this.statDefs) {
                const val = runData[def.key] || 0;
                if (def.recordKey === 'totalDamageDealt') continue;
                const prev = records[def.recordKey] || 0;
                if (val > prev && val > 0) {
                    this.newRecords.add(def.key);
                }
            }
        }
    }

    // ---- Update ----

    update(dt) {
        if (!this.active) return;

        this.revealTimer += dt;

        // Animated gold counter
        const goldStart = 1.5;
        const goldDuration = 1.5;
        const goldTarget = this.runData ? this.runData.goldEarned || 0 : 0;
        if (this.revealTimer > goldStart) {
            const t = Math.min(1, (this.revealTimer - goldStart) / goldDuration);
            const eased = 1 - (1 - t) * (1 - t);
            this.goldCounter = Math.floor(goldTarget * eased);
        }

        // Update particles
        for (const p of this._particles) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.y < -0.05) {
                p.y = 1.05;
                p.x = Math.random();
            }
            if (p.x < -0.05 || p.x > 1.05) {
                p.x = Math.random();
                p.y = 1.05;
            }
        }
    }

    // ---- Render ----

    render(ctx) {
        if (!this.active || !this.runData) return;

        const w = this.game.canvas.width;
        const h = this.game.canvas.height;

        // 1. Dark overlay with vignette
        ctx.fillStyle = 'rgba(3, 3, 6, 0.80)';
        ctx.fillRect(0, 0, w, h);

        // Vignette gradient overlay
        const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.7);
        vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vig.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, w, h);

        // Floating embers (behind content)
        for (const p of this._particles) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x * w, p.y * h, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Blood-red decorative line at top — danger accent
        const lineGrad = ctx.createLinearGradient(w * 0.2, 0, w * 0.8, 0);
        lineGrad.addColorStop(0, 'rgba(192, 56, 40, 0)');
        lineGrad.addColorStop(0.3, 'rgba(192, 56, 40, 0.55)');
        lineGrad.addColorStop(0.5, 'rgba(192, 56, 40, 0.75)');
        lineGrad.addColorStop(0.7, 'rgba(192, 56, 40, 0.55)');
        lineGrad.addColorStop(1, 'rgba(192, 56, 40, 0)');

        const topLineY = h * 0.06;
        ctx.fillStyle = lineGrad;
        ctx.fillRect(w * 0.15, topLineY, w * 0.7, 2);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 2. Header — "FALLEN IN BATTLE" carved bone over a blood glow
        const headerY = h * 0.1;
        const fontSize = Math.min(44, w * 0.048);

        ctx.shadowColor = 'rgba(192, 56, 40, 0.7)';
        ctx.shadowBlur = 26;
        ctx.font = `bold ${fontSize}px 'Cinzel', 'Georgia', 'Times New Roman', serif`;
        ctx.fillStyle = '#EDE3C8';
        ctx.fillText('FALLEN IN BATTLE', w / 2, headerY);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Character name and title
        const charId = this.game.systems.persistence ? this.game.systems.persistence.getSelectedCharacter() : 'antonio';
        const character = CHARACTERS.find((c) => c.id === charId);
        if (character) {
            ctx.font = `bold 15px Georgia, serif`;
            ctx.fillStyle = character.color;
            ctx.globalAlpha = 0.9;
            ctx.fillText(`${character.name} \u2014 ${character.title}`, w / 2, headerY + 30);
            ctx.globalAlpha = 1;
        }

        // "Killed by" display — drawn skull + blood text
        if (this.runData.killedBy && this.runData.killedBy.name) {
            const killerName = this.runData.killedBy.name.charAt(0).toUpperCase() + this.runData.killedBy.name.slice(1);
            const killY = headerY + (character ? 52 : 32);
            ctx.font = `bold 14px Georgia, serif`;
            const killText = `Killed by ${killerName}`;
            const killW = ctx.measureText(killText).width;
            this._icon(ctx, 'skull', w / 2 - killW / 2 - 14, killY, 8, '#D94A3A');
            ctx.fillStyle = '#E86A5A';
            ctx.globalAlpha = 0.95;
            ctx.fillText(killText, w / 2 + 8, killY);
            ctx.globalAlpha = 1;
        }

        // 3. Stats panel — card-style with background
        const panelX = w * 0.18;
        const panelW = w * 0.64;
        const statsStartY = h * 0.22;
        const statSpacing = Math.min(40, (h * 0.48) / this.statDefs.length);
        const panelH = this.statDefs.length * statSpacing + 20;

        // Panel background — charcoal stone slab
        const pGrad = ctx.createLinearGradient(panelX, statsStartY - 15, panelX, statsStartY - 15 + panelH);
        pGrad.addColorStop(0, 'rgba(26, 24, 30, 0.72)');
        pGrad.addColorStop(1, 'rgba(13, 12, 16, 0.78)');
        ctx.fillStyle = pGrad;
        this.roundRect(ctx, panelX, statsStartY - 15, panelW, panelH, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(198, 160, 92, 0.30)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, panelX, statsStartY - 15, panelW, panelH, 10);
        ctx.stroke();

        const revealDelay = 0.25;

        for (let i = 0; i < this.statDefs.length; i++) {
            const def = this.statDefs[i];
            const statRevealTime = i * revealDelay;

            if (this.revealTimer < statRevealTime) continue;

            const fadeT = Math.min(1, (this.revealTimer - statRevealTime) / 0.3);
            // Slide in from left
            const slideX = (1 - fadeT) * -30;
            ctx.globalAlpha = fadeT;

            const sy = statsStartY + i * statSpacing + 8;
            const val = this.runData[def.key] || 0;
            const displayVal = def.format === 'time' ? this.formatTime(val) : this.formatNumber(val);

            // Alternating row background
            if (i % 2 === 0) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
                ctx.fillRect(panelX + 4, sy - statSpacing / 2 + 2, panelW - 8, statSpacing);
            }

            // Icon — drawn glyph
            this._icon(ctx, def.icon, panelX + 22 + slideX, sy, 8, 'rgba(190, 175, 145, 0.65)');

            // Label
            ctx.font = '13px Georgia, serif';
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(178, 168, 146, 0.85)';
            ctx.fillText(def.label, panelX + 40 + slideX, sy);

            // Value — larger, brighter
            ctx.font = 'bold 20px "Courier New", monospace';
            ctx.textAlign = 'right';
            const isRecord = this.newRecords.has(def.key);
            ctx.fillStyle = isRecord ? '#E8C96A' : '#EDE6D4';
            ctx.fillText(displayVal, panelX + panelW - 20 + slideX, sy);

            // NEW RECORD badge
            if (isRecord) {
                const badgeX = panelX + panelW - 18 + slideX;
                const badgeY = sy - 12;

                // Pulsing glow
                const pulse = 0.7 + 0.3 * Math.sin(this.revealTimer * 5);
                ctx.save();
                ctx.globalAlpha = fadeT * pulse;
                ctx.font = 'bold 9px Georgia, serif';
                ctx.textAlign = 'right';
                ctx.fillStyle = '#E8C96A';
                ctx.shadowColor = 'rgba(232, 201, 106, 0.7)';
                ctx.shadowBlur = 8;
                ctx.fillText('\u2605 NEW RECORD', badgeX, badgeY);
                ctx.shadowBlur = 0;
                ctx.shadowColor = 'transparent';
                ctx.restore();
            }
        }

        ctx.globalAlpha = 1;

        // Milestone distance hint
        const kills = this.runData.kills || 0;
        const milestones = [100, 500, 1000, 2500, 5000, 10000];
        let nextMilestone = null;
        for (const m of milestones) {
            if (kills < m) { nextMilestone = m; break; }
        }
        if (nextMilestone && this.revealTimer > 1.5) {
            const hintFade = Math.min(1, (this.revealTimer - 1.5) / 0.4);
            ctx.globalAlpha = hintFade * 0.7;
            ctx.font = 'italic 12px Georgia, serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(178, 168, 146, 0.8)';
            const remaining = nextMilestone - kills;
            ctx.fillText(`${remaining} kills away from ${this.formatNumber(nextMilestone)} milestone`, w / 2, statsStartY + panelH + 6);
            ctx.globalAlpha = 1;
        }

        // 4. Weapons used row (visual icons)
        const weaponsY = statsStartY + panelH + 24;
        if (this.revealTimer > 1.8 && this.runData.weaponsUsed && this.runData.weaponsUsed.length > 0) {
            const weapFade = Math.min(1, (this.revealTimer - 1.8) / 0.4);
            ctx.globalAlpha = weapFade;
            ctx.font = '11px Georgia, serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(170, 158, 132, 0.6)';
            ctx.fillText('ARSENAL', w / 2, weaponsY);

            // Weapon name pills
            const names = this.runData.weaponsUsed.map((id) => this.formatWeaponName(id));
            const totalLen = names.reduce((s, n) => s + n.length * 8 + 20, 0);
            let px = w / 2 - totalLen / 2;

            ctx.font = '12px Georgia, serif';
            for (const name of names) {
                const tw = ctx.measureText(name).width + 16;
                // Pill background — stone chip
                ctx.fillStyle = 'rgba(38, 35, 42, 0.7)';
                this.roundRect(ctx, px, weaponsY + 6, tw, 22, 5);
                ctx.fill();
                ctx.strokeStyle = 'rgba(150, 128, 92, 0.35)';
                ctx.lineWidth = 1;
                this.roundRect(ctx, px, weaponsY + 6, tw, 22, 5);
                ctx.stroke();
                // Text
                ctx.fillStyle = 'rgba(226, 216, 192, 0.9)';
                ctx.textAlign = 'center';
                ctx.fillText(name, px + tw / 2, weaponsY + 18);
                px += tw + 8;
            }
            ctx.globalAlpha = 1;
        }

        // 5. Buttons
        const buttonsY = Math.min(weaponsY + 50, h * 0.84);
        if (this.revealTimer > 2.2) {
            const btnFade = Math.min(1, (this.revealTimer - 2.2) / 0.4);
            ctx.globalAlpha = btnFade;
            this.renderButtons(ctx, w, buttonsY);
            ctx.globalAlpha = 1;
        }

        // 6. Keyboard hints
        if (this.revealTimer > 2.8) {
            const hintFade = Math.min(1, (this.revealTimer - 2.8) / 0.4);
            ctx.globalAlpha = hintFade * 0.4;
            ctx.font = '12px Georgia, serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(178, 168, 146, 0.9)';
            ctx.fillText('R  Play Again    ·    M / ESC  Main Menu', w / 2, buttonsY + 54);
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }

    renderButtons(ctx, w, y) {
        this._buttonRects = [];
        const btnW = 180;
        const btnH = 46;
        const gap = 30;
        const totalW = btnW * 2 + gap;
        const startX = (w - totalW) / 2;

        const buttons = [
            { label: 'PLAY AGAIN', primary: true },
            { label: 'MAIN MENU', primary: false }
        ];

        for (let i = 0; i < buttons.length; i++) {
            const btn = buttons[i];
            const bx = startX + i * (btnW + gap);
            const isSelected = i === this.selectedButton;
            const isHovered = i === this.hoveredButton;
            const active = isSelected || isHovered;

            this._buttonRects.push({ x: bx, y, w: btnW, h: btnH });

            // Stone slab gradient
            const bgGrad = ctx.createLinearGradient(bx, y, bx, y + btnH);
            if (active) {
                bgGrad.addColorStop(0, 'rgba(74, 62, 48, 0.95)');
                bgGrad.addColorStop(1, 'rgba(36, 30, 26, 0.95)');
            } else {
                bgGrad.addColorStop(0, 'rgba(52, 48, 54, 0.92)');
                bgGrad.addColorStop(1, 'rgba(24, 22, 27, 0.95)');
            }

            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 3;
            ctx.fillStyle = bgGrad;
            this.roundRect(ctx, bx, y, btnW, btnH, 8);
            ctx.fill();
            ctx.restore();

            // Border — brass when active, dim stone otherwise
            ctx.strokeStyle = active ? 'rgba(216, 180, 106, 0.8)' : 'rgba(150, 128, 92, 0.4)';
            ctx.lineWidth = active ? 1.6 : 1;
            this.roundRect(ctx, bx, y, btnW, btnH, 8);
            ctx.stroke();

            // Selection glow
            if (active) {
                ctx.shadowColor = 'rgba(216, 180, 106, 0.5)';
                ctx.shadowBlur = 14;
                this.roundRect(ctx, bx, y, btnW, btnH, 8);
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.shadowColor = 'transparent';
            }

            // Label
            ctx.font = `bold 15px 'Cinzel', 'Georgia', serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = active ? '#F0E2BC' : 'rgba(201, 180, 137, 0.85)';
            ctx.fillText(btn.label, bx + btnW / 2, y + btnH / 2 + 1);
        }
    }
    handleInput(key) {
        if (!this.active) return;

        const k = key.toLowerCase();

        if (k === 'r') {
            this.game.restartGame();
        } else if (k === 'm' || k === 'escape') {
            this.game.returnToMenu();
        } else if (k === 'arrowleft') {
            this.selectedButton = 0;
        } else if (k === 'arrowright') {
            this.selectedButton = 1;
        } else if (k === 'enter' || k === ' ') {
            if (this.selectedButton === 0) {
                this.game.restartGame();
            } else {
                this.game.returnToMenu();
            }
        }
    }

    handleClick(x, y) {
        if (!this.active) return;

        for (let i = 0; i < this._buttonRects.length; i++) {
            const r = this._buttonRects[i];
            if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                if (i === 0) {
                    this.game.restartGame();
                } else {
                    this.game.returnToMenu();
                }
                return;
            }
        }
    }

    handleMouseMove(x, y) {
        if (!this.active) return;

        this.hoveredButton = -1;
        for (let i = 0; i < this._buttonRects.length; i++) {
            const r = this._buttonRects[i];
            if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                this.hoveredButton = i;
                break;
            }
        }
    }

    // ---- Helpers ----

    formatTime(seconds) {

        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
    /**
     * Small authored icon glyphs — one consistent stroke weight, no emoji.
     * (x, y) is the center; s is roughly the half-size.
     */
    _icon(ctx, name, x, y, s, color) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = Math.max(1, s * 0.18);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        switch (name) {
            case 'hourglass': {
                ctx.beginPath();
                ctx.moveTo(x - s * 0.55, y - s * 0.75);
                ctx.lineTo(x + s * 0.55, y - s * 0.75);
                ctx.lineTo(x + s * 0.15, y);
                ctx.lineTo(x + s * 0.55, y + s * 0.75);
                ctx.lineTo(x - s * 0.55, y + s * 0.75);
                ctx.lineTo(x - s * 0.15, y);
                ctx.closePath();
                ctx.stroke();
                break;
            }
            case 'skull': {
                ctx.beginPath();
                ctx.arc(x, y - s * 0.15, s * 0.62, Math.PI * 0.85, Math.PI * 2.15);
                ctx.lineTo(x + s * 0.4, y + s * 0.55);
                ctx.lineTo(x - s * 0.4, y + s * 0.55);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = 'rgba(0,0,0,0.55)';
                ctx.beginPath();
                ctx.arc(x - s * 0.24, y - s * 0.18, s * 0.15, 0, Math.PI * 2);
                ctx.arc(x + s * 0.24, y - s * 0.18, s * 0.15, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'star': {
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const a = -Math.PI / 2 + (i * Math.PI * 4) / 5;
                    const px = x + Math.cos(a) * s * 0.75;
                    const py = y + Math.sin(a) * s * 0.75;
                    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
                break;
            }
            case 'bolt': {
                ctx.beginPath();
                ctx.moveTo(x + s * 0.15, y - s * 0.8);
                ctx.lineTo(x - s * 0.4, y + s * 0.1);
                ctx.lineTo(x + s * 0.02, y + s * 0.1);
                ctx.lineTo(x - s * 0.15, y + s * 0.8);
                ctx.lineTo(x + s * 0.4, y - s * 0.1);
                ctx.lineTo(x - s * 0.02, y - s * 0.1);
                ctx.closePath();
                ctx.fill();
                break;
            }
            case 'coin': {
                ctx.beginPath();
                ctx.arc(x, y, s * 0.75, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.4)';
                ctx.beginPath();
                ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
                ctx.stroke();
                break;
            }
            case 'swords': {
                for (const dir of [-1, 1]) {
                    ctx.beginPath();
                    ctx.moveTo(x - dir * s * 0.7, y + s * 0.7);
                    ctx.lineTo(x + dir * s * 0.7, y - s * 0.7);
                    ctx.stroke();
                }
                break;
            }
            default: {
                ctx.beginPath();
                ctx.moveTo(x, y - s * 0.6);
                ctx.lineTo(x + s * 0.6, y);
                ctx.lineTo(x, y + s * 0.6);
                ctx.lineTo(x - s * 0.6, y);
                ctx.closePath();
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    formatNumber(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return String(Math.floor(n));
    }

    formatWeaponName(id) {
        return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }

    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    reset() {
        this.active = false;
        this.runData = null;
        this.newRecords = new Set();
        this.revealTimer = 0;
        this.goldCounter = 0;
        this.selectedButton = 0;
        this.hoveredButton = -1;
        this._buttonRects = [];
        this._particles = [];
    }
}
