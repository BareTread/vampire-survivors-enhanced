/**
 * RewardsSystem — Critical Hit Rolls & Experience Multipliers
 *
 * PURPOSE:
 * Provides probability-based reward mechanics: critical hit chances and
 * experience multipliers that scale with player performance.
 *
 * HOW IT ACTIVATES:
 * 3 callsites already reference `game.systems.rewards` with null guards:
 *
 *   - BaseWeapon.js (L440-441): calls rollForCritical() before each attack
 *   - BaseWeapon.js (L454-455): calls calculateExperienceMultiplier() for XP scaling
 *   - Projectile.js (L350-351): calls rollForJackpot() on critical hit projectiles
 *
 * DESIGN:
 * - Base crit chance: 5%, +0.5% per player level, capped at 25%
 * - Kill streak tracking: consecutive kills within 3s build a streak
 * - XP multiplier: 1.0 base + streak bonus (cap 2.0x)
 * - Jackpot: 2% chance for bonus gem burst on crit
 *
 * NEXT AGENT NOTES:
 * - The Clover passive item (BUILD CRAFT) should add flat crit chance
 * - Jackpot currently logs; integrate with ExperienceSystem for gem burst
 * - Kill streak timer is tunable; 3s feels responsive but not too punishing
 */

export class RewardsSystem {
    constructor(game) {
        this.game = game;

        // Critical hit configuration
        this.baseCritChance = 0.05; // 5% base
        this.critChancePerLevel = 0.005; // +0.5% per level
        this.maxCritChance = 0.25; // 25% cap
        this.bonusCritChance = 0; // From items/buffs (for future passive items)

        // Kill streak tracking
        this.killStreak = 0;
        this.killStreakTimer = 0;
        this.killStreakWindow = 3.0; // seconds between kills to maintain streak
        this.maxKillStreak = 0; // Best streak this run

        // XP multiplier config
        this.baseXPMultiplier = 1.0;
        this.streakXPBonus = 0.02; // +2% per streak kill
        this.maxXPMultiplier = 2.0; // Cap at 2x

        // Jackpot config
        this.jackpotChance = 0.02; // 2% on crit
        this.jackpotCount = 0; // Total jackpots this run

        // Temporary multiplier boosts (from micro-challenges, etc.)
        this.tempXPMultiplier = 1.0;
        this.tempXPTimer = 0;

        // Stats for debug/telemetry
        this.totalCrits = 0;
        this.totalRolls = 0;
    }

    // === PUBLIC API (called by existing callsites) ===

    /**
     * Roll for a critical hit (BaseWeapon.js L441)
     * @returns {boolean} true if critical hit
     */
    rollForCritical() {
        this.totalRolls++;

        const player = this.game.player;
        const playerLevel = player ? player.level || 1 : 1;
        const desperationBonus = player?.desperationMode?.active ? player.desperationMode.criticalChanceBonus || 0 : 0;
        const critChance = Math.min(
            this.maxCritChance,
            this.baseCritChance + (playerLevel - 1) * this.critChancePerLevel + this.bonusCritChance + desperationBonus
        );

        // Streak bonus: +1% per 5 streak kills
        const streakBonus = Math.floor(this.killStreak / 5) * 0.01;
        const finalChance = Math.min(this.maxCritChance, critChance + streakBonus);

        const isCrit = Math.random() < finalChance;
        if (isCrit) {
            this.totalCrits++;
        }
        return isCrit;
    }

    /**
     * Roll for a jackpot reward on critical hit (Projectile.js L351)
     * Triggers a bonus reward when lucky
     */
    rollForJackpot() {
        if (Math.random() < this.jackpotChance) {
            this.jackpotCount++;

            // Trigger bonus XP burst
            if (this.game.player && this.game.systems.experience) {
                const bonusXP = 20 + (this.game.player.level || 1) * 5;
                this.game.systems.experience.addExperienceToPlayer(bonusXP);
            }

            // Visual feedback
            if (this.game.showToast) {
                this.game.showToast('💎 JACKPOT! Bonus XP!', '#FFD700', 2000);
            }

            // Audio feedback
            if (this.game.audioManager && this.game.audioManager.playVampireSound) {
                this.game.audioManager.playVampireSound('victoryFanfare', 0.4);
            }
        }
    }

    /**
     * Calculate current XP multiplier (BaseWeapon.js L455)
     * @returns {number} XP multiplier (1.0 - 2.0)
     */
    calculateExperienceMultiplier() {
        const streakMultiplier = 1.0 + this.killStreak * this.streakXPBonus;
        const total = this.baseXPMultiplier * Math.min(this.maxXPMultiplier, streakMultiplier) * this.tempXPMultiplier;
        return Math.min(this.maxXPMultiplier, total);
    }

    // === KILL STREAK MANAGEMENT ===

    /**
     * Register a kill for streak tracking.
     * Called externally or can be hooked to onEnemyKilled.
     */
    onEnemyKilled() {
        this.killStreak++;
        this.killStreakTimer = this.killStreakWindow;

        if (this.killStreak > this.maxKillStreak) {
            this.maxKillStreak = this.killStreak;
        }
    }

    /**
     * Apply a temporary XP multiplier boost (from micro-challenges, etc.)
     * @param {number} multiplier - Multiplier value (e.g., 1.5 for +50%)
     * @param {number} duration - Duration in seconds
     */
    applyTempXPBoost(multiplier, duration) {
        this.tempXPMultiplier = multiplier;
        this.tempXPTimer = duration;

        if (this.game.showToast) {
            this.game.showToast(`✨ XP ×${multiplier.toFixed(1)} for ${duration}s!`, '#40E0D0', 1500);
        }
    }

    // === PER-FRAME UPDATE ===

    update(dt) {
        // Decay kill streak timer
        if (this.killStreakTimer > 0) {
            this.killStreakTimer -= dt;
            if (this.killStreakTimer <= 0) {
                this.killStreak = 0;
            }
        }

        // Decay temporary XP boost
        if (this.tempXPTimer > 0) {
            this.tempXPTimer -= dt;
            if (this.tempXPTimer <= 0) {
                this.tempXPMultiplier = 1.0;
            }
        }
    }

    /**
     * Reset for new run
     */
    reset() {
        this.killStreak = 0;
        this.killStreakTimer = 0;
        this.maxKillStreak = 0;
        this.totalCrits = 0;
        this.totalRolls = 0;
        this.jackpotCount = 0;
        this.bonusCritChance = 0;
        this.tempXPMultiplier = 1.0;
        this.tempXPTimer = 0;
    }

    getDebugInfo() {
        const playerLevel = this.game.player ? this.game.player.level || 1 : 1;
        const currentCritChance = Math.min(
            this.maxCritChance,
            this.baseCritChance + (playerLevel - 1) * this.critChancePerLevel + this.bonusCritChance
        );
        return {
            critChance: (currentCritChance * 100).toFixed(1) + '%',
            critRate: this.totalRolls > 0 ? ((this.totalCrits / this.totalRolls) * 100).toFixed(1) + '%' : 'N/A',
            killStreak: this.killStreak,
            maxKillStreak: this.maxKillStreak,
            xpMultiplier: this.calculateExperienceMultiplier().toFixed(2),
            jackpots: this.jackpotCount
        };
    }
}
