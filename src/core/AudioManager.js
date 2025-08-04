export class AudioManager {
    constructor() {
        this.sounds = {};
        this.music = {};
        this.masterVolume = 1;
        this.soundVolume = 0.8;
        this.musicVolume = 0.4;
        this.muted = false;
        this.currentMusic = null;
        
        // Enhanced audio features
        this.audioContext = null;
        this.dynamicMixing = true;
        this.gameIntensity = 0; // 0-1 scale for dynamic audio
        this.soundPools = new Map(); // For performance
        this.reverb = null;
        
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
        Object.values(this.sounds).forEach(sound => {
            try {
                sound.pause();
                sound.currentTime = 0;
            } catch (error) {
                // Ignore stop errors
            }
        });
        
        this.stopMusic();
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
        Object.values(this.sounds).forEach(sound => {
            if (sound.volume !== undefined) {
                sound.volume = this.soundVolume * this.masterVolume;
            }
        });
        
        Object.values(this.music).forEach(music => {
            if (music.volume !== undefined) {
                music.volume = this.musicVolume * this.masterVolume;
            }
        });
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
        // Define all the vampire-themed sounds we want
        this.vampireSoundMap = {
            // Combat sounds - base hits
            'vampireBite': { type: 'aggressive', pitch: 0.8, reverb: 0.3 },
            'bloodSplash': { type: 'wet', pitch: 1.0, reverb: 0.2 },
            'magicMissile': { type: 'magical', pitch: 1.2, reverb: 0.4 },
            'whipCrack': { type: 'impact', pitch: 0.9, reverb: 0.1 },
            'knifeThrowing': { type: 'sharp', pitch: 1.1, reverb: 0.1 },
            'criticalHit': { type: 'impact', pitch: 0.7, reverb: 0.3 },
            'enemyDeath': { type: 'death', pitch: 0.8, reverb: 0.5 },
            
            // Enhanced weapon-specific sounds
            'magicHit': { type: 'magical', pitch: 1.0, reverb: 0.3 },
            'magicCharge': { type: 'magical', pitch: 0.9, reverb: 0.5 },
            'arcaneWhisper': { type: 'magical', pitch: 1.4, reverb: 0.7 },
            'whipHit': { type: 'impact', pitch: 0.8, reverb: 0.2 },
            'whipSwoosh': { type: 'impact', pitch: 1.1, reverb: 0.1 },
            'bladeHit': { type: 'sharp', pitch: 1.2, reverb: 0.1 },
            'bladeWhoosh': { type: 'sharp', pitch: 1.3, reverb: 0.1 },
            'metalGlint': { type: 'sharp', pitch: 1.5, reverb: 0.2 },
            'bulletHit': { type: 'impact', pitch: 1.0, reverb: 0.1 },
            'gunshot': { type: 'impact', pitch: 1.0, reverb: 0.2 },
            'shellDrop': { type: 'impact', pitch: 0.7, reverb: 0.1 },
            
            // Layered combat feedback
            'criticalBoom': { type: 'impact', pitch: 0.6, reverb: 0.8 },
            'metalRing': { type: 'sharp', pitch: 1.8, reverb: 0.4 },
            'comboChime': { type: 'positive', pitch: 1.4, reverb: 0.3 },
            'massiveImpact': { type: 'impact', pitch: 0.5, reverb: 0.9 },
            'deathSatisfaction': { type: 'positive', pitch: 1.1, reverb: 0.2 },
            
            // Enemy-specific death sounds
            'boneBreak': { type: 'death', pitch: 0.9, reverb: 0.3 },
            'fleshTear': { type: 'death', pitch: 0.7, reverb: 0.4 },
            'vampireScream': { type: 'death', pitch: 1.0, reverb: 0.6 },
            'ghostWail': { type: 'death', pitch: 1.3, reverb: 0.8 },
            'demonRoar': { type: 'death', pitch: 0.6, reverb: 0.7 },
            'eliteDeath': { type: 'death', pitch: 0.8, reverb: 0.5 },
            'bossDefeat': { type: 'death', pitch: 0.5, reverb: 1.0 },
            
            // Progression sounds
            'levelUp': { type: 'positive', pitch: 1.0, reverb: 0.6 },
            'experienceGain': { type: 'collect', pitch: 1.3, reverb: 0.2 },
            'weaponUpgrade': { type: 'magical', pitch: 0.9, reverb: 0.7 },
            'levelUpFanfare': { type: 'positive', pitch: 1.0, reverb: 0.8 },
            'upgradeChime': { type: 'positive', pitch: 1.2, reverb: 0.5 },
            
            // Challenge and achievement sounds
            'challengeBell': { type: 'ui', pitch: 1.1, reverb: 0.4 },
            'challengeComplete': { type: 'positive', pitch: 1.0, reverb: 0.6 },
            'challengeFail': { type: 'ui', pitch: 0.8, reverb: 0.3 },
            'victoryFanfare': { type: 'positive', pitch: 1.0, reverb: 0.9 },
            'achievementUnlock': { type: 'positive', pitch: 1.1, reverb: 0.7 },
            
            // Atmospheric sounds
            'heartbeat': { type: 'ambient', pitch: 1.0, reverb: 0.8, loop: true },
            'windHowl': { type: 'ambient', pitch: 0.8, reverb: 0.9, loop: true },
            'gothicOrgan': { type: 'musical', pitch: 1.0, reverb: 0.8, loop: true },
            
            // UI sounds
            'uiHover': { type: 'ui', pitch: 1.1, reverb: 0.1 },
            'uiSelect': { type: 'ui', pitch: 1.0, reverb: 0.2 },
            'menuHover': { type: 'ui', pitch: 1.1, reverb: 0.1 },
            'menuSelect': { type: 'ui', pitch: 0.9, reverb: 0.2 },
            'errorBuzz': { type: 'ui', pitch: 0.8, reverb: 0.1 },
            'gameOver': { type: 'dramatic', pitch: 0.6, reverb: 1.0 },
            
            // Power-ups and special effects
            'powerUpCollect': { type: 'positive', pitch: 1.2, reverb: 0.4 },
            'weaponEvolution': { type: 'magical', pitch: 0.8, reverb: 0.9 },
            'skillShot': { type: 'positive', pitch: 1.3, reverb: 0.3 }
        };
    }
    
    initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.createReverbEffect();
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
            this.audioContext = null;
        }
    }
    
    createReverbEffect() {
        if (!this.audioContext) return;
        
        try {
            this.reverb = this.audioContext.createConvolver();
            
            // Create impulse response for gothic cathedral reverb
            const length = this.audioContext.sampleRate * 3; // 3 seconds
            const impulse = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate);
            
            for (let channel = 0; channel < 2; channel++) {
                const channelData = impulse.getChannelData(channel);
                for (let i = 0; i < length; i++) {
                    const decay = Math.pow(1 - i / length, 3);
                    channelData[i] = (Math.random() * 2 - 1) * decay;
                }
            }
            
            this.reverb.buffer = impulse;
        } catch (error) {
            console.warn('Failed to create reverb effect:', error);
            this.reverb = null;
        }
    }
    
    // Enhanced play method with vampire-themed processing
    playVampireSound(name, volume = 1, pitch = 1) {
        if (this.muted) return;
        
        const soundConfig = this.vampireSoundMap[name];
        if (!soundConfig) {
            // Fall back to regular play
            this.play(name, volume);
            return;
        }
        
        // Apply vampire-themed audio processing
        const adjustedVolume = volume * this.getIntensityMultiplier(soundConfig.type);
        const adjustedPitch = pitch * soundConfig.pitch;
        
        this.playWithEffects(name, adjustedVolume, adjustedPitch, soundConfig);
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
    
    synthesizeVampireSound(type, volume, pitch, config) {
        if (!this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            // Configure based on vampire sound type
            switch (type) {
                case 'aggressive':
                    oscillator.type = 'sawtooth';
                    oscillator.frequency.setValueAtTime(150 * pitch, this.audioContext.currentTime);
                    break;
                case 'magical':
                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(440 * pitch, this.audioContext.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(880 * pitch, this.audioContext.currentTime + 0.3);
                    break;
                case 'impact':
                    oscillator.type = 'square';
                    oscillator.frequency.setValueAtTime(80 * pitch, this.audioContext.currentTime);
                    break;
                case 'collect':
                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(800 * pitch, this.audioContext.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(1600 * pitch, this.audioContext.currentTime + 0.1);
                    break;
                default:
                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(220 * pitch, this.audioContext.currentTime);
            }
            
            // Apply volume envelope
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume * 0.3, this.audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
            
            // Connect audio nodes
            oscillator.connect(gainNode);
            if (this.reverb && config.reverb > 0) {
                const dryGain = this.audioContext.createGain();
                const wetGain = this.audioContext.createGain();
                
                dryGain.gain.value = 1 - config.reverb;
                wetGain.gain.value = config.reverb;
                
                gainNode.connect(dryGain);
                gainNode.connect(this.reverb);
                this.reverb.connect(wetGain);
                
                dryGain.connect(this.audioContext.destination);
                wetGain.connect(this.audioContext.destination);
            } else {
                gainNode.connect(this.audioContext.destination);
            }
            
            // Play the sound
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.3);
            
        } catch (error) {
            console.warn('Failed to synthesize vampire sound:', error);
        }
    }
    
    getIntensityMultiplier(type) {
        if (!this.dynamicMixing) return 1;
        
        // Adjust volume based on game intensity and sound type
        switch (type) {
            case 'aggressive':
            case 'impact':
                return 0.7 + (this.gameIntensity * 0.5); // Louder during intense moments
            case 'ambient':
                return 1.2 - (this.gameIntensity * 0.4); // Quieter during intense moments
            case 'magical':
                return 0.8 + (this.gameIntensity * 0.3);
            default:
                return 1;
        }
    }
    
    setGameIntensity(intensity) {
        this.gameIntensity = Math.max(0, Math.min(1, intensity));
        
        // Adjust music based on intensity
        if (this.currentMusic && this.dynamicMixing) {
            const targetVolume = this.musicVolume * this.masterVolume * (0.6 + intensity * 0.4);
            this.currentMusic.volume = targetVolume;
        }
    }
    
    playVampireBite() {
        this.playVampireSound('vampireBite', 0.8);
    }
    
    playBloodSplash() {
        this.playVampireSound('bloodSplash', 0.6);
    }
    
    playMagicMissile() {
        this.playVampireSound('magicMissile', 0.7);
    }
    
    playWhipCrack() {
        this.playVampireSound('whipCrack', 0.9);
    }
    
    playKnifeThrow() {
        this.playVampireSound('knifeThrowing', 0.5);
    }
    
    playCriticalHit() {
        this.playVampireSound('criticalHit', 1.0);
        this.setGameIntensity(Math.min(1, this.gameIntensity + 0.1)); // Increase intensity
    }
    
    playEnemyDeath() {
        this.playVampireSound('enemyDeath', 0.7);
    }
    
    playLevelUp() {
        this.playVampireSound('levelUp', 0.9);
    }
    
    playExperienceGain() {
        this.playVampireSound('experienceGain', 0.4);
    }
    
    playWeaponUpgrade() {
        this.playVampireSound('weaponUpgrade', 0.8);
    }
    
    playMenuHover() {
        this.playVampireSound('menuHover', 0.3);
    }
    
    playMenuSelect() {
        this.playVampireSound('menuSelect', 0.5);
    }
    
    playGameOver() {
        this.playVampireSound('gameOver', 1.0);
        this.setGameIntensity(0); // Reset intensity
    }
    
    startVampireAmbient() {
        // Start atmospheric vampire sounds
        this.playVampireSound('heartbeat', 0.2);
        this.playVampireSound('windHowl', 0.1);
        
        // Gradually increase ambient intensity
        setTimeout(() => {
            this.setGameIntensity(0.2);
        }, 2000);
    }
    
    stopVampireAmbient() {
        this.stop('heartbeat');
        this.stop('windHowl');
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
            setTimeout(() => {
                this.playCriticalHitLayer(intensity);
            }, 50);
        }
        
        if (combo > 5) {
            setTimeout(() => {
                this.playComboLayer(combo, intensity);
            }, 100);
        }
        
        if (baseDamage > 100) {
            setTimeout(() => {
                this.playMassiveDamageLayer(intensity);
            }, 75);
        }
    }
    
    playWeaponHitSound(weaponType, intensity) {
        const weaponSounds = {
            'magicMissile': { sound: 'magicHit', pitch: 1.1, volume: 0.7 },
            'whip': { sound: 'whipHit', pitch: 0.9, volume: 0.8 },
            'throwingKnife': { sound: 'bladeHit', pitch: 1.2, volume: 0.6 },
            'firearm': { sound: 'bulletHit', pitch: 1.0, volume: 0.8 }
        };
        
        const config = weaponSounds[weaponType] || weaponSounds['magicMissile'];
        const volume = config.volume * intensity * 0.8;
        const pitch = config.pitch + (intensity - 1.0) * 0.1;
        
        this.playVampireSound(config.sound, volume, pitch);
    }
    
    playCriticalHitLayer(intensity) {
        // Dramatic critical hit overlay
        this.playVampireSound('criticalBoom', 0.8 * intensity, 0.8);
        
        // Add metallic ring for emphasis
        setTimeout(() => {
            this.playVampireSound('metalRing', 0.4 * intensity, 1.3);
        }, 100);
    }
    
    playComboLayer(combo, intensity) {
        // Rising pitch based on combo level
        const pitchBonus = Math.min(0.5, combo * 0.02);
        const volumeBonus = Math.min(0.4, combo * 0.01);
        
        this.playVampireSound('comboChime', 0.5 + volumeBonus, 1.0 + pitchBonus);
    }
    
    playMassiveDamageLayer(intensity) {
        // Deep impact sound for massive damage
        this.playVampireSound('massiveImpact', 0.9 * intensity, 0.7);
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
            default:
                this.playVampireSound('weaponFire', 0.6 * levelIntensity, 1.0 + rapidPitchBonus);
                break;
        }
    }
    
    playMagicFireSound(intensity, pitchBonus) {
        // Magical charging sound
        this.playVampireSound('magicCharge', 0.4 * intensity, 1.0 + pitchBonus);
        
        // Main missile launch
        setTimeout(() => {
            this.playVampireSound('magicMissile', 0.7 * intensity, 1.1 + pitchBonus);
        }, 80);
        
        // Arcane whisper layer
        setTimeout(() => {
            this.playVampireSound('arcaneWhisper', 0.3 * intensity, 1.3 + pitchBonus);
        }, 150);
    }
    
    playWhipFireSound(intensity, pitchBonus) {
        // Whip swoosh
        this.playVampireSound('whipSwoosh', 0.6 * intensity, 0.9 + pitchBonus);
        
        // Crack sound
        setTimeout(() => {
            this.playVampireSound('whipCrack', 0.8 * intensity, 1.0 + pitchBonus);
        }, 120);
    }
    
    playKnifeFireSound(intensity, pitchBonus) {
        // Blade slice through air
        this.playVampireSound('bladeWhoosh', 0.5 * intensity, 1.2 + pitchBonus);
        
        // Metal glint
        setTimeout(() => {
            this.playVampireSound('metalGlint', 0.3 * intensity, 1.4 + pitchBonus);
        }, 60);
    }
    
    playFirearmSound(intensity, pitchBonus) {
        // Gunshot
        this.playVampireSound('gunshot', 0.8 * intensity, 1.0 + pitchBonus);
        
        // Shell casing drop
        setTimeout(() => {
            this.playVampireSound('shellDrop', 0.3 * intensity, 0.8 + Math.random() * 0.4);
        }, 200 + Math.random() * 300);
    }
    
    // Dynamic music system based on game intensity
    updateDynamicMusic(enemyCount, playerHealth) {
        const healthPercent = playerHealth / 100; // Assuming max health is 100
        const threatLevel = Math.min(1.0, enemyCount / 50); // Normalize enemy count
        
        const oldIntensity = this.gameIntensity;
        const targetIntensity = (1.0 - healthPercent * 0.5) + (threatLevel * 0.7);
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
        // Heartbeat gets more intense as player gets weaker
        if (this.sounds['heartbeat']) {
            const heartbeatVolume = Math.max(0.1, (1.0 - this.gameIntensity) * 0.4);
            this.sounds['heartbeat'].volume = heartbeatVolume * this.soundVolume * this.masterVolume;
        }
        
        // Wind intensity increases with combat
        if (this.sounds['windHowl']) {
            const windVolume = 0.1 + this.gameIntensity * 0.2;
            this.sounds['windHowl'].volume = windVolume * this.soundVolume * this.masterVolume;
        }
    }
    
    // Enhanced enemy death sounds with variety
    playEnemyDeathSound(enemyType, overkill = false) {
        const deathSounds = {
            'skeleton': { sound: 'boneBreak', pitch: 0.9, volume: 0.7 },
            'zombie': { sound: 'fleshTear', pitch: 0.8, volume: 0.8 },
            'vampire': { sound: 'vampireScream', pitch: 1.0, volume: 0.9 },
            'ghost': { sound: 'ghostWail', pitch: 1.2, volume: 0.6 },
            'demon': { sound: 'demonRoar', pitch: 0.7, volume: 1.0 },
            'elite': { sound: 'eliteDeath', pitch: 0.8, volume: 1.1 },
            'boss': { sound: 'bossDefeat', pitch: 0.6, volume: 1.3 }
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
        setTimeout(() => {
            this.playVampireSound('deathSatisfaction', 0.4, 1.0 + Math.random() * 0.2);
        }, 100);
    }
    
    // Enhanced UI feedback sounds
    playEnhancedUISound(action, context = 'normal') {
        const uiSounds = {
            'hover': { sound: 'uiHover', pitch: 1.1, volume: 0.3 },
            'select': { sound: 'uiSelect', pitch: 1.0, volume: 0.5 },
            'levelUp': { sound: 'levelUpFanfare', pitch: 1.0, volume: 0.8 },
            'weaponUpgrade': { sound: 'upgradeChime', pitch: 1.2, volume: 0.7 },
            'challengeStart': { sound: 'challengeBell', pitch: 1.1, volume: 0.6 },
            'challengeComplete': { sound: 'victoryFanfare', pitch: 1.0, volume: 0.9 },
            'error': { sound: 'errorBuzz', pitch: 0.8, volume: 0.4 }
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
        this.playVampireSound('weaponEvolution', 1.0);
    }
    
    playAchievementUnlock(intensity = 1) {
        const volume = 0.7 + (intensity * 0.3);
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