import { CHARACTERS } from '../data/characters.js';
import { t } from '../i18n/index.js';

/**
 * TitleScreenSystem - Canvas-rendered title screen with menu navigation, upgrade shop,
 * and character selection.
 *
 * Handles game states:
 *   - 'menu'       : Main title screen
 *   - 'characters' : Character selection overlay
 *   - 'upgrades'   : Upgrade shop overlay
 *   - 'challenges' : Challenge modifier selection overlay
 */
export class TitleScreenSystem {
    constructor(game) {
        this.game = game;

        // Menu state
        this.selectedIndex = 0;
        this.menuItems = ['PLAY', 'ENDLESS', 'CHARACTERS', 'UPGRADES', 'CHALLENGES', 'STATISTICS', 'CODEX', 'SETTINGS'];
        this.hoveredIndex = -1;

        // Upgrade shop state
        this.upgradeSelectedIndex = 0;
        this.upgradeHoveredIndex = -1;
        this.upgradeList = [];

        // Character select state
        this.characterSelectedIndex = 0;
        this.characterHoveredIndex = -1;
        this._characterRects = [];
        this._characterBackRect = null;

        // Challenge select state
        this.challengeSelectedIndex = 0;
        this.challengeHoveredIndex = -1;
        this._challengeRects = [];
        this._challengeBackRect = null;

        // Codex state
        this.codexTabIndex = 0;
        this._codexBackRect = null;

        // Settings state
        this.settingsSelectedIndex = 0;
        this._settingsBackRect = null;
        this._settingsItemRects = [];

        // Pause menu state
        this.pauseSelectedIndex = 0;
        this.pauseHoveredIndex = -1;
        this._pauseMenuRects = [];

        // Animation
        this.time = 0;
        this.titleGlow = 0;
        this.particles = [];
        this.initParticles();

        // Layout cache (recomputed on render)
        this._menuRects = [];
        this._upgradeRects = [];
        this._backButtonRect = null;
        this._statsBackRect = null;

        this.theme = {
            // Accent colors
            accentFill: 'rgba(154, 78, 36, 0.22)',
            accentStroke: 'rgba(214, 138, 68, 0.72)',
            accentMuted: '#CBB48A',
            // Panel colors
            panelFill: 'rgba(18, 12, 24, 0.95)',
            panelStroke: 'rgba(196, 118, 54, 0.58)',
            panelGradTop: '#1c1528',
            panelGradBottom: '#0e0b14',
            // Back button
            backFill: 'rgba(68, 34, 24, 0.72)',
            backStroke: 'rgba(214, 150, 90, 0.55)',
            // Typography
            sectionLabel: '#D9A45C',
            headerGold: '#FFD700',
            titleRed: '#FF4444',
            textPrimary: '#E0E0F0',
            textMuted: 'rgba(180, 180, 200, 0.6)',
            // Gothic accents
            bloodRed: '#8B0000',
            boneWhite: '#F5F0E0',
            shadowPurple: '#2D1B4E',
            fogColor: 'rgba(120, 100, 140, 0.04)',
            // Stone tablet buttons
            stoneGradTop: 'rgba(60, 45, 35, 0.85)',
            stoneGradBottom: 'rgba(30, 22, 18, 0.92)',
            stoneBorder: 'rgba(140, 110, 80, 0.5)',
            stoneHighlight: 'rgba(200, 170, 120, 0.12)',
            // Status
            successGreen: '#44CC88',
            dangerRed: '#FF4466'
        };

        // Fog layers — 4 sine-wave bands rendered behind menu content
        this.fogLayers = [];
        for (let i = 0; i < 4; i++) {
            this.fogLayers.push({
                y: 0.2 + i * 0.2, // Spread across screen height
                amplitude: 15 + i * 8,
                frequency: 0.003 + i * 0.001,
                speed: 0.15 + i * 0.08,
                alpha: 0.03 + i * 0.015,
                phase: Math.random() * Math.PI * 2,
                thickness: 40 + i * 20
            });
        }

        // Blood drip state — procedural bezier drips generated for panel borders
        this.bloodDrips = [];
        this._bloodDripTimer = 0;

        // Animated silhouettes — faint character shapes at screen edges
        this.silhouettes = [
            { x: 0.08, y: 0.5, scale: 1.0, alpha: 0, targetAlpha: 0.06, type: 'vampire', sway: 0 },
            { x: 0.92, y: 0.55, scale: 0.9, alpha: 0, targetAlpha: 0.05, type: 'werewolf', sway: 0 },
            { x: 0.05, y: 0.7, scale: 0.7, alpha: 0, targetAlpha: 0.04, type: 'skeleton', sway: 0 }
        ];

        // Screen transition state
        this.transition = {
            active: false,
            alpha: 0,
            speed: 3.0, // Transitions take ~0.35 seconds
            targetState: null,
            phase: 'none' // 'fadeOut', 'fadeIn', 'none'
        };
    }

    // ---- Particles ----

    initParticles() {
        this.particles = [];
        // Embers particles
        for (let i = 0; i < 80; i++) {
            this.particles.push({
                x: Math.random(),
                y: Math.random(),
                vx: (Math.random() - 0.5) * 0.015,
                vy: -(Math.random() * 0.02 + 0.005), // Float upwards like embers
                size: 0.5 + Math.random() * 2.0,
                alpha: 0.08 + Math.random() * 0.28,
                phase: Math.random() * Math.PI * 2,
                color: Math.random() > 0.82 ? [255, 205, 120] : [255, 120 + Math.random() * 30, 36]
            });
        }
    }

    // ---- Update ----

    update(dt) {
        this.time += dt;
        this.titleGlow = 0.5 + 0.5 * Math.sin(this.time * 1.8);

        // Update particles
        for (const p of this.particles) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            // Wrap around
            if (p.x < -0.05) p.x = 1.05;
            if (p.x > 1.05) p.x = -0.05;
            if (p.y < -0.05) p.y = 1.05;
            if (p.y > 1.05) p.y = -0.05;
        }

        // Update fog layer phases
        for (const fog of this.fogLayers) {
            fog.phase += fog.speed * dt;
        }

        // Update silhouettes — slow fade-in and sway
        for (const sil of this.silhouettes) {
            sil.alpha += (sil.targetAlpha - sil.alpha) * 0.3 * dt;
            sil.sway = Math.sin(this.time * 0.5 + sil.x * 10) * 5;
        }

        // Generate blood drips periodically
        this._bloodDripTimer -= dt;
        if (this._bloodDripTimer <= 0) {
            this._bloodDripTimer = 2 + Math.random() * 3;
            if (this.bloodDrips.length < 12) {
                this.bloodDrips.push({
                    x: 0.1 + Math.random() * 0.8,
                    length: 15 + Math.random() * 30,
                    width: 1.5 + Math.random() * 2,
                    alpha: 0.15 + Math.random() * 0.2,
                    speed: 8 + Math.random() * 12,
                    y: 0
                });
            }
        }
        // Update drip positions
        for (let i = this.bloodDrips.length - 1; i >= 0; i--) {
            this.bloodDrips[i].y += this.bloodDrips[i].speed * dt;
            this.bloodDrips[i].alpha *= 0.995;
            if (this.bloodDrips[i].y > this.bloodDrips[i].length || this.bloodDrips[i].alpha < 0.01) {
                this.bloodDrips.splice(i, 1);
            }
        }

        // Update screen transitions
        if (this.transition.active) {
            if (this.transition.phase === 'fadeOut') {
                this.transition.alpha += this.transition.speed * dt;
                if (this.transition.alpha >= 1.0) {
                    this.transition.alpha = 1.0;
                    // Switch to target state and start fade-in
                    if (this.transition.targetState) {
                        this.game.gameState = this.transition.targetState;
                        this.transition.targetState = null;
                    }
                    this.transition.phase = 'fadeIn';
                }
            } else if (this.transition.phase === 'fadeIn') {
                this.transition.alpha -= this.transition.speed * dt;
                if (this.transition.alpha <= 0) {
                    this.transition.alpha = 0;
                    this.transition.active = false;
                    this.transition.phase = 'none';
                }
            }
        }

