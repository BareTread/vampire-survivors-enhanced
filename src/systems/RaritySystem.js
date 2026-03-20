/**
 * RaritySystem — Build-Aware Rarity Scoring for Level-Up Options
 *
 * Assigns rarity tiers by SCORING each option against the player's current
 * build state. Rarity is purely informational — it tells the player how
 * valuable an option is for their run, not a random dice roll.
 *
 * Scoring dimensions (0-100 scale):
 *   A. Base Type Value   (0-25)  — intrinsic value of the option category
 *   B. Build Synergy     (0-45)  — contextual value vs current weapons/passives
 *   C. Contextual Scarcity (0-30) — how rare/urgent this opportunity is
 *
 * Score → Rarity mapping:
 *   0-24   → Common    (white)   "Generic pick"
 *   25-49  → Uncommon  (green)   "Decent option"
 *   50-74  → Rare      (blue)    "Strong pick for your build"
 *   75-100 → Epic      (purple)  "Build-defining choice!"
 *   N/A    → Legendary (gold)    Evolutions only (always)
 */

export class RaritySystem {
    constructor(game) {
        this.game = game;

        // Track how many times each stat has been picked this run
        this.statPickCounts = new Map();

        // AoE weapon IDs that benefit from area stat
        this._aoeWeapons = new Set(['garlic_aura', 'holy_bible', 'fire_wand', 'ice_shard']);

        // Rarity definitions (multiplier kept at 1.0 — rarity is informational only)
        this.rarities = {
            common: {
                id: 'common',
                name: 'Common',
                color: '#CCCCCC',
                borderColor: '#888888',
                glowColor: 'rgba(200,200,200,0.1)',
                multiplier: 1.0,
                baseWeight: 60
            },
            uncommon: {
                id: 'uncommon',
                name: 'Uncommon',
                color: '#4ADE80',
                borderColor: '#22C55E',
                glowColor: 'rgba(74,222,128,0.15)',
                multiplier: 1.0,
                baseWeight: 25
            },
            rare: {
                id: 'rare',
                name: 'Rare',
                color: '#60A5FA',
                borderColor: '#3B82F6',
                glowColor: 'rgba(96,165,250,0.2)',
                multiplier: 1.0,
                baseWeight: 12
            },
            epic: {
                id: 'epic',
                name: 'Epic',
                color: '#C084FC',
                borderColor: '#A855F7',
                glowColor: 'rgba(192,132,252,0.25)',
                multiplier: 1.0,
                baseWeight: 3
            },
            legendary: {
                id: 'legendary',
                name: 'LEGENDARY',
                color: '#FFD700',
                borderColor: '#FFA500',
                glowColor: 'rgba(255,215,0,0.35)',
                multiplier: 1.0,
                baseWeight: 0
            }
        };
    }

    /**
     * Score a level-up option against the player's current build (0-100).
     * Higher score = better pick for the current run state.
     */
    scoreOption(option) {
        const player = this.game.player;
        if (!player) return 0;

        let score = 0;

        // ── A. Base Type Value (0-25) ─────────────────────────────
        score += this._baseTypeScore(option, player);

        // ── B. Build Synergy (0-45) ──────────────────────────────
        score += this._synergyScore(option, player);

        // ── C. Contextual Scarcity (0-30) ────────────────────────
        score += this._scarcityScore(option, player);

        // Small random jitter ±5 to prevent identical scores every time
        score += (Math.random() - 0.5) * 10;

        return Math.max(0, Math.min(100, Math.round(score)));
    }

    /**
     * A. Base Type Value — intrinsic value of the option category.
     */
    _baseTypeScore(option, player) {
        switch (option.type) {
            case 'weapon_upgrade': {
                const weapon = this._getWeapon(player, option.weaponId);
                if (!weapon) return 12;
                // Higher-level upgrades are rarer/more exciting
                return 12 + (weapon.level / (weapon.maxLevel || 8)) * 10;
            }
            case 'new_weapon':
                return 15;
            case 'passive_upgrade': {
                const passiveItems = this.game.systems.passiveItems;
                const item = passiveItems?.items.get(option.itemId);
                if (!item) return 10;
                return 10 + (item.currentLevel / (item.maxLevel || 5)) * 8;
            }
            case 'new_passive':
                return 12;
            case 'stat_upgrade':
                return 8;
            default:
                return 5;
        }
    }

