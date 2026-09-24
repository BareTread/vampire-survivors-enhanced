import { globalDamageNumberPool } from '../core/DamageNumberPool.js';

/**
 * GoldSystem — Gold currency that drops from enemies and persists between runs.
 *
 * Features:
 *  - Enemies have a chance to drop gold coins (separate from XP gems)
 *  - Gold coins are world-space entities that get collected on proximity
 *  - Gold persists between runs via PersistenceSystem
 *  - HUD shows current run gold earned
 *  - Elite/boss enemies drop more gold
 *
 * Wire into VampireSurvivorsGame.systems.gold.
 */
export class GoldSystem {
    constructor(game) {
        this.game = game;

        // Gold drops in the world
        this.coins = [];
        this.maxCoins = 50;

        // Run tracking
        this.runGold = 0;

        // Conservation ledger (raw fields; public telemetry lands in phase 5)
        this.droppedGold = 0;
        this.collectedGold = 0;

        // Collection settings
        this.collectRange = 40;
        this.magnetRange = 100;

        // Drop chances
        this.baseDropChance = 0.08; // 8% base chance per enemy kill
        this.eliteDropMultiplier = 3;
        this.bossDropMultiplier = 10;
    }

    /**
     * Called when an enemy dies. May spawn a gold coin.
     */
    onEnemyKilled(enemy) {
        const waveNumber = this.game.systems?.enemy?.currentWave || 1;
        let chance = 0.03 + Math.min(waveNumber * 0.01, 0.15);
        let goldValue = 1 + Math.floor(Math.random() * 3); // 1-3 base

        // Gold gain modifier from persistence upgrades
        const persistence = this.game.systems.persistence;
        let goldMultiplier = 1;
        if (persistence) {
            const mods = persistence.getUpgradeModifiers();
            goldMultiplier = mods.goldGain || 1;
        }

        if (enemy.type === 'elite') {
            chance *= this.eliteDropMultiplier;
            goldValue = 3 + Math.floor(Math.random() * 5); // 3-7
        } else if (enemy.isBoss || enemy.type === 'boss') {
            chance = 1.0; // Guaranteed
            goldValue = 20 + Math.floor(Math.random() * 30); // 20-50
        }

        const waveScale = 1 + Math.min((waveNumber - 1) * 0.03, 0.5);
        goldValue = Math.floor(goldValue * waveScale * goldMultiplier);

        if (Math.random() < chance && this.coins.length < this.maxCoins) {
            this.spawnCoin(enemy.x, enemy.y, goldValue);
        }
    }

    spawnCoin(x, y, value) {
        this.droppedGold += value;
        this.coins.push({
            x: x + (Math.random() - 0.5) * 20,
            y: y + (Math.random() - 0.5) * 20,
            value,
            lifetime: 15, // seconds before despawn
            magnetized: false,
            claimed: false, // vacuum claim: homes until collected, never expires
            claimAge: 0,
            vx: (Math.random() - 0.5) * 60, // Initial scatter velocity
            vy: -30 - Math.random() * 40, // Pop upward
            bobPhase: Math.random() * Math.PI * 2
        });
    }

    /**
     * Vacuum-style claim: mark every unclaimed coin claimed. Claimed coins
     * home to the player with ramping speed until collected and cannot
     * expire. Idempotent — already claimed coins are not counted twice.
     * @returns {{count: number, gold: number}} newly claimed count and the
     *   gold the haul will pay out (collection multiplier applied, matching
     *   collectCoin)
     */
    claimAllCoins() {
        const challengeMult = this.game.systems?.challenge?.getGoldMultiplier() || 1;
        let count = 0;
        let gold = 0;
        for (const coin of this.coins) {
            if (coin.claimed) continue;
            coin.claimed = true;
            coin.claimAge = 0;
            coin.magnetized = true;
            count++;
            gold += Math.floor(coin.value * challengeMult);
        }
        return { count, gold };
    }

    update(dt) {
        const player = this.game.player;
        if (!player || !player.isAlive()) return;

        // Read Attractorb range bonus (additive: 0.25 per level → multiplier = 1 + bonus)
        let pickupBonus = 1;
        if (this.game.systems && this.game.systems.passiveItems) {
            const mods = this.game.systems.passiveItems.getStatModifiers();
            pickupBonus = 1 + (mods.pickupRange || 0);
        }
        const effectiveCollect = this.collectRange * pickupBonus;
        const effectiveMagnet = this.magnetRange * pickupBonus;

        // Magnetic Field / global magnet attract gold too (XP + gold only).
        // Attraction is not a claim — unclaimed coins can still expire.
        const exp = this.game.systems && this.game.systems.experience;
        const globalPull = !!(exp && exp.globalMagnetTimer > 0);
        const fieldRadius =
            exp && exp.areaMagnetTimer > 0 ? exp.areaMagnetRadius || 0 : 0;

        for (let i = this.coins.length - 1; i >= 0; i--) {
            const coin = this.coins[i];

            // Distance to player
            const dx = player.x - coin.x;
            const dy = player.y - coin.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (coin.claimed) {
                // Claimed coins home with ramping speed, independent of
                // expiry and magnet timers, until collected.
                coin.claimAge += dt;
                coin.magnetized = true;
                if (dist > 1) {
                    const ramp = Math.min(1, coin.claimAge / 1.5);
                    const speed = Math.min(300 * (1 + ramp * 4), dist / Math.max(0.001, dt));
                    coin.x += (dx / dist) * speed * dt;
                    coin.y += (dy / dist) * speed * dt;
                }
            } else {
                // Lifetime (claimed coins are exempt — they cannot expire)
                coin.lifetime -= dt;
                if (coin.lifetime <= 0) {
                    this.coins.splice(i, 1);
                    continue;
                }

                // Apply scatter velocity with damping
                coin.x += coin.vx * dt;
                coin.y += coin.vy * dt;
                coin.vx *= 0.95;
                coin.vy *= 0.95;
                coin.vy += 60 * dt; // Gravity

                // Bob animation
                coin.bobPhase += dt * 3;

                // Magnet pull: base range, Magnetic Field radius, or global
                // magnet (all coins, fast enough to arrive before it ends)
                let pull = 0;
                if (globalPull) {
                    pull = Math.max(300, dist / Math.max(0.3, (exp.globalMagnetTimer || 0) * 0.85));
                } else {
                    const range = Math.max(effectiveMagnet, fieldRadius);
                    if (dist < range) {
                        pull = Math.max((1 - dist / range) * 300, 150);
                    }
                }
                if (pull > 0 && dist > 1) {
                    coin.x += (dx / dist) * pull * dt;
                    coin.y += (dy / dist) * pull * dt;
                    coin.magnetized = true;
                } else {
                    coin.magnetized = false;
                }
            }

            // Collection
            if (dist < effectiveCollect) {
                this.collectCoin(coin);
                this.coins.splice(i, 1);
            }
        }
    }

