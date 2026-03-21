import { CHARACTERS } from '../data/characters.js';

/**
 * PersistenceSystem — LocalStorage persistence layer for cross-run data.
 *
 * Stores: total gold, permanent upgrades, personal records, total statistics,
 * achievement state, run history, and character selection/unlocks.
 *
 * Designed with version migration support for schema changes.
 * Wire into VampireSurvivorsGame.systems.persistence.
 */
export class PersistenceSystem {
    constructor(game) {
        this.game = game;
        this.storageKey = 'vampire-survivors-enhanced-save';
        this.schemaVersion = 1;

        // Default save data
        this.data = this.getDefaultData();

        // Load on construction
        this.load();
    }

    getDefaultData() {
        return {
            version: this.schemaVersion,

            // Currency
            gold: 0,

            // Permanent upgrades (purchased from shop)
            upgrades: {
                maxHealth: 0, // +4% per level
                damage: 0, // +2% per level
                moveSpeed: 0, // +1.5% per level
                cooldown: 0, // -2% per level
                xpGain: 0, // +6% per level
                armor: 0, // +0.75 per level
                revival: 0, // +1 revive per level (max 1)
                goldGain: 0 // +15% per level
            },

            // Personal records
            records: {
                highestKillCount: 0,
                longestSurvival: 0, // seconds
                maxLevel: 0,
                highestCombo: 0,
                mostGoldSingleRun: 0,
                totalRuns: 0,
                totalKills: 0,
                totalGoldEarned: 0,
                totalPlayTime: 0, // seconds
                totalDamageDealt: 0,
                favoriteWeapon: null, // most-used weapon ID
                weaponUsage: {} // { weapon_id: pick_count }
            },

            // Achievement tracking (IDs of unlocked achievements)
            unlockedAchievements: [],

            // Character selection
            selectedCharacter: 'antonio',
            characterUnlocks: { antonio: true },

            // Settings persistence
            settings: {
                masterVolume: 1,
                soundVolume: 0.8,
                musicVolume: 0.4,
                screenShake: true
            },

            // Bestiary / Discovery Codex
            codex: {
                enemies: [],
                weapons: [],
                evolutions: [],
                synergies: []
            }
        };
    }

    /**
     * Load save data from localStorage.
     */
    load() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return;

            const parsed = JSON.parse(raw);

