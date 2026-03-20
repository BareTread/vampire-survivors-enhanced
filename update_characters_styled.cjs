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
        ctx.fillText('CHOOSE YOUR CHAMPION', w / 2, panelY + 45);
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
                ctx.fillText('\\u{1F512}', iconX, midY + 1);

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
            ctx.fillText('\\u{1F512}', rightX + (rightPaneW - 25) / 2, paneY + paneH * 0.35);

            ctx.font = 'bold 26px "Cinzel", "Times New Roman", serif';
            ctx.fillStyle = 'rgba(140, 140, 160, 0.7)';
            ctx.fillText('CHARACTER LOCKED', rightX + (rightPaneW - 25) / 2, paneY + paneH * 0.55);

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
            ctx.fillText('STARTING WEAPON', detailsX, flexY);

            ctx.font = 'bold 18px Arial, sans-serif';
            ctx.fillStyle = '#87CEEB'; // Sky blue
            const weaponName = activeChar.startingWeapon.replace(/_/g, ' ').replace(/\\b\\w/g, (c) => c.toUpperCase());
            ctx.fillText(weaponName, detailsX, flexY + 25);

            // Right column: Stats
            const statsX = detailsX + detailsW * 0.45;
            ctx.font = 'bold 14px Arial, sans-serif';
            ctx.fillStyle = 'rgba(160, 150, 180, 0.9)';
            ctx.fillText('PASSIVE BONUSES', statsX, flexY);

            const modY = flexY + 25;
            ctx.font = '15px Arial, sans-serif';
            let modLine = 0;
            const entries = Object.entries(activeChar.statModifiers);
            
            if (entries.length === 0) {
                ctx.fillStyle = 'rgba(180, 180, 200, 0.6)';
                ctx.fillText('None', statsX, modY);
            } else {
                for (const [stat, val] of entries) {
                    const isPositive = val >= 1 || stat === 'projectiles';
                    const display = stat === 'projectiles'
                        ? \`+\${val} Projectile\${val > 1 ? 's' : ''}\`
                        : \`\${val > 1 ? '+' : ''}\${Math.round((val - 1) * 100)}% \${stat.charAt(0).toUpperCase() + stat.slice(1)}\`;
                    
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
                ctx.fillText('✓ EQUIPPED', rightX + rightPaneW - 45, badgeY);
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
                ctx.fillText('Press ENTER to Equip', rightX + rightPaneW - 45 - 20, badgeY - 5);
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
        ctx.fillText('ESC - RETURN TO MENU', w / 2, backY + backH / 2 + 1);
    }
\n`;

content = content.substring(0, startIdx) + newRender + content.substring(endIdx);
fs.writeFileSync(file, content);
console.log("Updated heavily styled characters screen!");
