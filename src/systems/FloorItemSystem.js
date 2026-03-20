/**
 * FloorItemSystem — World-space collectible drops beyond XP gems & gold.
 *
 * Item types:
 *   health_orb     — Restores 15–25 % HP. Drops from elites/berserkers at ~20 %.
 *   vacuum         — Instantly pulls all gems to player. ~6 % from elites.
 *   rosary         — Destroys all on-screen enemies. ~0.5 % elite drop, boss-guaranteed.
 *   treasure_chest — Guaranteed boss drop. Opens for gold burst, stat boost, or weapon level.
 *
 * Integration points:
 *   • Enemy.die()   calls game.systems.floorItems.onEnemyDeath(enemy)
 *   • BossSystem    calls game.systems.floorItems.onBossDeath(x, y)
 *   • VampireSurvivorsGame wires update/render/reset in the game loop
 */
export class FloorItemSystem {
    constructor(game) {
        this.game = game;
        this.items   = [];
        this.maxItems = 20; // cap to prevent visual clutter

        // Collection radius (world px)
        this.collectRange = 32;
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
    applyItem(type, player) {
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
                player.addDamageNumber('VACUUM!', '#FFD700', '');
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
                player.addDamageNumber('HOLY SMITE!', '#F0F0FF', '');
                if (this.game.camera) this.game.camera.shake(10, 0.5);
                // White screen flash
                if (this.game.camera && this.game.camera.flash)
                    this.game.camera.flash('rgba(255,255,255,0.6)', 0.35);
                break;
            }

            case 'treasure_chest':
                this._openChest(player);
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
    _openChest(player) {
        const roll = Math.random();
        const gold = this.game.systems.gold;
        const cam  = this.game.camera;

        if (roll < 0.38 && gold) {
            // Gold burst: scatter coins at player position
            const value = 80 + Math.floor(Math.random() * 120);
            for (let i = 0; i < 8; i++) {
                gold.spawnCoin(
                    player.x + (Math.random() - 0.5) * 40,
                    player.y + (Math.random() - 0.5) * 40,
                    Math.ceil(value / 8)
                );
            }
            player.addDamageNumber(`+${value} Gold`, '#FFD700', '');
        } else if (roll < 0.70) {
            // Random stat upgrade
            const stats = ['damage', 'speed', 'health', 'luck', 'area', 'cooldown'];
            const stat  = stats[Math.floor(Math.random() * stats.length)];
            this.game.applyStatUpgrade(stat);
            player.addDamageNumber('STAT BOOST!', '#AA88FF', '');
        } else {
            // Free weapon level (random non-evolved weapon that isn't max level)
            const weapons = Array.from(player.weapons.values())
                .filter(w => !w.evolved && w.level < w.maxLevel);
            if (weapons.length > 0) {
                const w = weapons[Math.floor(Math.random() * weapons.length)];
                this.game.player.upgradeWeapon(w.id);
                player.addDamageNumber(`${w.name} LEVEL UP!`, '#00FFFF', '');
            } else {
                // Fallback: gold
                if (gold) {
                    for (let i = 0; i < 5; i++)
                        gold.spawnCoin(player.x, player.y, 30);
                }
                player.addDamageNumber('+150 Gold', '#FFD700', '');
            }
        }

        if (cam) cam.shake(6, 0.3);
    }

    // ── Drop hooks called by Enemy / BossSystem ──────────────────────────
    onEnemyDeath(enemy) {
        if (this.items.length >= this.maxItems) return;
        if (!['elite', 'berserker', 'juggernaut', 'summoner'].includes(enemy.type)) return;

        // Aura carriers guaranteed chest (flag set in EnemySystem)
        if (enemy.auraType && Math.random() < 0.5) {
            this.spawnItem(enemy.x, enemy.y, 'treasure_chest');
            return;
        }

        const roll = Math.random();
        if      (roll < 0.005) this.spawnItem(enemy.x, enemy.y, 'rosary');
        else if (roll < 0.060) this.spawnItem(enemy.x, enemy.y, 'vacuum');
        else if (roll < 0.220) this.spawnItem(enemy.x, enemy.y, 'health_orb');
    }

    onBossDeath(bossX, bossY) {
        this.spawnItem(bossX,      bossY, 'treasure_chest');
        this.spawnItem(bossX + 55, bossY, 'health_orb');
        this.spawnItem(bossX - 55, bossY, 'rosary');
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
        if (!this.game.player || !this.game.player.isAlive()) return;
        const player = this.game.player;
        const collectRangeSq = this.collectRange * this.collectRange;

        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            item.age += dt;

            const dx = player.x - item.x;
            const dy = player.y - item.y;

            if (dx * dx + dy * dy <= collectRangeSq) {
                this.applyItem(item.type, player);
                this.items.splice(i, 1);
            }
        }
    }

    render(ctx) {
        const now = performance.now() * 0.001;

        for (const item of this.items) {
            const def = this.getItemDef(item.type);
            if (!def) continue;

            const bobY   = Math.sin(now * 2.2 + item.bobOffset) * 3;
            const glow   = 10 + Math.sin(now * 3.0 + item.bobOffset) * 4;
            const iy     = item.y + bobY;

            ctx.save();

            // Outer glow ring
            ctx.shadowColor = def.glow;
            ctx.shadowBlur  = glow;

            // Circle body
            ctx.beginPath();
            ctx.arc(item.x, iy, def.size, 0, Math.PI * 2);
            ctx.fillStyle = def.color;
            ctx.fill();

            // Symbol text
            ctx.shadowBlur  = 0;
            ctx.fillStyle   = '#FFFFFF';
            ctx.font        = `bold ${Math.round(def.size * 1.3)}px Arial`;
            ctx.textAlign   = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(def.symbol, item.x, iy);

            ctx.restore();
        }
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
    }
}
