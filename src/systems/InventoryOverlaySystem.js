/**
 * InventoryOverlaySystem — Full-Screen Build Overlay (Tab Key Toggle)
 *
 * Shows the player's current build at a glance:
 *   - Equipped weapons with levels and max-level indicators
 *   - Passive items with levels
 *   - Active synergies
 *   - Evolution recipe hints (what passive is needed, progress)
 *
 * Toggled via Tab key. Renders as a semi-transparent full-screen canvas overlay.
 * Game continues to render underneath but update is paused (timeScale = 0).
 */

export class InventoryOverlaySystem {
    constructor(game) {
        this.game = game;
        this.visible = false;
        this._wasTimeScale = 1.0;

        // Layout constants
        this.padding = 20;
        this.cardWidth = 160;
        this.cardHeight = 80;
        this.cardGap = 12;
        this.sectionGap = 24;

        // Rarity colors
        this.rarityColors = {
            common: '#B0B0B0',
            uncommon: '#4ADE80',
            rare: '#60A5FA',
            epic: '#C084FC',
            legendary: '#FBBF24'
        };

        // Weapon type colors (matching weapon identities)
        this.weaponColors = {
            magic_missile: '#A855F7',
            whip: '#DC143C',
            throwing_knife: '#38BDF8',
            lightning_chain: '#7DF9FF',
            garlic_aura: '#4ADE80',
            holy_bible: '#FBBF24',
            fire_wand: '#FF4500',
            bone_boomerang: '#ADFF2F'
        };
    }

    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    show() {
        if (this.game.gameState !== 'playing') return;
        this.visible = true;
        this._wasTimeScale = this.game.timeScale;
        this.game.timeScale = 0; // Pause while viewing build
    }

    hide() {
        this.visible = false;
        this.game.timeScale = this._wasTimeScale || 1.0;
    }

    update(dt) {
        // No per-frame logic needed; overlay is static when shown
    }

    reset() {
        this.visible = false;
    }

    render(ctx) {
        if (!this.visible || !this.game.player) return;

        const w = this.game.canvas.width;
        const h = this.game.canvas.height;

        // Full-screen backdrop
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, w, h);

        // Title
        ctx.font = 'bold 28px "Cinzel", Georgia, serif';
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'center';
        ctx.fillText('装备库', w / 2, 45);

        ctx.font = '13px monospace';
        ctx.fillStyle = '#888';
        ctx.fillText('按 TAB 关闭', w / 2, 65);

        // === WEAPONS SECTION ===
        let yOffset = 90;
        yOffset = this._renderWeaponsSection(ctx, w, yOffset);

        // === PASSIVE ITEMS SECTION ===
        yOffset += this.sectionGap;
        yOffset = this._renderPassivesSection(ctx, w, yOffset);

        // === SYNERGIES SECTION ===
        yOffset += this.sectionGap;
        yOffset = this._renderSynergiesSection(ctx, w, yOffset);

        // === EVOLUTION HINTS SECTION ===
        yOffset += this.sectionGap;
        this._renderEvolutionHints(ctx, w, yOffset);

