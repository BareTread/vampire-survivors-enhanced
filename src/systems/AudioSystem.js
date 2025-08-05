/**
 * Audio System - ECS-based Audio Management
 * 
 * Handles audio playback and sound effects using
 * component-based architecture and events.
 * 
 * @author Game Architecture Specialist
 * @version 1.0.0
 */

import { BaseSystem } from './BaseSystem.js';
import { GameEvents } from '../core/GameEngine.js';
import { Config } from '../core/ConfigManager.js';
import { LoggerInstance as Logger } from '../core/ErrorHandler.js';

export class AudioSystem extends BaseSystem {
    constructor(world, name = 'audio', config = {}) {
        super(world, name, config);
        
        this.audioManager = null;
        this.soundQueue = [];
        this.maxSimultaneousSounds = Config.get('audio.maxSimultaneousSounds');
        this.activeSounds = [];
    }

    onInit() {
        // Set up event listeners for game events that trigger sounds
        this.addEventListener(GameEvents.PLAYER_LEVELED_UP, this.onPlayerLevelUp.bind(this));
        this.addEventListener(GameEvents.ENEMY_KILLED, this.onEnemyKilled.bind(this));
        this.addEventListener('collision', this.onCollision.bind(this));
        this.addEventListener('weaponFired', this.onWeaponFired.bind(this));
        
        Logger.debug('AudioSystem initialized');
    }

    onUpdate(deltaTime) {
        // Process sound queue
        this.processSoundQueue();
        
        // Clean up finished sounds
        this.cleanupFinishedSounds();
        
        // Update audio manager if available
        if (this.audioManager && this.audioManager.update) {
            this.audioManager.update(deltaTime);
        }
    }

    processSoundQueue() {
        while (this.soundQueue.length > 0 && this.activeSounds.length < this.maxSimultaneousSounds) {
            const sound = this.soundQueue.shift();
            this.playSound(sound);
        }
    }

    cleanupFinishedSounds() {
        this.activeSounds = this.activeSounds.filter(sound => !sound.finished);
    }

    playSound(soundConfig) {
        if (!this.audioManager) {
            Logger.debug('No audio manager available, skipping sound', soundConfig);
            return;
        }

        try {
            // Apply volume settings
            const volume = soundConfig.volume * Config.get('audio.masterVolume');
            
            const sound = {
                ...soundConfig,
                volume: volume,
                startTime: performance.now(),
                finished: false
            };

            // Mock sound playback
            Logger.debug('Playing sound', sound);
            
            this.activeSounds.push(sound);
            
            // Mark as finished after duration (simplified)
            setTimeout(() => {
                sound.finished = true;
            }, (soundConfig.duration || 1000));
            
        } catch (error) {
            Logger.warn('Failed to play sound', { 
                error: error.message, 
                soundConfig 
            });
        }
    }

    queueSound(soundType, config = {}) {
        const soundConfig = {
            type: soundType,
            volume: config.volume || 1.0,
            pitch: config.pitch || 1.0,
            duration: config.duration || 1000,
            ...config
        };

        this.soundQueue.push(soundConfig);
    }

    onPlayerLevelUp(event) {
        this.queueSound('levelUp', {
            volume: 0.8,
            pitch: 1.0 + (event.level * 0.1)
        });
    }

    onEnemyKilled(event) {
        this.queueSound('enemyKilled', {
            volume: 0.4,
            pitch: 0.8 + Math.random() * 0.4
        });
    }

    onCollision(event) {
        const { entityA, entityB } = event;
        
        // Play different sounds based on collision types
        if (this.isPlayer(entityA) || this.isPlayer(entityB)) {
            this.queueSound('playerHit', {
                volume: 0.6,
                pitch: 0.9
            });
        }
    }

    onWeaponFired(event) {
        const weaponType = event.weaponType || 'default';
        
        this.queueSound('weaponFire', {
            volume: 0.3,
            pitch: this.getWeaponPitch(weaponType),
            weaponType: weaponType
        });
    }

    getWeaponPitch(weaponType) {
        const pitches = {
            magicMissile: 1.2,
            whip: 0.8,
            throwingKnife: 1.0
        };
        
        return pitches[weaponType] || 1.0;
    }

    isPlayer(entity) {
        return entity.hasTag && entity.hasTag('player');
    }

    setAudioManager(audioManager) {
        this.audioManager = audioManager;
        Logger.debug('Audio manager set');
    }

    playBackgroundMusic(trackName) {
        if (!this.audioManager) return;
        
        Logger.debug('Starting background music', { trackName });
        // Would start background music loop
    }

    stopBackgroundMusic() {
        if (!this.audioManager) return;
        
        Logger.debug('Stopping background music');
        // Would stop background music
    }

    setMasterVolume(volume) {
        Config.set('audio.masterVolume', Math.max(0, Math.min(1, volume)));
        Logger.debug('Master volume set', { volume });
    }

    getDebugInfo() {
        return {
            ...super.getDebugInfo(),
            soundQueueLength: this.soundQueue.length,
            activeSounds: this.activeSounds.length,
            maxSimultaneousSounds: this.maxSimultaneousSounds,
            hasAudioManager: !!this.audioManager
        };
    }
}