const fs = require('fs');
const file = 'src/systems/TitleScreenSystem.js';
let content = fs.readFileSync(file, 'utf8');

const startMatch = "    renderCharacters(ctx) {\n";
const endMatch = "    /**\n     * Simple word-wrap for centered text.\n     */";

const startIdx = content.indexOf(startMatch);
const endIdx = content.indexOf(endMatch);

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find boundaries");
    process.exit(1);
}

const newRender = `    renderCharacters(ctx) {
        const w = this.game.canvas.width;
        const h = this.game.canvas.height;
        const persistence = this.game.systems.persistence;
        const currentCharId = persistence ? persistence.getSelectedCharacter() : 'antonio';

        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, w, h);

        // Responsive Panel Size
        const panelW = Math.min(880, w - 40);
        const panelH = Math.min(580, h - 40);
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;

        // Draw Panel Background
        ctx.fillStyle = this.theme.panelFill;
        ctx.strokeStyle = this.theme.panelStroke;
        ctx.lineWidth = 2;
        this.roundRect(ctx, panelX, panelY, panelW, panelH, 16);
        ctx.fill();
        ctx.stroke();

        // Header
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 30px "Cinzel", "Times New Roman", serif';
        ctx.fillStyle = '#FFD700';
        ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.fillText('CHOOSE YOUR CHAMPION', w / 2, panelY + 40);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Divider
        ctx.beginPath();
        ctx.moveTo(panelX + 30, panelY + 70);
        ctx.lineTo(panelX + panelW - 30, panelY + 70);
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Two-pane Layout
        const leftPaneW = panelW * 0.38;
        const rightPaneW = panelW * 0.62;
        const paneY = panelY + 85;
        const paneH = panelH - 160;

        // List properties
        this._characterRects = [];
        const itemH = 42;
        const listMargin = 20;
        const listW = leftPaneW - listMargin * 2;
        const listX = panelX + listMargin;

        // We use either hovered or selected for right pane
        const activeIdx = this.characterHoveredIndex !== -1 ? this.characterHoveredIndex : this.characterSelectedIndex;

        // --- LEFT PANE (Character List) ---
        for (let i = 0; i < CHARACTERS.length; i++) {
            const char = CHARACTERS[i];
            const iy = paneY + i * (itemH + 6);
            const isSelected = i === this.characterSelectedIndex;
            const isHovered = i === this.characterHoveredIndex;
            const isActive = i === activeIdx;
            const isCurrentChar = char.id === currentCharId;
            const isUnlocked = char.unlocked || (persistence && persistence.isCharacterUnlocked(char.id));

            this._characterRects.push({ x: listX, y: iy, w: listW, h: itemH });

            // Row background
            const rowAlpha = isUnlocked ? 0.9 : 0.4;
            if (isActive) {
                ctx.fillStyle = \`rgba(255, 215, 0, \${isUnlocked ? 0.2 : 0.1})\`;
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 2;
            } else if (isHovered) {
                ctx.fillStyle = this.theme.accentFill;
                ctx.strokeStyle = this.theme.accentStroke;
                ctx.lineWidth = 1;
            } else {
                ctx.fillStyle = \`rgba(30, 22, 40, \${rowAlpha * 0.6})\`;
                ctx.strokeStyle = \`rgba(80, 60, 50, \${rowAlpha * 0.4})\`;
                ctx.lineWidth = 1;
            }
            this.roundRect(ctx, listX, iy, listW, itemH, 8);
            ctx.fill();
            ctx.stroke();

            // Equipped indicator (left border accent)
            if (isCurrentChar) {
                ctx.fillStyle = '#FFD700';
                this.roundRect(ctx, listX, iy, 6, itemH, {tl: 8, bl: 8, tr: 0, br: 0});
                ctx.fill();
            }

            const iconX = listX + 26;
            const textX = listX + 50;
            const midY = iy + itemH / 2;

            if (!isUnlocked) {
                // Locked icon
                ctx.font = 'bold 16px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = 'rgba(160, 160, 180, 0.5)';
                ctx.fillText('\\u{1F512}', iconX, midY + 2);

                // Locked Name
                ctx.textAlign = 'left';
                ctx.font = 'bold 15px Arial, sans-serif';
                ctx.fillStyle = 'rgba(140, 140, 160, 0.5)';
                ctx.fillText('???', textX, midY + 1);
            } else {
                // Character color circle
                ctx.beginPath();
                ctx.arc(iconX, midY, 11, 0, Math.PI * 2);
                ctx.fillStyle = char.color;
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 1;
                ctx.stroke();

                if (isCurrentChar) {
                    ctx.beginPath();
                    ctx.arc(iconX, midY, 4, 0, Math.PI * 2);
                    ctx.fillStyle = '#FFF';
                    ctx.fill();
                }

                // Name
                ctx.textAlign = 'left';
                ctx.font = 'bold 15px "Cinzel", "Times New Roman", serif';
                ctx.fillStyle = isActive ? '#FFD700' : '#E0E0F0';
                ctx.fillText(char.name, textX, midY + 1);
            }
        }

        // --- RIGHT PANE (Character Details) ---
        const rightX = panelX + leftPaneW;
        const detailsX = rightX + 30;
        const detailsW = rightPaneW - 60;
        const activeChar = CHARACTERS[activeIdx];
        const isUnlocked = activeChar.unlocked || (persistence && persistence.isCharacterUnlocked(activeChar.id));
        const isCurrentChar = activeChar.id === currentCharId;

        // Subtle pane background
        ctx.fillStyle = 'rgba(15, 10, 20, 0.4)';
        ctx.strokeStyle = 'rgba(60, 50, 80, 0.3)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, rightX, paneY, rightPaneW - 20, paneH, 12);
        ctx.fill();
        ctx.stroke();

        if (!isUnlocked) {
            // Locked View
            ctx.textAlign = 'center';
            ctx.font = 'bold 64px Arial, sans-serif';
            ctx.fillStyle = 'rgba(160, 160, 180, 0.3)';
            ctx.fillText('\\u{1F512}', rightX + (rightPaneW - 20) / 2, paneY + paneH * 0.35);

            ctx.font = 'bold 24px "Cinzel", "Times New Roman", serif';
            ctx.fillStyle = 'rgba(160, 160, 180, 0.6)';
            ctx.fillText('CHARACTER LOCKED', rightX + (rightPaneW - 20) / 2, paneY + paneH * 0.55);

            ctx.font = '14px Arial, sans-serif';
            ctx.fillStyle = 'rgba(215, 164, 92, 0.8)';
            this.wrapText(ctx, activeChar.unlockDesc || 'Defeat more enemies to unlock.', rightX + (rightPaneW - 20) / 2, paneY + paneH * 0.65, detailsW - 40, 20);

        } else {
            // Unlocked View
            
            // Large Portrait / Icon
            const portraitX = detailsX + 40;
            const portraitY = paneY + 50;
            ctx.beginPath();
            ctx.arc(portraitX, portraitY, 40, 0, Math.PI * 2);
            ctx.fillStyle = activeChar.color;
            ctx.fill();
            
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Inner styling for portrait
            ctx.beginPath();
            ctx.arc(portraitX - 10, portraitY - 10, 15, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fill();

            // Title and Name
            ctx.textAlign = 'left';
            ctx.font = 'bold 32px "Cinzel", "Times New Roman", serif';
            ctx.fillStyle = '#FFD700';
            ctx.fillText(activeChar.name, portraitX + 60, portraitY - 5);

            ctx.font = 'italic 16px Arial, sans-serif';
            ctx.fillStyle = activeChar.color;
            ctx.fillText(activeChar.title, portraitX + 62, portraitY + 20);

            // Description
            ctx.font = '14px Arial, sans-serif';
            ctx.fillStyle = 'rgba(200, 200, 220, 0.9)';
            const descY = portraitY + 60;
            
            // Wrap left-aligned text
            const words = activeChar.description.split(' ');
            let line = '';
            let lineY = descY;
            for (const word of words) {
                const test = line + (line ? ' ' : '') + word;
                if (ctx.measureText(test).width > detailsW && line) {
                    ctx.fillText(line, detailsX, lineY);
                    line = word;
                    lineY += 22;
                } else {
                    line = test;
                }
            }
            if (line) ctx.fillText(line, detailsX, lineY);

            // Starting Weapon
            const weaponY = lineY + 40;
            ctx.font = 'bold 15px Arial, sans-serif';
            ctx.fillStyle = '#A0A0B0';
            ctx.fillText('STARTING WEAPON', detailsX, weaponY);

            ctx.font = 'bold 16px Arial, sans-serif';
            ctx.fillStyle = 'rgba(140, 200, 255, 0.9)';
            const weaponName = activeChar.startingWeapon.replace(/_/g, ' ').replace(/\\b\\w/g, (c) => c.toUpperCase());
            ctx.fillText(weaponName, detailsX, weaponY + 22);

            // Stats Modifiers
            const statsY = weaponY + 60;
            ctx.font = 'bold 15px Arial, sans-serif';
            ctx.fillStyle = '#A0A0B0';
            ctx.fillText('PASSIVE BONUSES', detailsX, statsY);

            const modY = statsY + 24;
            ctx.font = '14px Arial, sans-serif';
            let modLine = 0;
            const entries = Object.entries(activeChar.statModifiers);
            
            if (entries.length === 0) {
                ctx.fillStyle = 'rgba(180, 180, 200, 0.6)';
                ctx.fillText('None', detailsX, modY);
            } else {
                for (const [stat, val] of entries) {
                    const isPositive = val >= 1 || stat === 'projectiles';
                    const display = stat === 'projectiles'
                        ? \`+\${val} Projectile\${val > 1 ? 's' : ''}\`
                        : \`\${val > 1 ? '+' : ''}\${Math.round((val - 1) * 100)}% \${stat.charAt(0).toUpperCase() + stat.slice(1)}\`;
                    
                    ctx.fillStyle = isPositive ? '#4ade80' : '#FF6B6B';
                    // Layout in two columns if many stats
                    const col = modLine % 2;
                    const row = Math.floor(modLine / 2);
                    ctx.fillText(display, detailsX + col * (detailsW / 2), modY + row * 24);
                    modLine++;
                }
            }

            // Status Badge
            if (isCurrentChar) {
                const badgeY = paneY + paneH - 30;
                ctx.font = 'bold 16px Arial, sans-serif';
                ctx.fillStyle = '#FFD700';
                ctx.textAlign = 'right';
                ctx.shadowColor = 'rgba(255, 215, 0, 0.4)';
                ctx.shadowBlur = 8;
                ctx.fillText('✓ EQUIPPED', rightX + rightPaneW - 40, badgeY);
                ctx.shadowBlur = 0;
                ctx.shadowColor = 'transparent';
            } else {
                const badgeY = paneY + paneH - 30;
                ctx.font = '14px Arial, sans-serif';
                ctx.fillStyle = 'rgba(180, 180, 200, 0.6)';
                ctx.textAlign = 'right';
                ctx.fillText('Press ENTER / Click to Equip', rightX + rightPaneW - 40, badgeY);
            }
        }

        // Divider above back button
        ctx.beginPath();
        ctx.moveTo(panelX + 30, panelY + panelH - 70);
        ctx.lineTo(panelX + panelW - 30, panelY + panelH - 70);
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Back button
        const backW = 140;
        const backH = 40;
        const backX = (w - backW) / 2;
        const backY = panelY + panelH - 55;
        this._characterBackRect = { x: backX, y: backY, w: backW, h: backH };

        ctx.fillStyle = this.theme.backFill;
        ctx.strokeStyle = this.theme.backStroke;
        ctx.lineWidth = 1;
        this.roundRect(ctx, backX, backY, backW, backH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = 'bold 15px Arial, sans-serif';
        ctx.fillStyle = this.theme.accentMuted;
        ctx.fillText('ESC  Back', w / 2, backY + backH / 2 + 1);
    }
\n`;

content = content.substring(0, startIdx) + newRender + content.substring(endIdx);
fs.writeFileSync(file, content);
console.log("Updated!");
