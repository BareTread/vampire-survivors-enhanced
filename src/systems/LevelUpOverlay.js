const TYPES = {
    weapon_upgrade: 'WEAPON UPGRADE', new_weapon: 'NEW WEAPON',
    stat_upgrade: 'SURVIVOR UPGRADE', new_passive: 'NEW PASSIVE',
    passive_upgrade: 'PASSIVE UPGRADE', evolution: 'WEAPON EVOLUTION'
};

const PREVIEW_STATS = [
    ['damage', 'Damage'], ['cooldown', 'Interval', 's'], ['projectiles', 'Projectiles'],
    ['chains', 'Chains'], ['orbiterCount', 'Orbiters'], ['radius', 'Radius'],
    ['range', 'Reach'], ['freezeDuration', 'Freeze', 's'], ['piercing', 'Pierce']
];

// Icon tints for weapons that are offered before an instance exists
const WEAPON_TINTS = {
    whip: '#d09058', magic_missile: '#b070e0', throwing_knife: '#d0d4dc',
    lightning_chain: '#7DF9FF', garlic_aura: '#c8e6a0', holy_bible: '#ffe08a',
    fire_wand: '#ff7a30', bone_boomerang: '#e8dcc0', ice_shard: '#88DDFF',
    shadow_dagger: '#9b6bff'
};