            // Version migration
            if (parsed.version !== this.schemaVersion) {
                this.migrate(parsed);
            } else {
                // Merge with defaults to handle new fields
                this.data = this.mergeDefaults(parsed);
            }
        } catch (error) {
            console.warn('PersistenceSystem: Failed to load save data:', error);
            // Keep defaults
        }
    }

    /**
     * Save current data to localStorage.
     */
    save() {
        try {
            this.data.version = this.schemaVersion;
            localStorage.setItem(this.storageKey, JSON.stringify(this.data));
        } catch (error) {
            console.warn('PersistenceSystem: Failed to save:', error);
        }
    }

    /**
     * Merge loaded data with defaults to handle newly added fields.
     */
    mergeDefaults(loaded) {
        const defaults = this.getDefaultData();
        return {
            ...defaults,
            ...loaded,
            upgrades: { ...defaults.upgrades, ...(loaded.upgrades || {}) },
            records: { ...defaults.records, ...(loaded.records || {}) },
            settings: { ...defaults.settings, ...(loaded.settings || {}) },
            characterUnlocks: { ...defaults.characterUnlocks, ...(loaded.characterUnlocks || {}) },
            unlockedAchievements: loaded.unlockedAchievements || []
        };
    }

    /**
     * Migrate from an older schema version.
     */
    migrate(oldData) {
        // Future: add migration logic as schema evolves
        // For now, merge with defaults
        this.data = this.mergeDefaults(oldData);
        this.save();
    }

    /**
     * Called at end of a run. Updates records and saves.
     * @param {object} runStats — { kills, survivalTime, level, goldEarned, combo, weaponsUsed, damageDealt }
     */
    recordRunEnd(runStats) {
        const r = this.data.records;

        r.totalRuns++;
        r.totalKills += runStats.kills || 0;
        r.totalGoldEarned += runStats.goldEarned || 0;
        r.totalPlayTime += runStats.survivalTime || 0;
        r.totalDamageDealt += runStats.damageDealt || 0;

        // Personal bests
        if ((runStats.kills || 0) > r.highestKillCount) r.highestKillCount = runStats.kills;
        if ((runStats.survivalTime || 0) > r.longestSurvival) r.longestSurvival = runStats.survivalTime;
        if ((runStats.level || 0) > r.maxLevel) r.maxLevel = runStats.level;
        if ((runStats.combo || 0) > r.highestCombo) r.highestCombo = runStats.combo;
        if ((runStats.goldEarned || 0) > r.mostGoldSingleRun) r.mostGoldSingleRun = runStats.goldEarned;

        // Weapon usage tracking
        if (runStats.weaponsUsed) {
            for (const wId of runStats.weaponsUsed) {
                r.weaponUsage[wId] = (r.weaponUsage[wId] || 0) + 1;
            }
            // Determine favorite weapon
            let maxUse = 0;
            for (const [wId, count] of Object.entries(r.weaponUsage)) {
                if (count > maxUse) {
                    maxUse = count;
                    r.favoriteWeapon = wId;
                }
            }
        }

        // Add run gold to bank
        this.data.gold += runStats.goldEarned || 0;

        // Check character unlock conditions after updating records
        this.checkCharacterUnlocks();

        this.save();
    }

    /**
     * Get the permanent stat modifiers from purchased upgrades.
     */
    getUpgradeModifiers() {
        const u = this.data.upgrades;
        return {
            maxHealth: 1 + u.maxHealth * 0.04,
            damage: 1 + u.damage * 0.02,
            moveSpeed: 1 + u.moveSpeed * 0.015,
            cooldown: 1 - u.cooldown * 0.02,
            xpGain: 1 + u.xpGain * 0.06,
            armor: u.armor * 0.75,
            revival: u.revival,
            goldGain: 1 + u.goldGain * 0.15
        };
    }

    /**
     * Purchase an upgrade. Returns true if successful.
     */
    purchaseUpgrade(upgradeId) {
        const costs = this.getUpgradeCosts();
        const cost = costs[upgradeId];
        if (!cost) return false;

        const currentLevel = this.data.upgrades[upgradeId] || 0;
        const maxLevel = this.getUpgradeMaxLevel(upgradeId);
        if (currentLevel >= maxLevel) return false;

        const totalCost = Math.floor(cost * Math.pow(1.8, currentLevel));
        if (this.data.gold < totalCost) return false;

        this.data.gold -= totalCost;
        this.data.upgrades[upgradeId] = currentLevel + 1;
        this.save();
        return true;
    }

    getUpgradeCosts() {
        return {
            maxHealth: 50,
            damage: 100,
            moveSpeed: 60,
            cooldown: 130,
            xpGain: 40,
            armor: 120,
            revival: 500,
            goldGain: 70
        };
    }

    getUpgradeMaxLevel(upgradeId) {
        const maxLevels = {
            maxHealth: 8,
            damage: 5,
            moveSpeed: 8,
            cooldown: 5,
            xpGain: 5,
            armor: 5,
            revival: 1,
            goldGain: 5
        };
        return maxLevels[upgradeId] || 10;
    }

    getUpgradeInfo() {
        const costs = this.getUpgradeCosts();
        const info = [];

        const descriptions = {
            maxHealth: { name: 'Max Health', desc: '+4% per level', icon: '+' },
            damage: { name: 'Damage', desc: '+2% per level', icon: 'D' },
            moveSpeed: { name: 'Move Speed', desc: '+1.5% per level', icon: 'S' },
            cooldown: { name: 'Cooldown', desc: '-2% per level', icon: 'C' },
            xpGain: { name: 'XP Gain', desc: '+6% per level', icon: 'X' },
            armor: { name: 'Armor', desc: '+0.75 per level', icon: 'A' },
            revival: { name: 'Revival', desc: '+1 revive', icon: 'R' },
            goldGain: { name: 'Gold Gain', desc: '+15% per level', icon: 'G' }
        };

        for (const [id, meta] of Object.entries(descriptions)) {
            const level = this.data.upgrades[id] || 0;
            const maxLevel = this.getUpgradeMaxLevel(id);
            const cost = Math.floor(costs[id] * Math.pow(1.8, level));
            info.push({
                id,
                ...meta,
                level,
                maxLevel,
                cost: level >= maxLevel ? null : cost,
                canAfford: this.data.gold >= cost && level < maxLevel
            });
        }

        return info;
    }

    // ---- Character System ----

    getSelectedCharacter() {
        return this.data.selectedCharacter || 'antonio';
    }

    setSelectedCharacter(id) {
        this.data.selectedCharacter = id;
        this.save();
    }

    isCharacterUnlocked(id) {
        return !!this.data.characterUnlocks[id];
    }

    unlockCharacter(id) {
        this.data.characterUnlocks[id] = true;
        this.save();
    }

    /**
     * Check records against character unlock conditions and auto-unlock.
     */
    checkCharacterUnlocks() {
        const r = this.data.records;
        for (const char of CHARACTERS) {
            if (this.data.characterUnlocks[char.id]) continue;
            if (!char.unlockCondition) continue;

            // Parse condition string: "field >= value"
            const match = char.unlockCondition.match(/^(\w+)\s*>=\s*(\d+)$/);
            if (match) {
                const field = match[1];
                const threshold = parseInt(match[2], 10);
                if (typeof r[field] === 'number' && r[field] >= threshold) {
                    this.data.characterUnlocks[char.id] = true;
                }
            }
        }
    }

    /**
     * Reset all save data.
     */
    resetAll() {
        this.data = this.getDefaultData();
        this.save();
    }

    /**
     * Get total gold.
     */
    getGold() {
        return this.data.gold;
    }

    /**
     * Add gold directly to the bank.
     */
    addGold(amount) {
        this.data.gold += amount;
    }
}
