// Opt-in reward telemetry for the pickup overhaul (REWARD_CONTRACT §12).
// Measures combat-time buff coverage, pickup collected/expired counts,
// healing waste, and XP/gold conservation. Default off: when disabled every
// entry point early-returns before touching counters, so it costs a couple
// of property reads per frame and allocates nothing.
import { HUD_BUFF_ORDER } from '../data/powerUps.js';

export class RewardTelemetry {
    constructor(game) {
        this.game = game;
        this.enabled = false;
        this._frozen = null;
        this._reset();
    }

    /**
     * Explicit opt-in/out. Enabling always opens a fresh measurement window
     * (counters zeroed, ledgers re-baselined) so a mid-run enable cannot
     * report false conservation loss. Disabling freezes the last snapshot.
     */
    setEnabled(enabled) {
        if (enabled) {
            this._reset();
            this.enabled = true;
            this._frozen = null;
        } else {
            this.enabled = false;
            if (!this._frozen) this._frozen = this._snapshot();
        }
    }


    /** New run: fresh stats. Honors opt-in — stays enabled if it was on. */
    onRunReset() {
        this._reset();
        this._frozen = null;
    }

    _reset() {
        this.combatSeconds = 0;
        this.buffSeconds = {};
        for (const type of HUD_BUFF_ORDER) this.buffSeconds[type] = 0;
        this.overlapSeconds = { 'damageBoost+fireRate': 0 };
        this.collected = {};
        this.expired = {};
        this.healing = { requested: 0, actual: 0, wasted: 0 };
        this.xpGranted = 0;
        this.coinBaseAwarded = 0;
        this._captureBaselines();
    }

    // Baselines let a mid-run enable measure a clean window: floor value and
    // raw ledgers are captured so conservation deltas start from zero.
    _captureBaselines() {
        const exp = this.game.systems?.experience;
        const gold = this.game.systems?.gold;
        this._baseDroppedXP = exp?.droppedXP || 0;
        this._baseCollectedXP = exp?.collectedXP || 0;
        this._baseDroppedGold = gold?.droppedGold || 0;
        this._baseCollectedGold = gold?.collectedGold || 0;
        this._openingFloorXP = this._floorXP();
        this._openingFloorGold = this._floorGold();
    }

    _floorXP() {
        const gems = this.game.systems?.experience?.activeGems;
        if (!gems) return 0;
        let total = 0;
        for (const gem of gems) {
            if (gem.active && !gem.collected) total += gem.value;
        }
        return total;
    }

    _floorGold() {
        const coins = this.game.systems?.gold?.coins;
        if (!coins) return 0;
        let total = 0;
        for (const coin of coins) total += coin.value;
        return total;
    }

    // ── Event hooks (called by game systems; no-ops when disabled) ────────

    /**
     * Combat-clock integration, hooked at the top of Player.updatePowerUps —
     * the only place combatTime advances — before that frame's layer prune.
     * dt is already timeScale-scaled: 0 during level-up selection and
     * hit-stop, and updatePowerUps never runs while paused.
     *
     * A buff covers the interval [combatTime - dt, combatTime] up to its
     * longest unexpired layer, so coverage counts any live layer (including
     * a weaker tail) and is capped at the remaining interval. Layers that
     * expire mid-frame are still visible here and contribute their partial
     * interval exactly.
     */
    trackCombatFrame(dt) {
        if (!this.enabled || dt <= 0) return;

        this.combatSeconds += dt;

        const player = this.game.player;
        if (!player || !player.buffLayers) return;

        const start = (player.combatTime || 0) - dt;
        const exp = this.game.systems?.experience;
        let damageRemaining = 0;
        let fireRateRemaining = 0;

        for (const type in this.buffSeconds) {
            let remaining = 0;
            const layers = player.buffLayers[type];
            if (layers) {
                for (const layer of layers) {
                    const r = layer.expiresAt - start;
                    if (r > remaining) remaining = r;
                }
            }
            if (type === 'magnetBoost' && exp) {
                // Magnetic coverage is the union of the player's magnet layer
                // and the system-level area/global timers.
                if (exp.areaMagnetTimer > remaining) remaining = exp.areaMagnetTimer;
                if (exp.globalMagnetTimer > remaining) remaining = exp.globalMagnetTimer;
            }
            if (remaining <= 0) continue;

            this.buffSeconds[type] += Math.min(dt, remaining);
            if (type === 'damageBoost') damageRemaining = remaining;
            else if (type === 'fireRate') fireRateRemaining = remaining;
        }

        // Exact intersection: both buffs are continuously active from `start`
        // until their longest layer ends.
        if (damageRemaining > 0 && fireRateRemaining > 0) {
            this.overlapSeconds['damageBoost+fireRate'] += Math.min(
                dt,
                damageRemaining,
                fireRateRemaining
            );
        }
    }