const easeOutBack = (t) => {
    const c = 1.4;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/** One layout owns drawing and pointer selection, including after a resize. */
export class LevelUpOverlay {
    constructor(game) {
        this.game = game;
        this.rects = [];
        this.layoutKey = '';
    }

    layout() {
        const { width: w, height: h } = this.game.canvas;
        const count = this.game.levelUpOptions.length;
        const key = `${w}:${h}:${count}`;
        if (key === this.layoutKey) return this.rects;
        this.layoutKey = key;
        this.rects.length = 0;
        this.compact = w < 960 || h < 640;
        const columns = this.compact ? 1 : Math.min(count, 3);
        const rows = Math.ceil(count / columns);
        const gap = this.compact ? 8 : 16;
        const width = Math.min(w - 32, this.compact ? 680 : 1120);
        const top = this.compact ? 100 : Math.max(140, h * 0.19);
        const height = Math.min(this.compact ? 124 : 238, (h - top - 64 - gap * (rows - 1)) / rows);
        const cardWidth = (width - (columns - 1) * gap) / columns;
        const left = (w - width) / 2;
        for (let i = 0; i < count; i++) {
            const row = Math.floor(i / columns);
            const rowCount = Math.min(columns, count - row * columns);
            const inset = (columns - rowCount) * (cardWidth + gap) / 2;
            this.rects.push({ x: left + inset + (i % columns) * (cardWidth + gap),
                y: top + row * (height + gap), w: cardWidth, h: height });
        }
        this.bottom = top + rows * (height + gap) - gap;
        return this.rects;
    }

    hitTest(x, y) {
        return this.layout().findIndex(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    }

    describe(option) {
        if (option.type !== 'weapon_upgrade') return option.description;
        const weapon = this.game.player.weapons.get(option.weaponId);
        const current = weapon?.levelProgression?.[weapon.level];
        const next = weapon?.levelProgression?.[weapon.level + 1];
        if (!current || !next) return option.description;
        const changes = [];
        for (const [key, label, unit = ''] of PREVIEW_STATS) {
            if (typeof current[key] === 'number' && typeof next[key] === 'number' && next[key] !== current[key]) {
                changes.push(`${label} ${current[key]}${unit} → ${next[key]}${unit}`);
            }
        }
        return changes.length ? `Base: ${changes.slice(0, 3).join(' · ')}` : option.description;
    }

    buildNote(option) {
        const player = this.game.player;
        const passives = this.game.systems.passiveItems;
        const weaponId = option.weaponId || option.weaponType;
        const recipe = this.game.systems.weaponEvolution?.recipes.get(weaponId);
        if (recipe && option.type !== 'evolution') {
            const passive = passives?.itemDefinitions.get(recipe.requiredPassive);
            const owned = passives?.items.has(recipe.requiredPassive);
            return `${recipe.evolvedName}: max weapon + ${passive?.name || recipe.requiredPassive}${owned ? ' (owned)' : ''}`;
        }
        if (option.type === 'new_passive' || option.type === 'passive_upgrade') {
            for (const [id, evolution] of this.game.systems.weaponEvolution?.recipes || []) {
                if (evolution.requiredPassive === option.itemId && player.weapons.has(id)) {
                    return `Evolution partner for ${player.weapons.get(id).name}`;
                }
            }
            return 'Applies to your whole build';
        }
        if (option.type === 'evolution') return 'Transforms your weapon in its existing slot';
        return 'Applies for the rest of this run';
    }

    text(ctx, value, x, y, width, lineHeight, maxLines) {
        const words = String(value || '').split(/\s+/);
        let line = '';
        let row = 0;
        for (let i = 0; i < words.length; i++) {
            const candidate = line ? `${line} ${words[i]}` : words[i];
            if (ctx.measureText(candidate).width > width && line) {
                if (row === maxLines - 1) {
                    while (line && ctx.measureText(`${line}…`).width > width) line = line.slice(0, -1);
                    ctx.fillText(`${line}…`, x, y + row * lineHeight);
                    return;
                }
                ctx.fillText(line, x, y + row++ * lineHeight);
                line = words[i];
            } else {
                line = candidate;
            }
        }
        ctx.fillText(line, x, y + row * lineHeight, width);
    }

    /** Strip a leading emoji/symbol (passive names carry their icon). */
    cleanName(name) {
        return String(name || '').replace(/^[^\p{L}\p{N}]+/u, '').trim() || String(name || '');
    }

    leadingIcon(name) {
        const m = /^([^\p{L}\p{N}\s]+)\s/u.exec(String(name || ''));
        return m ? m[1] : null;
    }

    /**
     * Round medallion in the card corner showing what the choice *is*:
     * weapon glyph (shared with the HUD), passive emblem, or stat sigil.
     */
    drawIcon(ctx, option, cx, cy, r, accent) {
        ctx.save();
        const bg = ctx.createRadialGradient(cx, cy - r * 0.4, 0, cx, cy, r);
        bg.addColorStop(0, '#2a2433');
        bg.addColorStop(1, '#0e0b13');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const hud = this.game.systems.canvasHUD;
        const weaponId = option.weaponId || option.weaponType;
        if (option.type === 'evolution') {
            // Radiant burst behind the evolved weapon
            ctx.fillStyle = 'rgba(255, 210, 90, 0.35)';
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2 + performance.now() * 0.0008;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, r * 0.95, a - 0.12, a + 0.12);
                ctx.closePath();
                ctx.fill();
            }
        }
        if (weaponId && hud && typeof hud._renderWeaponIcon === 'function') {
            const inst = this.game.player?.weapons?.get(weaponId);
            const color = inst?.color && inst.color !== '#8B4513' ? inst.color : (WEAPON_TINTS[weaponId] || '#d8c8a0');
            hud._renderWeaponIcon(ctx, { id: weaponId, color, evolved: option.type === 'evolution' }, cx, cy, r * 0.55);
        } else if (option.type === 'new_passive' || option.type === 'passive_upgrade') {
            const glyph = this.leadingIcon(option.name);
            if (glyph) {
                ctx.font = `${Math.round(r * 1.05)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(glyph, cx, cy + 1);
            } else {
                ctx.fillStyle = option.color || accent;
                ctx.beginPath();
                ctx.moveTo(cx, cy - r * 0.5); ctx.lineTo(cx + r * 0.4, cy);
                ctx.lineTo(cx, cy + r * 0.5); ctx.lineTo(cx - r * 0.4, cy);
                ctx.closePath();
                ctx.fill();
            }
        } else {
            this.drawStatSigil(ctx, option.stat, cx, cy, r * 0.5);
        }
        ctx.restore();
    }

    drawStatSigil(ctx, stat, cx, cy, s) {
        ctx.fillStyle = '#e8d6a8';
        ctx.strokeStyle = '#e8d6a8';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        switch (stat) {
            case 'damage': // sword
                ctx.moveTo(cx - s * 0.8, cy + s * 0.8); ctx.lineTo(cx + s * 0.8, cy - s * 0.8);
                ctx.moveTo(cx - s * 0.75, cy + s * 0.15); ctx.lineTo(cx - s * 0.15, cy + s * 0.75);
                ctx.stroke();
                break;
            case 'speed': // double chevron
                for (const dx of [-0.45, 0.25]) {
                    ctx.moveTo(cx + s * dx, cy - s * 0.6); ctx.lineTo(cx + s * (dx + 0.5), cy); ctx.lineTo(cx + s * dx, cy + s * 0.6);
                }
                ctx.stroke();
                break;
            case 'health': // heart
                ctx.fillStyle = '#e0484a';
                ctx.moveTo(cx, cy + s * 0.8);
                ctx.bezierCurveTo(cx - s * 1.2, cy - s * 0.1, cx - s * 0.5, cy - s * 1.0, cx, cy - s * 0.35);
                ctx.bezierCurveTo(cx + s * 0.5, cy - s * 1.0, cx + s * 1.2, cy - s * 0.1, cx, cy + s * 0.8);
                ctx.fill();
                break;
            case 'luck': // four-leaf
                ctx.fillStyle = '#6cd08a';
                for (let i = 0; i < 4; i++) {
                    const a = i * Math.PI / 2 + Math.PI / 4;
                    ctx.moveTo(cx, cy);
                    ctx.arc(cx + Math.cos(a) * s * 0.42, cy + Math.sin(a) * s * 0.42, s * 0.38, 0, Math.PI * 2);
                }
                ctx.fill();
                break;
            case 'area': // ripples
                ctx.arc(cx, cy, s * 0.35, 0, Math.PI * 2);
                ctx.moveTo(cx + s * 0.8, cy);
                ctx.arc(cx, cy, s * 0.8, 0, Math.PI * 2);
                ctx.stroke();
                break;
            case 'cooldown': // hourglass
                ctx.moveTo(cx - s * 0.6, cy - s * 0.8); ctx.lineTo(cx + s * 0.6, cy - s * 0.8);
                ctx.lineTo(cx - s * 0.6, cy + s * 0.8); ctx.lineTo(cx + s * 0.6, cy + s * 0.8);
                ctx.closePath();
                ctx.stroke();
                break;
            default:
                ctx.arc(cx, cy, s * 0.5, 0, Math.PI * 2);
                ctx.fill();
        }
    }

    render(ctx) {
        const { width: w, height: h } = this.game.canvas;
        const rects = this.layout();
        const compact = this.compact;
        // Entrance timing restarts whenever a fresh set of options appears
        if (this._shownOptions !== this.game.levelUpOptions) {
            this._shownOptions = this.game.levelUpOptions;
            this._openedAt = performance.now();
        }
        const since = performance.now() - this._openedAt;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(7, 6, 11, 0.95)';
        ctx.fillRect(0, 0, w, h);
        // Warm light pooled behind the title
        const halo = ctx.createRadialGradient(w / 2, compact ? 34 : 66, 0, w / 2, compact ? 34 : 66, Math.min(w, 700) * 0.5);
        halo.addColorStop(0, 'rgba(216, 170, 90, 0.16)');
        halo.addColorStop(1, 'rgba(216, 170, 90, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, w, h * 0.4);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#eee4cf';
        ctx.font = `bold ${compact ? 30 : 44}px Georgia, serif`;
        ctx.fillText('Choose your power', w / 2, compact ? 34 : 66);
        ctx.fillStyle = '#c7bda8';
        ctx.font = '14px Georgia, serif';
        const progress = this.game.player?.levelUpProgress;
        const progressText = progress && progress.total > 1 ? `  ·  Pick ${progress.current} of ${progress.total}` : '';
        ctx.fillText(`Level ${this.game.player.level}  ·  The hunt waits for your decision${progressText}`, w / 2, compact ? 66 : 108, w - 24);

        this.game.levelUpOptions.forEach((option, i) => {
            const base = rects[i];
            const selected = this.game._levelUpHoveredIndex === i;
            const pad = compact ? 14 : 22;
            const tight = compact && base.h < 106;
            const rarityColor = option.rarity?.color || '#8a8272';

            // Staggered rise-in, then a gentle lift on hover
            const t = Math.max(0, Math.min(1, (since - i * 60) / 260));
            const e = easeOutBack(t);
            const lift = selected ? 4 : 0;
            const r = { x: base.x, y: base.y + (1 - e) * 28 - lift, w: base.w, h: base.h };
            ctx.save();
            ctx.globalAlpha = Math.min(1, t * 1.6);

            if (selected) {
                ctx.shadowColor = rarityColor;
                ctx.shadowBlur = 18;
            }
            const cardGrad = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
            cardGrad.addColorStop(0, selected ? '#2d2833' : '#1c1920');
            cardGrad.addColorStop(1, selected ? '#1d1a22' : '#121015');
            ctx.fillStyle = cardGrad;
            ctx.fillRect(r.x, r.y, r.w, r.h);
            ctx.shadowBlur = 0;
            // Rarity band across the top edge
            ctx.fillStyle = rarityColor;
            ctx.globalAlpha *= selected ? 1 : 0.75;
            ctx.fillRect(r.x, r.y, r.w, 3);
            ctx.globalAlpha = Math.min(1, t * 1.6);
            ctx.strokeStyle = selected ? '#dbb76e' : 'rgba(150, 128, 92, 0.5)';
            ctx.lineWidth = selected ? 2 : 1;
            ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
            // Small corner cuts frame a stone tablet without noisy ornament.
            ctx.strokeStyle = selected ? '#e8cd90' : '#917c56';
            ctx.beginPath();
            ctx.moveTo(r.x, r.y + 8); ctx.lineTo(r.x, r.y); ctx.lineTo(r.x + 12, r.y);
            ctx.moveTo(r.x + r.w - 12, r.y + r.h); ctx.lineTo(r.x + r.w, r.y + r.h); ctx.lineTo(r.x + r.w, r.y + r.h - 8);
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.fillStyle = selected ? '#dbb76e' : '#2e2934';
            ctx.fillRect(r.x + pad, r.y + pad, 25, 25);
            ctx.fillStyle = selected ? '#101719' : '#e9d7ac';
            ctx.font = 'bold 15px Georgia, serif';
            ctx.fillText(String(i + 1), r.x + pad + 12.5, r.y + pad + 13);
            ctx.textAlign = 'left';
            ctx.fillStyle = '#c2b28e';
            ctx.font = '11px Georgia, serif';
            if (!tight) ctx.fillText(TYPES[option.type] || 'UPGRADE', r.x + pad + 36, r.y + pad + 13);
            const textX = r.x + pad + (compact ? 38 : 0);
            const textWidth = r.w - pad * 2 - (compact ? 38 : 0);
            // Icon medallion, top-right
            const iconR = compact ? 16 : 26;
            this.drawIcon(ctx, option, r.x + r.w - pad - iconR, r.y + pad + iconR - (compact ? 2 : 0), iconR, rarityColor);
            const nameWidth = textWidth - iconR * 2 - 8;

            ctx.fillStyle = '#f0e8d6';
            ctx.font = `bold ${compact ? 17 : 23}px Georgia, serif`;
            const nameY = compact ? r.y + (tight ? 23 : 49) : r.y + 68;
            this.text(ctx, this.cleanName(option.name), textX, nameY, nameWidth, 25, compact ? 1 : 2);
            ctx.fillStyle = '#d0c9bb';
            ctx.font = `${tight ? 12 : 14}px Georgia, serif`;
            const descY = compact ? nameY + 22 : r.y + 122;
            this.text(ctx, this.describe(option), textX, descY, textWidth, 20, compact ? 1 : 2);
            const fit = option.rarity?.id === 'legendary' ? 'Evolution ready' : `Build fit: ${option.rarity?.name || 'Common'}`;
            ctx.fillStyle = option.rarity?.color || '#bcb5a7';
            ctx.font = '12px Georgia, serif';
            if (!compact) {
                ctx.fillText(fit, textX, r.y + r.h - 54);
                ctx.fillStyle = '#bfb59f';
                ctx.font = '12px Georgia, serif';
                this.text(ctx, this.buildNote(option), textX, r.y + r.h - 30, textWidth, 16, 2);
            } else {
                ctx.fillText(fit, textX, r.y + r.h - 14);
            }
            ctx.restore();
        });
        ctx.textAlign = 'center';
        ctx.fillStyle = '#c7bda8';
        ctx.font = '13px Georgia, serif';
        if (w < 600) {
            ctx.fillText(`Click a choice or press 1–${rects.length}`, w / 2, this.bottom + 24);
            ctx.fillText('Build fit is advice, not a stat bonus', w / 2, this.bottom + 43);
        } else {
            ctx.fillText(`Click a choice or press 1–${rects.length}  ·  Build fit is advice, not a stat bonus`, w / 2, this.bottom + 30);
        }
        ctx.restore();
    }
}
