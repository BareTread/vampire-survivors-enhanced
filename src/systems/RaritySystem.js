/**
 * RaritySystem — Color-Coded Rarity Tiers for Level-Up Options
 *
 * Assigns rarity tiers to level-up choices based on game progression and randomness.
 * Each rarity multiplies the base stats of the offered item/upgrade:
 *
 *   Common    (white)   — 1.0x — 60% base chance
 *   Uncommon  (green)   — 1.3x — 25% base chance
 *   Rare      (blue)    — 1.7x — 12% base chance
 *   Epic      (purple)  — 2.2x — 3% base chance
 *   Legendary (gold)    — reserved for evolutions only (not rolled)
 *
 * As the game progresses (higher player level, more game time), the probability
 * distribution shifts toward better rarities. Luck stat also affects distribution.
 */

export class RaritySystem {
    constructor(game) {
        this.game = game;

        // Rarity definitions
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
                multiplier: 1.3,
                baseWeight: 25
            },
            rare: {
                id: 'rare',
                name: 'Rare',
                color: '#60A5FA',
                borderColor: '#3B82F6',
                glowColor: 'rgba(96,165,250,0.2)',
                multiplier: 1.7,
                baseWeight: 12
            },
            epic: {
                id: 'epic',
                name: 'Epic',
                color: '#C084FC',
                borderColor: '#A855F7',
                glowColor: 'rgba(192,132,252,0.25)',
                multiplier: 2.2,
                baseWeight: 3
            },
            legendary: {
                id: 'legendary',
                name: 'LEGENDARY',
                color: '#FFD700',
                borderColor: '#FFA500',
                glowColor: 'rgba(255,215,0,0.35)',
                multiplier: 3.0,
                baseWeight: 0 // Not randomly rolled — evolutions only
            }
        };
    }

    /**
     * Roll a rarity tier based on game state.
     * @param {string} [forceRarity] — Force a specific rarity (for evolutions)
     * @returns {object} The rarity definition
     */
    rollRarity(forceRarity) {
        if (forceRarity && this.rarities[forceRarity]) {
            return this.rarities[forceRarity];
        }

        const player = this.game.player;
        if (!player) return this.rarities.common;

        // Calculate progression factor (0-1, increases over the run)
        const levelFactor = Math.min(1, player.level / 40); // Maxes at level 40
        const timeFactor = Math.min(1, this.game.gameTime / (25 * 60)); // Maxes at 25 min
        const progression = levelFactor * 0.6 + timeFactor * 0.4;

        // Luck modifier (player.stats.luck defaults around 1.0, higher = better)
        const luck = player.stats?.luck || 1.0;

        // Adjust weights based on progression and luck
        const weights = {
            common: Math.max(5, this.rarities.common.baseWeight - progression * 30),
            uncommon: this.rarities.uncommon.baseWeight + progression * 10,
            rare: this.rarities.rare.baseWeight + progression * 12 * luck,
            epic: this.rarities.epic.baseWeight + progression * 8 * luck * luck
        };

        // Weighted random selection
        const totalWeight = weights.common + weights.uncommon + weights.rare + weights.epic;
        let roll = Math.random() * totalWeight;

        if (roll < weights.common) return this.rarities.common;
        roll -= weights.common;
        if (roll < weights.uncommon) return this.rarities.uncommon;
        roll -= weights.uncommon;
        if (roll < weights.rare) return this.rarities.rare;
        return this.rarities.epic;
    }

    /**
     * Assign a rarity to a level-up option and apply the stat multiplier.
     * Returns the option with rarity info attached.
     */
    assignRarity(option) {
        // Evolutions are always legendary
        if (option.type === 'evolution') {
            option.rarity = this.rarities.legendary;
            return option;
        }

        const rarity = this.rollRarity(option.forceRarity);
        option.rarity = rarity;

        // Apply multiplier to stat-based options
        if (option.type === 'stat_upgrade' && rarity.multiplier !== 1.0) {
            option._originalName = option.name;
            // Enhance the stat boost description
            const mult = rarity.multiplier;
            switch (option.stat) {
                case 'damage':
                    option.name = `Damage +${Math.round(20 * mult)}%`;
                    option._rarityMultiplier = mult;
                    break;
                case 'speed':
                    option.name = `Speed +${Math.round(15 * mult)}%`;
                    option._rarityMultiplier = mult;
                    break;
                case 'health':
                    option.name = `Max Health +${Math.round(25 * mult)}%`;
                    option._rarityMultiplier = mult;
                    break;
                case 'luck':
                    option.name = `Luck +${Math.round(10 * mult)}%`;
                    option._rarityMultiplier = mult;
                    break;
                case 'area':
                    option.name = `Area +${Math.round(15 * mult)}%`;
                    option._rarityMultiplier = mult;
                    break;
                case 'cooldown':
                    option.name = `Cooldown -${Math.round(10 * mult)}%`;
                    option._rarityMultiplier = mult;
                    break;
            }
        }

        return option;
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
}
