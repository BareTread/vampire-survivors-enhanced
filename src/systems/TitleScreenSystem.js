import { CHARACTERS } from '../data/characters.js';

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
        this.menuItems = ['PLAY', 'CHARACTERS', 'UPGRADES', 'CHALLENGES', 'STATISTICS', 'SETTINGS'];
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
            accentFill: 'rgba(154, 78, 36, 0.22)',
            accentStroke: 'rgba(214, 138, 68, 0.72)',
            accentMuted: '#CBB48A',
            panelFill: 'rgba(18, 12, 24, 0.95)',
            panelStroke: 'rgba(196, 118, 54, 0.58)',
            backFill: 'rgba(68, 34, 24, 0.72)',
            backStroke: 'rgba(214, 150, 90, 0.55)',
            sectionLabel: '#D9A45C'
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

        // 3. Title
        const titleY = h * 0.22;
        this.renderTitle(ctx, w, titleY);

        // 4. Menu items
        this._menuRects = [];
        const menuStartY = h * 0.48;
        const menuSpacing = 64;

        for (let i = 0; i < this.menuItems.length; i++) {
            const y = menuStartY + i * menuSpacing;
            const isSelected = i === this.selectedIndex;
            const isHovered = i === this.hoveredIndex;
            const label = this.menuItems[i];

            // Gold balance next to UPGRADES
            let displayLabel = label;
            if (label === 'UPGRADES') {
                const gold = this.game.systems.persistence ? this.game.systems.persistence.getGold() : 0;
                displayLabel = `UPGRADES  [${gold} Gold]`;
            }

            const fontSize = isSelected || isHovered ? 30 : 26;
            ctx.font = `bold ${fontSize}px 'Cinzel', 'Times New Roman', serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const textWidth = ctx.measureText(displayLabel).width;
            const rectW = textWidth + 60;
            const rectH = 50;
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
        const arrowX = w / 2 - (this._menuRects[this.selectedIndex]?.w / 2 || 100) - 20;
        const bounce = Math.sin(this.time * 4) * 4;
        ctx.font = 'bold 22px serif';
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'right';
        ctx.fillText('>', arrowX + bounce, selY);

        // 6. Personal records at bottom
        this.renderRecords(ctx, w, h);

        // 7. Controls hint
        ctx.font = '14px Arial, sans-serif';
        ctx.fillStyle = 'rgba(200, 200, 220, 0.5)';
        ctx.textAlign = 'center';
        ctx.fillText('Arrow Keys / Mouse to navigate  |  Enter / Click to select', w / 2, h - 20);

        // 8. Upgrade shop overlay
        if (this.game.gameState === 'upgrades') {
            this.renderUpgrades(ctx);
        }

        // 9. Character select overlay
        if (this.game.gameState === 'characters') {
            this.renderCharacters(ctx);
        }

        // 10. Statistics overlay
        if (this.game.gameState === 'statistics') {
            this.renderStatistics(ctx);
        }

        // 11. Challenges overlay
        if (this.game.gameState === 'challenges') {
            this.renderChallenges(ctx);
        }
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
        ctx.fillText('ENHANCED', w / 2, y + 42);

        ctx.restore();
    }

    renderRecords(ctx, w, h) {
        const persistence = this.game.systems.persistence;
        if (!persistence) return;

        const records = persistence.data.records;
        if (records.totalRuns === 0) return;

        const y = h * 0.82;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '13px Arial, sans-serif';
        ctx.fillStyle = 'rgba(180, 180, 200, 0.6)';
        ctx.fillText('PERSONAL RECORDS', w / 2, y);

        ctx.font = '12px Arial, sans-serif';
        ctx.fillStyle = 'rgba(160, 160, 180, 0.5)';

        const timeStr = this.formatTime(records.longestSurvival);
        const line = `Best Time: ${timeStr}  |  Most Kills: ${records.highestKillCount}  |  Highest Level: ${records.maxLevel}  |  Runs: ${records.totalRuns}`;
        ctx.fillText(line, w / 2, y + 20);
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
        ctx.fillText('UPGRADE SHOP', w / 2, panelY + 36);

        // Gold balance
        const gold = this.game.systems.persistence ? this.game.systems.persistence.getGold() : 0;
        ctx.font = 'bold 18px Arial, sans-serif';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`Gold: ${gold}`, w / 2, panelY + 66);

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
                ctx.fillText('MAX', listX + listW - 10, iy + (itemH - 4) / 2);
            } else {
                ctx.fillStyle = u.canAfford ? '#FFD700' : '#FF6B6B';
                ctx.fillText(`${u.cost}g`, listX + listW - 10, iy + (itemH - 4) / 2);
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
        ctx.fillText('ESC  Back', w / 2, backY + backH / 2);
    }

    // ---- Render: Character Select ----

    renderCharacters(ctx) {
        const w = this.game.canvas.width;
        const h = this.game.canvas.height;
        const persistence = this.game.systems.persistence;
        const currentCharId = persistence ? persistence.getSelectedCharacter() : 'antonio';

        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.80)';
        ctx.fillRect(0, 0, w, h);

        // Panel
        const panelW = Math.min(660, w - 40);
        const panelH = Math.min(480, h - 60);
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
        ctx.fillText('CHOOSE YOUR CHAMPION', w / 2, panelY + 36);

        // Character cards
        this._characterRects = [];
        const cardW = Math.min(180, (panelW - 80) / CHARACTERS.length);
        const cardH = 300;
        const totalCardsW = CHARACTERS.length * cardW + (CHARACTERS.length - 1) * 16;
        const cardsStartX = (w - totalCardsW) / 2;
        const cardsY = panelY + 70;

        for (let i = 0; i < CHARACTERS.length; i++) {
            const char = CHARACTERS[i];
            const cx = cardsStartX + i * (cardW + 16);
            const isSelected = i === this.characterSelectedIndex;
            const isHovered = i === this.characterHoveredIndex;
            const isCurrentChar = char.id === currentCharId;
            const isUnlocked = char.unlocked || (persistence && persistence.isCharacterUnlocked(char.id));

            this._characterRects.push({ x: cx, y: cardsY, w: cardW, h: cardH });

            // Card background
            const cardAlpha = isUnlocked ? 0.95 : 0.6;
            ctx.fillStyle = `rgba(25, 18, 50, ${cardAlpha})`;
            const borderColor = isCurrentChar
                ? '#FFD700'
                : isSelected || isHovered
                  ? this.theme.accentStroke
                  : 'rgba(110, 82, 56, 0.6)';
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = isCurrentChar ? 3 : 2;
            this.roundRect(ctx, cx, cardsY, cardW, cardH, 12);
            ctx.fill();
            ctx.stroke();

            // Selected glow
            if (isCurrentChar) {
                ctx.shadowColor = 'rgba(255, 215, 0, 0.4)';
                ctx.shadowBlur = 14;
                this.roundRect(ctx, cx, cardsY, cardW, cardH, 12);
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.shadowColor = 'transparent';
            }

            const cardCenterX = cx + cardW / 2;

            if (!isUnlocked) {
                // Locked overlay
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                this.roundRect(ctx, cx, cardsY, cardW, cardH, 12);
                ctx.fill();

                // Lock icon
                ctx.font = 'bold 36px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = 'rgba(160, 160, 180, 0.7)';
                ctx.fillText('\u{1F512}', cardCenterX, cardsY + 80);

                // Locked name
                ctx.font = 'bold 16px Arial, sans-serif';
                ctx.fillStyle = 'rgba(140, 140, 160, 0.8)';
                ctx.fillText('???', cardCenterX, cardsY + 130);

                // Unlock condition
                ctx.font = '11px Arial, sans-serif';
                ctx.fillStyle = 'rgba(215, 164, 92, 0.78)';
                this.wrapText(ctx, char.unlockDesc || '', cardCenterX, cardsY + 165, cardW - 20, 14);
            } else {
                // Character circle with color
                ctx.beginPath();
                ctx.arc(cardCenterX, cardsY + 55, 26, 0, Math.PI * 2);
                ctx.fillStyle = char.color;
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Inner highlight
                ctx.beginPath();
                ctx.arc(cardCenterX - 6, cardsY + 48, 8, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.fill();

                // Name
                ctx.font = 'bold 17px "Cinzel", "Times New Roman", serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = isCurrentChar ? '#FFD700' : '#E0E0F0';
                ctx.fillText(char.name, cardCenterX, cardsY + 100);

                // Title
                ctx.font = 'italic 12px Arial, sans-serif';
                ctx.fillStyle = char.color;
                ctx.fillText(char.title, cardCenterX, cardsY + 118);

                // Description
                ctx.font = '11px Arial, sans-serif';
                ctx.fillStyle = 'rgba(180, 180, 200, 0.8)';
                this.wrapText(ctx, char.description, cardCenterX, cardsY + 145, cardW - 20, 14);

                // Starting weapon
                ctx.font = '11px Arial, sans-serif';
                ctx.fillStyle = 'rgba(140, 200, 255, 0.7)';
                const weaponName = char.startingWeapon.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                ctx.fillText(`Starts: ${weaponName}`, cardCenterX, cardsY + 200);

                // Stat modifiers
                const modY = cardsY + 222;
                ctx.font = '11px Arial, sans-serif';
                let modLine = 0;
                for (const [stat, val] of Object.entries(char.statModifiers)) {
                    const display =
                        stat === 'projectiles'
                            ? `+${val} Projectile${val > 1 ? 's' : ''}`
                            : `${val > 1 ? '+' : ''}${Math.round((val - 1) * 100)}% ${stat.charAt(0).toUpperCase() + stat.slice(1)}`;
                    ctx.fillStyle =
                        val >= 1 && stat !== 'projectiles' ? '#4ade80' : stat === 'projectiles' ? '#4ade80' : '#FF6B6B';
                    ctx.fillText(display, cardCenterX, modY + modLine * 15);
                    modLine++;
                }

                // "SELECTED" badge
                if (isCurrentChar) {
                    ctx.font = 'bold 12px Arial, sans-serif';
                    ctx.fillStyle = '#FFD700';
                    ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
                    ctx.shadowBlur = 8;
                    ctx.fillText('SELECTED', cardCenterX, cardsY + cardH - 20);
                    ctx.shadowBlur = 0;
                    ctx.shadowColor = 'transparent';
                }
            }
        }

        // Back button
        const backW = 120;
        const backH = 36;
        const backX = (w - backW) / 2;
        const backY = panelY + panelH - 50;
        this._characterBackRect = { x: backX, y: backY, w: backW, h: backH };

        ctx.fillStyle = this.theme.backFill;
        ctx.strokeStyle = this.theme.backStroke;
        ctx.lineWidth = 1;
        this.roundRect(ctx, backX, backY, backW, backH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = 'bold 14px Arial, sans-serif';
        ctx.fillStyle = this.theme.accentMuted;
        ctx.fillText('ESC  Back', w / 2, backY + backH / 2);
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
                this.game.gameState = 'menu';
            }
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
            this.game.gameState = 'menu';
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
            this.game.gameState = 'menu';
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
                this.game.gameState = 'menu';
            }
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
            this.game.gameState = 'menu';
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
            this.game.gameState = 'menu';
            return;
        }

        // Character cards
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

    selectMenuItem(index) {
        const item = this.menuItems[index];
        this.playSelectSound();

        switch (item) {
            case 'PLAY':
                this.game.startGame();
                break;
            case 'CHARACTERS':
                this.characterSelectedIndex = 0;
                this.characterHoveredIndex = -1;
                this.game.gameState = 'characters';
                break;
            case 'UPGRADES':
                this.upgradeSelectedIndex = 0;
                this.upgradeList = this.game.systems.persistence ? this.game.systems.persistence.getUpgradeInfo() : [];
                this.game.gameState = 'upgrades';
                break;
            case 'CHALLENGES':
                this.challengeSelectedIndex = 0;
                this.challengeHoveredIndex = -1;
                this.game.gameState = 'challenges';
                break;
            case 'STATISTICS':
                this.game.gameState = 'statistics';
                break;
            case 'SETTINGS':
                if (this.game.settingsMenu) {
                    this.game.settingsMenu.toggle();
                }
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
            this.game.showToast(`Upgraded ${u.name}!`, '#4ade80', 1200);
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
        this.game.showToast(`Selected ${char.name}!`, char.color, 1200);
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
        ctx.fillText('STATISTICS', w / 2, panelY + 36);

        const persistence = this.game.systems.persistence;
        if (!persistence) {
            ctx.font = '16px Arial, sans-serif';
            ctx.fillStyle = this.theme.accentMuted;
            ctx.fillText('No data available', w / 2, h / 2);
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
        ctx.fillText('RUN TOTALS', colLeft, startY);

        // Left column stats
        ctx.font = '14px Arial, sans-serif';
        const leftStats = [
            ['Total Runs', records.totalRuns],
            ['Total Playtime', this.formatPlaytime(records.totalPlayTime || 0)],
            ['Total Kills', this.formatNumber(records.totalKills || 0)],
            ['Total Gold Earned', this.formatNumber(records.totalGoldEarned || 0)],
            ['Total Damage Dealt', this.formatNumber(records.totalDamageDealt || 0)]
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
        ctx.fillText('PERSONAL BESTS', colRight, startY);

        // Right column stats
        ctx.font = '14px Arial, sans-serif';
        const rightStats = [
            ['Best Survival', this.formatTime(records.longestSurvival || 0)],
            ['Most Kills', this.formatNumber(records.highestKillCount || 0)],
            ['Highest Level', records.maxLevel || 0],
            ['Highest Combo', records.highestCombo || 0],
            ['Most Gold (run)', this.formatNumber(records.mostGoldSingleRun || 0)]
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
        ctx.fillText('FAVORITE WEAPON', w / 2, weaponY);

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
                `${weaponName}  (picked ${favCount} time${favCount !== 1 ? 's' : ''})`,
                w / 2,
                weaponY + lineH
            );
        } else {
            ctx.fillStyle = 'rgba(160, 160, 180, 0.6)';
            ctx.fillText('No weapons used yet', w / 2, weaponY + lineH);
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
        ctx.fillText('ESC  Back', w / 2, backY + backH / 2);
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
        ctx.fillText('CHALLENGE MODIFIERS', w / 2, panelY + 36);

        // Unlock check
        const unlocked = challenge.isUnlocked();
        if (!unlocked) {
            ctx.font = '16px Arial, sans-serif';
            ctx.fillStyle = 'rgba(200, 160, 120, 0.8)';
            ctx.fillText('\u{1F512}  Survive 15 minutes to unlock challenges', w / 2, h / 2 - 10);
            ctx.font = '13px Arial, sans-serif';
            ctx.fillStyle = 'rgba(160, 140, 120, 0.6)';
            ctx.fillText('Challenges add difficulty modifiers in exchange for bonus gold', w / 2, h / 2 + 20);
        } else {
            // Subheader
            ctx.font = '13px Arial, sans-serif';
            ctx.fillStyle = 'rgba(180, 180, 200, 0.6)';
            ctx.fillText('Select up to 3 modifiers for bonus gold  |  Click / Enter to toggle', w / 2, panelY + 62);

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
                ctx.fillText(`+${Math.round(mod.goldBonus * 100)}% Gold`, listX + listW - 12, iy + (itemH - 4) / 2);
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
                ctx.fillText(`GOLD MULTIPLIER: ${pendingMult.toFixed(1)}×`, w / 2, totalY);
                ctx.shadowBlur = 0;
                ctx.shadowColor = 'transparent';
            } else {
                ctx.fillStyle = 'rgba(180, 180, 200, 0.5)';
                ctx.fillText('No modifiers selected', w / 2, totalY);
            }

            // Active count
            ctx.font = '12px Arial, sans-serif';
            ctx.fillStyle = 'rgba(180, 180, 200, 0.5)';
            ctx.fillText(`${pending.size} / ${challenge.maxActive} selected`, w / 2, totalY + 22);
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
        ctx.fillText('ESC  Back', w / 2, backY + backH / 2);
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
            this.game.gameState = 'menu';
        }
    }

    handleChallengeClick(x, y) {
        const challenge = this.game.systems.challenge;
        if (!challenge) return;

        // Back button
        const b = this._challengeBackRect;
        if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            this.game.gameState = 'menu';
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
    }
}
