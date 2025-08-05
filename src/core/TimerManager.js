/**
 * Timer Management System
 * 
 * Centralized timer management to prevent memory leaks from uncleaned
 * setTimeout/setInterval calls. Tracks all timers and ensures proper cleanup.
 */

export class TimerManager {
    constructor() {
        this.timers = new Map();
        this.intervals = new Map();
        this.nextId = 1;
        this.contexts = new WeakMap();
    }

    /**
     * Set a timeout with automatic tracking
     * @param {Function} callback - Function to call
     * @param {number} delay - Delay in milliseconds
     * @param {Object} context - Optional context for cleanup
     * @returns {number} Timer ID
     */
    setTimeout(callback, delay, context = null) {
        const id = this.nextId++;
        
        const timerId = setTimeout(() => {
            this.timers.delete(id);
            callback();
        }, delay);
        
        this.timers.set(id, timerId);
        
        if (context) {
            if (!this.contexts.has(context)) {
                this.contexts.set(context, new Set());
            }
            this.contexts.get(context).add({ type: 'timeout', id });
        }
        
        return id;
    }

    /**
     * Set an interval with automatic tracking
     * @param {Function} callback - Function to call
     * @param {number} delay - Delay in milliseconds
     * @param {Object} context - Optional context for cleanup
     * @returns {number} Interval ID
     */
    setInterval(callback, delay, context = null) {
        const id = this.nextId++;
        
        const intervalId = setInterval(callback, delay);
        
        this.intervals.set(id, intervalId);
        
        if (context) {
            if (!this.contexts.has(context)) {
                this.contexts.set(context, new Set());
            }
            this.contexts.get(context).add({ type: 'interval', id });
        }
        
        return id;
    }

    /**
     * Clear a timeout
     * @param {number} id - Timer ID
     */
    clearTimeout(id) {
        const timerId = this.timers.get(id);
        if (timerId !== undefined) {
            clearTimeout(timerId);
            this.timers.delete(id);
        }
    }

    /**
     * Clear an interval
     * @param {number} id - Interval ID
     */
    clearInterval(id) {
        const intervalId = this.intervals.get(id);
        if (intervalId !== undefined) {
            clearInterval(intervalId);
            this.intervals.delete(id);
        }
    }

    /**
     * Clear all timers for a specific context
     * @param {Object} context - Context object
     */
    clearContext(context) {
        const contextTimers = this.contexts.get(context);
        if (contextTimers) {
            for (const timer of contextTimers) {
                if (timer.type === 'timeout') {
                    this.clearTimeout(timer.id);
                } else if (timer.type === 'interval') {
                    this.clearInterval(timer.id);
                }
            }
            this.contexts.delete(context);
        }
    }

    /**
     * Clear all timers
     */
    clearAll() {
        // Clear all timeouts
        for (const [id, timerId] of this.timers) {
            clearTimeout(timerId);
        }
        this.timers.clear();
        
        // Clear all intervals
        for (const [id, intervalId] of this.intervals) {
            clearInterval(intervalId);
        }
        this.intervals.clear();
        
        // Context map will be garbage collected
    }

    /**
     * Get statistics about active timers
     * @returns {Object} Timer statistics
     */
    getStats() {
        return {
            activeTimeouts: this.timers.size,
            activeIntervals: this.intervals.size,
            totalActive: this.timers.size + this.intervals.size
        };
    }
}

// Global timer manager instance
export const globalTimerManager = new TimerManager();

// Convenience functions that use the global timer manager
export const managedSetTimeout = (callback, delay, context) => 
    globalTimerManager.setTimeout(callback, delay, context);

export const managedSetInterval = (callback, delay, context) => 
    globalTimerManager.setInterval(callback, delay, context);

export const managedClearTimeout = (id) => 
    globalTimerManager.clearTimeout(id);

export const managedClearInterval = (id) => 
    globalTimerManager.clearInterval(id);