/**
 * LeaderboardSystem - Manages player leaderboard data
 * Stores and retrieves player scores (survival time and kill count)
 * Data is persisted in localStorage
 */

export class LeaderboardSystem {
    constructor() {
        this.storageKey = 'vampire-survivors-leaderboard';
        this.maxEntries = 50; // Keep top 50 entries
        this.entries = this.load();
    }

    /**
     * Load leaderboard data from localStorage
     */
    load() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
        }
        return [];
    }

    /**
     * Save leaderboard data to localStorage
     */
    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.entries));
        } catch (error) {
            console.error('Failed to save leaderboard:', error);
        }
    }

    /**
     * Add a new entry to the leaderboard
     * @param {string} playerName - Name of the player
     * @param {number} survivalTime - Survival time in seconds
     * @param {number} killCount - Number of kills
     */
    addEntry(playerName, survivalTime, killCount) {
        const entry = {
            playerName: playerName || 'Anonymous',
            survivalTime: Math.floor(survivalTime),
            killCount: Math.floor(killCount),
            date: Date.now()
        };

        this.entries.push(entry);

        // Sort by survival time (descending), then by kill count (descending)
        this.entries.sort((a, b) => {
            if (b.survivalTime !== a.survivalTime) {
                return b.survivalTime - a.survivalTime;
            }
            return b.killCount - a.killCount;
        });

        // Keep only top entries
        if (this.entries.length > this.maxEntries) {
            this.entries = this.entries.slice(0, this.maxEntries);
        }

        this.save();
    }

    /**
     * Get top N entries
     * @param {number} count - Number of entries to retrieve
     * @returns {Array} Top leaderboard entries
     */
    getTopEntries(count = 10) {
        return this.entries.slice(0, count);
    }

    /**
     * Get all entries
     * @returns {Array} All leaderboard entries
     */
    getAllEntries() {
        return this.entries;
    }

    /**
     * Clear all leaderboard data
     */
    clear() {
        this.entries = [];
        this.save();
    }

    /**
     * Format time in seconds to MM:SS format
     * @param {number} seconds - Time in seconds
     * @returns {string} Formatted time string
     */
    static formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Format large numbers with K/M suffix
     * @param {number} num - Number to format
     * @returns {string} Formatted number string
     */
    static formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }
}