    /**
     * B. Build Synergy — how well does this option fit the current build?
     * This is the heart of the scoring system.
     */
    _synergyScore(option, player) {
        let score = 0;
        const evoSystem = this.game.systems.weaponEvolution;
        const passiveItems = this.game.systems.passiveItems;

        switch (option.type) {
            case 'new_passive': {
                // Does this passive enable an evolution for an owned weapon?
                if (evoSystem && option.itemId) {
                    score += this._evolutionEnablingScore(option.itemId, player, evoSystem);
                }
                break;
            }
            case 'passive_upgrade': {
                // Upgrading a passive that's part of an evolution recipe is good
                if (evoSystem && option.itemId) {
                    for (const weapon of player.weapons.values()) {
                        const recipe = evoSystem.recipes.get(weapon.id);
                        if (recipe && recipe.requiredPassive === option.itemId) {
                            score += 8;
                            break;
                        }
                    }
                }
                break;
            }
            case 'weapon_upgrade': {
                const weapon = this._getWeapon(player, option.weaponId);
                if (!weapon) break;

                // Upgrading to max level when player owns the evolution passive
                if (weapon.level === (weapon.maxLevel || 8) - 1 && evoSystem) {
                    const recipe = evoSystem.recipes.get(weapon.id);
                    if (recipe && passiveItems?.items.has(recipe.requiredPassive)) {
                        score += 25; // Next level-up will unlock evolution!
                    } else if (recipe) {
                        score += 10; // Reaching max level, but no passive yet
                    }
                }
                break;
            }
            case 'new_weapon': {
                // New weapons are more valuable early game
                if (player.level <= 5) score += 5;
                break;
            }
            case 'stat_upgrade': {
                score += this._statSynergyScore(option.stat, player);
                break;
            }
        }

        return Math.min(45, score);
    }

    /**
     * Score how much a new passive enables weapon evolutions.
     * This is the most valuable signal in the game.
     */
    _evolutionEnablingScore(passiveId, player, evoSystem) {
        let bestScore = 0;

        for (const weapon of player.weapons.values()) {
            if (weapon.evolved || evoSystem.evolvedWeapons.has(weapon.id)) continue;

            const recipe = evoSystem.recipes.get(weapon.id);
            if (!recipe || recipe.requiredPassive !== passiveId) continue;

            // This passive enables an evolution for an owned weapon!
            if (weapon.level >= (weapon.maxLevel || 8)) {
                // Weapon is already at max level — evolution is IMMEDIATE
                bestScore = Math.max(bestScore, 45);
            } else if (weapon.level >= (weapon.maxLevel || 8) - 2) {
                // Weapon is close to max — evolution is near
                bestScore = Math.max(bestScore, 38);
            } else {
                // Weapon exists but is low level — evolution is distant but possible
                bestScore = Math.max(bestScore, 30);
            }
        }

        return bestScore;
    }

    /**
     * Score how well a stat upgrade complements the current weapon loadout.
     */
    _statSynergyScore(stat, player) {
        let score = 0;
        const weaponCount = player.weapons.size;
        const pickCount = this.statPickCounts.get(stat) || 0;

        // Penalty for picking the same stat repeatedly (diminishing returns feel)
        if (pickCount >= 3) score -= 5;
        if (pickCount >= 5) score -= 5;

        switch (stat) {
            case 'damage':
                // Damage is better with more weapons
                if (weaponCount >= 3) score += 10;
                else if (weaponCount >= 2) score += 5;
                break;
            case 'area':
                // Area is great with AoE weapons
                for (const weapon of player.weapons.values()) {
                    if (this._aoeWeapons.has(weapon.id)) {
                        score += 6;
                    }
                }
                score = Math.min(score, 15);
                break;
            case 'cooldown':
                // Cooldown benefits more weapons
                if (weaponCount >= 3) score += 8;
                else if (weaponCount >= 2) score += 4;
                break;
            case 'speed':
                // Speed is more valuable early game (survival)
                if (player.level <= 8) score += 10;
                else if (player.level <= 15) score += 5;
                break;
            case 'health':
                // Health is valuable when player is struggling
                if (player.health < player.maxHealth * 0.5) score += 10;
                break;
            case 'luck':
                // Luck is decent early-mid, less so late
                if (player.level <= 15) score += 5;
                break;
        }

        return Math.max(0, score);
    }

