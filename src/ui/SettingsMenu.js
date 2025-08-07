// Settings menu with volume, effects, and performance controls
export class SettingsMenu {
    constructor(game) {
        this.game = game;
        this.isVisible = false;
        this.settingsKey = 'vampireSurvivors_settings';
        
        // Default settings
        this.settings = {
            masterVolume: 0.7,
            musicVolume: 0.5,
            sfxVolume: 0.8,
            particleEffects: true,
            screenShake: true,
            damageNumbers: true,
            lowFXMode: false,
            showFPS: false,
            autoQuality: true,
            pauseOnFocusLoss: true
        };
        
        // UI elements
        this.menuElement = null;
        this.overlay = null;
        
        this.initialize();
    }
    
    initialize() {
        this.loadSettings();
        this.createMenuElements();
        this.bindEvents();
        this.apply();
        
        console.log('⚙️ Settings menu initialized');
    }
    
    loadSettings() {
        try {
            const saved = localStorage.getItem(this.settingsKey);
            if (saved) {
                const parsedSettings = JSON.parse(saved);
                this.settings = { ...this.settings, ...parsedSettings };
            }
        } catch (error) {
            console.warn('Failed to load settings:', error);
        }
    }
    
    saveSettings() {
        try {
            localStorage.setItem(this.settingsKey, JSON.stringify(this.settings));
        } catch (error) {
            console.warn('Failed to save settings:', error);
        }
    }
    
