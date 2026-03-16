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
        this.coins.push({
            x: x + (Math.random() - 0.5) * 20,
            y: y + (Math.random() - 0.5) * 20,
            value,
            lifetime: 15, // seconds before despawn
            magnetized: false,
            vx: (Math.random() - 0.5) * 60, // Initial scatter velocity
            vy: -30 - Math.random() * 40, // Pop upward
            bobPhase: Math.random() * Math.PI * 2
        });
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

        for (let i = this.coins.length - 1; i >= 0; i--) {
            const coin = this.coins[i];

            // Lifetime
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

            // Distance to player
            const dx = player.x - coin.x;
            const dy = player.y - coin.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Magnet pull
            if (dist < effectiveMagnet) {
                const pull = (1 - dist / effectiveMagnet) * 300;
                if (dist > 1) {
                    coin.x += (dx / dist) * pull * dt;
                    coin.y += (dy / dist) * pull * dt;
                }
                coin.magnetized = true;
            } else {
                coin.magnetized = false;
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

        // Visual feedback
        if (globalDamageNumberPool) {
            globalDamageNumberPool.spawn(coin.x, coin.y - 10, `+${gainedGold}G`, '#FFD700', 'GOLD');
        }

        // Audio
        if (this.game.audioManager) {
            this.game.audioManager.playVampireSound('experienceGain', 0.3, 1.4);
        }
    }

    render(ctx) {
        for (const coin of this.coins) {
            const bob = Math.sin(coin.bobPhase) * 2;
            const fadeAlpha = coin.lifetime < 2 ? coin.lifetime / 2 : 1;
            const drawY = coin.y + bob;

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
     */
    renderHUD(ctx) {
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
    }
}