        ctx.restore();
    }

    _renderSectionHeader(ctx, text, w, y) {
        ctx.font = 'bold 16px "Cinzel", Georgia, serif';
        ctx.fillStyle = '#CCCCCC';
        ctx.textAlign = 'left';
        ctx.fillText(text, this.padding + 4, y);

        // Underline
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.padding, y + 6);
        ctx.lineTo(w - this.padding, y + 6);
        ctx.stroke();

        return y + 16;
    }

    _renderWeaponsSection(ctx, w, startY) {
        let y = this._renderSectionHeader(ctx, '⚔️ 武器', w, startY);
        const player = this.game.player;
        const weapons = Array.from(player.weapons.values());

        if (weapons.length === 0) {
            ctx.font = '13px monospace';
            ctx.fillStyle = '#666';
            ctx.textAlign = 'left';
            ctx.fillText('未装备武器', this.padding + 8, y + 16);
            return y + 30;
        }

        // Grid layout: max 3 per row
        const cols = Math.min(weapons.length, 3);
        const totalWidth = cols * this.cardWidth + (cols - 1) * this.cardGap;
        const startX = (w - totalWidth) / 2;

        for (let i = 0; i < weapons.length; i++) {
            const weapon = weapons[i];
            const col = i % 3;
            const row = Math.floor(i / 3);
            const x = startX + col * (this.cardWidth + this.cardGap);
            const cardY = y + 4 + row * (this.cardHeight + this.cardGap);

            this._renderWeaponCard(ctx, weapon, x, cardY);
        }

        const rows = Math.ceil(weapons.length / 3);
        return y + 4 + rows * (this.cardHeight + this.cardGap);
    }

    _renderWeaponCard(ctx, weapon, x, y) {
        const cw = this.cardWidth;
        const ch = this.cardHeight;
        const color = weapon.evolvedColor || this.weaponColors[weapon.id] || '#AAAAAA';

        // Card background
        ctx.fillStyle = 'rgba(30, 30, 50, 0.9)';
        this._roundRect(ctx, x, y, cw, ch, 6);
        ctx.fill();

        // Left color accent bar
        ctx.fillStyle = color;
        this._roundRect(ctx, x, y, 4, ch, 2);
        ctx.fill();

        // Border
        ctx.strokeStyle = weapon.evolved ? '#FFD700' : 'rgba(255,255,255,0.15)';
        ctx.lineWidth = weapon.evolved ? 2 : 1;
        this._roundRect(ctx, x, y, cw, ch, 6);
        ctx.stroke();

        // Weapon name
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = weapon.evolved ? '#FFD700' : '#FFFFFF';
        ctx.textAlign = 'left';
        const displayName = weapon.evolved ? `⚡ ${weapon.name}` : weapon.name;
        ctx.fillText(displayName, x + 12, y + 18);

        // Level indicator
        ctx.font = '11px monospace';
        const isMax = weapon.level >= weapon.maxLevel;
        ctx.fillStyle = isMax ? '#4ADE80' : '#AAA';
        ctx.fillText(`Lv ${weapon.level}/${weapon.maxLevel}`, x + 12, y + 34);

        // Level bar
        const barX = x + 12;
        const barY = y + 40;
        const barW = cw - 24;
        const barH = 4;
        const progress = weapon.level / weapon.maxLevel;

        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        this._roundRect(ctx, barX, barY, barW, barH, 2);
        ctx.fill();

        ctx.fillStyle = isMax ? '#4ADE80' : color;
        this._roundRect(ctx, barX, barY, barW * progress, barH, 2);
        ctx.fill();

        if (isMax) {
            ctx.font = 'bold 10px monospace';
            ctx.fillStyle = '#4ADE80';
            ctx.fillText('已满级', x + 12, y + 58);
        }

        // Evolved badge
        if (weapon.evolved) {
            ctx.font = 'bold 9px monospace';
            ctx.fillStyle = '#FFD700';
            ctx.textAlign = 'right';
            ctx.fillText('已进化', x + cw - 10, y + 58);
            ctx.textAlign = 'left';
        }

        // DPS estimate (if available)
        if (weapon.currentStats?.damage) {
            ctx.font = '10px monospace';
            ctx.fillStyle = '#FF6B6B';
            ctx.textAlign = 'right';
            ctx.fillText(`${Math.round(weapon.currentStats.damage)} dmg`, x + cw - 10, y + 18);
            ctx.textAlign = 'left';
        }
    }

    _renderPassivesSection(ctx, w, startY) {
        let y = this._renderSectionHeader(ctx, '🛡️ 被动道具', w, startY);
        const passiveSystem = this.game.systems.passiveItems;
        if (!passiveSystem || passiveSystem.items.size === 0) {
            ctx.font = '13px monospace';
            ctx.fillStyle = '#666';
            ctx.textAlign = 'left';
            ctx.fillText('无被动道具', this.padding + 8, y + 16);
            return y + 30;
        }

        const items = Array.from(passiveSystem.items.entries());
        const cols = Math.min(items.length, 4);
        const itemW = 120;
        const itemH = 36;
        const totalWidth = cols * itemW + (cols - 1) * 8;
        const startX = (w - totalWidth) / 2;

        for (let i = 0; i < items.length; i++) {
            const [id, data] = items[i];
            const col = i % 4;
            const row = Math.floor(i / 4);
            const x = startX + col * (itemW + 8);
            const iy = y + 4 + row * (itemH + 6);

            // Background
            ctx.fillStyle = 'rgba(30, 40, 30, 0.9)';
            this._roundRect(ctx, x, iy, itemW, itemH, 4);
            ctx.fill();

            ctx.strokeStyle = 'rgba(74, 222, 128, 0.3)';
            ctx.lineWidth = 1;
            this._roundRect(ctx, x, iy, itemW, itemH, 4);
            ctx.stroke();

            // Name
            ctx.font = 'bold 11px monospace';
            ctx.fillStyle = '#4ADE80';
            ctx.textAlign = 'left';
            const passiveNames = {
                spinach: '💪 Spinach',
                empty_tome: '📖 Empty Tome',
                duplicator: '✨ Duplicator',
                attractorb: '🧲 Attractorb',
                armor: '🛡️ Armor',
                wings: '🦅 Wings'
            };
            ctx.fillText(passiveNames[id] || id, x + 6, iy + 15);

            // Level
            ctx.font = '10px monospace';
            ctx.fillStyle = '#AAA';
            const level = data.level || data || 1;
            ctx.fillText(`Lv ${level}`, x + 6, iy + 28);
        }

        const rows = Math.ceil(items.length / 4);
        return y + 4 + rows * (itemH + 6);
    }

    _renderSynergiesSection(ctx, w, startY) {
        let y = this._renderSectionHeader(ctx, '🔗 激活协同', w, startY);
        const synergySystem = this.game.systems.synergy;
        if (!synergySystem || synergySystem.activeSynergies.size === 0) {
            ctx.font = '13px monospace';
            ctx.fillStyle = '#666';
            ctx.textAlign = 'left';
            ctx.fillText('暂无协同效果 — 组合武器和被动道具！', this.padding + 8, y + 16);
            return y + 30;
        }

        const synergies = Array.from(synergySystem.activeSynergies.values());
        for (let i = 0; i < synergies.length; i++) {
            const syn = synergies[i];
            const sy = y + 4 + i * 28;

            // Background pill
            const text = `${syn.icon} ${syn.name} — ${syn.description}`;
            ctx.font = '12px monospace';
            const tw = ctx.measureText(text).width;
            const px = (w - tw) / 2 - 12;

            ctx.fillStyle = 'rgba(30, 30, 50, 0.8)';
            this._roundRect(ctx, px, sy - 4, tw + 24, 22, 4);
            ctx.fill();

            ctx.strokeStyle = syn.color || '#888';
            ctx.lineWidth = 1;
            this._roundRect(ctx, px, sy - 4, tw + 24, 22, 4);
            ctx.stroke();

            ctx.fillStyle = syn.color || '#FFF';
            ctx.textAlign = 'center';
            ctx.fillText(text, w / 2, sy + 10);
        }

        return y + 4 + synergies.length * 28;
    }

    _renderEvolutionHints(ctx, w, startY) {
        let y = this._renderSectionHeader(ctx, '🌟 进化配方', w, startY);
        const evoSystem = this.game.systems.weaponEvolution;
        if (!evoSystem) return y;

        const player = this.game.player;
        const passiveSystem = this.game.systems.passiveItems;
        const weapons = Array.from(player.weapons.values());

        let hintCount = 0;
        for (const weapon of weapons) {
            const info = evoSystem.getRecipeInfo(weapon.id);
            if (!info) continue;

            const sy = y + 4 + hintCount * 30;
            hintCount++;

            const hasItem = info.hasPassive;
            const hasMax = info.isMaxLevel;
            const isEvolved = evoSystem.evolvedWeapons.has(weapon.id);

            // Status icons
            let status;
            let statusColor;
            if (isEvolved) {
                status = '✅ EVOLVED';
                statusColor = '#FFD700';
            } else if (info.isEligible) {
                status = '⚡ READY!';
                statusColor = '#4ADE80';
            } else {
                const parts = [];
                parts.push(hasMax ? '✅ Max Level' : `⬜ Lv ${weapon.level}/${weapon.maxLevel}`);
                const passiveNames = {
                    spinach: 'Spinach', empty_tome: 'Empty Tome', duplicator: 'Duplicator',
                    attractorb: 'Attractorb', armor: 'Armor', wings: 'Wings'
                };
                const passiveName = passiveNames[info.requiredPassive] || info.requiredPassive;
                parts.push(hasItem ? `✅ ${passiveName}` : `⬜ Need ${passiveName}`);
                status = parts.join('  ·  ');
                statusColor = '#AAA';
            }

            const wColor = this.weaponColors[weapon.id] || '#AAA';

            // Weapon name → evolved name
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'left';
            ctx.fillStyle = wColor;
            ctx.fillText(`${weapon.name}  →  ${info.evolvedName}`, this.padding + 8, sy + 12);

            // Status
            ctx.font = '11px monospace';
            ctx.fillStyle = statusColor;
            ctx.textAlign = 'right';
            ctx.fillText(status, w - this.padding - 8, sy + 12);
        }

        if (hintCount === 0) {
            ctx.font = '13px monospace';
            ctx.fillStyle = '#666';
            ctx.textAlign = 'left';
            ctx.fillText('装备武器以查看进化路径', this.padding + 8, y + 16);
        }

        return y + 4 + Math.max(hintCount, 1) * 30;
    }

    /**
     * Draw a rounded rectangle path.
     */
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
}