    createMenuElements() {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'settings-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 1000;
            display: none;
            align-items: center;
            justify-content: center;
        `;
        
        // Create menu container
        this.menuElement = document.createElement('div');
        this.menuElement.className = 'settings-menu';
        this.menuElement.style.cssText = `
            background: linear-gradient(135deg, #2c1810, #1a0f08);
            border: 2px solid #8B4513;
            border-radius: 12px;
            padding: 30px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 0 30px rgba(139, 69, 19, 0.5);
            color: #F5DEB3;
            font-family: 'Arial', sans-serif;
            max-height: 80vh;
            overflow-y: auto;
        `;
        
        this.menuElement.innerHTML = `
            <div class="settings-header">
                <h2 style="margin: 0 0 20px 0; text-align: center; color: #FFD700; text-shadow: 2px 2px 4px rgba(0,0,0,0.7);">Settings</h2>
                <button class="close-btn" style="position: absolute; top: 10px; right: 15px; background: none; border: none; color: #FFD700; font-size: 24px; cursor: pointer;">×</button>
            </div>
            
            <div class="settings-section">
                <h3 style="color: #DAA520; margin-bottom: 15px;">🔊 Audio</h3>
                
                <div class="setting-item">
                    <label for="masterVolume">Master Volume: <span id="masterVolumeValue">${Math.round(this.settings.masterVolume * 100)}%</span></label>
                    <input type="range" id="masterVolume" min="0" max="1" step="0.1" value="${this.settings.masterVolume}" style="width: 100%; margin-top: 5px;">
                </div>
                
                <div class="setting-item">
                    <label for="musicVolume">Music Volume: <span id="musicVolumeValue">${Math.round(this.settings.musicVolume * 100)}%</span></label>
                    <input type="range" id="musicVolume" min="0" max="1" step="0.1" value="${this.settings.musicVolume}" style="width: 100%; margin-top: 5px;">
                </div>
                
                <div class="setting-item">
                    <label for="sfxVolume">SFX Volume: <span id="sfxVolumeValue">${Math.round(this.settings.sfxVolume * 100)}%</span></label>
                    <input type="range" id="sfxVolume" min="0" max="1" step="0.1" value="${this.settings.sfxVolume}" style="width: 100%; margin-top: 5px;">
                </div>
            </div>
            
            <div class="settings-section">
                <h3 style="color: #DAA520; margin-bottom: 15px;">✨ Visual Effects</h3>
                
                <div class="setting-item">
                    <label>
                        <input type="checkbox" id="particleEffects" ${this.settings.particleEffects ? 'checked' : ''}>
                        Particle Effects
                    </label>
                </div>
                
                <div class="setting-item">
                    <label>
                        <input type="checkbox" id="screenShake" ${this.settings.screenShake ? 'checked' : ''}>
                        Screen Shake
                    </label>
                </div>
                
                <div class="setting-item">
                    <label>
                        <input type="checkbox" id="damageNumbers" ${this.settings.damageNumbers ? 'checked' : ''}>
                        Damage Numbers
                    </label>
                </div>
                
                <div class="setting-item">
                    <label>
                        <input type="checkbox" id="lowFXMode" ${this.settings.lowFXMode ? 'checked' : ''}>
                        Low Effects Mode
                    </label>
                    <small style="color: #B8860B; display: block; margin-top: 5px;">Reduces visual effects for better performance</small>
                </div>
            </div>
            
            <div class="settings-section">
                <h3 style="color: #DAA520; margin-bottom: 15px;">⚡ Performance</h3>
                
                <div class="setting-item">
                    <label>
                        <input type="checkbox" id="autoQuality" ${this.settings.autoQuality ? 'checked' : ''}>
                        Auto Quality Adjustment
                    </label>
                    <small style="color: #B8860B; display: block; margin-top: 5px;">Automatically reduces quality when FPS drops</small>
                </div>
                
                <div class="setting-item">
                    <label>
                        <input type="checkbox" id="showFPS" ${this.settings.showFPS ? 'checked' : ''}>
                        Show FPS Counter
                    </label>
                </div>
            </div>
            
            <div class="settings-section">
                <h3 style="color: #DAA520; margin-bottom: 15px;">🎮 Gameplay</h3>
                
                <div class="setting-item">
                    <label>
                        <input type="checkbox" id="pauseOnFocusLoss" ${this.settings.pauseOnFocusLoss ? 'checked' : ''}>
                        Pause When Window Loses Focus
                    </label>
                </div>
            </div>
            
            <div class="settings-actions" style="text-align: center; margin-top: 25px;">
                <button class="btn-reset" style="background: #8B4513; color: white; border: none; padding: 10px 20px; border-radius: 5px; margin-right: 10px; cursor: pointer;">Reset to Defaults</button>
                <button class="btn-close" style="background: #DAA520; color: #1a0f08; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Close</button>
            </div>
        `;
        
        // Style setting items
        const settingItems = this.menuElement.querySelectorAll('.setting-item');
        settingItems.forEach(item => {
            item.style.cssText = `
                margin-bottom: 15px;
                padding: 10px;
                background: rgba(139, 69, 19, 0.2);
                border-radius: 5px;
            `;
        });
        
        // Style checkboxes
        const checkboxes = this.menuElement.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.style.marginRight = '8px';
        });
        
        // Style range inputs
        const ranges = this.menuElement.querySelectorAll('input[type="range"]');
        ranges.forEach(range => {
            range.style.cssText = `
                -webkit-appearance: none;
                background: #8B4513;
                outline: none;
                border-radius: 5px;
                height: 6px;
            `;
        });
        
        this.overlay.appendChild(this.menuElement);
        document.body.appendChild(this.overlay);
    }
    
    bindEvents() {
        // Close buttons
        const closeButtons = this.menuElement.querySelectorAll('.close-btn, .btn-close');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.hide());
        });
        
        // Reset button
        const resetBtn = this.menuElement.querySelector('.btn-reset');
        resetBtn.addEventListener('click', () => this.resetToDefaults());
        
        // Overlay click to close
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        });
        
        // Volume sliders
        const volumeInputs = ['masterVolume', 'musicVolume', 'sfxVolume'];
        volumeInputs.forEach(id => {
            const input = this.menuElement.querySelector(`#${id}`);
            const valueSpan = this.menuElement.querySelector(`#${id}Value`);
            
            input.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.settings[id] = value;
                valueSpan.textContent = Math.round(value * 100) + '%';
                this.saveSettings();
                this.apply();
            });
        });
        
        // Checkboxes
        const checkboxInputs = ['particleEffects', 'screenShake', 'damageNumbers', 'lowFXMode', 'autoQuality', 'showFPS', 'pauseOnFocusLoss'];
        checkboxInputs.forEach(id => {
            const input = this.menuElement.querySelector(`#${id}`);
            input.addEventListener('change', (e) => {
                this.settings[id] = e.target.checked;
                this.saveSettings();
                this.apply();
            });
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }
    
    show() {
        this.isVisible = true;
        this.overlay.style.display = 'flex';
        
        // Pause game if setting is enabled
        if (this.game.isRunning) {
            this.game.wasPausedBySettings = !this.game.isPaused;
            if (this.game.wasPausedBySettings) {
                this.game.togglePause();
            }
        }
    }
    
    hide() {
        this.isVisible = false;
        this.overlay.style.display = 'none';
        
        // Resume game if we paused it
        if (this.game.wasPausedBySettings && this.game.isPaused) {
            this.game.togglePause();
        }
        this.game.wasPausedBySettings = false;
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    resetToDefaults() {
        // Reset to default values
        this.settings = {
            masterVolume: 0.7,
            musicVolume: 0.5,
            sfxVolume: 0.8,
            particleEffects: true,
            screenShake: true,
            damageNumbers: true,
            lowFXMode: false,
            showFPS: false,
            autoQuality: true,
            pauseOnFocusLoss: true
        };
        
        // Update UI
        this.updateUI();
        this.saveSettings();
        this.apply();
    }
    
    updateUI() {
        // Update volume sliders
        const volumeInputs = ['masterVolume', 'musicVolume', 'sfxVolume'];
        volumeInputs.forEach(id => {
            const input = this.menuElement.querySelector(`#${id}`);
            const valueSpan = this.menuElement.querySelector(`#${id}Value`);
            input.value = this.settings[id];
            valueSpan.textContent = Math.round(this.settings[id] * 100) + '%';
        });
        
        // Update checkboxes
        const checkboxInputs = ['particleEffects', 'screenShake', 'damageNumbers', 'lowFXMode', 'autoQuality', 'showFPS', 'pauseOnFocusLoss'];
        checkboxInputs.forEach(id => {
            const input = this.menuElement.querySelector(`#${id}`);
            input.checked = this.settings[id];
        });
    }
    
    apply() {
        // Apply audio settings
        if (this.game.audioSystem) {
            this.game.audioSystem.setMasterVolume(this.settings.masterVolume);
            this.game.audioSystem.setMusicVolume(this.settings.musicVolume);
            this.game.audioSystem.setSFXVolume(this.settings.sfxVolume);
        }
        
        // Apply visual effects settings
        if (this.game.qualitySettings) {
            this.game.qualitySettings.particleEffects = this.settings.particleEffects;
            this.game.qualitySettings.screenShake = this.settings.screenShake;
            this.game.qualitySettings.damageNumbers = this.settings.damageNumbers;
            this.game.qualitySettings.lowFXMode = this.settings.lowFXMode;
            this.game.qualitySettings.autoQuality = this.settings.autoQuality;
            this.game.qualitySettings.showFPS = this.settings.showFPS;
        }
        
        // Apply performance settings
        if (this.settings.lowFXMode) {
            this.applyLowFXMode();
        }
        
        // Focus loss pausing
        this.setupFocusHandling();
        
        console.log('⚙️ Settings applied:', this.settings);
    }
    
    applyLowFXMode() {
        if (!this.game.qualitySettings) return;
        
        // Reduce particle count and quality
        this.game.qualitySettings.particleReduction = 0.3;
        this.game.qualitySettings.effectsReduction = 0.4;
        this.game.qualitySettings.shadowQuality = 0.2;
        this.game.qualitySettings.animationDetail = 0.5;
        
        // Reduce maximum entities
        if (this.game.systems.projectile) {
            this.game.systems.projectile.maxActiveProjectiles = Math.min(
                this.game.systems.projectile.maxActiveProjectiles,
                100
            );
        }
        
        if (this.game.systems.enemy) {
            this.game.systems.enemy.maxActiveEnemies = Math.min(
                this.game.systems.enemy.maxActiveEnemies,
                80
            );
        }
    }
    
    setupFocusHandling() {
        if (!this.focusHandlerBound) {
            this.focusHandlerBound = true;
            
            window.addEventListener('blur', () => {
                if (this.settings.pauseOnFocusLoss && this.game.isRunning && !this.game.isPaused) {
                    this.game.wasPausedByFocusLoss = true;
                    this.game.togglePause();
                }
            });
            
            window.addEventListener('focus', () => {
                if (this.game.wasPausedByFocusLoss && this.game.isPaused) {
                    this.game.togglePause();
                    this.game.wasPausedByFocusLoss = false;
                }
            });
        }
    }
    
    // Performance monitoring integration
    updatePerformanceSettings(fps) {
        if (!this.settings.autoQuality || !this.game.qualitySettings) return;
        
        const targetFPS = 60;
        const lowFPSThreshold = 45;
        const criticalFPSThreshold = 30;
        
        if (fps < criticalFPSThreshold && !this.settings.lowFXMode) {
            // Auto-enable low FX mode
            this.settings.lowFXMode = true;
            this.applyLowFXMode();
            console.log('⚡ Auto-enabled Low FX Mode due to low FPS');
        } else if (fps > targetFPS && this.settings.lowFXMode && this.settings.autoQuality) {
            // Consider disabling low FX mode after good performance
            setTimeout(() => {
                if (this.game.averageFPS > targetFPS) {
                    this.settings.lowFXMode = false;
                    this.apply();
                    console.log('⚡ Auto-disabled Low FX Mode due to improved FPS');
                }
            }, 5000); // Wait 5 seconds of good performance
        }
    }
    
    // Get current settings for external systems
    getSettings() {
        return { ...this.settings };
    }
    
    // Update a specific setting from code
    setSetting(key, value) {
        if (key in this.settings) {
            this.settings[key] = value;
            this.saveSettings();
            this.apply();
            this.updateUI();
        }
    }
    
    // Cleanup
    destroy() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
    }
}