    collectCoin(coin) {
        const challengeMult = this.game.systems?.challenge?.getGoldMultiplier() || 1;
        const gainedGold = Math.floor(coin.value * challengeMult);
        this.runGold += gainedGold;
        this.collectedGold += gainedGold;

        // Visual feedback
        if (globalDamageNumberPool) {
            globalDamageNumberPool.spawn(coin.x, coin.y - 10, `+${gainedGold}G`, '#FFD700', 'GOLD');
        }

        // Audio
        if (this.game.audioManager) {
            this.game.audioManager.playVampireSound('experienceGain', 0.3, 1.4);
        }
    }

    /**
     * Baked coin (glow + body + highlight). shadowBlur per coin per frame
     * was one of the most expensive calls in a busy scene; the glow is
     * identical every frame, so paint it once. Supersampled 2x.
     */
    static coinSprite(magnetized) {
        const cache = GoldSystem._coinSprites || (GoldSystem._coinSprites = {});
        const k = magnetized ? 'm' : 'n';
        if (cache[k] !== undefined) return cache[k];
        if (typeof document === 'undefined') return (cache[k] = null);
        const SS = 2;
        const half = 18; // world units from center to edge
        const c = document.createElement('canvas');
        c.width = c.height = half * 2 * SS;
        const g = c.getContext('2d');
        if (!g) return (cache[k] = null);
        g.scale(SS, SS);
        g.translate(half, half);
        // Blur is in device pixels; world glow ≈ blur / typical zoom (1.33)
        g.shadowColor = '#FFD700';
        g.shadowBlur = (magnetized ? 12 : 6) * SS / 1.33;
        g.fillStyle = '#FFD700';
        g.beginPath();
        g.arc(0, 0, 5, 0, Math.PI * 2);
        g.fill();
        g.shadowBlur = 0;
        g.shadowColor = 'transparent';
        g.fillStyle = '#FFEE88';
        g.beginPath();
        g.arc(-1, -1, 2, 0, Math.PI * 2);
        g.fill();
        return (cache[k] = { canvas: c, half });
    }

    render(ctx) {
        for (const coin of this.coins) {
            const bob = Math.sin(coin.bobPhase) * 2;
            const fadeAlpha = coin.lifetime < 2 ? coin.lifetime / 2 : 1;
            const drawY = coin.y + bob;
            const sprite = GoldSystem.coinSprite(!!coin.magnetized);

            if (sprite) {
                const prev = ctx.globalAlpha;
                ctx.globalAlpha = prev * fadeAlpha;
                ctx.drawImage(sprite.canvas, coin.x - sprite.half, drawY - sprite.half, sprite.half * 2, sprite.half * 2);
                ctx.globalAlpha = prev;
                continue;
            }

            ctx.save();
            ctx.globalAlpha = fadeAlpha;

            // Gold glow
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = coin.magnetized ? 12 : 6;

            // Coin body
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(coin.x, drawY, 5, 0, Math.PI * 2);
            ctx.fill();

            // Coin highlight
            ctx.fillStyle = '#FFEE88';
            ctx.beginPath();
            ctx.arc(coin.x - 1, drawY - 1, 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    /**
     * Render HUD gold counter (screen-space).
     * Suppressed when CanvasHUD is active — it renders gold in the Economy Panel.
     */
    renderHUD(ctx) {
        // CanvasHUD handles gold display when present
        if (this.game.systems?.canvasHUD) return;

        const canvas = this.game.canvas;

        ctx.save();
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 18px monospace';

        // Gold icon + count
        ctx.fillStyle = '#FFD700';
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 4;
        ctx.fillText(`G ${this.runGold}`, canvas.width - 15, 15);

        // Total bank (smaller)
        if (this.game.systems.persistence) {
            ctx.font = '12px monospace';
            ctx.fillStyle = '#BBAA44';
            ctx.shadowBlur = 0;
            ctx.fillText(`Bank: ${this.game.systems.persistence.getGold()}`, canvas.width - 15, 38);
        }

        ctx.restore();
    }

    reset() {
        this.coins = [];
        this.runGold = 0;
        this.droppedGold = 0;
        this.collectedGold = 0;
    }
}
