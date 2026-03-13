/**
 * PassiveItemSystem — Build Diversity Through Passive Items
 *
 * Creates a separate item category from weapons. Players collect passive items
 * during level-up. Each passive modifies player stats or adds effects.
 * 6 items with 5 upgrade levels each:
 *
 *   - Spinach   (+damage)        — 🌿
 *   - Wings     (+speed)         — 🪶
 *   - Armor     (-damage taken)  — 🛡️
 *   - Empty Tome (+cooldown)     — 📖
 *   - Duplicator (+projectiles)  — ⚡
 *   - Attractorb (+pickup range) — 🧲
 *
 * Integrates with the level-up option flow in VampireSurvivorsGame and
 * Player.getEffectiveStats().
 */

export class PassiveItemSystem {
    constructor(game) {
        this.game = game;

        // Active passive items the player has collected, keyed by item id
        this.items = new Map();

        // Maximum passive item slots
        this.maxSlots = 6;

        // Item definitions registry
        this.itemDefinitions = this._buildDefinitions();
    }

    // ── Item Definitions ───────────────────────────────────────

    _buildDefinitions() {
        return new Map([
            ['spinach', {
                id: 'spinach',
                name: 'Spinach',
                icon: '🌿',
                stat: 'damage',
                description: 'Raises damage by 10%',
                upgradeDescription: level => `+${level * 10}% damage`,
                bonusPerLevel: 0.10,
                maxLevel: 5,
                color: '#4ade80'
            }],
            ['wings', {
                id: 'wings',
                name: 'Wings',
                icon: '🪶',
                stat: 'speed',
                description: 'Raises speed by 10%',
                upgradeDescription: level => `+${level * 10}% speed`,
                bonusPerLevel: 0.10,
                maxLevel: 5,
                color: '#60a5fa'
            }],
            ['armor', {
                id: 'armor',
                name: 'Armor',
                icon: '🛡️',
                stat: 'armor',
                description: 'Reduces damage taken by 5',
                upgradeDescription: level => `-${level * 5} damage taken`,
                bonusPerLevel: 5,
                maxLevel: 5,
                color: '#a78bfa'
            }],
            ['empty_tome', {
                id: 'empty_tome',
                name: 'Empty Tome',
                icon: '📖',
                stat: 'cooldown',
                description: 'Reduces weapon cooldowns by 8%',
                upgradeDescription: level => `-${level * 8}% cooldown`,
                bonusPerLevel: 0.08,
                maxLevel: 5,
                color: '#c084fc'
            }],
            ['duplicator', {
                id: 'duplicator',
                name: 'Duplicator',
                icon: '⚡',
                stat: 'projectiles',
                description: '+1 projectile count',
                upgradeDescription: level => `+${level} projectiles`,
                bonusPerLevel: 1,
                maxLevel: 5,
                color: '#fbbf24'
            }],
            ['attractorb', {
                id: 'attractorb',
                name: 'Attractorb',
                icon: '🧲',
                stat: 'pickupRange',
                description: 'Increases pickup range by 25%',
                upgradeDescription: level => `+${level * 25}% pickup range`,
                bonusPerLevel: 0.25,
                maxLevel: 5,
                color: '#22d3ee'
            }]
        ]);
    }

    // ── PUBLIC API ──────────────────────────────────────────────

    /**
     * Add a new passive item or upgrade an existing one.
     * @returns {boolean} true if successful
     */
    addItem(itemId) {
        const def = this.itemDefinitions.get(itemId);
        if (!def) return false;

        if (this.items.has(itemId)) {
            // Upgrade existing
            return this.upgradeItem(itemId);
        }

        // Check slot availability
        if (this.items.size >= this.maxSlots) return false;

        this.items.set(itemId, {
            ...def,
            currentLevel: 1
        });

        // Play pickup sound
        if (this.game.audioManager && this.game.audioManager.playVampireSound) {
            this.game.audioManager.playVampireSound('powerUpCollect', 0.4, 1.1);
        }

        // Toast notification
        if (this.game.showToast) {
            this.game.showToast(`${def.icon} ${def.name} acquired!`, def.color, 1800);
        }

        return true;
    }

