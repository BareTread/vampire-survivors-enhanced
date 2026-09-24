/**
 * FloorItemSystem — World-space collectible drops beyond XP gems & gold.
 *
 * Item types:
 *   health_orb     — Restores 15–25 % HP. Drops from elites/berserkers at a modest rate.
 *   vacuum         — Instantly pulls all gems to player. Rare elite drop, boss reward.
 *   rosary         — Destroys all on-screen enemies. Very rare elite drop.
 *   treasure_chest — Guaranteed boss drop. Opens for gold burst, stat boost, or weapon level.
 *
 * Integration points:
 *   • Enemy.die()   calls game.systems.floorItems.onEnemyDeath(enemy)
 *   • BossSystem    calls game.systems.floorItems.onBossDeath(x, y)
 *   • VampireSurvivorsGame wires update/render/reset in the game loop
 *
 * Visuals: every item is an outlined baked sprite in the shared CharacterArt
 * style. Chests play an opening sequence (lid pops, light beam, coin
 * fountain) with a reward banner rendered in screen space by renderOverlay().
 */
import { bakeSprite } from '../entities/rendering/CharacterArt.js';

const ITEM_PAINTERS = {
    // Iron-banded oak chest; `open` 0..1 swings the lid back
    treasure_chest(ctx, open = 0) {
        const w = 16;
        const h = 11;
        // Body
        ctx.fillStyle = '#6a3e1e';
        ctx.fillRect(-w, -h, w * 2, h);
        ctx.fillStyle = '#4a2a14';
        ctx.fillRect(-w, -h * 0.35, w * 2, h * 0.35);
        // Planks
        ctx.strokeStyle = '#3a200e';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-w, -h * 0.66); ctx.lineTo(w, -h * 0.66);
        ctx.stroke();
        // Gold bands + lock plate
        ctx.fillStyle = '#d8a83a';
        ctx.fillRect(-w * 0.72, -h, 4, h);
        ctx.fillRect(w * 0.72 - 4, -h, 4, h);
        ctx.fillRect(-3.5, -h * 0.8, 7, 7);
        ctx.fillStyle = '#3a200e';
        ctx.fillRect(-1, -h * 0.62, 2, 3);
        // Lid (hinged at the back edge, y = -h)
        ctx.save();
        ctx.translate(0, -h);
        ctx.scale(1, 1 - open * 1.6);
        ctx.fillStyle = '#7a4a24';
        ctx.beginPath();
        ctx.moveTo(-w, 0);
        ctx.lineTo(-w, -5);
        ctx.quadraticCurveTo(0, -12, w, -5);
        ctx.lineTo(w, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#e6b84a';
        ctx.fillRect(-w * 0.72, -9, 4, 9);
        ctx.fillRect(w * 0.72 - 4, -9, 4, 9);
        ctx.restore();
        if (open > 0.2) {
            // Treasure glow spilling out
            ctx.fillStyle = `rgba(255, 220, 120, ${0.8 * open})`;
            ctx.fillRect(-w + 2, -h - 2, w * 2 - 4, 3);
        }
    },
    // Glowing heart-shaped blood crystal
    health_orb(ctx) {
        ctx.fillStyle = '#b01c2c';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-13, -8, -8, -20, 0, -13);
        ctx.bezierCurveTo(8, -20, 13, -8, 0, 0);
        ctx.fill();
        ctx.fillStyle = '#ff5a6a';
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.bezierCurveTo(-9, -9, -6, -17, 0, -12);
        ctx.bezierCurveTo(1, -9, 0, -6, 0, -3);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(-4, -13, 1.8, 0, Math.PI * 2);
        ctx.fill();
    },
    // Horseshoe magnet
    vacuum(ctx) {
        ctx.lineCap = 'butt';
        ctx.strokeStyle = '#c8303a';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, -10, 7, Math.PI * 0.05, Math.PI * 0.95, true);
        ctx.stroke();
        ctx.fillStyle = '#e8e8f0';
        ctx.fillRect(-10, -12, 6, 6);
        ctx.fillRect(4, -12, 6, 6);
        ctx.fillStyle = '#ffd24a';
        ctx.fillRect(-10, -12, 6, 2);
        ctx.fillRect(4, -12, 6, 2);
    },
    // Silver cross with prayer beads
    rosary(ctx) {
        ctx.fillStyle = '#d9d0ff';
        for (let i = 0; i < 9; i++) {
            const a = Math.PI * (0.15 + i * 0.09);
            ctx.beginPath();
            ctx.arc(Math.cos(a) * 9, -16 + Math.sin(a) * -6 + 6, 1.4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = '#eef0ff';
        ctx.fillRect(-2, -18, 4, 18);
        ctx.fillRect(-7, -13, 14, 4);
        ctx.fillStyle = '#b8b0e8';
        ctx.fillRect(-2, -18, 1.5, 18);
    }
};
const ITEM_BOX = {
    treasure_chest: { l: -18, r: 18, t: -34, b: 2 },
    health_orb: { l: -14, r: 14, t: -22, b: 2 },
    vacuum: { l: -14, r: 14, t: -24, b: 2 },
    rosary: { l: -12, r: 12, t: -24, b: 2 }
};

export class FloorItemSystem {
    constructor(game) {
        this.game = game;
        this.items   = [];
        this.maxItems = 20; // cap to prevent visual clutter

        // Collection radius (world px)
        this.collectRange = 32;

        // Chest opening sequences + reward banner
        this.chestFx = [];
        this.banner = null;
        this._sprites = new Map();
    }

    _itemSprite(type, open = 0) {
        const key = `${type}|${open}`;
        let spr = this._sprites.get(key);
        if (spr !== undefined) return spr;
        const paint = ITEM_PAINTERS[type];
        spr = paint ? bakeSprite(ITEM_BOX[type], (ctx) => paint(ctx, open / 4), { outline: 1.4 }) : null;
        this._sprites.set(key, spr);
        return spr;
    }

    // ── Static item definitions ─────────────────────────────────────────────
    getItemDef(type) {
        const defs = {
            health_orb:     { color: '#44FF88', glow: 'rgba(68,255,136,0.55)',  size: 10, symbol: '♥', label: 'Health Orb'  },
            vacuum:         { color: '#FFD700', glow: 'rgba(255,215,0,0.55)',   size: 11, symbol: '◎', label: 'Vacuum'      },
            rosary:         { color: '#E8E8FF', glow: 'rgba(200,200,255,0.65)', size: 11, symbol: '✦', label: 'Rosary'      },
            treasure_chest: { color: '#DAA520', glow: 'rgba(218,165,32,0.55)', size: 15, symbol: '⊞', label: 'Chest'       }
        };
        return defs[type] || null;
    }

    // ── Apply collected item effect ────────────────────────────────────────
    applyItem(type, player, at = null) {
        switch (type) {
            case 'health_orb': {
                const heal = Math.round(player.maxHealth * (0.15 + Math.random() * 0.10));
                player.health = Math.min(player.maxHealth, player.health + heal);
                player.addDamageNumber(`+${heal} HP`, '#44FF88', '');
                if (this.game.camera) this.game.camera.shake(2, 0.15);
                break;
            }

            case 'vacuum': {
                const exp = this.game.systems.experience;
                if (exp) {
                    exp.magnetizeAllGems();
                    if (exp.activateGlobalMagnet) exp.activateGlobalMagnet(3.0);
                }
                player.callout?.('VACUUM', '#FFD700', 2);
                break;
            }

            case 'rosary': {
                const bounds = this.game.camera ? this.game.camera.getWorldBounds(50) : null;
                let killed = 0;
                for (const enemy of this.game.systems.enemy.activeEnemies) {
                    if (!enemy.active || enemy._deathProcessed) continue;
                    if (enemy.isBoss) continue; // bosses immune to rosary
                    if (
                        bounds &&
                        (enemy.x < bounds.left || enemy.x > bounds.right ||
                         enemy.y < bounds.top  || enemy.y > bounds.bottom)
                    ) continue;
                    enemy.takeDamage(999999, this, false);
                    killed++;
                }
                player.callout?.('HOLY SMITE', '#F0F0FF', 3);
                if (this.game.camera) this.game.camera.shake(10, 0.5);
                // White screen flash
                if (this.game.camera && this.game.camera.flash)
                    this.game.camera.flash('rgba(255,255,255,0.6)', 0.35);
                break;
            }

            case 'treasure_chest':
                this._openChest(player, at);
                break;
        }

        this._spawnCollectParticles(player.x, player.y, type);

        // Brief audio cue (non-fatal if audioManager absent)
        try {
            if (this.game.audioManager && this.game.audioManager.playVampireSound)
                this.game.audioManager.playVampireSound('powerUpCollect', 0.5, 1.0);
        } catch (_) { /* silent */ }
    }

    // ── Chest reward (random outcome) ────────────────────────────────────
    _openChest(player, at = null) {
        const roll = Math.random();
        const gold = this.game.systems.gold;
        const cam  = this.game.camera;
        const fx = { x: at ? at.x : player.x, y: at ? at.y : player.y, t: 0 };
        this.chestFx.push(fx);
        const reward = (title, line, color) => {
            this.banner = { title, line, color, t: 0 };
        };
        try {
            this.game.audioManager?.playVampireSound?.('victoryFanfare', 0.55, 1.1);
        } catch (_) { /* silent */ }

        if (roll < 0.55 && gold) {
            // Gold burst: scatter coins at player position
            const value = 80 + Math.floor(Math.random() * 120);
            for (let i = 0; i < 8; i++) {
                gold.spawnCoin(
                    player.x + (Math.random() - 0.5) * 40,
                    player.y + (Math.random() - 0.5) * 40,
                    Math.ceil(value / 8)
                );
            }
            reward('TREASURE', `+${value} gold`, '#FFD24A');
        } else if (roll < 0.82) {
            // Random stat upgrade
            const stats = ['damage', 'speed', 'health', 'luck', 'area', 'cooldown'];
            const stat  = stats[Math.floor(Math.random() * stats.length)];
            this.game.applyStatUpgrade(stat);
            const statNames = { damage: 'Might', speed: 'Swiftness', health: 'Vitality', luck: 'Fortune', area: 'Reach', cooldown: 'Haste' };
            reward('RELIC FOUND', `${statNames[stat] || stat} blessing`, '#C8A0FF');
        } else {
            // Free weapon level (random non-evolved weapon that isn't max level)
            const weapons = Array.from(player.weapons.values())
                .filter(w => !w.evolved && w.level < w.maxLevel);
            if (weapons.length > 0) {
                const w = weapons[Math.floor(Math.random() * weapons.length)];
                this.game.player.upgradeWeapon(w.id);
                reward('EMPOWERED', `${w.name} rises to level ${w.level}`, '#7CF2FF');
            } else {
                // Fallback: gold
                if (gold) {
                    for (let i = 0; i < 5; i++)
                        gold.spawnCoin(player.x, player.y, 30);
                }
                reward('TREASURE', '+150 gold', '#FFD24A');
            }
        }

        if (cam) cam.shake(6, 0.3);
    }

    // ── Drop hooks called by Enemy / BossSystem ──────────────────────────
    onEnemyDeath(enemy) {
        if (this.items.length >= this.maxItems) return;
        if (!['elite', 'berserker', 'juggernaut', 'summoner'].includes(enemy.type)) return;

        // Aura carriers are still rewarding, but less likely to snowball a run.
        if (enemy.auraType && Math.random() < 0.35) {
            this.spawnItem(enemy.x, enemy.y, 'treasure_chest');
            return;
        }

        const roll = Math.random();
        if      (roll < 0.002) this.spawnItem(enemy.x, enemy.y, 'rosary');
        else if (roll < 0.035) this.spawnItem(enemy.x, enemy.y, 'vacuum');
        else if (roll < 0.140) this.spawnItem(enemy.x, enemy.y, 'health_orb');
    }

    onBossDeath(bossX, bossY) {
        this.spawnItem(bossX,      bossY, 'treasure_chest');
        this.spawnItem(bossX + 55, bossY, 'health_orb');
        this.spawnItem(bossX - 55, bossY, 'vacuum');
    }

    spawnItem(x, y, type) {
        if (this.items.length >= this.maxItems) return;
        if (!this.getItemDef(type)) return;
        this.items.push({
            x, y, type,
            bobOffset: Math.random() * Math.PI * 2,
            age: 0,
            active: true
        });
    }

    // ── Game loop ─────────────────────────────────────────────────────────
    update(dt) {
        for (let i = this.chestFx.length - 1; i >= 0; i--) {
            this.chestFx[i].t += dt;
            if (this.chestFx[i].t > 2.2) this.chestFx.splice(i, 1);
        }
        if (this.banner) {
            this.banner.t += dt;
            if (this.banner.t > 2.6) this.banner = null;
        }
        if (!this.game.player || !this.game.player.isAlive()) return;
        const player = this.game.player;
        const collectRangeSq = this.collectRange * this.collectRange;

        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            item.age += dt;

            const dx = player.x - item.x;
            const dy = player.y - item.y;

            if (dx * dx + dy * dy <= collectRangeSq) {
                this.applyItem(item.type, player, item);
                this.items.splice(i, 1);
            }
        }
    }

    render(ctx) {
        const now = performance.now() * 0.001;

        for (const item of this.items) {
            const def = this.getItemDef(item.type);
            if (!def) continue;

            const bob = Math.sin(now * 2.2 + item.bobOffset) * 2.5;
            const pulse = 0.5 + 0.5 * Math.sin(now * 3.0 + item.bobOffset);
            const spawnPop = Math.min(1, item.age / 0.25);

            ctx.save();

            // Soft light pool on the floor
            const glowR = def.size * 2.4;
            const g = ctx.createRadialGradient(item.x, item.y, 0, item.x, item.y, glowR);
            g.addColorStop(0, def.glow.replace(/[\d.]+\)$/, `${0.35 + pulse * 0.25})`));
            g.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(item.x, item.y, glowR, glowR * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Chests call to the player with a slow rising beam
            if (item.type === 'treasure_chest') {
                ctx.globalCompositeOperation = 'lighter';
                const beam = ctx.createLinearGradient(0, item.y - 120, 0, item.y);
                beam.addColorStop(0, 'rgba(255, 210, 110, 0)');
                beam.addColorStop(1, `rgba(255, 210, 110, ${0.12 + pulse * 0.1})`);
                ctx.fillStyle = beam;
                ctx.fillRect(item.x - 10, item.y - 120, 20, 120);
                ctx.globalCompositeOperation = 'source-over';
            }

            const spr = this._itemSprite(item.type, 0);
            if (spr) {
                ctx.translate(item.x, item.y + bob * (item.type === 'treasure_chest' ? 0.2 : 1));
                ctx.scale(spawnPop, spawnPop);
                ctx.drawImage(spr.canvas, -spr.ax, -spr.ay, spr.w, spr.h);
            } else {
                ctx.beginPath();
                ctx.arc(item.x, item.y + bob, def.size, 0, Math.PI * 2);
                ctx.fillStyle = def.color;
                ctx.fill();
            }

            ctx.restore();
        }

        this._renderChestFx(ctx);
    }

    /** Opening chest: lid swings, a golden beam erupts, coins fountain up. */
    _renderChestFx(ctx) {
        for (const fx of this.chestFx) {
            const t = fx.t;
            const open = Math.min(4, Math.floor(Math.min(1, t / 0.35) * 4));
            const fade = t < 1.6 ? 1 : Math.max(0, 1 - (t - 1.6) / 0.6);
            ctx.save();
            ctx.globalAlpha = fade;

            // Beam
            ctx.globalCompositeOperation = 'lighter';
            const bh = 60 + Math.min(1, t / 0.3) * 220;
            const bw = 14 + Math.sin(t * 20) * 2;
            const beam = ctx.createLinearGradient(0, fx.y - bh, 0, fx.y);
            beam.addColorStop(0, 'rgba(255, 230, 150, 0)');
            beam.addColorStop(0.6, 'rgba(255, 210, 110, 0.35)');
            beam.addColorStop(1, 'rgba(255, 245, 210, 0.7)');
            ctx.fillStyle = beam;
            ctx.fillRect(fx.x - bw, fx.y - bh, bw * 2, bh);

            // Coin fountain (deterministic arcs so no per-frame allocation)
            for (let i = 0; i < 14; i++) {
                const ang = -Math.PI / 2 + (i / 13 - 0.5) * 1.6;
                const sp = 120 + (i * 37 % 60);
                const ct = Math.max(0, t - 0.15 - (i % 5) * 0.05);
                const cx = fx.x + Math.cos(ang) * sp * ct;
                const cy = fx.y - 14 + Math.sin(ang) * sp * ct + 260 * ct * ct;
                if (cy > fx.y + 6) continue;
                ctx.fillStyle = i % 3 === 0 ? '#fff4c0' : '#ffcc40';
                ctx.beginPath();
                ctx.ellipse(cx, cy, 2.6, 2.6 * Math.abs(Math.cos(t * 12 + i)), 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalCompositeOperation = 'source-over';

            const spr = this._itemSprite('treasure_chest', open);
            if (spr) ctx.drawImage(spr.canvas, fx.x - spr.ax, fx.y - spr.ay, spr.w, spr.h);
            ctx.restore();
        }
    }

    /** Screen-space reward banner for the latest chest. */
    renderOverlay(ctx) {
        const b = this.banner;
        if (!b || b.t < 0.3) return;
        const t = b.t - 0.3;
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const inT = Math.min(1, t / 0.25);
        const outT = t > 1.9 ? Math.min(1, (t - 1.9) / 0.4) : 0;
        const alpha = inT * (1 - outT);
        const scale = 0.8 + 0.2 * (1 - Math.pow(1 - inT, 3));
        const y = h * 0.3;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(w / 2, y);
        ctx.scale(scale, scale);

        const bandW = Math.min(520, w * 0.8);
        const band = ctx.createLinearGradient(-bandW / 2, 0, bandW / 2, 0);
        band.addColorStop(0, 'rgba(10, 6, 14, 0)');
        band.addColorStop(0.2, 'rgba(10, 6, 14, 0.82)');
        band.addColorStop(0.8, 'rgba(10, 6, 14, 0.82)');
        band.addColorStop(1, 'rgba(10, 6, 14, 0)');
        ctx.fillStyle = band;
        ctx.fillRect(-bandW / 2, -36, bandW, 72);
        ctx.fillStyle = 'rgba(216, 180, 106, 0.6)';
        ctx.fillRect(-bandW * 0.35, -36, bandW * 0.7, 1);
        ctx.fillRect(-bandW * 0.35, 35, bandW * 0.7, 1);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = "bold 30px 'Cinzel', Georgia, serif";
        ctx.lineJoin = 'round';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(8, 4, 8, 0.9)';
        ctx.strokeText(b.title, 0, -10);
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 16;
        ctx.fillStyle = b.color;
        ctx.fillText(b.title, 0, -10);
        ctx.shadowBlur = 0;
        ctx.font = '15px Georgia, serif';
        ctx.fillStyle = '#efe4c8';
        ctx.fillText(b.line, 0, 20);
        ctx.restore();
    }

    _spawnCollectParticles(x, y, type) {
        const ps  = this.game.systems.particle;
        if (!ps) return;
        const def = this.getItemDef(type);
        const col = def ? def.color : '#FFD700';
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            ps.create(x, y, {
                vx: Math.cos(angle) * (60 + Math.random() * 40),
                vy: Math.sin(angle) * (60 + Math.random() * 40),
                life: 0.4 + Math.random() * 0.2,
                size: 2 + Math.random() * 2,
                color: col,
                fadeOut: true
            });
        }
    }

    reset() {
        this.items = [];
        this.chestFx = [];
        this.banner = null;
    }
}