    trackPickupCollected(family, type) {
        if (!this.enabled) return;
        const fam = this.collected[family] || (this.collected[family] = {});
        fam[type] = (fam[type] || 0) + 1;
    }

    trackPickupExpired(family, type) {
        if (!this.enabled) return;
        const fam = this.expired[family] || (this.expired[family] = {});
        fam[type] = (fam[type] || 0) + 1;
    }

    /** Consumed health pickups only: requested vs actually restored HP. */
    trackHealing(requested, actual) {
        if (!this.enabled) return;
        this.healing.requested += requested;
        this.healing.actual += actual;
        this.healing.wasted += Math.max(0, requested - actual);
    }

    /** Total XP granted by Player.gainExperienceEnhanced (post-multiplier). */
    trackXPGranted(amount) {
        if (!this.enabled) return;
        this.xpGranted += amount;
    }

    /** Raw coin value collected (pre-challenge-multiplier). */
    trackCoinBaseAwarded(value) {
        if (!this.enabled) return;
        this.coinBaseAwarded += value;
    }

    // ── Reporting ─────────────────────────────────────────────────────────

    /** Plain serializable snapshot; never enables collection. */
    getStats() {
        return this._frozen || this._snapshot();
    }

    _snapshot() {
        const exp = this.game.systems?.experience;
        const gold = this.game.systems?.gold;
        const combat = this.combatSeconds;

        const buffs = {};
        for (const type in this.buffSeconds) {
            const seconds = this.buffSeconds[type];
            buffs[type] = {
                seconds,
                percent: combat > 0 ? (seconds / combat) * 100 : 0
            };
        }

        const overlapSeconds = this.overlapSeconds['damageBoost+fireRate'];
        const overlaps = {
            'damageBoost+fireRate': {
                seconds: overlapSeconds,
                percent: combat > 0 ? (overlapSeconds / combat) * 100 : 0
            }
        };

        const droppedXP = (exp?.droppedXP || 0) - this._baseDroppedXP;
        const awardedBaseXP = (exp?.collectedXP || 0) - this._baseCollectedXP;
        const currentFloorXP = this._floorXP();
        const xp = {
            openingFloor: this._openingFloorXP,
            dropped: droppedXP,
            awardedBase: awardedBaseXP,
            currentFloor: currentFloorXP,
            lost: this._openingFloorXP + droppedXP - awardedBaseXP - currentFloorXP,
            // Granted beyond base gem value: multiplier bonus plus non-gem
            // grants (streaks, achievements). Negative under famine.
            bonus: this.xpGranted - awardedBaseXP
        };

        const droppedGold = (gold?.droppedGold || 0) - this._baseDroppedGold;
        const awardedGold = (gold?.collectedGold || 0) - this._baseCollectedGold;
        const currentFloorGold = this._floorGold();
        const goldStats = {
            openingFloor: this._openingFloorGold,
            dropped: droppedGold,
            awardedBase: this.coinBaseAwarded,
            awarded: awardedGold,
            currentFloor: currentFloorGold,
            lost: this._openingFloorGold + droppedGold - this.coinBaseAwarded - currentFloorGold,
            bonus: awardedGold - this.coinBaseAwarded
        };

        return {
            enabled: this.enabled,
            combatSeconds: combat,
            buffs,
            overlaps,
            pickups: {
                collected: this._copyCounts(this.collected),
                expired: this._copyCounts(this.expired)
            },
            healing: { ...this.healing },
            xp,
            gold: goldStats
        };
    }

    _copyCounts(source) {
        const out = {};
        for (const family in source) out[family] = { ...source[family] };
        return out;
    }
}
