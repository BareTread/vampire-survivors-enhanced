import {
    managedSetTimeout,
    managedSetInterval,
    managedClearTimeout,
    managedClearInterval
} from '../core/TimerManager.js';

export class AudioManager {
    constructor() {
        this.sounds = {};
        this.music = {};
        this.masterVolume = 0.8;
        this.soundVolume = 0.5;
        this.musicVolume = 0.4;
        this.muted = false;
        this.currentMusic = null;

        // Enhanced audio features
        this.audioContext = null;
        this.dynamicMixing = true;
        this.gameIntensity = 0; // 0-1 scale for dynamic audio
        this.soundPools = new Map(); // For performance
        this.reverbBuffer = null;

        // AUDIO THROTTLING - Prevent spam with many enemies
        this.soundThrottle = new Map(); // Track last played time for each sound type
        this.throttleInterval = 50; // Minimum ms between same sound type
        this.maxSimultaneousSounds = 10; // Max sounds playing at once
        this.currentlyPlaying = 0;
        this.playingByFamily = new Map();
        this.familyCaps = {
            ambient: 4,
            combat: 7,
            progression: 4,
            reward: 4,
            ui: 3,
            boss: 3,
            music: 4
        };

        this.busNodes = {};
        this.reverbBuffer = null;
        this.activeLoopingSounds = new Map();
        this.pendingAggregations = new Map();
        this.aggregationSettings = {
            experienceGain: {
                windowMs: 80,
                aggregateName: 'experienceCluster',
                aggregateType: 'collectCluster',
                durationMs: 320,
                reverb: 0.28,
                family: 'reward'
            },
            enemyDeath: {
                windowMs: 110,
                aggregateName: 'enemyDeathBloom',
                aggregateType: 'deathBloom',
                durationMs: 420,
                reverb: 0.24,
                family: 'combat'
            }
        };
        this.busSettings = {
            ambient: { gain: 0.34, highpass: 40, lowpass: 2300 },
            music: { gain: 0.7, highpass: 35, lowpass: 5200 },
            combat: { gain: 0.82, highpass: 45, lowpass: 7000 },
            reward: { gain: 0.78, highpass: 120, lowpass: 8200 },
            ui: { gain: 0.68, highpass: 180, lowpass: 9200 }
        };
        this.mixDebug = {
            busGains: {
                ...Object.fromEntries(Object.entries(this.busSettings).map(([name, config]) => [name, config.gain]))
            },
            aggregationWindows: {
                experienceGain: this.aggregationSettings.experienceGain.windowMs,
                enemyDeath: this.aggregationSettings.enemyDeath.windowMs
            }
        };

        // Vampire-themed sound definitions
        this.initializeVampireSounds();
        this.initializeAudioContext();
    }

    loadSound(name, src) {
        try {
            const audio = new Audio(src);
            audio.volume = this.soundVolume * this.masterVolume;
            this.sounds[name] = audio;
        } catch (error) {
            console.warn(`Failed to load sound: ${name}`);
            // Create stub sound
            this.sounds[name] = {
                play: () => {},
                pause: () => {},
                currentTime: 0,
                volume: 1
            };
        }
    }

    loadMusic(name, src) {
        try {
            const audio = new Audio(src);
            audio.volume = this.musicVolume * this.masterVolume;
            audio.loop = true;
            this.music[name] = audio;
        } catch (error) {
            console.warn(`Failed to load music: ${name}`);
            // Create stub music
            this.music[name] = {
                play: () => {},
                pause: () => {},
                currentTime: 0,
                volume: 1,
                loop: true
            };
        }
    }

    play(name, volume = 1) {
        if (this.muted) return;

        const sound = this.sounds[name];
        if (sound) {
            try {
                sound.volume = volume * this.soundVolume * this.masterVolume;
                sound.currentTime = 0;
                sound.play().catch(() => {
                    // Ignore autoplay errors
                });
            } catch (error) {
                // Ignore play errors
            }
        }
    }

    playLoop(name, volume = 1) {
        if (this.muted) return;

        const sound = this.sounds[name] || this.music[name];
        if (sound) {
            try {
                sound.loop = true;
                sound.volume = volume * this.soundVolume * this.masterVolume;
                sound.play().catch(() => {
                    // Ignore autoplay errors
                });
            } catch (error) {
                // Ignore play errors
            }
        }
    }

    playMusic(name, fadeIn = false) {
        if (this.muted) return;

        // Stop current music
        if (this.currentMusic) {
            this.stopMusic();
        }

        const music = this.music[name];
        if (music) {
            try {
                this.currentMusic = music;
                music.volume = fadeIn ? 0 : this.musicVolume * this.masterVolume;
                music.play().catch(() => {
                    // Ignore autoplay errors
                });

                if (fadeIn) {
                    this.fadeIn(music, this.musicVolume * this.masterVolume, 2000);
                }
            } catch (error) {
                // Ignore play errors
            }
        }
    }

    stopMusic(fadeOut = false) {
        if (this.currentMusic) {
            if (fadeOut) {
                this.fadeOut(this.currentMusic, 1000, () => {
                    this.currentMusic.pause();
                    this.currentMusic = null;
                });
            } else {
                try {
                    this.currentMusic.pause();
                    this.currentMusic.currentTime = 0;
                } catch (error) {
                    // Ignore stop errors
                }
                this.currentMusic = null;
            }
        }
    }

    stop(name) {
        this.stopLoopingSound(name);

        const pending = this.pendingAggregations.get(name);
        if (pending?.timerId) {
            managedClearTimeout(pending.timerId);
            this.pendingAggregations.delete(name);
        }

        const sound = this.sounds[name];
        if (sound) {
            try {
                sound.pause();
                sound.currentTime = 0;
            } catch (error) {
                // Ignore stop errors
            }
        }
    }