    /**
     * C. Contextual Scarcity — how rare or urgent is this opportunity?
     */
    _scarcityScore(option, player) {
        let score = 0;
        const passiveItems = this.game.systems.passiveItems;
        const evoSystem = this.game.systems.weaponEvolution;

        switch (option.type) {
            case 'new_weapon': {
                // Last weapon slot is precious
                if (player.weapons.size === player.maxWeapons - 1) score += 12;
                // Early game new weapons are extra valuable
                if (player.level <= 5) score += 8;
                break;
            }
            case 'new_passive': {
                // Last passive slot
                if (passiveItems && passiveItems.items.size === passiveItems.maxSlots - 1) score += 10;
                break;
            }
            case 'weapon_upgrade': {
                const weapon = this._getWeapon(player, option.weaponId);
                if (!weapon) break;

                // Weapon at penultimate level AND player owns the evo passive
                if (weapon.level === (weapon.maxLevel || 8) - 1 && evoSystem) {
                    const recipe = evoSystem.recipes.get(weapon.id);
                    if (recipe && passiveItems?.items.has(recipe.requiredPassive)) {
                        score += 15; // Evolution is one upgrade away!
                    }
                }
                break;
            }
            case 'stat_upgrade':
                // No scarcity bonus for stats — they're always available
                break;
        }

        // Late game evolution window bonus
        if (this.game.gameTime > 15 * 60 && evoSystem) {
            if (option.type === 'new_passive' || option.type === 'passive_upgrade') {
                // Check if this passive could enable an unevolved weapon's evolution
                for (const weapon of player.weapons.values()) {
                    if (weapon.evolved || evoSystem.evolvedWeapons.has(weapon.id)) continue;
                    const recipe = evoSystem.recipes.get(weapon.id);
                    if (recipe && recipe.requiredPassive === option.itemId) {
                        score += 5;
                        break;
                    }
                }
            }
        }

        return Math.min(30, score);
    }

    /**
     * Map a numeric score (0-100) to a rarity tier.
     */
    _scoreToRarity(score) {
        if (score >= 75) return this.rarities.epic;
        if (score >= 50) return this.rarities.rare;
        if (score >= 25) return this.rarities.uncommon;
        return this.rarities.common;
    }

    /**
     * Assign a rarity to a level-up option based on build-aware scoring.
     * Rarity is purely informational — no stat multipliers applied.
     */
    assignRarity(option) {
        // Evolutions are always legendary
        if (option.type === 'evolution') {
            option.rarity = this.rarities.legendary;
            return option;
        }

        const score = this.scoreOption(option);
        option.rarity = this._scoreToRarity(score);
        option._rarityScore = score; // Expose for debugging/testing

        return option;
    }

    /**
     * Record that a stat was picked (called from VampireSurvivorsGame.selectLevelUpOption).
     */
    recordStatPick(stat) {
        this.statPickCounts.set(stat, (this.statPickCounts.get(stat) || 0) + 1);
    }

    /**
     * Reset per-run state (called on game start).
     */
    reset() {
        this.statPickCounts.clear();
    }

    /**
     * Get rarity info for display purposes.
     */
    getRarityInfo(rarityId) {
        return this.rarities[rarityId] || this.rarities.common;
    }

    /**
     * Style a level-up button element based on its rarity.
     */
    styleButton(button, option) {
        const rarity = option.rarity || this.rarities.common;

        // Base styling
        button.style.borderColor = rarity.borderColor;
        button.style.borderWidth = rarity.id === 'legendary' ? '3px' : '2px';

        // Rarity name label
        const rarityLabel = document.createElement('div');
        rarityLabel.style.cssText = `
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: ${rarity.color};
            margin-bottom: 4px;
            font-weight: bold;
        `;
        rarityLabel.textContent = rarity.name;

        // Insert at top of button
        if (button.firstChild) {
            button.insertBefore(rarityLabel, button.firstChild);
        } else {
            button.appendChild(rarityLabel);
        }

        // Add glow for rare+ items
        if (rarity.id === 'rare' || rarity.id === 'epic' || rarity.id === 'legendary') {
            button.style.boxShadow = `0 0 10px ${rarity.glowColor}, inset 0 0 10px ${rarity.glowColor}`;
        }

        // Legendary gets animated border
        if (rarity.id === 'legendary') {
            button.style.animation = 'legendary-pulse 1.5s ease-in-out infinite';
            button.style.background = 'linear-gradient(135deg, #1a1a2e 0%, #2d1b00 50%, #1a1a2e 100%)';
        }

        // Update the option name color
        const nameDiv = button.querySelector('div:nth-child(2)');
        if (nameDiv && rarity.id !== 'common') {
            nameDiv.style.color = rarity.color;
        }
    }

    // ── Helpers ──────────────────────────────────────────────────

    _getWeapon(player, weaponId) {
        for (const weapon of player.weapons.values()) {
            if (weapon.id === weaponId) return weapon;
        }
        return null;
    }
}