        // Refresh upgrade list when in upgrades view
        if (this.game.gameState === 'upgrades') {
            const persistence = this.game.systems.persistence;
            if (persistence) {
                this.upgradeList = persistence.getUpgradeInfo();
            }
        }
    }

    // ---- Render: Main Menu ----

    render(ctx) {
        const w = this.game.canvas.width;
        const h = this.game.canvas.height;

        // 1. Dark background with subtle animated gradient (closer to ash/void)
        const pulse = Math.sin(this.time * 0.5) * 0.5 + 0.5;
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, `rgba(${10 + pulse * 5}, ${8 + pulse * 3}, ${15 + pulse * 5}, 1)`);
        grad.addColorStop(1, `rgba(${5 + pulse * 2}, ${3 + pulse}, ${8 + pulse * 3}, 1)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // 1.5 Render deep background elements (fog and silhouettes)
        this.renderFog(ctx, w, h);
        this.renderSilhouettes(ctx, w, h);

        // 2. Ember particles
        for (const p of this.particles) {
            const px = p.x * w;
            const py = p.y * h;
            const flicker = p.alpha + 0.3 * Math.sin(this.time * 5.0 + p.phase);
            const [r, g, b] = p.color;

            // Ember glow
            ctx.shadowBlur = p.size * 2.5;
            ctx.shadowColor = `rgba(${r}, ${g * 0.75}, ${Math.max(20, b)}, 0.45)`;

            // Core
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.max(0, flicker)})`;

            ctx.beginPath();
            ctx.arc(px, py, p.size, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        }

        // 3. Title — positioned at 18% of screen height for more room below
        const titleY = h * 0.18;
        this.renderTitle(ctx, w, titleY);

        // 4. Menu items — adaptive layout that fits any screen size
        this._menuRects = [];
        const menuCount = this.menuItems.length;
        // Reserve space: title ends ~titleY+55, controls hint at h-30, records ~40px above that
        const menuTopY = titleY + 65;
        const menuBottomY = h - 80; // leave room for records + controls hint
        const availableH = menuBottomY - menuTopY;
        // Spacing: divide available height evenly, cap at 56px for comfort
        const menuSpacing = Math.min(56, Math.floor(availableH / menuCount));
        // Center the menu block vertically in the available space
        const menuBlockH = (menuCount - 1) * menuSpacing;
        const menuStartY = menuTopY + (availableH - menuBlockH) / 2;

        for (let i = 0; i < menuCount; i++) {
            const y = menuStartY + i * menuSpacing;
            const isSelected = i === this.selectedIndex;
            const isHovered = i === this.hoveredIndex;
            const label = this.menuItems[i];
            const menuLabelMap = {
                'PLAY': t('menu.play'),
                'ENDLESS': t('menu.endless'),
                'CHARACTERS': t('menu.characters'),
                'UPGRADES': t('menu.upgradesGold', { gold: this.game.systems.persistence ? this.game.systems.persistence.getGold() : 0 }),
                'CHALLENGES': t('menu.challenges'),
                'STATISTICS': t('menu.statistics'),
                'CODEX': t('menu.codex'),
                'SETTINGS': t('menu.settings')
            };
            const displayLabel = menuLabelMap[label] || label;

            // Adaptive font: scale down slightly on smaller screens
            const baseFontSize = Math.min(26, Math.max(18, menuSpacing * 0.46));
            const fontSize = isSelected || isHovered ? baseFontSize + 3 : baseFontSize;
            ctx.font = `bold ${fontSize}px 'Cinzel', 'Times New Roman', serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const textWidth = ctx.measureText(displayLabel).width;
            const rectW = textWidth + 50;
            const rectH = Math.min(46, menuSpacing - 6);
            const rectX = w / 2 - rectW / 2;
            const rectY = y - rectH / 2;

            this._menuRects.push({ x: rectX, y: rectY, w: rectW, h: rectH });

            // Button background
            if (isSelected || isHovered) {
                ctx.fillStyle = this.theme.accentFill;
                ctx.strokeStyle = this.theme.accentStroke;
                ctx.lineWidth = 2;
                this.roundRect(ctx, rectX, rectY, rectW, rectH, 10);
                ctx.fill();
                ctx.stroke();
            }

            // Text glow
            if (isSelected || isHovered) {
                ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
                ctx.shadowBlur = 15;
            }

            ctx.fillStyle = isSelected || isHovered ? '#FFD700' : this.theme.accentMuted;
            ctx.fillText(displayLabel, w / 2, y);

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        }

        // 5. Selection indicator (arrow)
        const selY = menuStartY + this.selectedIndex * menuSpacing;
        const arrowX = w / 2 - (this._menuRects[this.selectedIndex]?.w / 2 || 100) - 16;
        const bounce = Math.sin(this.time * 4) * 4;
        ctx.font = `bold ${Math.min(20, menuSpacing * 0.38)}px serif`;
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'right';
        ctx.fillText('>', arrowX + bounce, selY);

        // 6. Personal records — compact, pinned above controls hint
        this.renderRecords(ctx, w, h);

        // 7. Controls hint
        ctx.font = '13px Arial, sans-serif';
        ctx.fillStyle = 'rgba(200, 200, 220, 0.4)';
        ctx.textAlign = 'center';
        ctx.fillText(t('menu.controls'), w / 2, h - 14);

        // 8. Overlays
        if (this.game.gameState === 'upgrades') this.renderUpgrades(ctx);
        if (this.game.gameState === 'characters') this.renderCharacters(ctx);
        if (this.game.gameState === 'statistics') this.renderStatistics(ctx);
        if (this.game.gameState === 'challenges') this.renderChallenges(ctx);
        if (this.game.gameState === 'codex') this.renderCodex(ctx);
        if (this.game.gameState === 'settings') this.renderSettings(ctx);

        // 9. Drips (drawn over menus but under transition)
        this.renderBloodDrips(ctx, w, h);

        // 10. Screen Transition Overlay
        this.renderTransition(ctx, w, h);
    }

    renderTitle(ctx, w, y) {
        // Main title
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Title glow effect
        const glowAlpha = 0.3 + 0.3 * this.titleGlow;
        ctx.shadowColor = `rgba(255, 80, 40, ${glowAlpha})`;
        ctx.shadowBlur = 25 + 15 * this.titleGlow;

        ctx.font = `bold ${Math.min(56, w * 0.06)}px 'Cinzel', 'Times New Roman', serif`;
        ctx.fillStyle = '#FF4444';
        ctx.fillText('VAMPIRE SURVIVORS', w / 2, y);

        // Second pass for gold highlight
        ctx.shadowColor = `rgba(255, 215, 0, ${glowAlpha * 0.5})`;
        ctx.shadowBlur = 10;
        ctx.fillStyle = `rgba(255, 215, 0, ${0.15 + 0.1 * this.titleGlow})`;
        ctx.fillText('VAMPIRE SURVIVORS', w / 2, y);

        // Subtitle
        ctx.shadowColor = 'rgba(217, 164, 92, 0.45)';
        ctx.shadowBlur = 12;
        ctx.font = `bold ${Math.min(24, w * 0.025)}px 'Cinzel', 'Times New Roman', serif`;
        ctx.fillStyle = this.theme.sectionLabel;
        ctx.fillText(t('menu.subtitle'), w / 2, y + 42);

        ctx.restore();
    }

    renderRecords(ctx, w, h) {
        const persistence = this.game.systems.persistence;
        if (!persistence) return;

        const records = persistence.data.records;
        if (records.totalRuns === 0) return;

        // Pinned near bottom, single compact line
        const y = h - 38;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '11px Arial, sans-serif';
        ctx.fillStyle = 'rgba(160, 160, 180, 0.45)';

        const timeStr = this.formatTime(records.longestSurvival);
        const line = t('menu.personalBest', { time: timeStr, kills: records.highestKillCount, level: records.maxLevel, runs: records.totalRuns });
        ctx.fillText(line, w / 2, y);
        ctx.restore();
    }

    renderFog(ctx, w, h) {
        ctx.save();
        ctx.fillStyle = this.theme.fogColor;

        for (const fog of this.fogLayers) {
            ctx.beginPath();
            ctx.moveTo(0, h);

            // Draw sine wave across the screen width
            const segments = 20;
            for (let i = 0; i <= segments; i++) {
                const x = (i / segments) * w;
                const normalizedX = x / w;
                const wave = Math.sin(fog.phase + normalizedX * 5) * fog.amplitude;
                const y = h * fog.y + wave;
                ctx.lineTo(x, y);
            }

            ctx.lineTo(w, h);
            ctx.closePath();
            ctx.fill();

            // Draw a second pass with slight offset for thicker fog
            ctx.beginPath();
            ctx.moveTo(0, h);
            for (let i = 0; i <= segments; i++) {
                const x = (i / segments) * w;
                const normalizedX = x / w;
                const wave = Math.sin(fog.phase + Math.PI + normalizedX * 4) * (fog.amplitude * 0.8);
                const y = h * fog.y + fog.thickness + wave;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(w, h);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }

    renderSilhouettes(ctx, w, h) {
        ctx.save();
        for (const sil of this.silhouettes) {
            if (sil.alpha <= 0) continue;

            ctx.fillStyle = `rgba(10, 5, 20, ${sil.alpha})`;

            const x = w * sil.x + sil.sway;
            const y = h * sil.y;
            const s = 60 * sil.scale;

            ctx.beginPath();
            if (sil.type === 'vampire') {
                // Tall, cloaked figure
                ctx.moveTo(x, y - s);
                ctx.lineTo(x + s * 0.4, y - s * 0.8);
                ctx.lineTo(x + s * 0.6, y + s);
                ctx.lineTo(x - s * 0.6, y + s);
                ctx.lineTo(x - s * 0.4, y - s * 0.8);
            } else if (sil.type === 'werewolf') {
                // Hulking, hunched figure
                ctx.moveTo(x - s * 0.2, y - s * 0.8); // Snout
                ctx.lineTo(x + s * 0.5, y - s * 0.6); // Hunch
                ctx.lineTo(x + s * 0.7, y + s);       // Leg
                ctx.lineTo(x - s * 0.3, y + s);       // Leg
                ctx.lineTo(x - s * 0.6, y);           // Arm
            } else { // skeleton
                // Thin, jagged figure
                ctx.arc(x, y - s * 0.8, s * 0.2, 0, Math.PI * 2); // Skull
                ctx.moveTo(x, y - s * 0.6);
                ctx.lineTo(x, y + s); // Spine/Legs
                ctx.moveTo(x - s * 0.3, y - s * 0.4);
                ctx.lineTo(x + s * 0.3, y - s * 0.4); // Shoulders
            }
            ctx.fill();
        }
        ctx.restore();
    }

    renderBloodDrips(ctx, w, h) {
        if (this.bloodDrips.length === 0) return;

        ctx.save();
        for (const drip of this.bloodDrips) {
            ctx.fillStyle = `rgba(139, 0, 0, ${drip.alpha})`; // bloodRed

            const x = w * drip.x;
            const y = drip.y;
            const width = drip.width;

            ctx.beginPath();
            ctx.arc(x, y, width, 0, Math.PI);
            ctx.lineTo(x - width * 0.8, 0);
            ctx.lineTo(x + width * 0.8, 0);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    renderTransition(ctx, w, h) {
        if (!this.transition.active || this.transition.alpha <= 0) return;

        ctx.save();
        ctx.fillStyle = `rgba(0, 0, 0, ${this.transition.alpha})`;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }

    // ---- Render: Upgrade Shop ----

    renderUpgrades(ctx) {
        const w = this.game.canvas.width;
        const h = this.game.canvas.height;

        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.80)';
        ctx.fillRect(0, 0, w, h);

        // Panel
        const panelW = Math.min(600, w - 60);
        const panelH = Math.min(550, h - 80);
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;

        ctx.fillStyle = this.theme.panelFill;
        ctx.strokeStyle = this.theme.panelStroke;
        ctx.lineWidth = 2;
        this.roundRect(ctx, panelX, panelY, panelW, panelH, 16);
        ctx.fill();
        ctx.stroke();

        // Header
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 28px "Cinzel", "Times New Roman", serif';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(t('upgrades.title'), w / 2, panelY + 36);

        // Gold balance
        const gold = this.game.systems.persistence ? this.game.systems.persistence.getGold() : 0;
        ctx.font = 'bold 18px Arial, sans-serif';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(t('upgrades.gold', { gold }), w / 2, panelY + 66);

        // Upgrade list
        this._upgradeRects = [];
        const listY = panelY + 95;
        const itemH = 50;
        const listX = panelX + 20;
        const listW = panelW - 40;

        const upgrades = this.upgradeList;
        for (let i = 0; i < upgrades.length; i++) {
            const u = upgrades[i];
            const iy = listY + i * itemH;
            const isSelected = i === this.upgradeSelectedIndex;
            const isHovered = i === this.upgradeHoveredIndex;

            this._upgradeRects.push({ x: listX, y: iy, w: listW, h: itemH - 4 });

            // Row background
            if (isSelected || isHovered) {
                ctx.fillStyle = this.theme.accentFill;
                ctx.strokeStyle = this.theme.accentStroke;
                ctx.lineWidth = 1;
                this.roundRect(ctx, listX, iy, listW, itemH - 4, 6);
                ctx.fill();
                ctx.stroke();
            }

            // Icon
            ctx.font = 'bold 18px Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = this.theme.accentMuted;
            ctx.fillText(u.icon, listX + 10, iy + (itemH - 4) / 2);

            // Name
            ctx.font = 'bold 15px Arial, sans-serif';
            ctx.fillStyle = isSelected || isHovered ? '#FFD700' : '#E0E0F0';
            ctx.fillText(u.name, listX + 36, iy + 16);

            // Description
            ctx.font = '12px Arial, sans-serif';
            ctx.fillStyle = 'rgba(180, 180, 200, 0.7)';
            ctx.fillText(u.desc, listX + 36, iy + 34);

            // Level pips
            const pipsX = listX + listW - 160;
            for (let l = 0; l < u.maxLevel; l++) {
                const px = pipsX + l * 12;
                ctx.fillStyle = l < u.level ? '#FFD700' : 'rgba(100, 100, 120, 0.5)';
                ctx.beginPath();
                ctx.arc(px, iy + (itemH - 4) / 2, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            // Cost
            ctx.textAlign = 'right';
            ctx.font = 'bold 14px Arial, sans-serif';
            if (u.cost === null) {
                ctx.fillStyle = '#4ade80';
                ctx.fillText(t('upgrades.max'), listX + listW - 10, iy + (itemH - 4) / 2);
            } else {
                ctx.fillStyle = u.canAfford ? '#FFD700' : '#FF6B6B';
                ctx.fillText(t('upgrades.cost', { cost: u.cost }), listX + listW - 10, iy + (itemH - 4) / 2);
            }
        }

        // Back button
        const backW = 120;
        const backH = 36;
        const backX = (w - backW) / 2;
        const backY = panelY + panelH - 50;
        this._backButtonRect = { x: backX, y: backY, w: backW, h: backH };

        ctx.fillStyle = this.theme.backFill;
        ctx.strokeStyle = this.theme.backStroke;
        ctx.lineWidth = 1;
        this.roundRect(ctx, backX, backY, backW, backH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = 'bold 14px Arial, sans-serif';
        ctx.fillStyle = this.theme.accentMuted;
        ctx.fillText(t('upgrades.back'), w / 2, backY + backH / 2);
    }

    // ---- Render: Character Select ----

    renderCharacters(ctx) {
        const w = this.game.canvas.width;
        const h = this.game.canvas.height;
        const persistence = this.game.systems.persistence;
        const currentCharId = persistence ? persistence.getSelectedCharacter() : 'antonio';

        // Dark overlay with blur-like color
        ctx.fillStyle = 'rgba(10, 8, 15, 0.90)';
        ctx.fillRect(0, 0, w, h);

        // Responsive Panel Size
        const panelW = Math.min(960, w - 40);
        const panelH = Math.min(640, h - 40);
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;

        // Draw Panel Background
        const bgGradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
        bgGradient.addColorStop(0, '#1c1528');
        bgGradient.addColorStop(1, '#0e0b14');
        ctx.fillStyle = bgGradient;
        ctx.strokeStyle = '#3a2845';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 30;
        this.roundRect(ctx, panelX, panelY, panelW, panelH, 16);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.stroke();

        // Header
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 34px "Cinzel", "Times New Roman", serif';
        
        // Header Text Gradient
        const textGradient = ctx.createLinearGradient(0, panelY + 20, 0, panelY + 60);
        textGradient.addColorStop(0, '#FFF5C3');
        textGradient.addColorStop(1, '#FFD700');
        ctx.fillStyle = textGradient;
        
        ctx.shadowColor = 'rgba(255, 215, 0, 0.3)';
        ctx.shadowBlur = 15;
        ctx.fillText(t('characters.title'), w / 2, panelY + 45);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Divider
        ctx.beginPath();
        ctx.moveTo(panelX + 40, panelY + 80);
        ctx.lineTo(panelX + panelW - 40, panelY + 80);
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Two-pane Layout
        const leftPaneW = panelW * 0.36;
        const rightPaneW = panelW * 0.64;
        const paneY = panelY + 100;
        const paneH = panelH - 190;

        // List properties
        this._characterRects = [];
        const itemH = 46;
        const listMargin = 25;
        const listW = leftPaneW - listMargin * 2;
        const listX = panelX + listMargin;

        // We use either hovered or selected for right pane
        const activeIdx = this.characterHoveredIndex !== -1 ? this.characterHoveredIndex : this.characterSelectedIndex;

        // --- LEFT PANE (Character List) ---
        for (let i = 0; i < CHARACTERS.length; i++) {
            const char = CHARACTERS[i];
            const iy = paneY + i * (itemH + 5);
            const isSelected = i === this.characterSelectedIndex;
            const isHovered = i === this.characterHoveredIndex;
            const isActive = i === activeIdx;
            const isCurrentChar = char.id === currentCharId;
            const isUnlocked = char.unlocked || (persistence && persistence.isCharacterUnlocked(char.id));

            this._characterRects.push({ x: listX, y: iy, w: listW, h: itemH });

            // Row background
            if (isActive) {
                const rowGrad = ctx.createLinearGradient(listX, iy, listX + listW, iy);
                rowGrad.addColorStop(0, 'rgba(255, 215, 0, 0.25)');
                rowGrad.addColorStop(1, 'rgba(255, 215, 0, 0.05)');
                ctx.fillStyle = rowGrad;
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 2;
            } else if (isHovered) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 1;
            } else {
                ctx.fillStyle = isUnlocked ? 'rgba(20, 15, 30, 0.6)' : 'rgba(10, 8, 15, 0.4)';
                ctx.strokeStyle = isUnlocked ? 'rgba(60, 45, 80, 0.5)' : 'rgba(30, 25, 40, 0.5)';
                ctx.lineWidth = 1;
            }
            this.roundRect(ctx, listX, iy, listW, itemH, 8);
            ctx.fill();
            ctx.stroke();

            // Equipped indicator (left border accent)
            if (isCurrentChar) {
                ctx.fillStyle = '#FFD700';
                ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
                ctx.shadowBlur = 10;
                this.roundRect(ctx, listX, iy, 6, itemH, {tl: 8, bl: 8, tr: 0, br: 0});
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            const iconX = listX + 28;
            const textX = listX + 54;
            const midY = iy + itemH / 2;

            if (!isUnlocked) {
                // Locked icon
                ctx.font = 'bold 16px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = 'rgba(120, 120, 140, 0.6)';
                ctx.fillText('\u{1F512}', iconX, midY + 1);

                // Locked Name
                ctx.textAlign = 'left';
                ctx.font = 'bold 16px Arial, sans-serif';
                ctx.fillStyle = 'rgba(100, 100, 120, 0.6)';
                ctx.fillText('???', textX, midY + 1);
            } else {
                // Character color circle with glow if active
                if (isActive) {
                    ctx.shadowColor = char.color;
                    ctx.shadowBlur = 8;
                }
                ctx.beginPath();
                ctx.arc(iconX, midY, 12, 0, Math.PI * 2);
                ctx.fillStyle = char.color;
                ctx.fill();
                ctx.shadowBlur = 0;
                
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                if (isCurrentChar) {
                    ctx.beginPath();
                    ctx.arc(iconX, midY, 4, 0, Math.PI * 2);
                    ctx.fillStyle = '#FFF';
                    ctx.fill();
                }

                // Name
                ctx.textAlign = 'left';
                ctx.font = 'bold 16px "Cinzel", "Times New Roman", serif';
                ctx.fillStyle = isActive ? '#FFD700' : '#EAEAEA';
                ctx.fillText(char.name, textX, midY + 1);
            }
        }

        // --- RIGHT PANE (Character Details) ---
        const rightX = panelX + leftPaneW;
        const detailsX = rightX + 40;
        const detailsW = rightPaneW - 80;
        const activeChar = CHARACTERS[activeIdx];
        const isUnlocked = activeChar.unlocked || (persistence && persistence.isCharacterUnlocked(activeChar.id));
        const isCurrentChar = activeChar.id === currentCharId;

        // Inner pane styling
        const rightPaneGrad = ctx.createLinearGradient(rightX, paneY, rightX, paneY + paneH);
        rightPaneGrad.addColorStop(0, 'rgba(25, 18, 35, 0.6)');
        rightPaneGrad.addColorStop(1, 'rgba(15, 10, 20, 0.8)');
        ctx.fillStyle = rightPaneGrad;
        ctx.strokeStyle = 'rgba(80, 60, 110, 0.4)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, rightX, paneY, rightPaneW - 25, paneH, 12);
        ctx.fill();
        ctx.stroke();

        this._characterEquipRect = { x: rightX, y: paneY, w: rightPaneW - 25, h: paneH };

        if (!isUnlocked) {
            // Locked View
            ctx.textAlign = 'center';
            ctx.font = 'bold 72px Arial, sans-serif';
            ctx.fillStyle = 'rgba(100, 100, 120, 0.3)';
            ctx.fillText('\u{1F512}', rightX + (rightPaneW - 25) / 2, paneY + paneH * 0.35);

            ctx.font = 'bold 26px "Cinzel", "Times New Roman", serif';
            ctx.fillStyle = 'rgba(140, 140, 160, 0.7)';
            ctx.fillText(t('characters.locked'), rightX + (rightPaneW - 25) / 2, paneY + paneH * 0.55);

            ctx.font = '15px Arial, sans-serif';
            ctx.fillStyle = 'rgba(215, 164, 92, 0.9)';
            this.wrapText(ctx, activeChar.unlockDesc || 'Defeat more enemies to unlock.', rightX + (rightPaneW - 25) / 2, paneY + paneH * 0.65, detailsW - 40, 22);

        } else {
            // Unlocked View
            
            // Large Portrait background aura
            const portraitX = detailsX + 50;
            const portraitY = paneY + 65;
            
            const auraGrad = ctx.createRadialGradient(portraitX, portraitY, 10, portraitX, portraitY, 60);
            auraGrad.addColorStop(0, activeChar.color);
            auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = auraGrad;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(portraitX, portraitY, 70, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;

            // Character Icon
            ctx.beginPath();
            ctx.arc(portraitX, portraitY, 45, 0, Math.PI * 2);
            ctx.fillStyle = activeChar.color;
            ctx.fill();
            
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Inner styling for portrait
            ctx.beginPath();
            ctx.arc(portraitX - 12, portraitY - 12, 18, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.fill();

            // Title and Name
            ctx.textAlign = 'left';
            ctx.font = 'bold 36px "Cinzel", "Times New Roman", serif';
            ctx.fillStyle = '#FFD700';
            ctx.shadowColor = 'rgba(255, 215, 0, 0.4)';
            ctx.shadowBlur = 8;
            ctx.fillText(activeChar.name, portraitX + 75, portraitY - 5);
            ctx.shadowBlur = 0;

            ctx.font = 'italic 18px Arial, sans-serif';
            ctx.fillStyle = activeChar.color;
            ctx.fillText(activeChar.title, portraitX + 78, portraitY + 22);

            // Separator line
            ctx.beginPath();
            ctx.moveTo(detailsX, portraitY + 65);
            ctx.lineTo(detailsX + detailsW, portraitY + 65);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Description
            ctx.font = '15px Arial, sans-serif';
            ctx.fillStyle = 'rgba(220, 220, 235, 0.95)';
            const descY = portraitY + 95;
            
            const words = activeChar.description.split(' ');
            let line = '';
            let lineY = descY;
            for (const word of words) {
                const test = line + (line ? ' ' : '') + word;
                if (ctx.measureText(test).width > detailsW && line) {
                    ctx.fillText(line, detailsX, lineY);
                    line = word;
                    lineY += 24;
                } else {
                    line = test;
                }
            }
            if (line) ctx.fillText(line, detailsX, lineY);

            // Flex layout for Stats and Weapon
            const flexY = lineY + 45;
            
            // Left column: Weapon
            ctx.font = 'bold 14px Arial, sans-serif';
            ctx.fillStyle = 'rgba(160, 150, 180, 0.9)';
            ctx.fillText(t('characters.startingWeapon'), detailsX, flexY);

            ctx.font = 'bold 18px Arial, sans-serif';
            ctx.fillStyle = '#87CEEB'; // Sky blue
            const weaponName = activeChar.startingWeapon.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            ctx.fillText(weaponName, detailsX, flexY + 25);

            // Right column: Stats
            const statsX = detailsX + detailsW * 0.45;
            ctx.font = 'bold 14px Arial, sans-serif';
            ctx.fillStyle = 'rgba(160, 150, 180, 0.9)';
            ctx.fillText(t('characters.passiveBonuses'), statsX, flexY);

            const modY = flexY + 25;
            ctx.font = '15px Arial, sans-serif';
            let modLine = 0;
            const entries = Object.entries(activeChar.statModifiers);
            
            if (entries.length === 0) {
                ctx.fillStyle = 'rgba(180, 180, 200, 0.6)';
                ctx.fillText(t('characters.none'), statsX, modY);
            } else {
                for (const [stat, val] of entries) {
                    const isPositive = val >= 1 || stat === 'projectiles';
                    const display = stat === 'projectiles'
                        ? `+${val} Projectile${val > 1 ? 's' : ''}`
                        : `${val > 1 ? '+' : ''}${Math.round((val - 1) * 100)}% ${stat.charAt(0).toUpperCase() + stat.slice(1)}`;
                    
                    ctx.fillStyle = isPositive ? '#4ade80' : '#FF6B6B';
                    // Two-column grid inside the stats section
                    const col = modLine % 2;
                    const row = Math.floor(modLine / 2);
                    ctx.fillText(display, statsX + col * (detailsW * 0.25), modY + row * 24);
                    modLine++;
                }
            }

            // Status Badge
            const badgeY = paneY + paneH - 35;
            if (isCurrentChar) {
                ctx.font = 'bold 18px Arial, sans-serif';
                ctx.fillStyle = '#FFD700';
                ctx.textAlign = 'right';
                ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
                ctx.shadowBlur = 10;
                ctx.fillText(t('characters.equipped'), rightX + rightPaneW - 45, badgeY);
                ctx.shadowBlur = 0;
                ctx.shadowColor = 'transparent';
            } else {
                ctx.font = '15px Arial, sans-serif';
                ctx.fillStyle = 'rgba(180, 180, 200, 0.8)';
                ctx.textAlign = 'right';
                
                // Add a subtle button look
                const btnW = 200;
                const btnH = 40;
                const btnX = rightX + rightPaneW - 45 - btnW;
                const btnY = badgeY - 25;
                
                ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
                ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
                ctx.lineWidth = 1;
                this.roundRect(ctx, btnX, btnY, btnW, btnH, 6);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#FFD700';
                ctx.fillText(t('characters.equip'), rightX + rightPaneW - 45 - 20, badgeY - 5);
            }
        }

        // Divider above back button
        ctx.beginPath();
        ctx.moveTo(panelX + 40, panelY + panelH - 80);
        ctx.lineTo(panelX + panelW - 40, panelY + panelH - 80);
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Back button
        const backW = 160;
        const backH = 44;
        const backX = (w - backW) / 2;
        const backY = panelY + panelH - 62;
        this._characterBackRect = { x: backX, y: backY, w: backW, h: backH };

        ctx.fillStyle = this.theme.backFill;
        ctx.strokeStyle = this.theme.backStroke;
        ctx.lineWidth = 1;
        this.roundRect(ctx, backX, backY, backW, backH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = 'bold 16px "Cinzel", "Times New Roman", serif';
        ctx.fillStyle = '#E0E0E0';
        ctx.fillText(t('characters.returnToMenu'), w / 2, backY + backH / 2 + 1);
    }

    /**
     * Simple word-wrap for centered text.
     */
    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let lineY = y;
        for (const word of words) {
            const test = line + (line ? ' ' : '') + word;
            if (ctx.measureText(test).width > maxWidth && line) {
                ctx.fillText(line, x, lineY);
                line = word;
                lineY += lineHeight;
            } else {
                line = test;
            }
        }
        if (line) ctx.fillText(line, x, lineY);
    }

    // ---- Input ----

    handleInput(key) {
        const k = key.toLowerCase();

        if (this.game.gameState === 'upgrades') {
            this.handleUpgradeInput(k);
            return;
        }

        if (this.game.gameState === 'challenges') {
            this.handleChallengeInput(k);
            return;
        }

        if (this.game.gameState === 'characters') {
            this.handleCharacterInput(k);
            return;
        }

        if (this.game.gameState === 'statistics') {
            if (k === 'escape') {
                this.triggerTransition('menu');
            }
            return;
        }

        if (this.game.gameState === 'codex') {
            this.handleCodexInput(k);
            return;
        }

        if (this.game.gameState === 'settings') {
            this.handleSettingsInput(k);
            return;
        }

        // Main menu
        if (k === 'arrowup') {
            this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
            this.playHoverSound();
        } else if (k === 'arrowdown') {
            this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
            this.playHoverSound();
        } else if (k === 'enter' || k === ' ') {
            this.selectMenuItem(this.selectedIndex);
        }
    }

    handleUpgradeInput(k) {
        const len = this.upgradeList.length;
        if (len === 0) return;

        if (k === 'arrowup') {
            this.upgradeSelectedIndex = (this.upgradeSelectedIndex - 1 + len) % len;
            this.playHoverSound();
        } else if (k === 'arrowdown') {
            this.upgradeSelectedIndex = (this.upgradeSelectedIndex + 1) % len;
            this.playHoverSound();
        } else if (k === 'enter' || k === ' ') {
            this.tryPurchaseUpgrade(this.upgradeSelectedIndex);
        } else if (k === 'escape') {
            this.triggerTransition('menu');
        }
    }

    handleCharacterInput(k) {
        if (k === 'arrowleft') {
            this.characterSelectedIndex = (this.characterSelectedIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
            this.playHoverSound();
        } else if (k === 'arrowright') {
            this.characterSelectedIndex = (this.characterSelectedIndex + 1) % CHARACTERS.length;
            this.playHoverSound();
        } else if (k === 'arrowup') {
            this.characterSelectedIndex = (this.characterSelectedIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
            this.playHoverSound();
        } else if (k === 'arrowdown') {
            this.characterSelectedIndex = (this.characterSelectedIndex + 1) % CHARACTERS.length;
            this.playHoverSound();
        } else if (k === 'enter' || k === ' ') {
            this.trySelectCharacter(this.characterSelectedIndex);
        } else if (k === 'escape') {
            this.triggerTransition('menu');
        }
    }

    handleClick(x, y) {
        if (this.game.gameState === 'upgrades') {
            this.handleUpgradeClick(x, y);
            return;
        }

        if (this.game.gameState === 'challenges') {
            this.handleChallengeClick(x, y);
            return;
        }

        if (this.game.gameState === 'characters') {
            this.handleCharacterClick(x, y);
            return;
        }

        if (this.game.gameState === 'statistics') {
            // Back button
            const b = this._statsBackRect;
            if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                this.triggerTransition('menu');
            }
            return;
        }

        if (this.game.gameState === 'codex') {
            this.handleCodexClick(x, y);
            return;
        }

        if (this.game.gameState === 'settings') {
            this.handleSettingsClick(x, y);
            return;
        }

        // Main menu
        for (let i = 0; i < this._menuRects.length; i++) {
            const r = this._menuRects[i];
            if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                this.selectedIndex = i;
                this.selectMenuItem(i);
                return;
            }
        }
    }

    handleUpgradeClick(x, y) {
        // Back button
        const b = this._backButtonRect;
        if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            this.triggerTransition('menu');
            return;
        }

        // Upgrade rows
        for (let i = 0; i < this._upgradeRects.length; i++) {
            const r = this._upgradeRects[i];
            if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                this.upgradeSelectedIndex = i;
                this.tryPurchaseUpgrade(i);
                return;
            }
        }
    }

    handleCharacterClick(x, y) {
        // Back button
        const b = this._characterBackRect;
        if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            this.triggerTransition('menu');
            return;
        }

        // Equip rect
        const e = this._characterEquipRect;
        if (e && x >= e.x && x <= e.x + e.w && y >= e.y && y <= e.y + e.h) {
            const activeIdx = this.characterHoveredIndex !== -1 ? this.characterHoveredIndex : this.characterSelectedIndex;
            this.trySelectCharacter(activeIdx);
            return;
        }

        // Character cards / list rows
        for (let i = 0; i < this._characterRects.length; i++) {
            const r = this._characterRects[i];
            if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                this.characterSelectedIndex = i;
                this.trySelectCharacter(i);
                return;
            }
        }
    }

    handleMouseMove(x, y) {
        if (this.game.gameState === 'statistics') {
            return; // No hover state needed for statistics
        }

        if (this.game.gameState === 'codex') {
            return; // Tab navigation only
        }

        if (this.game.gameState === 'settings') {
            return; // Settings uses own navigation
        }

        if (this.game.gameState === 'challenges') {
            this.challengeHoveredIndex = -1;
            for (let i = 0; i < this._challengeRects.length; i++) {
                const r = this._challengeRects[i];
                if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                    this.challengeHoveredIndex = i;
                    break;
                }
            }
            return;
        }

        if (this.game.gameState === 'characters') {
            this.characterHoveredIndex = -1;
            for (let i = 0; i < this._characterRects.length; i++) {
                const r = this._characterRects[i];
                if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                    this.characterHoveredIndex = i;
                    break;
                }
            }
            return;
        }

        if (this.game.gameState === 'upgrades') {
            this.upgradeHoveredIndex = -1;
            for (let i = 0; i < this._upgradeRects.length; i++) {
                const r = this._upgradeRects[i];
                if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                    this.upgradeHoveredIndex = i;
                    break;
                }
            }
            return;
        }

        // Main menu
        this.hoveredIndex = -1;
        for (let i = 0; i < this._menuRects.length; i++) {
            const r = this._menuRects[i];
            if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                this.hoveredIndex = i;
                break;
            }
        }
    }

    // ---- Actions ----

    triggerTransition(targetState) {
        if (this.transition.active) return;
        this.transition.targetState = targetState;
        this.transition.active = true;
        this.transition.phase = 'fadeOut';
        this.transition.alpha = 0;
    }

    selectMenuItem(index) {
        if (this.transition.active) return;
        const item = this.menuItems[index];
        this.playSelectSound();

        switch (item) {
            case 'PLAY':
                this.game.startGame();
                break;
            case 'ENDLESS':
                this.game.startGame();
                if (this.game.systems.runTimer) {
                    this.game.systems.runTimer.endlessMode = true;
                }
                break;
            case 'CHARACTERS':
                this.characterSelectedIndex = 0;
                this.characterHoveredIndex = -1;
                this.triggerTransition('characters');
                break;
            case 'UPGRADES':
                this.upgradeSelectedIndex = 0;
                this.upgradeList = this.game.systems.persistence ? this.game.systems.persistence.getUpgradeInfo() : [];
                this.triggerTransition('upgrades');
                break;
            case 'CHALLENGES':
                this.challengeSelectedIndex = 0;
                this.challengeHoveredIndex = -1;
                this.triggerTransition('challenges');
                break;
            case 'STATISTICS':
                this.triggerTransition('statistics');
                break;
            case 'CODEX':
                this.codexTabIndex = 0;
                this.triggerTransition('codex');
                break;
            case 'SETTINGS':
                this.settingsSelectedIndex = 0;
                this.triggerTransition('settings');
                break;
        }
    }

    tryPurchaseUpgrade(index) {
        const u = this.upgradeList[index];
        if (!u || u.cost === null || !u.canAfford) return;

        const persistence = this.game.systems.persistence;
        if (!persistence) return;

        const success = persistence.purchaseUpgrade(u.id);
        if (success) {
            this.upgradeList = persistence.getUpgradeInfo();
            this.playSelectSound();
            this.game.showToast(t('upgrades.upgraded', { name: u.name }), '#4ade80', 1200);
        }
    }

    trySelectCharacter(index) {
        const char = CHARACTERS[index];
        if (!char) return;

        const persistence = this.game.systems.persistence;
        if (!persistence) return;

        const isUnlocked = char.unlocked || persistence.isCharacterUnlocked(char.id);
        if (!isUnlocked) return;

        persistence.setSelectedCharacter(char.id);
        this.playSelectSound();
        this.game.showToast(t('common.selected', { name: char.name }), char.color, 1200);
    }

    // ---- Render: Statistics Dashboard ----

    renderStatistics(ctx) {
        const w = this.game.canvas.width;
        const h = this.game.canvas.height;

        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.80)';
        ctx.fillRect(0, 0, w, h);

        // Panel
        const panelW = Math.min(620, w - 60);
        const panelH = Math.min(520, h - 80);
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;

        ctx.fillStyle = this.theme.panelFill;
        ctx.strokeStyle = this.theme.panelStroke;
        ctx.lineWidth = 2;
        this.roundRect(ctx, panelX, panelY, panelW, panelH, 16);
        ctx.fill();
        ctx.stroke();

        // Header
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 28px "Cinzel", "Times New Roman", serif';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(t('stats.title'), w / 2, panelY + 36);

        const persistence = this.game.systems.persistence;
        if (!persistence) {
            ctx.font = '16px Arial, sans-serif';
            ctx.fillStyle = this.theme.accentMuted;
            ctx.fillText(t('stats.noData'), w / 2, h / 2);
            return;
        }

        const records = persistence.data.records;
        const colLeft = panelX + 40;
        const colRight = panelX + panelW / 2 + 20;
        const startY = panelY + 80;
        const lineH = 32;

        // Left column header
        ctx.textAlign = 'left';
        ctx.font = 'bold 15px Arial, sans-serif';
        ctx.fillStyle = this.theme.sectionLabel;
        ctx.fillText(t('stats.runTotals'), colLeft, startY);

        // Left column stats
        ctx.font = '14px Arial, sans-serif';
        const leftStats = [
            [t('stats.totalRuns'), records.totalRuns],
            [t('stats.totalPlaytime'), this.formatPlaytime(records.totalPlayTime || 0)],
            [t('stats.totalKills'), this.formatNumber(records.totalKills || 0)],
            [t('stats.totalGoldEarned'), this.formatNumber(records.totalGoldEarned || 0)],
            [t('stats.totalDamageDealt'), this.formatNumber(records.totalDamageDealt || 0)]
        ];

        for (let i = 0; i < leftStats.length; i++) {
            const y = startY + (i + 1) * lineH;
            ctx.fillStyle = 'rgba(180, 180, 200, 0.7)';
            ctx.fillText(leftStats[i][0], colLeft, y);
            ctx.fillStyle = '#E0E0F0';
            ctx.textAlign = 'right';
            ctx.fillText(String(leftStats[i][1]), colLeft + panelW / 2 - 60, y);
            ctx.textAlign = 'left';
        }

        // Right column header
        ctx.font = 'bold 15px Arial, sans-serif';
        ctx.fillStyle = this.theme.sectionLabel;
        ctx.fillText(t('stats.personalBests'), colRight, startY);

        // Right column stats
        ctx.font = '14px Arial, sans-serif';
        const rightStats = [
            [t('stats.bestSurvival'), this.formatTime(records.longestSurvival || 0)],
            [t('stats.mostKills'), this.formatNumber(records.highestKillCount || 0)],
            [t('stats.highestLevel'), records.maxLevel || 0],
            [t('stats.highestCombo'), records.highestCombo || 0],
            [t('stats.mostGold'), this.formatNumber(records.mostGoldSingleRun || 0)]
        ];

        for (let i = 0; i < rightStats.length; i++) {
            const y = startY + (i + 1) * lineH;
            ctx.fillStyle = 'rgba(180, 180, 200, 0.7)';
            ctx.fillText(rightStats[i][0], colRight, y);
            ctx.fillStyle = '#E0E0F0';
            ctx.textAlign = 'right';
            ctx.fillText(String(rightStats[i][1]), colRight + panelW / 2 - 60, y);
            ctx.textAlign = 'left';
        }

        // Favorite weapon section
        const weaponY = startY + 7 * lineH;
        ctx.font = 'bold 15px Arial, sans-serif';
        ctx.fillStyle = this.theme.sectionLabel;
        ctx.textAlign = 'center';
        ctx.fillText(t('stats.favoriteWeapon'), w / 2, weaponY);

        const usage = records.weaponUsage || {};
        let favWeapon = null;
        let favCount = 0;
        for (const [weapon, count] of Object.entries(usage)) {
            if (count > favCount) {
                favCount = count;
                favWeapon = weapon;
            }
        }

        ctx.font = '14px Arial, sans-serif';
        if (favWeapon) {
            const weaponName = favWeapon.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            ctx.fillStyle = '#FFD700';
            ctx.fillText(
                t('stats.pickedTimes', { count: favCount }),
                w / 2,
                weaponY + lineH
            );
        } else {
            ctx.fillStyle = 'rgba(160, 160, 180, 0.6)';
            ctx.fillText(t('stats.noWeapons'), w / 2, weaponY + lineH);
        }

        // Back button
        const backW = 120;
        const backH = 36;
        const backX = (w - backW) / 2;
        const backY = panelY + panelH - 50;
        this._statsBackRect = { x: backX, y: backY, w: backW, h: backH };

        ctx.fillStyle = this.theme.backFill;
        ctx.strokeStyle = this.theme.backStroke;
        ctx.lineWidth = 1;
        this.roundRect(ctx, backX, backY, backW, backH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = 'bold 14px Arial, sans-serif';
        ctx.fillStyle = this.theme.accentMuted;
        ctx.fillText(t('upgrades.back'), w / 2, backY + backH / 2);
    }

    // ---- Render: Challenge Modifiers ----

    renderChallenges(ctx) {
        const w = this.game.canvas.width;
        const h = this.game.canvas.height;
        const challenge = this.game.systems.challenge;
        if (!challenge) return;

        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, w, h);

        // Panel
        const panelW = Math.min(620, w - 60);
        const panelH = Math.min(560, h - 60);
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;

        ctx.fillStyle = this.theme.panelFill;
        ctx.strokeStyle = this.theme.panelStroke;
        ctx.lineWidth = 2;
        this.roundRect(ctx, panelX, panelY, panelW, panelH, 16);
        ctx.fill();
        ctx.stroke();

        // Header
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 26px "Cinzel", "Times New Roman", serif';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(t('challenges.title'), w / 2, panelY + 36);

        // Unlock check
        const unlocked = challenge.isUnlocked();
        if (!unlocked) {
            ctx.font = '16px Arial, sans-serif';
            ctx.fillStyle = 'rgba(200, 160, 120, 0.8)';
            ctx.fillText(t('challenges.locked'), w / 2, h / 2 - 10);
            ctx.font = '13px Arial, sans-serif';
            ctx.fillStyle = 'rgba(160, 140, 120, 0.6)';
            ctx.fillText(t('challenges.lockedHint'), w / 2, h / 2 + 20);
        } else {
            // Subheader
            ctx.font = '13px Arial, sans-serif';
            ctx.fillStyle = 'rgba(180, 180, 200, 0.6)';
            ctx.fillText(t('challenges.selectHint'), w / 2, panelY + 62);

            // Modifier list
            this._challengeRects = [];
            const listY = panelY + 85;
            const itemH = 60;
            const listX = panelX + 24;
            const listW = panelW - 48;

            for (let i = 0; i < challenge.modifiers.length; i++) {
                const mod = challenge.modifiers[i];
                const iy = listY + i * itemH;
                const isSelected = i === this.challengeSelectedIndex;
                const isHovered = i === this.challengeHoveredIndex;
                const isActive = challenge.pendingModifiers.has(mod.id);

                this._challengeRects.push({ x: listX, y: iy, w: listW, h: itemH - 4 });

                // Row background
                if (isActive) {
                    ctx.fillStyle = `rgba(${this.hexToRgb(mod.color)}, 0.15)`;
                    ctx.strokeStyle = mod.color;
                    ctx.lineWidth = 2;
                } else if (isSelected || isHovered) {
                    ctx.fillStyle = this.theme.accentFill;
                    ctx.strokeStyle = this.theme.accentStroke;
                    ctx.lineWidth = 1;
                } else {
                    ctx.fillStyle = 'rgba(30, 22, 40, 0.6)';
                    ctx.strokeStyle = 'rgba(80, 60, 50, 0.4)';
                    ctx.lineWidth = 1;
                }
                this.roundRect(ctx, listX, iy, listW, itemH - 4, 8);
                ctx.fill();
                ctx.stroke();

                // Active checkmark
                ctx.font = 'bold 20px Arial, sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = isActive ? '#4ade80' : 'rgba(80, 80, 100, 0.5)';
                ctx.fillText(isActive ? '✓' : '○', listX + 12, iy + (itemH - 4) / 2);

                // Icon
                ctx.font = '22px Arial, sans-serif';
                ctx.fillText(mod.icon, listX + 40, iy + (itemH - 4) / 2);

                // Name
                ctx.font = 'bold 15px Arial, sans-serif';
                ctx.fillStyle = isActive ? mod.color : (isSelected || isHovered ? '#FFD700' : '#E0E0F0');
                ctx.fillText(mod.name, listX + 70, iy + 18);

                // Description
                ctx.font = '12px Arial, sans-serif';
                ctx.fillStyle = 'rgba(180, 180, 200, 0.7)';
                ctx.fillText(mod.description, listX + 70, iy + 38);

                // Gold bonus
                ctx.textAlign = 'right';
                ctx.font = 'bold 14px Arial, sans-serif';
                ctx.fillStyle = '#FFD700';
                ctx.fillText(t('challenges.gold', { pct: Math.round(mod.goldBonus * 100) }), listX + listW - 12, iy + (itemH - 4) / 2);
                ctx.textAlign = 'left';
            }

            // Total gold multiplier
            const totalY = listY + challenge.modifiers.length * itemH + 10;
            const mult = challenge.getGoldMultiplier();
            const pending = challenge.pendingModifiers;
            // Recalculate based on pending (not active)
            let pendingBonus = 0;
            for (const id of pending) {
                const mod = challenge.modifiers.find(m => m.id === id);
                if (mod) pendingBonus += mod.goldBonus;
            }
            const pendingMult = 1 + pendingBonus;

            ctx.textAlign = 'center';
            ctx.font = 'bold 18px "Cinzel", "Times New Roman", serif';
            if (pending.size > 0) {
                ctx.fillStyle = '#FFD700';
                ctx.shadowColor = 'rgba(255, 215, 0, 0.4)';
                ctx.shadowBlur = 10;
                ctx.fillText(t('challenges.goldMultiplier', { mult: pendingMult.toFixed(1) }), w / 2, totalY);
                ctx.shadowBlur = 0;
                ctx.shadowColor = 'transparent';
            } else {
                ctx.fillStyle = 'rgba(180, 180, 200, 0.5)';
                ctx.fillText(t('challenges.noModifiers'), w / 2, totalY);
            }

            // Active count
            ctx.font = '12px Arial, sans-serif';
            ctx.fillStyle = 'rgba(180, 180, 200, 0.5)';
            ctx.fillText(t('challenges.selected', { count: pending.size, max: challenge.maxActive }), w / 2, totalY + 22);
        }

        // Back button
        const backW = 120;
        const backH = 36;
        const backX = (w - backW) / 2;
        const backY = panelY + panelH - 50;
        this._challengeBackRect = { x: backX, y: backY, w: backW, h: backH };

        ctx.fillStyle = this.theme.backFill;
        ctx.strokeStyle = this.theme.backStroke;
        ctx.lineWidth = 1;
        this.roundRect(ctx, backX, backY, backW, backH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = 'bold 14px Arial, sans-serif';
        ctx.fillStyle = this.theme.accentMuted;
        ctx.fillText(t('upgrades.back'), w / 2, backY + backH / 2);
    }

    // ---- Render: Codex / Bestiary ----

    renderCodex(ctx) {
        const w = this.game.canvas.width;
        const h = this.game.canvas.height;
        const codex = this.game.systems.codex;

        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
        ctx.fillRect(0, 0, w, h);

        // Panel
        const panelW = Math.min(700, w - 40);
        const panelH = Math.min(580, h - 40);
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;

        const bgGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
        bgGrad.addColorStop(0, '#1c1528');
        bgGrad.addColorStop(1, '#0e0b14');
        ctx.fillStyle = bgGrad;
        ctx.strokeStyle = '#3a2845';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 30;
        this.roundRect(ctx, panelX, panelY, panelW, panelH, 16);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.stroke();

        // Header
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 30px "Cinzel", "Times New Roman", serif';
        ctx.fillStyle = '#FFD700';
        ctx.shadowColor = 'rgba(255, 215, 0, 0.3)';
        ctx.shadowBlur = 15;
        ctx.fillText(t('codex.title'), w / 2, panelY + 40);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Category tabs
        const tabs = [
            { key: 'enemies', label: t('codex.enemies'), icon: '\u{1F480}' },
            { key: 'weapons', label: t('codex.weapons'), icon: '\u{2694}' },
            { key: 'evolutions', label: t('codex.evolutions'), icon: '\u{2B50}' },
            { key: 'synergies', label: t('codex.synergies'), icon: '\u{1F517}' }
        ];
        const tabW = (panelW - 60) / tabs.length;
        const tabY = panelY + 70;
        const tabH = 36;
        this._codexTabRects = [];

        for (let i = 0; i < tabs.length; i++) {
            const tx = panelX + 30 + i * tabW;
            const isActive = i === this.codexTabIndex;
            this._codexTabRects.push({ x: tx, y: tabY, w: tabW - 4, h: tabH });

            if (isActive) {
                ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 2;
            } else {
                ctx.fillStyle = 'rgba(30, 22, 40, 0.6)';
                ctx.strokeStyle = 'rgba(80, 60, 100, 0.4)';
                ctx.lineWidth = 1;
            }
            this.roundRect(ctx, tx, tabY, tabW - 4, tabH, 6);
            ctx.fill();
            ctx.stroke();

            ctx.textAlign = 'center';
            ctx.font = 'bold 14px Arial, sans-serif';
            ctx.fillStyle = isActive ? '#FFD700' : this.theme.accentMuted;
            ctx.fillText(`${tabs[i].icon} ${tabs[i].label}`, tx + (tabW - 4) / 2, tabY + tabH / 2);
        }

        // Completion bar for active tab
        const activeTab = tabs[this.codexTabIndex];
        const stats = codex ? codex.getCompletionStats() : null;
        const catStats = stats ? stats[activeTab.key] : { discovered: 0, total: 1, percent: 0 };

        const barY = tabY + tabH + 16;
        const barW = panelW - 60;
        const barX = panelX + 30;
        const barH = 14;

        ctx.fillStyle = 'rgba(40, 30, 55, 0.8)';
        this.roundRect(ctx, barX, barY, barW, barH, 4);
        ctx.fill();

        const fillW = Math.max(0, (catStats.discovered / catStats.total) * barW);
        if (fillW > 0) {
            const barGrad = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
            barGrad.addColorStop(0, '#FFD700');
            barGrad.addColorStop(1, '#D4A017');
            ctx.fillStyle = barGrad;
            this.roundRect(ctx, barX, barY, fillW, barH, 4);
            ctx.fill();
        }

        ctx.textAlign = 'center';
        ctx.font = 'bold 11px Arial, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`${catStats.discovered} / ${catStats.total}  (${catStats.percent}%)`, barX + barW / 2, barY + barH / 2 + 1);

        // Discovery grid
        const gridY = barY + barH + 20;
        const gridX = panelX + 30;
        const gridW = panelW - 60;
        const cardW = 130;
        const cardH = 60;
        const gap = 10;
        const cols = Math.max(1, Math.floor((gridW + gap) / (cardW + gap)));

        const discoveries = codex ? codex.getDiscoveries(activeTab.key) : [];
        const totalSlots = catStats.total;

        // Build display list: discovered items + undiscovered placeholders
        const displayList = [];
        for (const entry of discoveries) {
            displayList.push({ id: entry.id, count: entry.count, discovered: true });
        }
        for (let i = displayList.length; i < totalSlots; i++) {
            displayList.push({ id: '???', count: 0, discovered: false });
        }

        for (let i = 0; i < displayList.length; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const cx = gridX + col * (cardW + gap);
            const cy = gridY + row * (cardH + gap);

            if (cy + cardH > panelY + panelH - 70) break;

            const item = displayList[i];

            if (item.discovered) {
                ctx.fillStyle = 'rgba(40, 30, 55, 0.7)';
                ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
                ctx.lineWidth = 1;
            } else {
                ctx.fillStyle = 'rgba(20, 15, 30, 0.5)';
                ctx.strokeStyle = 'rgba(60, 45, 80, 0.3)';
                ctx.lineWidth = 1;
            }
            this.roundRect(ctx, cx, cy, cardW, cardH, 6);
            ctx.fill();
            ctx.stroke();

            ctx.textAlign = 'left';
            if (item.discovered) {
                const displayName = item.id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                ctx.font = 'bold 12px Arial, sans-serif';
                ctx.fillStyle = '#E0E0F0';
                ctx.fillText(displayName, cx + 8, cy + 22);

                ctx.font = '11px Arial, sans-serif';
                ctx.fillStyle = 'rgba(180, 180, 200, 0.6)';
                ctx.fillText(t('codex.seen', { count: item.count }), cx + 8, cy + 42);
            } else {
                ctx.font = 'bold 20px Arial, sans-serif';
                ctx.fillStyle = 'rgba(80, 70, 100, 0.5)';
                ctx.textAlign = 'center';
                ctx.fillText('?', cx + cardW / 2, cy + cardH / 2 + 6);
            }
        }

        // Overall completion at bottom
        if (stats) {
            let totalDisc = 0;
            let totalAll = 0;
            for (const cat of Object.values(stats)) {
                totalDisc += cat.discovered;
                totalAll += cat.total;
            }
            const overallPct = totalAll > 0 ? Math.round((totalDisc / totalAll) * 100) : 0;
            ctx.textAlign = 'center';
            ctx.font = '12px Arial, sans-serif';
            ctx.fillStyle = 'rgba(180, 180, 200, 0.5)';
            ctx.fillText(t('codex.overallCompletion', { discovered: totalDisc, total: totalAll, pct: overallPct }), w / 2, panelY + panelH - 72);
        }

        // Back button
        const backW = 140;
        const backH = 38;
        const backX = (w - backW) / 2;
        const backY = panelY + panelH - 52;
        this._codexBackRect = { x: backX, y: backY, w: backW, h: backH };

        ctx.fillStyle = this.theme.backFill;
        ctx.strokeStyle = this.theme.backStroke;
        ctx.lineWidth = 1;
        this.roundRect(ctx, backX, backY, backW, backH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = 'bold 14px "Cinzel", "Times New Roman", serif';
        ctx.fillStyle = '#E0E0E0';
        ctx.fillText(t('characters.returnToMenu'), w / 2, backY + backH / 2 + 1);
    }

    handleCodexInput(k) {
        const tabs = ['enemies', 'weapons', 'evolutions', 'synergies'];
        if (k === 'arrowleft') {
            this.codexTabIndex = (this.codexTabIndex - 1 + tabs.length) % tabs.length;
            this.playHoverSound();
        } else if (k === 'arrowright') {
            this.codexTabIndex = (this.codexTabIndex + 1) % tabs.length;
            this.playHoverSound();
        } else if (k === 'escape') {
            this.triggerTransition('menu');
        }
    }

    handleCodexClick(x, y) {
        // Back button
        const b = this._codexBackRect;
        if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            this.triggerTransition('menu');
            return;
        }

        // Tab clicks
        if (this._codexTabRects) {
            for (let i = 0; i < this._codexTabRects.length; i++) {
                const r = this._codexTabRects[i];
                if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                    this.codexTabIndex = i;
                    this.playSelectSound();
                    return;
                }
            }
        }
    }

    // ---- Render: Settings ----

    renderSettings(ctx) {
        const w = this.game.canvas.width;
        const h = this.game.canvas.height;
        const sm = this.game.settingsMenu;
        const settings = sm ? sm.settings : {};

        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
        ctx.fillRect(0, 0, w, h);

        // Panel
        const panelW = Math.min(520, w - 40);
        const panelH = Math.min(560, h - 40);
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;

        const bgGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
        bgGrad.addColorStop(0, '#1c1528');
        bgGrad.addColorStop(1, '#0e0b14');
        ctx.fillStyle = bgGrad;
        ctx.strokeStyle = '#3a2845';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 30;
        this.roundRect(ctx, panelX, panelY, panelW, panelH, 16);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.stroke();

        // Header
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 28px "Cinzel", "Times New Roman", serif';
        ctx.fillStyle = '#FFD700';
        ctx.shadowColor = 'rgba(255, 215, 0, 0.3)';
        ctx.shadowBlur = 15;
        ctx.fillText(t('settings.title'), w / 2, panelY + 38);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Settings items definition
        const items = [
            { key: 'masterVolume', label: t('settings.masterVolume'), type: 'slider', icon: '\u{1F50A}' },
            { key: 'musicVolume', label: t('settings.musicVolume'), type: 'slider', icon: '\u{1F3B5}' },
            { key: 'sfxVolume', label: t('settings.sfxVolume'), type: 'slider', icon: '\u{1F3B6}' },
            { key: 'particleEffects', label: t('settings.particleEffects'), type: 'toggle', icon: '\u{2728}' },
            { key: 'screenShake', label: t('settings.screenShake'), type: 'toggle', icon: '\u{1F4F3}' },
            { key: 'damageNumbers', label: t('settings.damageNumbers'), type: 'toggle', icon: '\u{1F4A5}' },
            { key: 'lowFXMode', label: t('settings.lowFXMode'), type: 'toggle', icon: '\u{26A1}' },
            { key: 'autoQuality', label: t('settings.autoQuality'), type: 'toggle', icon: '\u{2699}' },
            { key: 'showFPS', label: t('settings.showFPS'), type: 'toggle', icon: '\u{1F4CA}' },
            { key: 'pauseOnFocusLoss', label: t('settings.pauseOnFocusLoss'), type: 'toggle', icon: '\u{23F8}' }
        ];

        const itemH = 36;
        const itemGap = 4;
        const startY = panelY + 70;
        const contentX = panelX + 30;
        const contentW = panelW - 60;
        this._settingsItemRects = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const iy = startY + i * (itemH + itemGap);
            const isSelected = i === this.settingsSelectedIndex;

            this._settingsItemRects.push({ x: contentX, y: iy, w: contentW, h: itemH, item });

            // Row background
            if (isSelected) {
                ctx.fillStyle = 'rgba(255, 215, 0, 0.08)';
                ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
                ctx.lineWidth = 1;
            } else {
                ctx.fillStyle = 'rgba(30, 22, 40, 0.4)';
                ctx.strokeStyle = 'rgba(60, 45, 80, 0.2)';
                ctx.lineWidth = 1;
            }
            this.roundRect(ctx, contentX, iy, contentW, itemH, 6);
            ctx.fill();
            ctx.stroke();

            // Icon + label
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = '14px Arial, sans-serif';
            ctx.fillStyle = isSelected ? '#FFD700' : '#C0C0D0';
            ctx.fillText(`${item.icon}  ${item.label}`, contentX + 12, iy + itemH / 2);

            const val = settings[item.key];

            if (item.type === 'slider') {
                // Slider track
                const sliderX = contentX + contentW - 170;
                const sliderW = 120;
                const sliderY = iy + itemH / 2;
                const sliderH = 6;

                ctx.fillStyle = 'rgba(40, 30, 55, 0.8)';
                this.roundRect(ctx, sliderX, sliderY - sliderH / 2, sliderW, sliderH, 3);
                ctx.fill();

                // Slider fill
                const fillW = Math.max(0, (val || 0) * sliderW);
                if (fillW > 0) {
                    const sGrad = ctx.createLinearGradient(sliderX, 0, sliderX + fillW, 0);
                    sGrad.addColorStop(0, '#FFD700');
                    sGrad.addColorStop(1, '#D4A017');
                    ctx.fillStyle = sGrad;
                    this.roundRect(ctx, sliderX, sliderY - sliderH / 2, fillW, sliderH, 3);
                    ctx.fill();
                }

                // Value text
                ctx.textAlign = 'right';
                ctx.font = 'bold 12px "Courier New", monospace';
                ctx.fillStyle = isSelected ? '#FFD700' : '#A0A0B0';
                ctx.fillText(`${Math.round((val || 0) * 100)}%`, contentX + contentW - 12, iy + itemH / 2);

            } else if (item.type === 'toggle') {
                // Toggle pill
                const pillW = 36;
                const pillH = 18;
                const pillX = contentX + contentW - pillW - 12;
                const pillY = iy + (itemH - pillH) / 2;
                const isOn = !!val;

                ctx.fillStyle = isOn ? 'rgba(68, 204, 136, 0.3)' : 'rgba(80, 60, 100, 0.3)';
                ctx.strokeStyle = isOn ? '#44CC88' : 'rgba(100, 80, 130, 0.5)';
                ctx.lineWidth = 1;
                this.roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
                ctx.fill();
                ctx.stroke();

                // Toggle knob
                const knobR = 6;
                const knobX = isOn ? pillX + pillW - knobR - 3 : pillX + knobR + 3;
                ctx.fillStyle = isOn ? '#44CC88' : '#666';
                ctx.beginPath();
                ctx.arc(knobX, pillY + pillH / 2, knobR, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Reset defaults button
        const resetW = 160;
        const resetH = 32;
        const resetX = w / 2 - resetW - 10;
        const resetY = panelY + panelH - 90;
        this._settingsResetRect = { x: resetX, y: resetY, w: resetW, h: resetH };

        ctx.fillStyle = 'rgba(139, 69, 19, 0.3)';
        ctx.strokeStyle = 'rgba(139, 69, 19, 0.6)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, resetX, resetY, resetW, resetH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = 'bold 12px Arial, sans-serif';
        ctx.fillStyle = '#DAA520';
        ctx.fillText(t('settings.resetDefaults'), resetX + resetW / 2, resetY + resetH / 2 + 1);

        // Back button
        const backW = 140;
        const backH = 32;
        const backX = w / 2 + 10;
        const backY = panelY + panelH - 90;
        this._settingsBackRect = { x: backX, y: backY, w: backW, h: backH };

        ctx.fillStyle = this.theme.backFill;
        ctx.strokeStyle = this.theme.backStroke;
        ctx.lineWidth = 1;
        this.roundRect(ctx, backX, backY, backW, backH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = 'bold 12px Arial, sans-serif';
        ctx.fillStyle = '#E0E0E0';
        ctx.fillText(t('settings.back'), backX + backW / 2, backY + backH / 2 + 1);
    }

    handleSettingsInput(k) {
        const sm = this.game.settingsMenu;
        if (!sm) return;

        const items = this._settingsItemRects;
        const len = items.length;

        if (k === 'arrowup') {
            this.settingsSelectedIndex = (this.settingsSelectedIndex - 1 + len) % len;
            this.playHoverSound();
        } else if (k === 'arrowdown') {
            this.settingsSelectedIndex = (this.settingsSelectedIndex + 1) % len;
            this.playHoverSound();
        } else if (k === 'escape') {
            this.triggerTransition('menu');
        } else {
            const rect = items[this.settingsSelectedIndex];
            if (!rect) return;
            const item = rect.item;

            if (item.type === 'toggle' && (k === 'enter' || k === ' ')) {
                sm.settings[item.key] = !sm.settings[item.key];
                sm.saveSettings();
                sm.apply();
                this.playSelectSound();
            } else if (item.type === 'slider') {
                const step = 0.1;
                if (k === 'arrowleft') {
                    sm.settings[item.key] = Math.max(0, (sm.settings[item.key] || 0) - step);
                    sm.saveSettings();
                    sm.apply();
                    this.playHoverSound();
                } else if (k === 'arrowright') {
                    sm.settings[item.key] = Math.min(1, (sm.settings[item.key] || 0) + step);
                    sm.saveSettings();
                    sm.apply();
                    this.playHoverSound();
                }
            }
        }
    }

    handleSettingsClick(x, y) {
        const sm = this.game.settingsMenu;

        // Back button
        const b = this._settingsBackRect;
        if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            this.triggerTransition('menu');
            return;
        }

        // Reset defaults
        const r = this._settingsResetRect;
        if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
            if (sm) {
                sm.resetToDefaults();
                this.playSelectSound();
            }
            return;
        }

        // Settings items
        if (!sm) return;
        for (let i = 0; i < this._settingsItemRects.length; i++) {
            const rect = this._settingsItemRects[i];
            if (!rect) continue;
            if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
                this.settingsSelectedIndex = i;
                const item = rect.item;

                if (item.type === 'toggle') {
                    sm.settings[item.key] = !sm.settings[item.key];
                    sm.saveSettings();
                    sm.apply();
                    this.playSelectSound();
                } else if (item.type === 'slider') {
                    // Click position on slider maps to value
                    const sliderX = rect.x + rect.w - 170;
                    const sliderW = 120;
                    if (x >= sliderX && x <= sliderX + sliderW) {
                        const val = Math.max(0, Math.min(1, (x - sliderX) / sliderW));
                        sm.settings[item.key] = Math.round(val * 10) / 10;
                        sm.saveSettings();
                        sm.apply();
                    }
                }
                return;
            }
        }
    }

    // ---- Pause Menu (in-game overlay) ----

    renderPauseMenu(ctx) {
        const w = this.game.canvas.width;
        const h = this.game.canvas.height;

        // Dim overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(0, 0, w, h);

        // Panel — compact centered card
        const panelW = Math.min(380, w - 60);
        const panelH = 320;
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;

        const bgGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
        bgGrad.addColorStop(0, 'rgba(22, 14, 36, 0.97)');
        bgGrad.addColorStop(1, 'rgba(12, 8, 20, 0.97)');
        ctx.fillStyle = bgGrad;
        ctx.strokeStyle = 'rgba(214, 138, 68, 0.6)';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 30;
        this.roundRect(ctx, panelX, panelY, panelW, panelH, 16);
        ctx.fill();
        ctx.shadowBlur = 0;
        this.roundRect(ctx, panelX, panelY, panelW, panelH, 16);
        ctx.stroke();

        // Header
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 34px "Cinzel", "Times New Roman", serif';
        ctx.fillStyle = '#FFD700';
        ctx.shadowColor = 'rgba(255, 215, 0, 0.35)';
        ctx.shadowBlur = 18;
        ctx.fillText(t('pause.title'), w / 2, panelY + 50);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Divider
        ctx.beginPath();
        ctx.moveTo(panelX + 40, panelY + 80);
        ctx.lineTo(panelX + panelW - 40, panelY + 80);
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Run info (compact)
        const runTimer = this.game.systems.runTimer;
        const elapsed = runTimer ? runTimer.elapsed : this.game.gameTime || 0;
        const wave = this.game.systems.enemy?.getCurrentWave?.() || 1;
        const level = this.game.player?.level || 1;
        ctx.font = '13px Arial, sans-serif';
        ctx.fillStyle = 'rgba(180, 180, 200, 0.55)';
        ctx.fillText(`Lv ${level}  ·  Wave ${wave}  ·  ${this.formatTime(elapsed)}`, w / 2, panelY + 100);

        // Menu items
        const pauseItems = [t('pause.resume'), t('pause.settings'), t('pause.returnToMenu')];
        const itemH = 48;
        const itemGap = 8;
        const itemsStartY = panelY + 128;
        const itemW = panelW - 60;
        this._pauseMenuRects = [];

        for (let i = 0; i < pauseItems.length; i++) {
            const iy = itemsStartY + i * (itemH + itemGap);
            const ix = (w - itemW) / 2;
            const isSelected = i === this.pauseSelectedIndex;
            const isHovered = i === this.pauseHoveredIndex;
            const active = isSelected || isHovered;

            this._pauseMenuRects.push({ x: ix, y: iy, w: itemW, h: itemH });

            // Button bg
            if (active) {
                ctx.fillStyle = this.theme.accentFill;
                ctx.strokeStyle = this.theme.accentStroke;
                ctx.lineWidth = 2;
            } else {
                ctx.fillStyle = 'rgba(30, 22, 40, 0.5)';
                ctx.strokeStyle = 'rgba(80, 60, 100, 0.3)';
                ctx.lineWidth = 1;
            }
            this.roundRect(ctx, ix, iy, itemW, itemH, 10);
            ctx.fill();
            this.roundRect(ctx, ix, iy, itemW, itemH, 10);
            ctx.stroke();

            // Arrow indicator
            if (active) {
                const arrowBounce = Math.sin(this.time * 4) * 3;
                ctx.font = 'bold 18px serif';
                ctx.fillStyle = '#FFD700';
                ctx.textAlign = 'right';
                ctx.fillText('>', ix + 20 + arrowBounce, iy + itemH / 2);
            }

            // Label
            if (active) {
                ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
                ctx.shadowBlur = 12;
            }
            ctx.font = `bold ${active ? 22 : 20}px "Cinzel", "Times New Roman", serif`;
            ctx.fillStyle = active ? '#FFD700' : this.theme.accentMuted;
            ctx.textAlign = 'center';
            ctx.fillText(pauseItems[i], w / 2, iy + itemH / 2);
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        }

        // Controls hint
        ctx.font = '12px Arial, sans-serif';
        ctx.fillStyle = 'rgba(180, 180, 200, 0.35)';
        ctx.textAlign = 'center';
        ctx.fillText(t('pause.escToResume'), w / 2, panelY + panelH - 18);
    }

    handlePauseInput(k) {
        const items = [t('pause.resume'), t('pause.settings'), t('pause.returnToMenu')];
        const len = items.length;

        if (k === 'arrowup') {
            this.pauseSelectedIndex = (this.pauseSelectedIndex - 1 + len) % len;
            this.playHoverSound();
        } else if (k === 'arrowdown') {
            this.pauseSelectedIndex = (this.pauseSelectedIndex + 1) % len;
            this.playHoverSound();
        } else if (k === 'enter' || k === ' ') {
            this.selectPauseItem(this.pauseSelectedIndex);
        } else if (k === 'escape') {
            this.game.resumeGame();
        }
    }

    handlePauseClick(x, y) {
        for (let i = 0; i < this._pauseMenuRects.length; i++) {
            const r = this._pauseMenuRects[i];
            if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                this.pauseSelectedIndex = i;
                this.selectPauseItem(i);
                return;
            }
        }
    }

    handlePauseMouseMove(x, y) {
        this.pauseHoveredIndex = -1;
        for (let i = 0; i < this._pauseMenuRects.length; i++) {
            const r = this._pauseMenuRects[i];
            if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                this.pauseHoveredIndex = i;
                break;
            }
        }
    }

    selectPauseItem(index) {
        this.playSelectSound();
        switch (index) {
            case 0: // RESUME
                this.game.resumeGame();
                break;
            case 1: // SETTINGS
                this.game.settingsMenu.toggle();
                break;
            case 2: // RETURN TO MENU
                this.game.returnToMenu();
                break;
        }
    }

    handleChallengeInput(k) {
        const challenge = this.game.systems.challenge;
        if (!challenge) return;

        const len = challenge.modifiers.length;
        if (k === 'arrowup') {
            this.challengeSelectedIndex = (this.challengeSelectedIndex - 1 + len) % len;
            this.playHoverSound();
        } else if (k === 'arrowdown') {
            this.challengeSelectedIndex = (this.challengeSelectedIndex + 1) % len;
            this.playHoverSound();
        } else if (k === 'enter' || k === ' ') {
            if (challenge.isUnlocked()) {
                const mod = challenge.modifiers[this.challengeSelectedIndex];
                if (mod) {
                    challenge.togglePending(mod.id);
                    this.playSelectSound();
                }
            }
        } else if (k === 'escape') {
            this.triggerTransition('menu');
        }
    }

    handleChallengeClick(x, y) {
        const challenge = this.game.systems.challenge;
        if (!challenge) return;

        // Back button
        const b = this._challengeBackRect;
        if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            this.triggerTransition('menu');
            return;
        }

        // Modifier rows
        if (challenge.isUnlocked()) {
            for (let i = 0; i < this._challengeRects.length; i++) {
                const r = this._challengeRects[i];
                if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                    this.challengeSelectedIndex = i;
                    const mod = challenge.modifiers[i];
                    if (mod) {
                        challenge.togglePending(mod.id);
                        this.playSelectSound();
                    }
                    return;
                }
            }
        }
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
    }

    formatPlaytime(seconds) {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hrs > 0) return `${hrs}h ${mins}m`;
        return `${mins}m`;
    }

    formatNumber(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return String(n);
    }

    // ---- Audio helpers ----

    playHoverSound() {
        if (this.game.audioManager && this.game.audioManager.playVampireSound) {
            this.game.audioManager.playVampireSound('menuHover', 0.3);
        }
    }

    playSelectSound() {
        if (this.game.audioManager && this.game.audioManager.playVampireSound) {
            this.game.audioManager.playVampireSound('menuSelect', 0.5);
        }
    }

    // ---- Helpers ----

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
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
        this.selectedIndex = 0;
        this.hoveredIndex = -1;
        this.upgradeSelectedIndex = 0;
        this.upgradeHoveredIndex = -1;
        this.upgradeList = [];
        this.characterSelectedIndex = 0;
        this.characterHoveredIndex = -1;
        this.challengeSelectedIndex = 0;
        this.challengeHoveredIndex = -1;
        this.codexTabIndex = 0;
        this.settingsSelectedIndex = 0;
        this.pauseSelectedIndex = 0;
        this.pauseHoveredIndex = -1;
    }
}
