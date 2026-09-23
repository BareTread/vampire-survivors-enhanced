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

    render(ctx) {
        const { width: w, height: h } = this.game.canvas;
        const rects = this.layout();
        const compact = this.compact;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(7, 10, 13, 0.94)';
        ctx.fillRect(0, 0, w, h);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#eee4cf';
        ctx.font = `bold ${compact ? 30 : 44}px Georgia, serif`;
        ctx.fillText('Choose your power', w / 2, compact ? 34 : 66);
        ctx.fillStyle = '#c7bda8';
        ctx.font = '14px Georgia, serif';
        ctx.fillText(`Level ${this.game.player.level}  ·  The hunt waits for your decision`, w / 2, compact ? 66 : 108, w - 24);

        this.game.levelUpOptions.forEach((option, i) => {
            const r = rects[i];
            const selected = this.game._levelUpHoveredIndex === i;
            const pad = compact ? 14 : 22;
            const tight = compact && r.h < 106;
            ctx.fillStyle = selected ? '#2b302f' : '#171d20';
            ctx.fillRect(r.x, r.y, r.w, r.h);
            ctx.strokeStyle = selected ? '#dbb76e' : '#525653';
            ctx.lineWidth = selected ? 2 : 1;
            ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
            // Small corner cuts frame a stone tablet without noisy ornament.
            ctx.strokeStyle = selected ? '#e8cd90' : '#917c56';
            ctx.beginPath();
            ctx.moveTo(r.x, r.y + 8); ctx.lineTo(r.x, r.y); ctx.lineTo(r.x + 12, r.y);
            ctx.moveTo(r.x + r.w - 12, r.y + r.h); ctx.lineTo(r.x + r.w, r.y + r.h); ctx.lineTo(r.x + r.w, r.y + r.h - 8);
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.fillStyle = selected ? '#dbb76e' : '#323a3b';
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
            ctx.fillStyle = '#f0e8d6';
            ctx.font = `bold ${compact ? 17 : 23}px Georgia, serif`;
            const nameY = compact ? r.y + (tight ? 23 : 49) : r.y + 68;
            this.text(ctx, option.name, textX, nameY, textWidth, 25, compact ? 1 : 2);
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