    stopAll() {
        this.clearAggregations();
        for (const name of [...this.activeLoopingSounds.keys()]) {
            this.stopLoopingSound(name);
        }

        Object.values(this.sounds).forEach((sound) => {
            try {
                sound.pause();
                sound.currentTime = 0;
            } catch (error) {
                // Ignore stop errors
            }
        });

        this.stopMusic();
        this.currentlyPlaying = 0;
        this.playingByFamily.clear();
    }

    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        this.updateVolumes();
    }

    setSoundVolume(volume) {
        this.soundVolume = Math.max(0, Math.min(1, volume));
        this.updateVolumes();
    }

    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        this.updateVolumes();
    }

    updateVolumes() {
        Object.values(this.sounds).forEach((sound) => {
            if (sound.volume !== undefined) {
                sound.volume = this.soundVolume * this.masterVolume;
            }
        });

        Object.values(this.music).forEach((music) => {
            if (music.volume !== undefined) {
                music.volume = this.musicVolume * this.masterVolume;
            }
        });

        this.updateBusMix();
        this.updateAmbientSounds();
    }

    mute() {
        this.muted = true;
        this.stopAll();
    }

    unmute() {
        this.muted = false;
    }

    toggleMute() {
        if (this.muted) {
            this.unmute();
        } else {
            this.mute();
        }
    }

    fadeIn(audio, targetVolume, duration) {
        const startVolume = 0;
        const startTime = Date.now();

        const fade = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            try {
                audio.volume = startVolume + (targetVolume - startVolume) * progress;
            } catch (error) {
                // Ignore volume errors
            }

            if (progress < 1) {
                requestAnimationFrame(fade);
            }
        };

        fade();
    }

    fadeOut(audio, duration, callback) {
        const startVolume = audio.volume || 0;
        const startTime = Date.now();

        const fade = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            try {
                audio.volume = startVolume * (1 - progress);
            } catch (error) {
                // Ignore volume errors
            }

            if (progress < 1) {
                requestAnimationFrame(fade);
            } else if (callback) {
                callback();
            }
        };

        fade();
    }

    // Enhanced vampire-themed audio methods
    initializeVampireSounds() {
        const combat = (type, overrides = {}) => ({
            type,
            bus: 'combat',
            family: 'combat',
            pitch: 1.0,
            reverb: 0.16,
            durationMs: 260,
            throttleMs: 40,
            ...overrides
        });
        const reward = (type, overrides = {}) => ({
            type,
            bus: 'reward',
            family: 'reward',
            pitch: 1.0,
            reverb: 0.28,
            durationMs: 420,
            throttleMs: 70,
            ...overrides
        });
        const progression = (type, overrides = {}) => ({
            type,
            bus: 'reward',
            family: 'progression',
            pitch: 1.0,
            reverb: 0.34,
            durationMs: 620,
            throttleMs: 120,
            ...overrides
        });
        const ui = (type, overrides = {}) => ({
            type,
            bus: 'ui',
            family: 'ui',
            pitch: 1.0,
            reverb: 0.08,
            durationMs: 170,
            throttleMs: 45,
            ...overrides
        });
        const ambient = (type, overrides = {}) => ({
            type,
            bus: 'ambient',
            family: 'ambient',
            pitch: 1.0,
            reverb: 0.22,
            durationMs: 1800,
            throttleMs: 180,
            ...overrides
        });
        const boss = (type, overrides = {}) => ({
            type,
            bus: 'combat',
            family: 'boss',
            pitch: 1.0,
            reverb: 0.36,
            durationMs: 950,
            throttleMs: 220,
            ...overrides
        });

        this.vampireSoundMap = {
            vampireBite: combat('aggressiveWarm', { pitch: 0.94, durationMs: 220 }),
            bloodSplash: combat('wetSoft', { pitch: 1.04, reverb: 0.1, durationMs: 190 }),
            magicMissile: combat('glassPluck', { reverb: 0.26, durationMs: 280 }),
            whipCrack: combat('whipBody', { pitch: 1.02, durationMs: 210 }),
            knifeThrowing: combat('bladeAir', { pitch: 1.18, durationMs: 160, reverb: 0.1 }),
            criticalHit: reward('modalRewardAccent', { pitch: 0.98, reverb: 0.32, durationMs: 360 }),
            enemyDeath: combat('deathBloomCore', { pitch: 0.9, reverb: 0.2, durationMs: 240, throttleMs: 10 }),

            magicHit: combat('glassHit', { pitch: 1.08, reverb: 0.24, durationMs: 210 }),
            magicCharge: combat('magicChargeWarm', { pitch: 0.9, reverb: 0.28, durationMs: 320 }),
            arcaneWhisper: combat('reedAir', { pitch: 1.16, reverb: 0.34, durationMs: 340 }),
            whipHit: combat('whipImpact', { pitch: 0.94, reverb: 0.12, durationMs: 180 }),
            whipSwoosh: combat('clothWhoosh', { pitch: 1.0, reverb: 0.08, durationMs: 150 }),
            bladeHit: combat('woodBoneTick', { pitch: 1.08, reverb: 0.08, durationMs: 150 }),
            bladeWhoosh: combat('bladeAir', { pitch: 1.22, reverb: 0.08, durationMs: 140 }),
            metalGlint: reward('glassSpark', { pitch: 1.34, reverb: 0.2, durationMs: 220 }),
            bulletHit: combat('softImpact', { pitch: 0.98, durationMs: 170 }),
            gunshot: combat('softImpact', { pitch: 0.9, durationMs: 180, reverb: 0.12 }),
            shellDrop: ui('uiTickLow', { pitch: 0.84, durationMs: 110, reverb: 0.04 }),

            criticalBoom: reward('lowRewardBloom', { pitch: 0.82, reverb: 0.34, durationMs: 380 }),
            metalRing: reward('glassSpark', { pitch: 1.42, reverb: 0.18, durationMs: 250 }),
            comboChime: reward('modalRewardAccent', { pitch: 1.08, reverb: 0.24, durationMs: 300 }),
            massiveImpact: combat('lowImpactBloom', { pitch: 0.74, reverb: 0.28, durationMs: 340 }),
            deathSatisfaction: reward('lowRewardBloom', { pitch: 0.94, reverb: 0.18, durationMs: 260 }),

            boneBreak: combat('boneFlutter', { pitch: 0.96, durationMs: 220, reverb: 0.16 }),
            fleshTear: combat('wetSoft', { pitch: 0.84, durationMs: 200, reverb: 0.18 }),
            vampireScream: boss('reedCry', { pitch: 1.0, durationMs: 520, reverb: 0.42 }),
            ghostWail: boss('reedCry', { pitch: 1.28, durationMs: 600, reverb: 0.5 }),
            demonRoar: boss('lowWarning', { pitch: 0.72, durationMs: 700, reverb: 0.34 }),
            eliteDeath: combat('deathBloomCore', { pitch: 0.82, reverb: 0.28, durationMs: 340 }),
            bossDefeat: progression('bossResolve', { pitch: 0.72, durationMs: 1100, reverb: 0.42, family: 'boss' }),
            bossWarning: boss('bossWarningCue', { pitch: 0.96, durationMs: 760, reverb: 0.26 }),
            bossSpawn: boss('bossSpawnCue', { pitch: 0.9, durationMs: 980, reverb: 0.34 }),

            levelUp: progression('modalRewardPhrase', { pitch: 1.0, durationMs: 720 }),
            experienceGain: reward('collectCore', { pitch: 1.04, durationMs: 160, throttleMs: 0 }),
            weaponUpgrade: progression('upgradePhrase', { pitch: 1.02, durationMs: 760 }),
            levelUpFanfare: progression('modalRewardPhrase', { pitch: 1.08, durationMs: 860, reverb: 0.38 }),
            upgradeChime: progression('upgradePhrase', { pitch: 1.18, durationMs: 580, reverb: 0.3 }),

            challengeBell: reward('ritualBell', { pitch: 1.0, durationMs: 500 }),
            challengeComplete: progression('modalRewardPhrase', { pitch: 1.06, durationMs: 760 }),
            challengeFail: ui('uiSoftError', { pitch: 0.88, durationMs: 220, reverb: 0.06 }),
            victoryFanfare: progression('modalRewardPhrase', { pitch: 1.14, durationMs: 920, reverb: 0.4 }),
            achievementUnlock: progression('achievementPhrase', { pitch: 1.08, durationMs: 820, reverb: 0.38 }),

            heartbeat: ambient('heartbeatLoop', { loop: true, autoStopMs: 1600, durationMs: 1400, reverb: 0.1 }),
            windHowl: ambient('windLoop', { loop: true, durationMs: 2600, reverb: 0.18, pitch: 0.92 }),
            gothicOrgan: ambient('organDrone', {
                loop: true,
                durationMs: 3000,
                bus: 'music',
                family: 'music',
                reverb: 0.3
            }),
            lowDrone: ambient('lowDroneLoop', { loop: true, durationMs: 2800, reverb: 0.2 }),
            ritualPulse: ambient('ritualPulseLoop', { loop: true, durationMs: 1800, reverb: 0.12 }),

            uiHover: ui('uiGlass', { pitch: 1.08, durationMs: 120 }),
            uiSelect: ui('uiSelectWarm', { pitch: 1.0, durationMs: 170 }),
            menuHover: ui('uiGlass', { pitch: 1.12, durationMs: 120 }),
            menuSelect: ui('uiSelectWarm', { pitch: 0.96, durationMs: 180 }),
            errorBuzz: ui('uiSoftError', { pitch: 0.84, durationMs: 210 }),
            gameOver: boss('gameOverFall', { pitch: 0.72, durationMs: 1200, reverb: 0.38 }),

            powerUpCollect: reward('modalRewardAccent', { pitch: 1.2, durationMs: 360, reverb: 0.26 }),
            weaponEvolution: progression('achievementPhrase', { pitch: 0.92, durationMs: 980, reverb: 0.42 }),
            skillShot: reward('glassSpark', { pitch: 1.28, durationMs: 260, reverb: 0.18 }),

            lightningStrike: combat('silkLightning', { pitch: 1.0, durationMs: 180, reverb: 0.16 }),
            lightningChain: combat('silkLightningChain', { pitch: 1.14, durationMs: 160, reverb: 0.16 }),

            garlicPulse: combat('garlicHalo', { pitch: 0.96, durationMs: 260, reverb: 0.16, throttleMs: 65 }),

            orbiterWhoosh: combat('orbiterHalo', { pitch: 0.98, durationMs: 180, reverb: 0.16 }),
            orbiterHit: combat('glassHit', { pitch: 1.2, durationMs: 150, reverb: 0.12 }),

            fireballLaunch: combat('fireCeramic', { pitch: 0.98, durationMs: 260, reverb: 0.18 }),
            fireballExplosion: combat('fireBurstWarm', { pitch: 0.84, durationMs: 340, reverb: 0.28 }),

            boomerangThrow: combat('boneFlutter', { pitch: 1.0, durationMs: 230, reverb: 0.14 }),
            boomerangReturn: combat('boneReturnWhistle', { pitch: 1.14, durationMs: 210, reverb: 0.14 }),
            weaponFire: combat('woodBoneTick', { pitch: 1.0, durationMs: 150, reverb: 0.08 })
        };
    }

    initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Master dynamics compressor — tames peaks and reduces harshness
            this.compressor = this.audioContext.createDynamicsCompressor();
            this.compressor.threshold.setValueAtTime(-18, this.audioContext.currentTime);
            this.compressor.knee.setValueAtTime(12, this.audioContext.currentTime);
            this.compressor.ratio.setValueAtTime(6, this.audioContext.currentTime);
            this.compressor.attack.setValueAtTime(0.003, this.audioContext.currentTime);
            this.compressor.release.setValueAtTime(0.15, this.audioContext.currentTime);
            this.compressor.connect(this.audioContext.destination);

            // Master gain node — final stage before compression
            this.masterGainNode = this.audioContext.createGain();
            this.masterGainNode.gain.value = 1;
            this.masterGainNode.connect(this.compressor);

            this.createAudioBuses();
            this.createReverbEffect();
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
            this.audioContext = null;
        }
    }

    createAudioBuses() {
        if (!this.audioContext || !this.masterGainNode) return;

        this.busNodes = {};

        for (const [name, settings] of Object.entries(this.busSettings)) {
            const input = this.audioContext.createGain();
            const highpass = this.audioContext.createBiquadFilter();
            highpass.type = 'highpass';
            highpass.frequency.value = settings.highpass;

            const lowpass = this.audioContext.createBiquadFilter();
            lowpass.type = 'lowpass';
            lowpass.frequency.value = settings.lowpass;
            lowpass.Q.value = name === 'combat' ? 0.4 : 0.2;

            const gain = this.audioContext.createGain();
            gain.gain.value = settings.gain;

            input.connect(highpass);
            highpass.connect(lowpass);
            lowpass.connect(gain);
            gain.connect(this.masterGainNode);

            this.busNodes[name] = { input, highpass, lowpass, gain };
        }

        this.updateBusMix();
    }

    createReverbEffect() {
        if (!this.audioContext) return;

        try {
            // Create impulse response for a soft ritual hall reverb
            const length = this.audioContext.sampleRate * 3; // 3 seconds
            const impulse = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate);

            for (let channel = 0; channel < 2; channel++) {
                const channelData = impulse.getChannelData(channel);
                for (let i = 0; i < length; i++) {
                    const decay = Math.pow(1 - i / length, 2.7);
                    const toneTilt = 1 - Math.min(0.65, i / length);
                    channelData[i] = (Math.random() * 2 - 1) * decay * toneTilt;
                }
            }

            this.reverbBuffer = impulse;
        } catch (error) {
            console.warn('Failed to create reverb effect:', error);
            this.reverbBuffer = null;
        }
    }

    getBusInput(name) {
        return this.busNodes[name]?.input || this.masterGainNode || this.audioContext?.destination || null;
    }

    updateBusMix() {
        if (!this.audioContext || !this.busNodes) return;

        const now = this.audioContext.currentTime;
        const intensity = this.gameIntensity || 0;
        const settings = {
            ambient: {
                gain: this.mixDebug.busGains.ambient * (0.9 - intensity * 0.1),
                lowpass: 2400 - intensity * 300
            },
            music: {
                gain: this.mixDebug.busGains.music,
                lowpass: 5200 - intensity * 500
            },
            combat: {
                gain: this.mixDebug.busGains.combat,
                lowpass: 7600 - intensity * 2400
            },
            reward: {
                gain: this.mixDebug.busGains.reward,
                lowpass: 8400 - intensity * 900
            },
            ui: {
                gain: this.mixDebug.busGains.ui,
                lowpass: 9000
            }
        };

        for (const [name, bus] of Object.entries(this.busNodes)) {
            const mix = settings[name];
            if (!mix) continue;

            try {
                bus.gain.gain.setTargetAtTime(mix.gain, now, 0.25);
                bus.lowpass.frequency.setTargetAtTime(mix.lowpass, now, 0.25);
            } catch (error) {
                // Ignore filter automation errors
            }
        }
    }

    getSoundConfig(name) {
        return (
            this.vampireSoundMap[name] || {
                type: 'softImpact',
                bus: 'combat',
                family: 'combat',
                pitch: 1.0,
                reverb: 0.12,
                durationMs: 220,
                throttleMs: this.throttleInterval
            }
        );
    }

    shouldAggregateSound(name) {
        return Boolean(this.aggregationSettings[name]);
    }

    queueAggregatedSound(name, volume, pitch, config) {
        const settings = this.aggregationSettings[name];
        if (!settings) return false;

        const pending = this.pendingAggregations.get(name) || {
            count: 0,
            totalVolume: 0,
            maxVolume: 0,
            pitchSum: 0,
            maxPitch: 0,
            config
        };

        pending.count++;
        pending.totalVolume += volume;
        pending.maxVolume = Math.max(pending.maxVolume, volume);
        pending.pitchSum += pitch;
        pending.maxPitch = Math.max(pending.maxPitch, pitch);
        pending.config = config;

        if (pending.timerId) {
            managedClearTimeout(pending.timerId);
        }

        pending.timerId = managedSetTimeout(
            () => {
                this.flushAggregatedSound(name);
            },
            settings.windowMs,
            this
        );

        this.pendingAggregations.set(name, pending);
        return true;
    }

    flushAggregatedSound(name) {
        const pending = this.pendingAggregations.get(name);
        const settings = this.aggregationSettings[name];
        if (!pending || !settings) return;

        this.pendingAggregations.delete(name);

        const averagePitch = pending.pitchSum / Math.max(1, pending.count);
        const densityBoost = Math.min(1.75, 1 + pending.count * 0.08);
        const volume = Math.min(
            0.95,
            Math.min(0.85, Math.max(pending.maxVolume, pending.totalVolume * 0.35)) * densityBoost
        );
        const pitch = Math.min(pending.maxPitch + 0.08, averagePitch + pending.count * 0.015);
        const aggregateConfig = {
            ...pending.config,
            type: settings.aggregateType,
            family: settings.family || pending.config.family,
            durationMs: settings.durationMs,
            reverb: settings.reverb ?? pending.config.reverb,
            throttleMs: settings.windowMs
        };

        this.playResolvedSound(settings.aggregateName, volume, pitch, aggregateConfig, {
            bypassAggregation: true,
            bypassThrottle: true
        });
    }

    playLoopingSound(name, volume, pitch, config) {
        if (!this.audioContext) return;

        const existing = this.activeLoopingSounds.get(name);
        if (existing) {
            existing.volume = volume;
            existing.pitch = pitch;
            if (typeof existing.update === 'function') {
                existing.update(volume, pitch);
            }
            this.refreshLoopAutoStop(name, config);
            return;
        }

        const controller = this.createLoopingController(name, volume, pitch, config);
        if (!controller) return;

        this.activeLoopingSounds.set(name, controller);
        this.refreshLoopAutoStop(name, config);
    }

    refreshLoopAutoStop(name, config) {
        const controller = this.activeLoopingSounds.get(name);
        if (!controller || !config.autoStopMs) return;

        if (controller.autoStopTimerId) {
            managedClearTimeout(controller.autoStopTimerId);
        }

        controller.autoStopTimerId = managedSetTimeout(
            () => {
                this.stopLoopingSound(name);
            },
            config.autoStopMs,
            this
        );
    }

    createLoopingController(name, volume, pitch, config) {
        const busInput = this.getBusInput(config.bus || 'ambient');
        if (!busInput) return null;

        switch (config.type) {
            case 'windLoop':
                return this.createWindLoopController(name, busInput, volume, pitch, config);
            case 'lowDroneLoop':
                return this.createLowDroneController(name, busInput, volume, pitch, config);
            case 'ritualPulseLoop':
                return this.createRitualPulseController(name, busInput, volume, pitch, config);
            case 'heartbeatLoop':
                return this.createHeartbeatLoopController(name, busInput, volume, pitch, config);
            case 'organDrone':
                return this.createOrganLoopController(name, busInput, volume, pitch, config);
            default:
                return this.createOneShotLoopController(name, volume, pitch, config);
        }
    }

    createLoopGain(busInput, targetVolume) {
        const gain = this.audioContext.createGain();
        gain.gain.value = 0.0001;
        gain.connect(busInput);

        try {
            gain.gain.setTargetAtTime(Math.max(0.0001, targetVolume), this.audioContext.currentTime, 0.6);
        } catch (error) {
            gain.gain.value = targetVolume;
        }

        return gain;
    }

    createWindLoopController(name, busInput, volume, pitch, config) {
        const gain = this.createLoopGain(busInput, volume * this.soundVolume * this.masterVolume * 0.55);
        const source = this.audioContext.createBufferSource();
        source.buffer = this.getNoiseBuffer();
        source.loop = true;

        const bandpass = this.audioContext.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 420 * pitch;
        bandpass.Q.value = 0.4;

        const lowpass = this.audioContext.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 1800;

        const lfo = this.audioContext.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.05;
        const lfoGain = this.audioContext.createGain();
        lfoGain.gain.value = 120;

        source.connect(bandpass);
        bandpass.connect(lowpass);
        lowpass.connect(gain);
        lfo.connect(lfoGain);
        lfoGain.connect(bandpass.frequency);

        source.start();
        lfo.start();

        return {
            name,
            gain,
            nodes: [source, bandpass, lowpass, lfo, lfoGain],
            update: (nextVolume, nextPitch) => {
                gain.gain.setTargetAtTime(
                    Math.max(0.0001, nextVolume * this.soundVolume * this.masterVolume * 0.55),
                    this.audioContext.currentTime,
                    0.8
                );
                bandpass.frequency.setTargetAtTime(420 * nextPitch, this.audioContext.currentTime, 1.2);
            }
        };
    }

    createLowDroneController(name, busInput, volume, pitch) {
        const gain = this.createLoopGain(busInput, volume * this.soundVolume * this.masterVolume * 0.42);
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 360;
        filter.Q.value = 0.3;

        const osc1 = this.audioContext.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.value = 73.42 * pitch;

        const osc2 = this.audioContext.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.value = 110 * pitch;

        const osc2Gain = this.audioContext.createGain();
        osc2Gain.gain.value = 0.32;

        const lfo = this.audioContext.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.07;
        const lfoGain = this.audioContext.createGain();
        lfoGain.gain.value = 4;

        osc1.connect(filter);
        osc2.connect(osc2Gain);
        osc2Gain.connect(filter);
        filter.connect(gain);
        lfo.connect(lfoGain);
        lfoGain.connect(osc1.frequency);

        osc1.start();
        osc2.start();
        lfo.start();

        return {
            name,
            gain,
            nodes: [osc1, osc2, osc2Gain, filter, lfo, lfoGain],
            update: (nextVolume, nextPitch) => {
                gain.gain.setTargetAtTime(
                    Math.max(0.0001, nextVolume * this.soundVolume * this.masterVolume * 0.42),
                    this.audioContext.currentTime,
                    0.9
                );
                osc1.frequency.setTargetAtTime(73.42 * nextPitch, this.audioContext.currentTime, 1.4);
                osc2.frequency.setTargetAtTime(110 * nextPitch, this.audioContext.currentTime, 1.4);
            }
        };
    }

    createOrganLoopController(name, busInput, volume, pitch) {
        const gain = this.createLoopGain(busInput, volume * this.soundVolume * this.masterVolume * 0.28);
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1400;
        filter.Q.value = 0.2;

        const freqs = [146.83, 220, 293.66].map((freq) => freq * pitch);
        const nodes = [filter];

        freqs.forEach((freq, index) => {
            const osc = this.audioContext.createOscillator();
            osc.type = index === 1 ? 'triangle' : 'sine';
            osc.frequency.value = freq;

            const partialGain = this.audioContext.createGain();
            partialGain.gain.value = index === 1 ? 0.32 : 0.22;
            osc.connect(partialGain);
            partialGain.connect(filter);
            osc.start();

            nodes.push(osc, partialGain);
        });

        filter.connect(gain);

        return {
            name,
            gain,
            nodes,
            update: (nextVolume) => {
                gain.gain.setTargetAtTime(
                    Math.max(0.0001, nextVolume * this.soundVolume * this.masterVolume * 0.28),
                    this.audioContext.currentTime,
                    1.2
                );
            }
        };
    }

    createRitualPulseController(name, busInput, volume, pitch, config) {
        const gain = this.createLoopGain(busInput, volume * this.soundVolume * this.masterVolume);
        const state = { volume, pitch };
        const timerId = managedSetInterval(
            () => {
                if (this.muted) return;
                const pulseConfig = {
                    ...config,
                    loop: false,
                    reverb: 0.08,
                    durationMs: 220,
                    bus: 'ambient',
                    family: 'ambient'
                };
                this.synthesizeVampireSound('ritualPulseOneShot', state.volume * 0.45, state.pitch, pulseConfig);
            },
            2300,
            this
        );

        return {
            name,
            gain,
            intervalIds: [timerId],
            nodes: [],
            update: (nextVolume, nextPitch) => {
                state.volume = nextVolume;
                state.pitch = nextPitch;
                gain.gain.setTargetAtTime(
                    Math.max(0.0001, nextVolume * this.soundVolume * this.masterVolume),
                    this.audioContext.currentTime,
                    0.8
                );
            }
        };
    }

    createHeartbeatLoopController(name, busInput, volume, pitch, config) {
        const gain = this.createLoopGain(busInput, volume * this.soundVolume * this.masterVolume);
        const state = { volume, pitch };
        const timerId = managedSetInterval(
            () => {
                if (this.muted) return;
                const heartbeatConfig = {
                    ...config,
                    loop: false,
                    reverb: 0.04,
                    durationMs: 180,
                    bus: 'ambient',
                    family: 'ambient'
                };
                this.synthesizeVampireSound('heartbeatPulse', state.volume * 0.48, state.pitch, heartbeatConfig);
                managedSetTimeout(
                    () => {
                        this.synthesizeVampireSound(
                            'heartbeatPulse',
                            state.volume * 0.35,
                            state.pitch * 0.98,
                            heartbeatConfig
                        );
                    },
                    180,
                    this
                );
            },
            900,
            this
        );

        return {
            name,
            gain,
            intervalIds: [timerId],
            nodes: [],
            update: (nextVolume, nextPitch) => {
                state.volume = nextVolume;
                state.pitch = nextPitch;
                gain.gain.setTargetAtTime(
                    Math.max(0.0001, nextVolume * this.soundVolume * this.masterVolume),
                    this.audioContext.currentTime,
                    0.35
                );
            }
        };
    }

    createOneShotLoopController(name, volume, pitch, config) {
        const state = { volume, pitch };
        const timerId = managedSetInterval(
            () => {
                if (this.muted) return;
                this.playResolvedSound(
                    name,
                    state.volume,
                    state.pitch,
                    { ...config, loop: false },
                    { bypassAggregation: true }
                );
            },
            Math.max(400, config.durationMs || 1200),
            this
        );

        return {
            name,
            nodes: [],
            intervalIds: [timerId],
            update: (nextVolume, nextPitch) => {
                state.volume = nextVolume;
                state.pitch = nextPitch;
            }
        };
    }

    stopLoopingSound(name) {
        const controller = this.activeLoopingSounds.get(name);
        if (!controller) return;

        this.activeLoopingSounds.delete(name);

        if (controller.autoStopTimerId) {
            managedClearTimeout(controller.autoStopTimerId);
        }

        if (controller.intervalIds) {
            controller.intervalIds.forEach((id) => managedClearInterval(id));
        }

        if (controller.gain && this.audioContext) {
            try {
                controller.gain.gain.setTargetAtTime(0.0001, this.audioContext.currentTime, 0.25);
            } catch (error) {
                // Ignore gain automation errors
            }
        }

        managedSetTimeout(
            () => {
                const disconnectables = [...(controller.nodes || []), controller.gain].filter(Boolean);
                disconnectables.forEach((node) => {
                    try {
                        if (typeof node.stop === 'function') node.stop();
                    } catch (error) {
                        // Ignore stop errors
                    }

                    try {
                        if (typeof node.disconnect === 'function') node.disconnect();
                    } catch (error) {
                        // Ignore disconnect errors
                    }
                });
            },
            320,
            this
        );
    }

    clearAggregations() {
        for (const [name, pending] of this.pendingAggregations.entries()) {
            if (pending.timerId) {
                managedClearTimeout(pending.timerId);
            }
            this.pendingAggregations.delete(name);
        }
    }

    getNoiseBuffer() {
        if (!this.audioContext) return null;
        if (!this._noiseBuffer) {
            const len = this.audioContext.sampleRate;
            this._noiseBuffer = this.audioContext.createBuffer(1, len, this.audioContext.sampleRate);
            const data = this._noiseBuffer.getChannelData(0);
            for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        }
        return this._noiseBuffer;
    }

    // Enhanced play method with vampire-themed processing AND THROTTLING
    playVampireSound(name, volume = 1, pitch = 1) {
        if (this.muted) return;

        const soundConfig = this.getSoundConfig(name);

        if (soundConfig.loop) {
            this.playLoopingSound(name, volume, pitch, soundConfig);
            return;
        }

        if (this.shouldAggregateSound(name)) {
            this.queueAggregatedSound(name, volume, pitch, soundConfig);
            return;
        }

        this.playResolvedSound(name, volume, pitch, soundConfig);
    }

    playResolvedSound(name, volume, pitch, config, options = {}) {
        if (this.muted) return false;

        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
        }

        const throttleTime = config.throttleMs ?? this.throttleInterval;
        const now = performance.now();
        const lastPlayed = this.soundThrottle.get(name) || 0;
        if (!options.bypassThrottle && throttleTime > 0 && now - lastPlayed < throttleTime) {
            return false;
        }

        const family = config.family || 'combat';
        const familyCount = this.playingByFamily.get(family) || 0;
        const familyCap = this.familyCaps[family] || this.maxSimultaneousSounds;
        if (!options.bypassFamilyCap && familyCount >= familyCap) {
            return false;
        }

        if (
            !options.bypassFamilyCap &&
            this.currentlyPlaying >= this.maxSimultaneousSounds &&
            !['ui', 'boss'].includes(family)
        ) {
            return false;
        }

        this.soundThrottle.set(name, now);
        this.currentlyPlaying++;
        this.playingByFamily.set(family, familyCount + 1);

        const durationMs = config.durationMs || 260;
        managedSetTimeout(
            () => {
                this.currentlyPlaying = Math.max(0, this.currentlyPlaying - 1);
                const nextCount = Math.max(0, (this.playingByFamily.get(family) || 1) - 1);
                if (nextCount === 0) {
                    this.playingByFamily.delete(family);
                } else {
                    this.playingByFamily.set(family, nextCount);
                }
            },
            durationMs,
            this
        );

        const adjustedVolume = volume * this.getIntensityMultiplier(config.type);
        const adjustedPitch = pitch * (config.pitch || 1);
        const loadSoftness = this.getLoadSoftness(family, familyCap);

        this.playWithEffects(name, adjustedVolume, adjustedPitch, { ...config, loadSoftness });
        return true;
    }

    getLoadSoftness(family, familyCap) {
        const familyLoad = (this.playingByFamily.get(family) || 0) / Math.max(1, familyCap);
        const globalLoad = this.currentlyPlaying / Math.max(1, this.maxSimultaneousSounds);
        return Math.max(0, Math.min(1, Math.max(familyLoad, globalLoad * 0.9)));
    }

    playWithEffects(name, volume, pitch, config) {
        const sound = this.sounds[name];
        if (!sound) {
            // Create a synthesized sound if the actual sound file doesn't exist
            this.synthesizeVampireSound(config.type, volume, pitch, config);
            return;
        }

        try {
            // Apply dynamic volume based on game intensity
            const finalVolume = volume * this.soundVolume * this.masterVolume;
            sound.volume = finalVolume;

            // Apply pitch if supported (limited in HTML5 Audio)
            if (sound.playbackRate !== undefined) {
                sound.playbackRate = pitch;
            }

            sound.currentTime = 0;
            sound.play().catch(() => {
                // Ignore autoplay errors
            });
        } catch (error) {
            // Fall back to synthesized sound
            this.synthesizeVampireSound(config.type, volume, pitch, config);
        }
    }

    createSynthDestination(config) {
        const busInput = this.getBusInput(config.bus || 'combat');
        if (!busInput || !this.audioContext) {
            return this.masterGainNode || this.audioContext?.destination;
        }

        const softness = config.loadSoftness || 0;

        const sourceGain = this.audioContext.createGain();
        const routeFilter = this.audioContext.createBiquadFilter();
        routeFilter.type = 'lowpass';
        routeFilter.frequency.value = 12000 - softness * 6500;
        routeFilter.Q.value = 0.2;
        sourceGain.connect(routeFilter);

        const finalOutput = this.audioContext.createGain();
        finalOutput.gain.value = 1 - Math.max(0, softness - 0.6) * 0.15;
        const cleanupNodes = [sourceGain, routeFilter, finalOutput];

        if (this.reverbBuffer && config.reverb > 0) {
            const dryGain = this.audioContext.createGain();
            dryGain.gain.value = 1 - config.reverb * 0.5;

            const wetSend = this.audioContext.createGain();
            wetSend.gain.value = config.reverb * 0.45;
            const convolver = this.audioContext.createConvolver();
            convolver.buffer = this.reverbBuffer;
            cleanupNodes.push(dryGain, wetSend, convolver);

            routeFilter.connect(dryGain);
            routeFilter.connect(wetSend);
            wetSend.connect(convolver);
            convolver.connect(finalOutput);
            dryGain.connect(finalOutput);
        } else {
            routeFilter.connect(finalOutput);
        }

        finalOutput.connect(busInput);

        managedSetTimeout(
            () => {
                cleanupNodes.forEach((node) => {
                    try {
                        node.disconnect();
                    } catch (error) {
                        // Ignore disconnect errors
                    }
                });
            },
            (config.durationMs || 260) + 300,
            this
        );

        return sourceGain;
    }

    // ── Multi-oscillator layered synthesis engine ──────────────────────
    // Each sound type creates 2-4 oscillator layers + optional noise for
    // rich, satisfying audio.  Pitch is randomized ±5-15 % per play so
    // no two hits sound identical.

    /**
     * Create a one-shot noise burst (white noise through a bandpass).
     * Returns a {source, gain} pair already connected to `destination`.
     */
    _createNoiseBurst(destination, volume, duration, freqCenter = 1000, Q = 1) {
        const src = this.audioContext.createBufferSource();
        src.buffer = this.getNoiseBuffer();

        const bp = this.audioContext.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = freqCenter;
        bp.Q.value = Q;

        const g = this.audioContext.createGain();
        const now = this.audioContext.currentTime;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(Math.min(0.06, volume * 0.08), now + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, now + duration);

        src.connect(bp).connect(g).connect(destination);
        src.start(now);
        src.stop(now + duration);
        return { source: src, gain: g };
    }

    /**
     * Helper — create one oscillator layer with envelope.
     * @returns {OscillatorNode}
     */
    _createLayer(
        destination,
        {
            wave,
            freqStart,
            freqEnd,
            freqDur,
            attack = 0.01,
            sustain = 0.08,
            decay = 0.2,
            volume = 0.1,
            delay = 0,
            sweepType = 'exp'
        }
    ) {
        const now = this.audioContext.currentTime + delay;
        const osc = this.audioContext.createOscillator();
        osc.type = wave;
        osc.frequency.setValueAtTime(freqStart, now);
        if (freqEnd && freqDur) {
            if (sweepType === 'exp') {
                osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), now + freqDur);
            } else {
                osc.frequency.linearRampToValueAtTime(freqEnd, now + freqDur);
            }
        }

        const g = this.audioContext.createGain();
        const peak = Math.min(0.1, volume);
        const actualAttack = Math.max(0.005, attack);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(peak, now + actualAttack);
        g.gain.setValueAtTime(peak * 0.75, now + actualAttack + sustain);
        g.gain.exponentialRampToValueAtTime(0.0001, now + actualAttack + sustain + decay);

        osc.connect(g).connect(destination);
        const total = actualAttack + sustain + decay;
        osc.start(now);
        osc.stop(now + total + 0.01);
        return osc;
    }

    synthesizeVampireSound(type, volume, pitch, config) {
        if (!this.audioContext) return;

        try {
            // Pitch randomization — ±8 % so repeated sounds differ
            const pr = pitch * (0.92 + Math.random() * 0.16);

            const dest = this.createSynthDestination(config || {});
            const v = volume * (1 - (config?.loadSoftness || 0) * 0.12);
            const sparkle = 1 - (config?.loadSoftness || 0) * 0.45;
            const noiseSoftness = 1 - (config?.loadSoftness || 0) * 0.55;

            switch (type) {
                // ── COMBAT ──────────────────────────────────────
                case 'glassPluck': {
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 587 * pr,
                        freqEnd: 740 * pr,
                        freqDur: 0.12,
                        volume: v * 0.1,
                        attack: 0.004,
                        sustain: 0.03,
                        decay: 0.18
                    });
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 880 * pr,
                        freqEnd: 932 * pr,
                        freqDur: 0.1,
                        volume: v * 0.06 * sparkle,
                        attack: 0.008,
                        sustain: 0.03,
                        decay: 0.22,
                        delay: 0.012
                    });
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 1174 * pr,
                        freqEnd: 1318 * pr,
                        freqDur: 0.12,
                        volume: v * 0.03 * sparkle,
                        attack: 0.015,
                        sustain: 0.05,
                        decay: 0.26,
                        delay: 0.02
                    });
                    break;
                }

                case 'glassHit': {
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 740 * pr,
                        freqEnd: 698 * pr,
                        freqDur: 0.08,
                        volume: v * 0.08,
                        attack: 0.003,
                        sustain: 0.02,
                        decay: 0.16
                    });
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 1480 * pr,
                        freqEnd: 1244 * pr,
                        freqDur: 0.09,
                        volume: v * 0.035 * sparkle,
                        attack: 0.005,
                        sustain: 0.025,
                        decay: 0.14,
                        delay: 0.008
                    });
                    break;
                }

                case 'magicChargeWarm': {
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 220 * pr,
                        freqEnd: 293 * pr,
                        freqDur: 0.22,
                        volume: v * 0.09,
                        attack: 0.04,
                        sustain: 0.1,
                        decay: 0.22,
                        sweepType: 'lin'
                    });
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 440 * pr,
                        freqEnd: 523 * pr,
                        freqDur: 0.22,
                        volume: v * 0.05 * sparkle,
                        attack: 0.05,
                        sustain: 0.08,
                        decay: 0.26,
                        delay: 0.03,
                        sweepType: 'lin'
                    });
                    break;
                }

                case 'reedAir': {
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 392 * pr,
                        freqEnd: 440 * pr,
                        freqDur: 0.18,
                        volume: v * 0.06,
                        attack: 0.02,
                        sustain: 0.06,
                        decay: 0.18
                    });
                    this._createNoiseBurst(dest, v * 0.16 * noiseSoftness, 0.12, 1800, 0.5);
                    break;
                }

                case 'whipBody': {
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 180 * pr,
                        freqEnd: 120 * pr,
                        freqDur: 0.08,
                        volume: v * 0.12,
                        attack: 0.004,
                        sustain: 0.02,
                        decay: 0.12
                    });
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 82 * pr,
                        freqEnd: 60 * pr,
                        freqDur: 0.09,
                        volume: v * 0.08,
                        attack: 0.004,
                        sustain: 0.03,
                        decay: 0.14,
                        delay: 0.008
                    });
                    this._createNoiseBurst(dest, v * 0.14 * noiseSoftness, 0.04, 2200, 0.9);
                    break;
                }

                case 'whipImpact': {
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 130 * pr,
                        freqEnd: 88 * pr,
                        freqDur: 0.06,
                        volume: v * 0.12,
                        attack: 0.003,
                        sustain: 0.02,
                        decay: 0.1
                    });
                    this._createNoiseBurst(dest, v * 0.1 * noiseSoftness, 0.03, 1500, 0.7);
                    break;
                }

                case 'clothWhoosh': {
                    this._createNoiseBurst(dest, v * 0.14 * noiseSoftness, 0.08, 1100, 0.45);
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 260 * pr,
                        freqEnd: 180 * pr,
                        freqDur: 0.08,
                        volume: v * 0.03,
                        attack: 0.004,
                        sustain: 0.03,
                        decay: 0.08
                    });
                    break;
                }

                case 'bladeAir': {
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 980 * pr,
                        freqEnd: 1240 * pr,
                        freqDur: 0.05,
                        volume: v * 0.06,
                        attack: 0.002,
                        sustain: 0.015,
                        decay: 0.08
                    });
                    this._createNoiseBurst(dest, v * 0.08 * noiseSoftness, 0.05, 2600, 0.8);
                    break;
                }

                case 'woodBoneTick': {
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 420 * pr,
                        freqEnd: 300 * pr,
                        freqDur: 0.04,
                        volume: v * 0.06,
                        attack: 0.002,
                        sustain: 0.015,
                        decay: 0.06
                    });
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 210 * pr,
                        freqEnd: 180 * pr,
                        freqDur: 0.05,
                        volume: v * 0.04,
                        attack: 0.002,
                        sustain: 0.01,
                        decay: 0.08,
                        delay: 0.004
                    });
                    break;
                }

                case 'softImpact': {
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 90 * pr,
                        freqEnd: 50 * pr,
                        freqDur: 0.08,
                        volume: v * 0.1,
                        attack: 0.003,
                        sustain: 0.025,
                        decay: 0.12
                    });
                    this._createNoiseBurst(dest, v * 0.1 * noiseSoftness, 0.04, 1700, 0.8);
                    break;
                }

                case 'aggressiveWarm': {
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 150 * pr,
                        freqEnd: 105 * pr,
                        freqDur: 0.16,
                        volume: v * 0.12,
                        attack: 0.006,
                        sustain: 0.04,
                        decay: 0.16
                    });
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 62 * pr,
                        freqEnd: 46 * pr,
                        freqDur: 0.13,
                        volume: v * 0.08,
                        attack: 0.005,
                        sustain: 0.03,
                        decay: 0.14,
                        delay: 0.004
                    });
                    this._createNoiseBurst(dest, v * 0.12 * noiseSoftness, 0.05, 1800, 0.7);
                    break;
                }

                case 'wetSoft': {
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 180 * pr,
                        freqEnd: 150 * pr,
                        freqDur: 0.18,
                        volume: v * 0.08,
                        attack: 0.006,
                        sustain: 0.04,
                        decay: 0.14,
                        sweepType: 'lin'
                    });
                    this._createNoiseBurst(dest, v * 0.12 * noiseSoftness, 0.08, 700, 0.4);
                    break;
                }

                case 'deathBloomCore': {
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 220 * pr,
                        freqEnd: 90 * pr,
                        freqDur: 0.22,
                        volume: v * 0.08,
                        attack: 0.005,
                        sustain: 0.04,
                        decay: 0.2
                    });
                    this._createNoiseBurst(dest, v * 0.1 * noiseSoftness, 0.08, 1400, 0.5);
                    break;
                }

                case 'deathBloom': {
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 246 * pr,
                        freqEnd: 110 * pr,
                        freqDur: 0.28,
                        volume: v * 0.09,
                        attack: 0.01,
                        sustain: 0.06,
                        decay: 0.24
                    });
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 147 * pr,
                        freqEnd: 73 * pr,
                        freqDur: 0.24,
                        volume: v * 0.06,
                        attack: 0.01,
                        sustain: 0.05,
                        decay: 0.22,
                        delay: 0.03
                    });
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 587 * pr,
                        freqEnd: 220 * pr,
                        freqDur: 0.26,
                        volume: v * 0.03 * sparkle,
                        attack: 0.03,
                        sustain: 0.05,
                        decay: 0.3,
                        delay: 0.04
                    });
                    break;
                }

                case 'collectCore': {
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 587 * pr,
                        freqEnd: 622 * pr,
                        freqDur: 0.06,
                        volume: v * 0.07,
                        attack: 0.003,
                        sustain: 0.02,
                        decay: 0.08
                    });
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 740 * pr,
                        freqEnd: 784 * pr,
                        freqDur: 0.07,
                        volume: v * 0.06,
                        attack: 0.003,
                        sustain: 0.025,
                        decay: 0.1,
                        delay: 0.025
                    });
                    break;
                }

                case 'collectCluster': {
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 587 * pr,
                        freqEnd: 659 * pr,
                        freqDur: 0.08,
                        volume: v * 0.08,
                        attack: 0.003,
                        sustain: 0.03,
                        decay: 0.12
                    });
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 740 * pr,
                        freqEnd: 784 * pr,
                        freqDur: 0.08,
                        volume: v * 0.07,
                        attack: 0.003,
                        sustain: 0.03,
                        decay: 0.12,
                        delay: 0.04
                    });
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 880 * pr,
                        freqEnd: 988 * pr,
                        freqDur: 0.1,
                        volume: v * 0.05 * sparkle,
                        attack: 0.01,
                        sustain: 0.04,
                        decay: 0.16,
                        delay: 0.08
                    });
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 1174 * pr,
                        freqEnd: 1318 * pr,
                        freqDur: 0.12,
                        volume: v * 0.03 * sparkle,
                        attack: 0.012,
                        sustain: 0.05,
                        decay: 0.18,
                        delay: 0.11
                    });
                    break;
                }

                case 'modalRewardAccent': {
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 293 * pr,
                        freqEnd: 311 * pr,
                        freqDur: 0.16,
                        volume: v * 0.08,
                        attack: 0.01,
                        sustain: 0.05,
                        decay: 0.2
                    });
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 440 * pr,
                        freqEnd: 466 * pr,
                        freqDur: 0.16,
                        volume: v * 0.05 * sparkle,
                        attack: 0.015,
                        sustain: 0.05,
                        decay: 0.22,
                        delay: 0.04
                    });
                    break;
                }

                case 'lowRewardBloom': {
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 146 * pr,
                        freqEnd: 196 * pr,
                        freqDur: 0.18,
                        volume: v * 0.08,
                        attack: 0.012,
                        sustain: 0.06,
                        decay: 0.24
                    });
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 293 * pr,
                        freqEnd: 349 * pr,
                        freqDur: 0.16,
                        volume: v * 0.04,
                        attack: 0.02,
                        sustain: 0.05,
                        decay: 0.22,
                        delay: 0.04
                    });
                    break;
                }

                case 'modalRewardPhrase':
                case 'upgradePhrase':
                case 'achievementPhrase':
                case 'bossResolve': {
                    const phrase =
                        type === 'bossResolve'
                            ? [146, 174, 220, 293]
                            : type === 'upgradePhrase'
                              ? [293, 349, 440]
                              : [293, 349, 440, 466];
                    phrase.forEach((freq, index) => {
                        this._createLayer(dest, {
                            wave: index % 2 === 0 ? 'sine' : 'triangle',
                            freqStart: freq * pr,
                            freqEnd: freq * (1.02 + index * 0.01) * pr,
                            freqDur: 0.14,
                            volume: v * (0.085 - index * 0.012),
                            attack: 0.01,
                            sustain: 0.06,
                            decay: 0.24,
                            delay: index * 0.08,
                            sweepType: 'lin'
                        });
                    });
                    break;
                }

                case 'ritualBell': {
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 440 * pr,
                        freqEnd: 466 * pr,
                        freqDur: 0.18,
                        volume: v * 0.06,
                        attack: 0.01,
                        sustain: 0.05,
                        decay: 0.32
                    });
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 880 * pr,
                        freqEnd: 932 * pr,
                        freqDur: 0.16,
                        volume: v * 0.03 * sparkle,
                        attack: 0.015,
                        sustain: 0.04,
                        decay: 0.34,
                        delay: 0.03
                    });
                    break;
                }

                case 'glassSpark': {
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 1174 * pr,
                        freqEnd: 1318 * pr,
                        freqDur: 0.08,
                        volume: v * 0.04 * sparkle,
                        attack: 0.004,
                        sustain: 0.02,
                        decay: 0.12
                    });
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 1568 * pr,
                        freqEnd: 1760 * pr,
                        freqDur: 0.09,
                        volume: v * 0.02 * sparkle,
                        attack: 0.006,
                        sustain: 0.02,
                        decay: 0.14,
                        delay: 0.01
                    });
                    break;
                }

                case 'silkLightning': {
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 980 * pr,
                        freqEnd: 180 * pr,
                        freqDur: 0.06,
                        volume: v * 0.09,
                        attack: 0.002,
                        sustain: 0.015,
                        decay: 0.08
                    });
                    this._createNoiseBurst(dest, v * 0.14 * noiseSoftness, 0.05, 2600, 1.1);
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 540 * pr,
                        freqEnd: 180 * pr,
                        freqDur: 0.08,
                        volume: v * 0.03,
                        attack: 0.004,
                        sustain: 0.02,
                        decay: 0.1,
                        delay: 0.01
                    });
                    break;
                }

                case 'silkLightningChain': {
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 880 * pr,
                        freqEnd: 280 * pr,
                        freqDur: 0.05,
                        volume: v * 0.07,
                        attack: 0.002,
                        sustain: 0.012,
                        decay: 0.07
                    });
                    this._createNoiseBurst(dest, v * 0.1 * noiseSoftness, 0.04, 2200, 0.9);
                    break;
                }

                case 'garlicHalo': {
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 196 * pr,
                        freqEnd: 220 * pr,
                        freqDur: 0.16,
                        volume: v * 0.06,
                        attack: 0.02,
                        sustain: 0.05,
                        decay: 0.16,
                        sweepType: 'lin'
                    });
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 392 * pr,
                        freqEnd: 440 * pr,
                        freqDur: 0.16,
                        volume: v * 0.025 * sparkle,
                        attack: 0.03,
                        sustain: 0.05,
                        decay: 0.18,
                        delay: 0.01,
                        sweepType: 'lin'
                    });
                    break;
                }

                case 'orbiterHalo': {
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 330 * pr,
                        freqEnd: 494 * pr,
                        freqDur: 0.09,
                        volume: v * 0.05,
                        attack: 0.004,
                        sustain: 0.03,
                        decay: 0.12
                    });
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 784 * pr,
                        freqEnd: 988 * pr,
                        freqDur: 0.08,
                        volume: v * 0.025 * sparkle,
                        attack: 0.01,
                        sustain: 0.03,
                        decay: 0.1,
                        delay: 0.01
                    });
                    break;
                }

                case 'fireCeramic': {
                    this._createNoiseBurst(dest, v * 0.12 * noiseSoftness, 0.1, 1200, 0.5);
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 320 * pr,
                        freqEnd: 180 * pr,
                        freqDur: 0.12,
                        volume: v * 0.08,
                        attack: 0.004,
                        sustain: 0.04,
                        decay: 0.16
                    });
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 620 * pr,
                        freqEnd: 420 * pr,
                        freqDur: 0.11,
                        volume: v * 0.03,
                        attack: 0.01,
                        sustain: 0.03,
                        decay: 0.12,
                        delay: 0.015
                    });
                    break;
                }

                case 'fireBurstWarm': {
                    this._createNoiseBurst(dest, v * 0.16 * noiseSoftness, 0.12, 1000, 0.45);
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 260 * pr,
                        freqEnd: 120 * pr,
                        freqDur: 0.14,
                        volume: v * 0.09,
                        attack: 0.005,
                        sustain: 0.04,
                        decay: 0.18
                    });
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 140 * pr,
                        freqEnd: 70 * pr,
                        freqDur: 0.16,
                        volume: v * 0.05,
                        attack: 0.008,
                        sustain: 0.05,
                        decay: 0.2,
                        delay: 0.01
                    });
                    break;
                }

                case 'boneFlutter': {
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 340 * pr,
                        freqEnd: 520 * pr,
                        freqDur: 0.09,
                        volume: v * 0.06,
                        attack: 0.004,
                        sustain: 0.03,
                        decay: 0.14
                    });
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 190 * pr,
                        freqEnd: 260 * pr,
                        freqDur: 0.09,
                        volume: v * 0.04,
                        attack: 0.004,
                        sustain: 0.03,
                        decay: 0.12,
                        delay: 0.01
                    });
                    this._createNoiseBurst(dest, v * 0.08 * noiseSoftness, 0.05, 900, 0.4);
                    break;
                }

                case 'boneReturnWhistle': {
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 440 * pr,
                        freqEnd: 620 * pr,
                        freqDur: 0.12,
                        volume: v * 0.05,
                        attack: 0.004,
                        sustain: 0.04,
                        decay: 0.14
                    });
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 620 * pr,
                        freqEnd: 520 * pr,
                        freqDur: 0.08,
                        volume: v * 0.02 * sparkle,
                        attack: 0.01,
                        sustain: 0.03,
                        decay: 0.12,
                        delay: 0.02
                    });
                    break;
                }

                case 'bossWarningCue': {
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 146 * pr,
                        freqEnd: 110 * pr,
                        freqDur: 0.32,
                        volume: v * 0.08,
                        attack: 0.02,
                        sustain: 0.08,
                        decay: 0.3
                    });
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 220 * pr,
                        freqEnd: 174 * pr,
                        freqDur: 0.28,
                        volume: v * 0.05,
                        attack: 0.03,
                        sustain: 0.08,
                        decay: 0.32,
                        delay: 0.04
                    });
                    break;
                }

                case 'bossSpawnCue': {
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 110 * pr,
                        freqEnd: 73 * pr,
                        freqDur: 0.45,
                        volume: v * 0.1,
                        attack: 0.02,
                        sustain: 0.12,
                        decay: 0.42
                    });
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 220 * pr,
                        freqEnd: 293 * pr,
                        freqDur: 0.38,
                        volume: v * 0.04,
                        attack: 0.03,
                        sustain: 0.12,
                        decay: 0.36,
                        delay: 0.06,
                        sweepType: 'lin'
                    });
                    break;
                }

                case 'lowWarning': {
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 98 * pr,
                        freqEnd: 73 * pr,
                        freqDur: 0.3,
                        volume: v * 0.08,
                        attack: 0.01,
                        sustain: 0.08,
                        decay: 0.24
                    });
                    break;
                }

                case 'reedCry': {
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 330 * pr,
                        freqEnd: 220 * pr,
                        freqDur: 0.22,
                        volume: v * 0.06,
                        attack: 0.02,
                        sustain: 0.07,
                        decay: 0.26
                    });
                    this._createNoiseBurst(dest, v * 0.08 * noiseSoftness, 0.1, 1600, 0.6);
                    break;
                }

                case 'uiGlass': {
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 880 * pr,
                        freqEnd: 988 * pr,
                        freqDur: 0.03,
                        volume: v * 0.04,
                        attack: 0.002,
                        sustain: 0.015,
                        decay: 0.05
                    });
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 1320 * pr,
                        freqEnd: 1480 * pr,
                        freqDur: 0.03,
                        volume: v * 0.015 * sparkle,
                        attack: 0.003,
                        sustain: 0.01,
                        decay: 0.05,
                        delay: 0.004
                    });
                    break;
                }

                case 'uiSelectWarm': {
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 659 * pr,
                        freqEnd: 740 * pr,
                        freqDur: 0.05,
                        volume: v * 0.05,
                        attack: 0.003,
                        sustain: 0.02,
                        decay: 0.07
                    });
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 988 * pr,
                        freqEnd: 1108 * pr,
                        freqDur: 0.05,
                        volume: v * 0.018 * sparkle,
                        attack: 0.004,
                        sustain: 0.015,
                        decay: 0.07,
                        delay: 0.006
                    });
                    break;
                }

                case 'uiTickLow': {
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 420 * pr,
                        freqEnd: 360 * pr,
                        freqDur: 0.04,
                        volume: v * 0.04,
                        attack: 0.002,
                        sustain: 0.012,
                        decay: 0.05
                    });
                    break;
                }

                case 'uiSoftError': {
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 330 * pr,
                        freqEnd: 250 * pr,
                        freqDur: 0.05,
                        volume: v * 0.04,
                        attack: 0.004,
                        sustain: 0.015,
                        decay: 0.09
                    });
                    break;
                }

                case 'heartbeatPulse': {
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 64 * pr,
                        freqEnd: 52 * pr,
                        freqDur: 0.08,
                        volume: v * 0.08,
                        attack: 0.003,
                        sustain: 0.02,
                        decay: 0.12
                    });
                    break;
                }

                case 'ritualPulseOneShot': {
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 146 * pr,
                        freqEnd: 110 * pr,
                        freqDur: 0.09,
                        volume: v * 0.07,
                        attack: 0.004,
                        sustain: 0.03,
                        decay: 0.11
                    });
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 293 * pr,
                        freqEnd: 330 * pr,
                        freqDur: 0.09,
                        volume: v * 0.03,
                        attack: 0.01,
                        sustain: 0.03,
                        decay: 0.12,
                        delay: 0.01
                    });
                    break;
                }

                case 'gameOverFall': {
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 196 * pr,
                        freqEnd: 73 * pr,
                        freqDur: 0.6,
                        volume: v * 0.1,
                        attack: 0.02,
                        sustain: 0.12,
                        decay: 0.55
                    });
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 98 * pr,
                        freqEnd: 49 * pr,
                        freqDur: 0.56,
                        volume: v * 0.06,
                        attack: 0.03,
                        sustain: 0.1,
                        decay: 0.5,
                        delay: 0.02
                    });
                    break;
                }

                case 'aggressive': {
                    // Layer 1: triangle growl (softer than sawtooth)
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 130 * pr,
                        freqEnd: 90 * pr,
                        freqDur: 0.18,
                        volume: v * 0.14,
                        attack: 0.01,
                        sustain: 0.06,
                        decay: 0.22
                    });
                    // Layer 2: sub-bass sine punch
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 55 * pr,
                        freqEnd: 40 * pr,
                        freqDur: 0.15,
                        volume: v * 0.1,
                        attack: 0.005,
                        sustain: 0.04,
                        decay: 0.18,
                        delay: 0.005
                    });
                    // Layer 3: noise crack
                    this._createNoiseBurst(dest, v * 0.3, 0.08, 2400, 0.8);
                    break;
                }

                case 'magical': {
                    // Layer 1: C5 sine
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 523 * pr,
                        freqEnd: 587 * pr,
                        freqDur: 0.25,
                        volume: v * 0.12,
                        attack: 0.015,
                        sustain: 0.12,
                        decay: 0.25
                    });
                    // Layer 2: E5 harmonic (major third shimmer)
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 659 * pr,
                        freqEnd: 698 * pr,
                        freqDur: 0.25,
                        volume: v * 0.08,
                        attack: 0.02,
                        sustain: 0.1,
                        decay: 0.3,
                        delay: 0.015
                    });
                    // Layer 3: high shimmer triangle
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 1318 * pr,
                        freqEnd: 1568 * pr,
                        freqDur: 0.2,
                        volume: v * 0.04,
                        attack: 0.03,
                        sustain: 0.08,
                        decay: 0.35,
                        delay: 0.03
                    });
                    break;
                }

                case 'impact': {
                    // Layer 1: triangle thud
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 80 * pr,
                        freqEnd: 45 * pr,
                        freqDur: 0.08,
                        volume: v * 0.15,
                        attack: 0.003,
                        sustain: 0.03,
                        decay: 0.15
                    });
                    // Layer 2: sub sine
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 50 * pr,
                        freqEnd: 30 * pr,
                        freqDur: 0.1,
                        volume: v * 0.1,
                        attack: 0.005,
                        sustain: 0.04,
                        decay: 0.12,
                        delay: 0.003
                    });
                    // Layer 3: noise snap
                    this._createNoiseBurst(dest, v * 0.35, 0.06, 3500, 1.2);
                    break;
                }

                case 'collect': {
                    // Ascending arpeggio: E5 → G5 → C6
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 659 * pr,
                        freqEnd: 680 * pr,
                        freqDur: 0.08,
                        volume: v * 0.1,
                        attack: 0.005,
                        sustain: 0.04,
                        decay: 0.12
                    });
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 784 * pr,
                        freqEnd: 800 * pr,
                        freqDur: 0.08,
                        volume: v * 0.09,
                        attack: 0.005,
                        sustain: 0.04,
                        decay: 0.12,
                        delay: 0.04
                    });
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 1047 * pr,
                        freqEnd: 1100 * pr,
                        freqDur: 0.08,
                        volume: v * 0.08,
                        attack: 0.005,
                        sustain: 0.04,
                        decay: 0.15,
                        delay: 0.08
                    });
                    // Sparkle overtone
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 2093 * pr,
                        freqEnd: 2400 * pr,
                        freqDur: 0.15,
                        volume: v * 0.03,
                        attack: 0.01,
                        sustain: 0.05,
                        decay: 0.2,
                        delay: 0.06
                    });
                    break;
                }

                case 'positive': {
                    // Major triad staggered: C5, E5, G5
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 523 * pr,
                        freqEnd: 540 * pr,
                        freqDur: 0.2,
                        volume: v * 0.1,
                        attack: 0.01,
                        sustain: 0.1,
                        decay: 0.25
                    });
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 659 * pr,
                        freqEnd: 670 * pr,
                        freqDur: 0.2,
                        volume: v * 0.08,
                        attack: 0.01,
                        sustain: 0.1,
                        decay: 0.25,
                        delay: 0.03
                    });
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 784 * pr,
                        freqEnd: 800 * pr,
                        freqDur: 0.2,
                        volume: v * 0.06,
                        attack: 0.01,
                        sustain: 0.1,
                        decay: 0.3,
                        delay: 0.06
                    });
                    // High shimmer
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 1568 * pr,
                        freqEnd: 1760 * pr,
                        freqDur: 0.15,
                        volume: v * 0.03,
                        attack: 0.02,
                        sustain: 0.06,
                        decay: 0.2,
                        delay: 0.08
                    });
                    break;
                }

                case 'ui': {
                    // Clean sine tap + soft harmonic
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 880 * pr,
                        freqEnd: 920 * pr,
                        freqDur: 0.04,
                        volume: v * 0.06,
                        attack: 0.003,
                        sustain: 0.02,
                        decay: 0.08
                    });
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 1760 * pr,
                        freqEnd: 1800 * pr,
                        freqDur: 0.03,
                        volume: v * 0.03,
                        attack: 0.005,
                        sustain: 0.01,
                        decay: 0.06,
                        delay: 0.005
                    });
                    break;
                }

                case 'death': {
                    // Layer 1: descending sawtooth
                    this._createLayer(dest, {
                        wave: 'sawtooth',
                        freqStart: 220 * pr,
                        freqEnd: 80 * pr,
                        freqDur: 0.35,
                        volume: v * 0.12,
                        attack: 0.005,
                        sustain: 0.08,
                        decay: 0.35
                    });
                    // Layer 2: sub triangle rumble (softer than square)
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 65 * pr,
                        freqEnd: 35 * pr,
                        freqDur: 0.3,
                        volume: v * 0.06,
                        attack: 0.01,
                        sustain: 0.06,
                        decay: 0.25,
                        delay: 0.01
                    });
                    // Layer 3: noise burst
                    this._createNoiseBurst(dest, v * 0.3, 0.12, 1800, 0.6);
                    // Layer 4: descending whistle
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 600 * pr,
                        freqEnd: 150 * pr,
                        freqDur: 0.3,
                        volume: v * 0.04,
                        attack: 0.02,
                        sustain: 0.05,
                        decay: 0.3,
                        delay: 0.02
                    });
                    break;
                }

                case 'sharp': {
                    // Layer 1: bright triangle
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 1100 * pr,
                        freqEnd: 1400 * pr,
                        freqDur: 0.06,
                        volume: v * 0.1,
                        attack: 0.002,
                        sustain: 0.02,
                        decay: 0.1
                    });
                    // Layer 2: metallic sine
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 2200 * pr,
                        freqEnd: 2600 * pr,
                        freqDur: 0.05,
                        volume: v * 0.04,
                        attack: 0.003,
                        sustain: 0.015,
                        decay: 0.08,
                        delay: 0.003
                    });
                    // Layer 3: tiny noise edge
                    this._createNoiseBurst(dest, v * 0.2, 0.04, 5000, 1.0);
                    break;
                }

                case 'wet': {
                    // Layer 1: deep sine wobble
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 200 * pr,
                        freqEnd: 170 * pr,
                        freqDur: 0.25,
                        volume: v * 0.1,
                        attack: 0.01,
                        sustain: 0.08,
                        decay: 0.2,
                        sweepType: 'lin'
                    });
                    // Layer 2: filtered noise bubble
                    this._createNoiseBurst(dest, v * 0.25, 0.15, 800, 0.5);
                    // Layer 3: harmonic overtone
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 400 * pr,
                        freqEnd: 350 * pr,
                        freqDur: 0.2,
                        volume: v * 0.04,
                        attack: 0.02,
                        sustain: 0.06,
                        decay: 0.15,
                        delay: 0.01
                    });
                    break;
                }

                case 'dramatic': {
                    // Layer 1: heavy sawtooth descent
                    this._createLayer(dest, {
                        wave: 'sawtooth',
                        freqStart: 150 * pr,
                        freqEnd: 55 * pr,
                        freqDur: 0.7,
                        volume: v * 0.13,
                        attack: 0.01,
                        sustain: 0.15,
                        decay: 0.6
                    });
                    // Layer 2: sub bass
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 65 * pr,
                        freqEnd: 35 * pr,
                        freqDur: 0.6,
                        volume: v * 0.08,
                        attack: 0.02,
                        sustain: 0.1,
                        decay: 0.5,
                        delay: 0.02
                    });
                    // Layer 3: tense harmonic
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 330 * pr,
                        freqEnd: 220 * pr,
                        freqDur: 0.5,
                        volume: v * 0.05,
                        attack: 0.03,
                        sustain: 0.1,
                        decay: 0.4,
                        delay: 0.04
                    });
                    break;
                }

                case 'musical': {
                    // Layer 1: C4 sine
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 261 * pr,
                        freqEnd: 329 * pr,
                        freqDur: 0.4,
                        volume: v * 0.1,
                        attack: 0.02,
                        sustain: 0.2,
                        decay: 0.35
                    });
                    // Layer 2: E4 harmony
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 329 * pr,
                        freqEnd: 392 * pr,
                        freqDur: 0.4,
                        volume: v * 0.06,
                        attack: 0.03,
                        sustain: 0.18,
                        decay: 0.3,
                        delay: 0.02
                    });
                    break;
                }

                case 'ambient': {
                    // Layer 1: slow sine sweep
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 440 * pr,
                        freqEnd: 466 * pr,
                        freqDur: 1.8,
                        volume: v * 0.08,
                        attack: 0.1,
                        sustain: 0.5,
                        decay: 1.5,
                        sweepType: 'lin'
                    });
                    // Layer 2: sub drone
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 220 * pr,
                        freqEnd: 233 * pr,
                        freqDur: 1.8,
                        volume: v * 0.04,
                        attack: 0.15,
                        sustain: 0.5,
                        decay: 1.5,
                        delay: 0.05,
                        sweepType: 'lin'
                    });
                    break;
                }

                case 'lightning': {
                    // Layer 1: triangle crack (softer than sawtooth)
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 1400 * pr,
                        freqEnd: 180 * pr,
                        freqDur: 0.07,
                        volume: v * 0.14,
                        attack: 0.002,
                        sustain: 0.02,
                        decay: 0.1
                    });
                    // Layer 2: noise crackle
                    this._createNoiseBurst(dest, v * 0.35, 0.08, 4000, 1.5);
                    // Layer 3: sine zap trail
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 800 * pr,
                        freqEnd: 200 * pr,
                        freqDur: 0.12,
                        volume: v * 0.06,
                        attack: 0.005,
                        sustain: 0.03,
                        decay: 0.12,
                        delay: 0.015
                    });
                    break;
                }

                case 'aura': {
                    // Layer 1: sine drone
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 120 * pr,
                        freqEnd: 140 * pr,
                        freqDur: 0.15,
                        volume: v * 0.08,
                        attack: 0.01,
                        sustain: 0.06,
                        decay: 0.12,
                        sweepType: 'lin'
                    });
                    // Layer 2: triangle pulse
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 240 * pr,
                        freqEnd: 260 * pr,
                        freqDur: 0.12,
                        volume: v * 0.04,
                        attack: 0.015,
                        sustain: 0.04,
                        decay: 0.1,
                        delay: 0.01,
                        sweepType: 'lin'
                    });
                    // Layer 3: sub-harmonic
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 60 * pr,
                        freqEnd: 70 * pr,
                        freqDur: 0.12,
                        volume: v * 0.05,
                        attack: 0.02,
                        sustain: 0.05,
                        decay: 0.1,
                        delay: 0.005,
                        sweepType: 'lin'
                    });
                    break;
                }

                case 'orbiter': {
                    // Ethereal whoosh with harmonic shimmer
                    // Layer 1: whoosh sweep
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 300 * pr,
                        freqEnd: 600 * pr,
                        freqDur: 0.1,
                        volume: v * 0.07,
                        attack: 0.005,
                        sustain: 0.04,
                        decay: 0.12
                    });
                    // Layer 2: harmonic chime
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 880 * pr,
                        freqEnd: 1100 * pr,
                        freqDur: 0.08,
                        volume: v * 0.04,
                        attack: 0.01,
                        sustain: 0.03,
                        decay: 0.1,
                        delay: 0.01
                    });
                    // Layer 3: soft noise air
                    this._createNoiseBurst(dest, v * 0.15, 0.1, 2000, 0.4);
                    break;
                }

                case 'fireball': {
                    // Layer 1: whooshing flame (triangle is softer than sawtooth)
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 400 * pr,
                        freqEnd: 180 * pr,
                        freqDur: 0.15,
                        volume: v * 0.12,
                        attack: 0.005,
                        sustain: 0.05,
                        decay: 0.18
                    });
                    // Layer 2: crackling fire noise
                    this._createNoiseBurst(dest, v * 0.3, 0.12, 2800, 0.9);
                    // Layer 3: deep bass impact
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 100 * pr,
                        freqEnd: 50 * pr,
                        freqDur: 0.2,
                        volume: v * 0.08,
                        attack: 0.01,
                        sustain: 0.06,
                        decay: 0.2,
                        delay: 0.01
                    });
                    // Layer 4: bright flame top
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 900 * pr,
                        freqEnd: 500 * pr,
                        freqDur: 0.1,
                        volume: v * 0.04,
                        attack: 0.008,
                        sustain: 0.03,
                        decay: 0.12,
                        delay: 0.02
                    });
                    break;
                }

                case 'boomerang': {
                    // Layer 1: spinning whoosh
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 250 * pr,
                        freqEnd: 450 * pr,
                        freqDur: 0.12,
                        volume: v * 0.09,
                        attack: 0.005,
                        sustain: 0.04,
                        decay: 0.14
                    });
                    // Layer 2: bone rattle
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 1200 * pr,
                        freqEnd: 800 * pr,
                        freqDur: 0.08,
                        volume: v * 0.05,
                        attack: 0.003,
                        sustain: 0.02,
                        decay: 0.08,
                        delay: 0.01
                    });
                    // Layer 3: air cutting noise
                    this._createNoiseBurst(dest, v * 0.2, 0.08, 3500, 1.2);
                    break;
                }

                default: {
                    // Fallback: warm sine + harmonic
                    this._createLayer(dest, {
                        wave: 'sine',
                        freqStart: 440 * pr,
                        freqEnd: 460 * pr,
                        freqDur: 0.15,
                        volume: v * 0.1,
                        attack: 0.01,
                        sustain: 0.05,
                        decay: 0.15
                    });
                    this._createLayer(dest, {
                        wave: 'triangle',
                        freqStart: 880 * pr,
                        freqEnd: 900 * pr,
                        freqDur: 0.12,
                        volume: v * 0.04,
                        attack: 0.02,
                        sustain: 0.04,
                        decay: 0.12,
                        delay: 0.01
                    });
                    break;
                }
            }
        } catch (error) {
            console.warn('Failed to synthesize vampire sound:', error);
        }
    }

    getIntensityMultiplier(type) {
        if (!this.dynamicMixing) return 1;

        switch (type) {
            case 'windLoop':
            case 'lowDroneLoop':
            case 'ritualPulseLoop':
            case 'heartbeatLoop':
            case 'organDrone':
                return 0.7 - this.gameIntensity * 0.12;
            case 'glassPluck':
            case 'glassHit':
            case 'magicChargeWarm':
            case 'reedAir':
            case 'whipBody':
            case 'whipImpact':
            case 'clothWhoosh':
            case 'bladeAir':
            case 'woodBoneTick':
            case 'softImpact':
            case 'aggressiveWarm':
            case 'wetSoft':
            case 'deathBloomCore':
            case 'deathBloom':
            case 'silkLightning':
            case 'silkLightningChain':
            case 'garlicHalo':
            case 'orbiterHalo':
            case 'fireCeramic':
            case 'fireBurstWarm':
            case 'boneFlutter':
            case 'boneReturnWhistle':
            case 'heartbeatPulse':
            case 'ritualPulseOneShot':
                return 0.56 + this.gameIntensity * 0.22;
            case 'collectCore':
            case 'collectCluster':
                return 0.65 + this.gameIntensity * 0.12;
            case 'modalRewardAccent':
            case 'lowRewardBloom':
            case 'modalRewardPhrase':
            case 'upgradePhrase':
            case 'achievementPhrase':
            case 'ritualBell':
            case 'glassSpark':
            case 'bossResolve':
                return 0.78 + this.gameIntensity * 0.18;
            case 'bossWarningCue':
            case 'bossSpawnCue':
            case 'lowWarning':
            case 'reedCry':
            case 'gameOverFall':
                return 0.72 + this.gameIntensity * 0.2;
            case 'uiGlass':
            case 'uiSelectWarm':
            case 'uiTickLow':
            case 'uiSoftError':
                return 0.58;
            case 'aggressive':
            case 'impact':
                return 0.5 + this.gameIntensity * 0.3;
            case 'ambient':
                return 0.8 - this.gameIntensity * 0.2;
            case 'magical':
                return 0.7 + this.gameIntensity * 0.2;
            case 'positive':
                return 0.8 + this.gameIntensity * 0.3;
            case 'ui':
                return 0.6;
            case 'collect':
                return 0.7 + this.gameIntensity * 0.2;
            case 'death':
                return 0.6 + this.gameIntensity * 0.2;
            case 'sharp':
                return 0.5 + this.gameIntensity * 0.25;
            case 'dramatic':
                return 0.7 + this.gameIntensity * 0.4;
            case 'musical':
                return 0.9 - this.gameIntensity * 0.1;
            case 'lightning':
                return 0.6 + this.gameIntensity * 0.3;
            case 'aura':
                return 0.4 + this.gameIntensity * 0.15;
            case 'orbiter':
                return 0.5 + this.gameIntensity * 0.2;
            case 'fireball':
                return 0.6 + this.gameIntensity * 0.25;
            case 'boomerang':
                return 0.5 + this.gameIntensity * 0.2;
            default:
                return 0.7;
        }
    }

    setGameIntensity(intensity) {
        this.gameIntensity = Math.max(0, Math.min(1, intensity));

        // Adjust music based on intensity
        if (this.currentMusic && this.dynamicMixing) {
            const targetVolume = this.musicVolume * this.masterVolume * (0.6 + intensity * 0.4);
            this.currentMusic.volume = targetVolume;
        }

        this.updateBusMix();
        this.updateAmbientSounds();
    }

    playVampireBite() {
        this.playVampireSound('vampireBite', 0.4);
    }

    playBloodSplash() {
        this.playVampireSound('bloodSplash', 0.6);
    }

    playMagicMissile() {
        this.playVampireSound('magicMissile', 0.4);
    }

    playWhipCrack() {
        this.playVampireSound('whipCrack', 0.45);
    }

    playKnifeThrow() {
        this.playVampireSound('knifeThrowing', 0.5);
    }

    playCriticalHit() {
        this.playVampireSound('criticalHit', 0.5);
        this.setGameIntensity(Math.min(1, this.gameIntensity + 0.1)); // Increase intensity
    }

    playEnemyDeath() {
        this.playVampireSound('enemyDeath', 0.4);
    }

    playLevelUp() {
        this.playVampireSound('levelUp', 0.5);
    }

    playExperienceGain() {
        this.playVampireSound('experienceGain', 0.4);
    }

    playWeaponUpgrade() {
        this.playVampireSound('weaponUpgrade', 0.4);
    }

    playMenuHover() {
        this.playVampireSound('menuHover', 0.3);
    }

    playMenuSelect() {
        this.playVampireSound('menuSelect', 0.5);
    }

    playGameOver() {
        this.playVampireSound('gameOver', 0.6);
        this.setGameIntensity(0); // Reset intensity
    }

    startVampireAmbient() {
        this.playVampireSound('windHowl', 0.16);
        this.playVampireSound('lowDrone', 0.2);
        this.playVampireSound('ritualPulse', 0.1);

        managedSetTimeout(
            () => {
                this.setGameIntensity(0.2);
            },
            2000,
            this
        );
    }

    stopVampireAmbient() {
        this.stop('heartbeat');
        this.stop('windHowl');
        this.stop('lowDrone');
        this.stop('ritualPulse');
        this.stop('gothicOrgan');
        this.setGameIntensity(0);
    }

    // Enhanced layered audio feedback system
    playLayeredHitSound(damage, weaponType, critical = false, combo = 1) {
        const baseDamage = Math.max(1, damage);
        const intensity = Math.min(3.0, baseDamage * 0.02 + combo * 0.1);

        // Base hit sound
        this.playWeaponHitSound(weaponType, intensity);

        // Layer additional effects based on damage and combo
        if (critical) {
            managedSetTimeout(
                () => {
                    this.playCriticalHitLayer(intensity);
                },
                50,
                this
            );
        }

        if (combo > 5) {
            managedSetTimeout(
                () => {
                    this.playComboLayer(combo, intensity);
                },
                100,
                this
            );
        }

        if (baseDamage > 100) {
            managedSetTimeout(
                () => {
                    this.playMassiveDamageLayer(intensity);
                },
                75,
                this
            );
        }
    }

    playWeaponHitSound(weaponType, intensity) {
        const weaponSounds = {
            magicMissile: { sound: 'magicHit', pitch: 1.1, volume: 0.4 },
            whip: { sound: 'whipHit', pitch: 0.9, volume: 0.4 },
            throwingKnife: { sound: 'bladeHit', pitch: 1.2, volume: 0.4 },
            firearm: { sound: 'bulletHit', pitch: 1.0, volume: 0.4 }
        };

        const config = weaponSounds[weaponType] || weaponSounds['magicMissile'];
        const volume = config.volume * intensity * 0.8;
        const pitch = config.pitch + (intensity - 1.0) * 0.1;

        this.playVampireSound(config.sound, volume, pitch);
    }

    playCriticalHitLayer(intensity) {
        // Dramatic critical hit overlay
        this.playVampireSound('criticalBoom', 0.4 * intensity, 0.8);

        // Add metallic ring for emphasis
        managedSetTimeout(
            () => {
                this.playVampireSound('metalRing', 0.4 * intensity, 1.3);
            },
            100,
            this
        );
    }

    playComboLayer(combo, intensity) {
        // Rising pitch based on combo level
        const pitchBonus = Math.min(0.5, combo * 0.02);
        const volumeBonus = Math.min(0.4, combo * 0.01);

        this.playVampireSound('comboChime', 0.5 + volumeBonus, 1.0 + pitchBonus);
    }

    playMassiveDamageLayer(intensity) {
        // Deep impact sound for massive damage
        this.playVampireSound('massiveImpact', 0.45 * intensity, 0.7);
    }

    // Enhanced weapon firing sounds with variation
    playEnhancedWeaponFire(weaponType, level = 1, rapid = false) {
        const levelIntensity = 1.0 + (level - 1) * 0.1;
        const rapidPitchBonus = rapid ? 0.2 : 0;

        switch (weaponType) {
            case 'magicMissile':
                this.playMagicFireSound(levelIntensity, rapidPitchBonus);
                break;
            case 'whip':
                this.playWhipFireSound(levelIntensity, rapidPitchBonus);
                break;
            case 'throwingKnife':
                this.playKnifeFireSound(levelIntensity, rapidPitchBonus);
                break;
            case 'firearm':
                this.playFirearmSound(levelIntensity, rapidPitchBonus);
                break;
            case 'lightning':
                this.playVampireSound('lightningStrike', 0.4 * levelIntensity, 1.0 + rapidPitchBonus);
                break;
            case 'aura':
                this.playVampireSound('garlicPulse', 0.3 * levelIntensity, 0.9 + rapidPitchBonus);
                break;
            case 'holyBible':
                this.playVampireSound('orbiterWhoosh', 0.4 * levelIntensity, 1.0 + rapidPitchBonus);
                break;
            case 'fireWand':
                this.playVampireSound('fireballLaunch', 0.6 * levelIntensity, 1.0 + rapidPitchBonus);
                break;
            case 'boneBoomerang':
                this.playVampireSound('boomerangThrow', 0.5 * levelIntensity, 1.0 + rapidPitchBonus);
                break;
            default:
                this.playVampireSound('weaponFire', 0.4 * levelIntensity, 1.0 + rapidPitchBonus);
                break;
        }
    }

    playMagicFireSound(intensity, pitchBonus) {
        // Magical charging sound
        this.playVampireSound('magicCharge', 0.4 * intensity, 1.0 + pitchBonus);

        // Main missile launch
        managedSetTimeout(
            () => {
                this.playVampireSound('magicMissile', 0.4 * intensity, 1.1 + pitchBonus);
            },
            80,
            this
        );

        // Arcane whisper layer
        managedSetTimeout(
            () => {
                this.playVampireSound('arcaneWhisper', 0.3 * intensity, 1.3 + pitchBonus);
            },
            150,
            this
        );
    }

    playWhipFireSound(intensity, pitchBonus) {
        // Whip swoosh
        this.playVampireSound('whipSwoosh', 0.4 * intensity, 0.9 + pitchBonus);

        // Crack sound
        managedSetTimeout(
            () => {
                this.playVampireSound('whipCrack', 0.4 * intensity, 1.0 + pitchBonus);
            },
            120,
            this
        );
    }

    playKnifeFireSound(intensity, pitchBonus) {
        // Blade slice through air
        this.playVampireSound('bladeWhoosh', 0.5 * intensity, 1.2 + pitchBonus);

        // Metal glint
        managedSetTimeout(
            () => {
                this.playVampireSound('metalGlint', 0.3 * intensity, 1.4 + pitchBonus);
            },
            60,
            this
        );
    }

    playFirearmSound(intensity, pitchBonus) {
        // Gunshot
        this.playVampireSound('gunshot', 0.4 * intensity, 1.0 + pitchBonus);

        // Shell casing drop
        managedSetTimeout(
            () => {
                this.playVampireSound('shellDrop', 0.3 * intensity, 0.8 + Math.random() * 0.4);
            },
            200 + Math.random() * 300,
            this
        );
    }

    // Dynamic music system based on game intensity
    updateDynamicMusic(enemyCount, playerHealth) {
        const healthPercent = playerHealth / 100; // Assuming max health is 100
        const threatLevel = Math.min(1.0, enemyCount / 50); // Normalize enemy count

        const oldIntensity = this.gameIntensity;
        const targetIntensity = 1.0 - healthPercent * 0.5 + threatLevel * 0.7;
        this.gameIntensity = Math.min(1.0, targetIntensity);

        // Trigger musical transitions at key intensity thresholds
        if (oldIntensity < 0.3 && this.gameIntensity >= 0.3) {
            this.transitionToCombatMusic();
        } else if (oldIntensity < 0.7 && this.gameIntensity >= 0.7) {
            this.transitionToIntenseMusic();
        } else if (oldIntensity >= 0.7 && this.gameIntensity < 0.5) {
            this.transitionToNormalMusic();
        }

        // Update ambient sound intensity
        this.updateAmbientSounds();
    }

    transitionToCombatMusic() {
        if (this.currentMusic) {
            this.fadeOut(this.currentMusic, 1500, () => {
                this.playMusic('combatTheme', true);
            });
        } else {
            this.playMusic('combatTheme', true);
        }
    }

    transitionToIntenseMusic() {
        if (this.currentMusic) {
            this.fadeOut(this.currentMusic, 1000, () => {
                this.playMusic('intenseTheme', true);
            });
        } else {
            this.playMusic('intenseTheme', true);
        }
    }

    transitionToNormalMusic() {
        if (this.currentMusic) {
            this.fadeOut(this.currentMusic, 2000, () => {
                this.playMusic('ambientTheme', true);
            });
        }
    }

    updateAmbientSounds() {
        const wind = this.activeLoopingSounds.get('windHowl');
        if (wind?.update) {
            wind.update(0.16 + this.gameIntensity * 0.04, 0.92 + this.gameIntensity * 0.03);
        }

        const drone = this.activeLoopingSounds.get('lowDrone');
        if (drone?.update) {
            drone.update(0.2 - this.gameIntensity * 0.03, 1.0 + this.gameIntensity * 0.015);
        }

        const pulse = this.activeLoopingSounds.get('ritualPulse');
        if (pulse?.update) {
            pulse.update(0.08 + this.gameIntensity * 0.03, 1.0 + this.gameIntensity * 0.02);
        }

        const heartbeat = this.activeLoopingSounds.get('heartbeat');
        if (heartbeat?.update) {
            heartbeat.update(0.24 + this.gameIntensity * 0.08, 1.0 + this.gameIntensity * 0.04);
        }
    }

    // Enhanced enemy death sounds with variety
    playEnemyDeathSound(enemyType, overkill = false) {
        const deathSounds = {
            skeleton: { sound: 'boneBreak', pitch: 0.9, volume: 0.4 },
            zombie: { sound: 'fleshTear', pitch: 0.8, volume: 0.4 },
            vampire: { sound: 'vampireScream', pitch: 1.0, volume: 0.45 },
            ghost: { sound: 'ghostWail', pitch: 1.2, volume: 0.4 },
            demon: { sound: 'demonRoar', pitch: 0.7, volume: 0.5 },
            elite: { sound: 'eliteDeath', pitch: 0.8, volume: 0.5 },
            boss: { sound: 'bossDefeat', pitch: 0.6, volume: 0.6 }
        };

        const config = deathSounds[enemyType] || deathSounds['skeleton'];
        let volume = config.volume;
        let pitch = config.pitch;

        // Modify for overkill
        if (overkill) {
            volume *= 1.3;
            pitch *= 0.9;
        }

        this.playVampireSound(config.sound, volume, pitch);

        // Add satisfying death layer
        managedSetTimeout(
            () => {
                this.playVampireSound('deathSatisfaction', 0.4, 1.0 + Math.random() * 0.2);
            },
            100,
            this
        );
    }

    // Enhanced UI feedback sounds
    playEnhancedUISound(action, context = 'normal') {
        const uiSounds = {
            hover: { sound: 'uiHover', pitch: 1.1, volume: 0.3 },
            select: { sound: 'uiSelect', pitch: 1.0, volume: 0.5 },
            levelUp: { sound: 'levelUpFanfare', pitch: 1.0, volume: 0.5 },
            weaponUpgrade: { sound: 'upgradeChime', pitch: 1.2, volume: 0.4 },
            challengeStart: { sound: 'challengeBell', pitch: 1.1, volume: 0.5 },
            challengeComplete: { sound: 'victoryFanfare', pitch: 1.0, volume: 0.5 },
            error: { sound: 'errorBuzz', pitch: 0.8, volume: 0.4 }
        };

        const config = uiSounds[action];
        if (!config) return;

        let volume = config.volume;
        let pitch = config.pitch;

        // Context modifications
        switch (context) {
            case 'important':
                volume *= 1.5;
                pitch *= 1.1;
                break;
            case 'subtle':
                volume *= 0.6;
                break;
        }

        this.playVampireSound(config.sound, volume, pitch);
    }

    // Missing methods for new systems
    playWeaponEvolution() {
        this.playVampireSound('weaponEvolution', 0.6);
    }

    playAchievementUnlock(intensity = 1) {
        const volume = Math.min(0.6, 0.4 + intensity * 0.2);
        this.playVampireSound('achievementUnlock', volume);
    }

    playPowerUpCollect() {
        this.playVampireSound('powerUpCollect', 0.6);
    }

    // Performance monitoring
    getPerformanceStats() {
        return {
            latency: 0, // Would need Web Audio API implementation
            bufferUnderruns: 0,
            activeAudioNodes: Object.keys(this.sounds).length + Object.keys(this.music).length
        };
    }
}
