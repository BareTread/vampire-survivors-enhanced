import { CHARACTERS } from '../data/characters.js';

const WEAPON_NAMES = {
    whip: '鞭子',
    magic_missile: '魔法飞弹',
    fire_wand: '火焰法杖',
    lightning_chain: '连锁闪电',
    garlic_aura: '大蒜光环',
    holy_bible: '圣经',
    bone_boomerang: '骨头回旋镖',
    throwing_knife: '飞刀',
    ice_shard: '冰晶碎片',
    shadow_dagger: '暗影匕首'
};

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
                label: '生存时间',
                format: 'time',
                recordKey: 'longestSurvival',
                icon: '\u23F1'
            },
            { key: 'kills', label: '击杀敌人', format: 'number', recordKey: 'highestKillCount', icon: '\u2620' },
            { key: 'level', label: '达到等级', format: 'number', recordKey: 'maxLevel', icon: '\u2B50' },
            { key: 'combo', label: '最佳连击', format: 'number', recordKey: 'highestCombo', icon: '\u26A1' },
            {
                key: 'goldEarned',
                label: '获得金币',
                format: 'number',
                recordKey: 'mostGoldSingleRun',
                icon: '\uD83D\uDCB0'
            },
            {
                key: 'damageDealt',
                label: '造成伤害',
                format: 'number',
                recordKey: 'totalDamageDealt',
                icon: '\u2694'
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
                color: Math.random() > 0.6 ? '#FF4444' : Math.random() > 0.3 ? '#FFD700' : '#8844AA'
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
        ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
        ctx.fillRect(0, 0, w, h);

        // Vignette gradient overlay
        const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.7);
        vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vig.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, w, h);

        // Floating particles (behind content)
        for (const p of this._particles) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x * w, p.y * h, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Red decorative line at top
        const lineGrad = ctx.createLinearGradient(w * 0.2, 0, w * 0.8, 0);
        lineGrad.addColorStop(0, 'rgba(255, 60, 40, 0)');
        lineGrad.addColorStop(0.3, 'rgba(255, 60, 40, 0.6)');
        lineGrad.addColorStop(0.5, 'rgba(255, 60, 40, 0.8)');
        lineGrad.addColorStop(0.7, 'rgba(255, 60, 40, 0.6)');
        lineGrad.addColorStop(1, 'rgba(255, 60, 40, 0)');

        const topLineY = h * 0.06;
        ctx.fillStyle = lineGrad;
        ctx.fillRect(w * 0.15, topLineY, w * 0.7, 2);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 2. Header — "FALLEN IN BATTLE" with glow
        const headerY = h * 0.1;
        const fontSize = Math.min(44, w * 0.048);

        // Text glow layers
        ctx.shadowColor = 'rgba(255, 40, 30, 0.8)';
        ctx.shadowBlur = 30;
        ctx.font = `bold ${fontSize}px 'Cinzel', 'Times New Roman', serif`;
        ctx.fillStyle = '#FF3333';
        ctx.fillText('战死于沙场', w / 2, headerY);
        ctx.shadowBlur = 15;
        ctx.fillText('战死于沙场', w / 2, headerY);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Lighter text on top
        ctx.fillStyle = '#FF8888';
        ctx.fillText('战死于沙场', w / 2, headerY);

        // Character name and title
        const charId = this.game.systems.persistence ? this.game.systems.persistence.getSelectedCharacter() : 'antonio';
        const character = CHARACTERS.find((c) => c.id === charId);
        if (character) {
            ctx.font = `bold 15px Arial, sans-serif`;
            ctx.fillStyle = character.color;
            ctx.globalAlpha = 0.9;
            ctx.fillText(`${character.name} \u2014 ${character.title}`, w / 2, headerY + 30);
            ctx.globalAlpha = 1;
        }

        // "Killed by" display
        if (this.runData.killedBy && this.runData.killedBy.name) {
            ctx.font = `bold 14px Arial, sans-serif`;
            ctx.fillStyle = '#FF6666';
            ctx.globalAlpha = 0.95;
            const killerName = this.runData.killedBy.name.charAt(0).toUpperCase() + this.runData.killedBy.name.slice(1);
            ctx.fillText(`\u2620 击杀者: ${killerName}`, w / 2, headerY + (character ? 50 : 30));
            ctx.globalAlpha = 1;
        }

        // Decorative line below header
        ctx.fillStyle = lineGrad;
        ctx.fillRect(w * 0.2, headerY + 62, w * 0.6, 1);

        // 3. Stats panel — card-style with background
        const panelX = w * 0.18;
        const panelW = w * 0.64;
        const statsStartY = h * 0.22;
        const statSpacing = Math.min(40, (h * 0.48) / this.statDefs.length);
        const panelH = this.statDefs.length * statSpacing + 20;

        // Panel background
        ctx.fillStyle = 'rgba(20, 15, 30, 0.5)';
        this.roundRect(ctx, panelX, statsStartY - 15, panelW, panelH, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 60, 40, 0.15)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, panelX, statsStartY - 15, panelW, panelH, 12);
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

            // Icon
            ctx.font = '16px Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(200, 200, 220, 0.5)';
            ctx.fillText(def.icon, panelX + 16 + slideX, sy);

            // Label
            ctx.font = '13px Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(160, 160, 180, 0.85)';
            ctx.fillText(def.label, panelX + 40 + slideX, sy);

            // Value — larger, brighter
            ctx.font = 'bold 20px "Courier New", monospace';
            ctx.textAlign = 'right';
            const isRecord = this.newRecords.has(def.key);
            ctx.fillStyle = isRecord ? '#FFD700' : '#E8E8F8';
            ctx.fillText(displayVal, panelX + panelW - 20 + slideX, sy);

            // NEW RECORD badge
            if (isRecord) {
                const badgeX = panelX + panelW - 18 + slideX;
                const badgeY = sy - 12;

                // Pulsing glow
                const pulse = 0.7 + 0.3 * Math.sin(this.revealTimer * 5);
                ctx.save();
                ctx.globalAlpha = fadeT * pulse;
                ctx.font = 'bold 9px Arial, sans-serif';
                ctx.textAlign = 'right';
                ctx.fillStyle = '#FFD700';
                ctx.shadowColor = 'rgba(255, 215, 0, 0.7)';
                ctx.shadowBlur = 8;
                ctx.fillText('\u2605 新纪录', badgeX, badgeY);
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
            ctx.font = 'italic 12px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#AAAACC';
            const remaining = nextMilestone - kills;
            ctx.fillText(`距离 ${this.formatNumber(nextMilestone)} 里程碑还差 ${remaining} 击杀`, w / 2, statsStartY + panelH + 6);
            ctx.globalAlpha = 1;
        }

        // 4. Weapons used row (visual icons)
        const weaponsY = statsStartY + panelH + 24;
        if (this.revealTimer > 1.8 && this.runData.weaponsUsed && this.runData.weaponsUsed.length > 0) {
            const weapFade = Math.min(1, (this.revealTimer - 1.8) / 0.4);
            ctx.globalAlpha = weapFade;
            ctx.font = '11px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(150, 150, 170, 0.6)';
            ctx.fillText('武器库', w / 2, weaponsY);

            // Weapon name pills
            const names = this.runData.weaponsUsed.map((id) => this.formatWeaponName(id));
            const totalLen = names.reduce((s, n) => s + n.length * 8 + 20, 0);
            let px = w / 2 - totalLen / 2;

            ctx.font = '12px Arial, sans-serif';
            for (const name of names) {
                const tw = ctx.measureText(name).width + 16;
                // Pill background
                ctx.fillStyle = 'rgba(80, 60, 120, 0.4)';
                this.roundRect(ctx, px, weaponsY + 6, tw, 22, 6);
                ctx.fill();
                // Text
                ctx.fillStyle = 'rgba(200, 190, 230, 0.9)';
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
            ctx.font = '12px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#AAAACC';
            ctx.fillText('R - 再来一局    M - 返回主菜单    ESC - 返回主菜单', w / 2, buttonsY + 54);
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }

    renderButtons(ctx, w, y) {
        this._buttonRects = [];
        const btnW = 170;
        const btnH = 46;
        const gap = 30;
        const totalW = btnW * 2 + gap;
        const startX = (w - totalW) / 2;

        const buttons = [
            { label: '再来一局', baseColor: [60, 160, 70], accent: '#4CAF50' },
            { label: '返回主菜单', baseColor: [100, 50, 140], accent: '#8844AA' }
        ];

        for (let i = 0; i < buttons.length; i++) {
            const btn = buttons[i];
            const bx = startX + i * (btnW + gap);
            const isSelected = i === this.selectedButton;
            const isHovered = i === this.hoveredButton;
            const active = isSelected || isHovered;

            this._buttonRects.push({ x: bx, y, w: btnW, h: btnH });

            // Button gradient background
            const [r, g, b] = btn.baseColor;
            const brightness = active ? 1.3 : 1.0;
            const bgGrad = ctx.createLinearGradient(bx, y, bx, y + btnH);
            bgGrad.addColorStop(0, `rgba(${r * brightness}, ${g * brightness}, ${b * brightness}, 0.85)`);
            bgGrad.addColorStop(
                1,
                `rgba(${r * brightness * 0.7}, ${g * brightness * 0.7}, ${b * brightness * 0.7}, 0.85)`
            );

            ctx.fillStyle = bgGrad;
            this.roundRect(ctx, bx, y, btnW, btnH, 10);
            ctx.fill();

            // Border
            ctx.strokeStyle = active ? btn.accent : 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = active ? 2 : 1;
            this.roundRect(ctx, bx, y, btnW, btnH, 10);
            ctx.stroke();

            // Selection glow
            if (active) {
                ctx.shadowColor = btn.accent;
                ctx.shadowBlur = 16;
                this.roundRect(ctx, bx, y, btnW, btnH, 10);
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.shadowColor = 'transparent';
            }

            // Text with subtle shadow
            ctx.font = `bold 15px 'Cinzel', 'Times New Roman', serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = active ? '#FFFFFF' : 'rgba(230, 230, 240, 0.9)';
            ctx.fillText(btn.label, bx + btnW / 2, y + btnH / 2);
        }
    }

    // ---- Input ----

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

    formatNumber(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return String(Math.floor(n));
    }

    formatWeaponName(id) {
        return WEAPON_NAMES[id] || id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
