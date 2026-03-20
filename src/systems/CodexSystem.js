/**
 * CodexSystem — Bestiary & Discovery Tracker
 *
 * Tracks all discovered enemies, weapons, evolutions, and synergies.
 * Data is persisted via PersistenceSystem.
 *
 * Categories:
 *   - enemies:    enemy types encountered
 *   - weapons:    weapons used across runs
 *   - evolutions: evolved weapon forms unlocked
 *   - synergies:  synergy combos discovered
 *
 * Each entry: { id, firstSeen (ISO timestamp), count (times encountered) }
 */
export class CodexSystem {
    constructor(game) {
        this.game = game;

        // In-memory codex (loaded from persistence on init)
        this.discoveries = {
            enemies: new Map(),
            weapons: new Map(),
            evolutions: new Map(),
            synergies: new Map()
        };

        // Load from persistence
        this._loadFromPersistence();
    }

    // ── Discovery Registration ──────────────────────────

    /**
     * Record seeing an enemy type.
     */
    discoverEnemy(enemyType) {
        this._discover('enemies', enemyType);
    }

    /**
     * Record using a weapon.
     */
    discoverWeapon(weaponId) {
        this._discover('weapons', weaponId);
    }

    /**
     * Record an evolution.
     */
    discoverEvolution(evolvedName) {
        this._discover('evolutions', evolvedName);
    }

    /**
     * Record a synergy combo.
     */
    discoverSynergy(synergyId) {
        this._discover('synergies', synergyId);
    }

    // ── Queries ──────────────────────────────────────────

    /**
     * Get all discoveries for a category.
     * Returns array of { id, firstSeen, count }.
     */
    getDiscoveries(category) {
        const map = this.discoveries[category];
        if (!map) return [];
        return Array.from(map.values());
    }

    /**
     * Get total discovery count across all categories.
     */
    getTotalDiscoveries() {
        let total = 0;
        for (const map of Object.values(this.discoveries)) {
            total += map.size;
        }
        return total;
    }

    /**
     * Check if a specific item has been discovered.
     */
    isDiscovered(category, id) {
        return this.discoveries[category]?.has(id) ?? false;
    }

    /**
     * Get completion stats per category.
     */
    getCompletionStats() {
        // Known totals (could be dynamically queried later)
        const known = {
            enemies: 10,   // basic, fast, tank, ranged, wraith, demon, elite, berserker, summoner, juggernaut
            weapons: 10,   // magic_missile, whip, throwing_knife, lightning_chain, garlic_aura, holy_bible, fire_wand, bone_boomerang, ice_shard, shadow_dagger
            evolutions: 10,
            synergies: 10
        };
        const stats = {};
        for (const [cat, total] of Object.entries(known)) {
            stats[cat] = {
                discovered: this.discoveries[cat].size,
                total,
                percent: Math.round((this.discoveries[cat].size / total) * 100)
            };
        }
        return stats;
    }

    // ── Persistence ─────────────────────────────────────

    _discover(category, id) {
        if (!id) return;
        const map = this.discoveries[category];
        if (!map) return;

        const existing = map.get(id);
        if (existing) {
            existing.count++;
        } else {
            map.set(id, {
                id,
                firstSeen: new Date().toISOString(),
                count: 1
            });
        }

        // Save to persistence
        this._saveToPersistence();
    }

    _loadFromPersistence() {
        const persistence = this.game.systems?.persistence;
        if (!persistence) return;

        const codexData = persistence.data.codex;
        if (!codexData) return;

        for (const category of ['enemies', 'weapons', 'evolutions', 'synergies']) {
            if (codexData[category]) {
                for (const entry of codexData[category]) {
                    this.discoveries[category].set(entry.id, { ...entry });
                }
            }
        }
    }

    _saveToPersistence() {
        const persistence = this.game.systems?.persistence;
        if (!persistence) return;

        const codexData = {};
        for (const [category, map] of Object.entries(this.discoveries)) {
            codexData[category] = Array.from(map.values());
        }
        persistence.data.codex = codexData;
        persistence.save();
    }

    /**
     * Reset all discoveries (for testing).
     */
    reset() {
        for (const map of Object.values(this.discoveries)) {
            map.clear();
        }
    }
}