    /**
     * Upgrade an existing passive item by one level.
     * @returns {boolean} true if successful
     */
    upgradeItem(itemId) {
        const item = this.items.get(itemId);
        if (!item) return false;
        if (item.currentLevel >= item.maxLevel) return false;

        item.currentLevel++;

        // Play upgrade sound
        if (this.game.audioManager && this.game.audioManager.playVampireSound) {
            this.game.audioManager.playVampireSound('weaponUpgrade', 0.4, 1.0 + item.currentLevel * 0.05);
        }

        // Toast notification
        if (this.game.showToast) {
            this.game.showToast(
                `${item.icon} ${item.name} → Lv ${item.currentLevel}`,
                item.color, 1800
            );
        }

        return true;
    }

    /**
     * Returns aggregate stat modifiers from all passive items.
     * These are additive bonuses applied in Player.getEffectiveStats().
     */
    getStatModifiers() {
        const mods = {
            damage: 0,       // Additive multiplier bonus (0.1 = +10%)
            speed: 0,
            armor: 0,        // Flat damage reduction
            cooldown: 0,     // Additive cooldown reduction (0.08 = 8% faster)
            projectiles: 0,  // Flat extra projectiles
            pickupRange: 0   // Additive range multiplier bonus
        };

        for (const item of this.items.values()) {
            const bonus = item.bonusPerLevel * item.currentLevel;
            switch (item.stat) {
                case 'damage':
                    mods.damage += bonus;
                    break;
                case 'speed':
                    mods.speed += bonus;
                    break;
                case 'armor':
                    mods.armor += bonus;
                    break;
                case 'cooldown':
                    mods.cooldown += bonus;
                    break;
                case 'projectiles':
                    mods.projectiles += bonus;
                    break;
                case 'pickupRange':
                    mods.pickupRange += bonus;
                    break;
            }
        }

        return mods;
    }

    /**
     * Generate level-up options for passive items.
     * Returns array of option objects compatible with VampireSurvivorsGame.generateLevelUpOptions().
     */
    getLevelUpOptions() {
        const options = [];

        // Upgrades for existing items
        for (const item of this.items.values()) {
            if (item.currentLevel < item.maxLevel) {
                options.push({
                    type: 'passive_upgrade',
                    itemId: item.id,
                    name: `${item.icon} ${item.name} (Lv ${item.currentLevel + 1})`,
                    description: item.upgradeDescription(item.currentLevel + 1),
                    color: item.color
                });
            }
        }

        // New items (if slots available)
        if (this.items.size < this.maxSlots) {
            for (const [id, def] of this.itemDefinitions) {
                if (!this.items.has(id)) {
                    options.push({
                        type: 'new_passive',
                        itemId: id,
                        name: `${def.icon} ${def.name}`,
                        description: def.description,
                        color: def.color
                    });
                }
            }
        }

        return options;
    }

    /**
     * Check if the player has a specific passive item.
     */
    hasItem(itemId) {
        return this.items.has(itemId);
    }

    /**
     * Get item level (0 if not owned).
     */
    getItemLevel(itemId) {
        const item = this.items.get(itemId);
        return item ? item.currentLevel : 0;
    }

    /**
     * Get all owned items as an array (for HUD rendering).
     */
    getOwnedItems() {
        return Array.from(this.items.values());
    }

    /**
     * Reset the system (called on game start/restart).
     */
    reset() {
        this.items.clear();
    }

    /**
     * No per-frame update needed — passive items are stat modifiers,
     * not tick-based systems. Included for interface consistency.
     */
    update(dt) {
        // No-op: passive items don't tick
    }

    // ── Debug ──────────────────────────────────────────────────

    getDebugInfo() {
        const owned = [];
        for (const item of this.items.values()) {
            owned.push(`${item.icon}${item.name} Lv${item.currentLevel}/${item.maxLevel}`);
        }
        return {
            slots: `${this.items.size}/${this.maxSlots}`,
            items: owned.join(', ') || 'none',
            modifiers: this.getStatModifiers()
        };
    }
}
