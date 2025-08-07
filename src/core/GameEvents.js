/**
 * Game Events - Event constants for the game system
 * 
 * Centralized event type definitions for game-wide communication
 */

export const GameEvents = {
    STATE_CHANGED: 'stateChanged',
    PLAYER_LEVELED_UP: 'playerLeveledUp',
    PLAYER_DIED: 'playerDied',
    ENEMY_SPAWNED: 'enemySpawned',
    ENEMY_KILLED: 'enemyKilled',
    WAVE_COMPLETED: 'waveCompleted',
    PERFORMANCE_WARNING: 'performanceWarning',
    CONFIG_CHANGED: 'configChanged'
};