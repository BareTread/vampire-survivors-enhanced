// Graphics Upgrade Integration - High visual impact with maintained performance
import { SpriteManager } from './SpriteManager.js';
import { VisualEffectsSystem } from '../systems/VisualEffectsSystem.js';
import { LayeredRenderer } from './LayeredRenderer.js';
import { PerformanceDashboard } from './PerformanceDashboard.js';

export class GraphicsUpgrade {
    constructor(game) {
        this.game = game;
        this.isInitialized = false;
        
        // Feature flags for gradual rollout
        this.features = {
            sprites: true,
            enhancedEffects: true,
            proceduralFallback: true,
            adaptiveQuality: true,
            layeredRendering: false, // DISABLED: Causes white rectangle bug by creating extra canvases
            performanceDashboard: false // DISABLED: Can create overlay issues
        };
        
        console.log('🎨 GraphicsUpgrade system ready');
    }
    
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            // Initialize sprite system
            if (this.features.sprites && this.game.renderer) {
                this.game.spriteManager = new SpriteManager(this.game.renderer);
                console.log('✅ SpriteManager initialized');
            }
            
            // Initialize enhanced visual effects
            if (this.features.enhancedEffects) {
                this.game.visualEffects = new VisualEffectsSystem(this.game);
                console.log('✅ VisualEffectsSystem initialized');
            }
            
            // Initialize layered rendering for performance boost
            if (this.features.layeredRendering) {
                this.game.layeredRenderer = new LayeredRenderer(this.game.canvas, this.game);
                console.log('✅ LayeredRenderer initialized - expect 15-30% FPS boost');
            }
            
            // Initialize performance dashboard
            if (this.features.performanceDashboard) {
                this.game.performanceDashboard = new PerformanceDashboard(this.game);
                window.perfDashboard = this.game.performanceDashboard; // Global access for debug
                console.log('✅ PerformanceDashboard initialized - Press F2 to toggle');
            }
            
            // Integrate with existing systems
            this.integrateWithExistingSystems();
            
            // Setup adaptive quality monitoring
            if (this.features.adaptiveQuality) {
                this.setupQualityMonitoring();
            }
            
            this.isInitialized = true;
            console.log('🚀 Graphics upgrade fully initialized');
            
        } catch (error) {
            console.error('❌ Graphics upgrade initialization failed:', error);
            this.handleInitializationFailure();
        }
    }
    
    integrateWithExistingSystems() {
        // Enhance existing particle system with fallbacks
        if (this.game.systems && this.game.systems.particle) {
            this.wrapParticleSystem();
        }
        
        // Enhance renderer with sprite batching
        if (this.game.renderer) {
            this.enhanceRenderer();
        }
        
        // Add graphics quality settings to game
        this.addQualitySettings();
        
        // Integrate layered rendering
        if (this.game.layeredRenderer) {
            this.integrateLayeredRenderer();
        }
    }
    
    wrapParticleSystem() {
        const originalParticleSystem = this.game.systems.particle;
        const visualEffects = this.game.visualEffects;
        
        if (!visualEffects) return;
        
        // Create wrapper that uses new system for major effects
        const wrapper = new Proxy({}, {
            get: (target, prop) => {
                // Handle special overridden methods first
                if (target[prop]) {
                    return target[prop];
                }
                
                // Forward all other methods to the original particle system
                const method = originalParticleSystem[prop];
                if (typeof method === 'function') {
                    return method.bind(originalParticleSystem);
                }
                
                return method;
            }
        });
        
        // Set the special overridden methods
        Object.assign(wrapper, {
            // High-impact effects use new system
            createCriticalEffect: (x, y, color) => {
                visualEffects.createCriticalHitEffect(x, y, color);
            },
            
            createDeathEffect: (x, y, color) => {
                visualEffects.createEnemyDeathEffect(x, y, color);
            },
            
            createLevelUpEffect: (x, y) => {
                visualEffects.createLevelUpEffect(x, y);
            },
            
            showDamage: (x, y, damage, isCritical) => {
                visualEffects.createDamageNumber(x, y, damage, isCritical);
            },
            
            // Small effects can still use old system but with limits
            createHitEffect: (x, y, colorOrIntensity = 1.0) => {
                // Handle both signatures: (x, y, intensity) and (x, y, color)
                const isColor = typeof colorOrIntensity === 'string';
                const intensity = isColor ? 1.0 : colorOrIntensity;
                const color = isColor ? colorOrIntensity : undefined;
                
                if (intensity > 1.5) {
                    visualEffects.createCriticalHitEffect(x, y);
                } else {
                    // Use original system with reduced particles
                    const reducedIntensity = Math.min(intensity * 0.3, 1.0);
                    if (color) {
                        originalParticleSystem.createHitEffect(x, y, color);
                    } else {
                        originalParticleSystem.createHitEffect(x, y, reducedIntensity);
                    }
                }
            },
            
            // Maintain compatibility
            update: (dt, qualitySettings) => {
                originalParticleSystem.update(dt, qualitySettings);
                visualEffects.update(dt);
            },
            
            render: (renderer, qualitySettings) => {
                originalParticleSystem.render(renderer, qualitySettings);
                visualEffects.render(renderer);
            },
            
            getPerformanceInfo: () => ({
                original: originalParticleSystem.getPerformanceInfo(),
                enhanced: visualEffects.getPerformanceInfo()
            }),
            
            clear: () => {
                originalParticleSystem.clear();
                visualEffects.clear();
            }
        });
        
        // Replace the particle system
        this.game.systems.particle = wrapper;
        console.log('🔄 Particle system enhanced with visual effects wrapper');
    }
    
    enhanceRenderer() {
        const renderer = this.game.renderer;
        const originalDrawCircle = renderer.drawCircle.bind(renderer);
        const originalDrawRect = renderer.drawRect.bind(renderer);
        
        // Add sprite batch tracking
        renderer.spriteBatches = [];
        renderer.batchedSprites = 0;
        
        // Enhanced drawing methods with automatic sprite substitution
        renderer.drawEnhancedCircle = function(x, y, radius, color, filled = true, options = {}) {
            // For specific sizes and colors, use sprites if available
            if (this.game.spriteManager && options.useSprite) {
                const spriteName = options.spriteName || this.findBestSprite(radius, color);
                if (spriteName) {
                    return this.game.spriteManager.drawSprite(spriteName, x, y, {
                        scale: radius / 10, // Assume 10px base size
                        ...options
                    });
                }
            }
            
            // Fallback to original
            return originalDrawCircle(x, y, radius, color, filled);
        }.bind(renderer);
        
        renderer.findBestSprite = function(radius, color) {
            // Simple sprite matching logic
            if (radius >= 8 && radius <= 16) {
                if (color.includes('FF6B6B')) return 'enemy_basic';
                if (color.includes('4ECDC4')) return 'enemy_fast';
                if (color.includes('45B7D1')) return 'enemy_tank';
                if (color.includes('4A90E2')) return 'player_base';
            }
            return null;
        };
        
        console.log('🔧 Renderer enhanced with sprite integration');
    }
    
    integrateLayeredRenderer() {
        // Replace the game's render method to use layered rendering
        const originalRender = this.game.render?.bind(this.game);
        
        if (originalRender) {
            this.game.render = () => {
                if (this.game.layeredRenderer && this.game.qualitySettings?.layeredRendering) {
                    // Use layered rendering for performance
                    this.game.layeredRenderer.render(this.game);
                } else {
                    // Fallback to original rendering
                    originalRender();
                }
            };
            
            console.log('🔄 Game render method enhanced with layered rendering');
        }
    }
    
    addQualitySettings() {
        this.game.qualitySettings = {
            // Visual quality levels
            effects: 'high', // high, medium, low
            sprites: true,
            particleReduction: 1.0,
            animationSmoothing: true,
            layeredRendering: true, // NEW: High-performance layered rendering
            
            // Performance thresholds
            targetFPS: 60,
            minFPS: 45,
            
            // Adaptive settings
            autoAdjust: true,
            lastAdjustment: 0,
            
            // Method to apply settings
            apply: () => {
                this.applyQualitySettings();
            }
        };
        
        console.log('⚙️ Quality settings added to game');
    }
    
    setupQualityMonitoring() {
        // Monitor performance every 2 seconds
        this.qualityMonitorInterval = setInterval(() => {
            this.monitorAndAdjustQuality();
        }, 2000);
        
        console.log('📊 Quality monitoring started');
    }
    
    monitorAndAdjustQuality() {
        if (!this.game.qualitySettings || !this.game.qualitySettings.autoAdjust) return;
        
        const fps = this.game.performanceStats?.fps || 60;
        const settings = this.game.qualitySettings;
        const now = performance.now();
        
        // Don't adjust too frequently
        if (now - settings.lastAdjustment < 5000) return;
        
        let adjusted = false;
        
        if (fps < settings.minFPS) {
            // Reduce quality
            if (settings.effects === 'high') {
                settings.effects = 'medium';
                settings.particleReduction = 0.7;
                adjusted = true;
            } else if (settings.effects === 'medium') {
                settings.effects = 'low';
                settings.particleReduction = 0.5;
                settings.sprites = false;
                settings.layeredRendering = false; // Disable for performance
                adjusted = true;
            }
        } else if (fps > settings.targetFPS && settings.effects !== 'high') {
            // Increase quality
            if (settings.effects === 'low') {
                settings.effects = 'medium';
                settings.particleReduction = 0.7;
                settings.sprites = true;
                settings.layeredRendering = true;
                adjusted = true;
            } else if (settings.effects === 'medium') {
                settings.effects = 'high';
                settings.particleReduction = 1.0;
                settings.layeredRendering = true;
                adjusted = true;
            }
        }
        
        if (adjusted) {
            settings.lastAdjustment = now;
            settings.apply();
            console.log(`🎛️ Quality adjusted to ${settings.effects} (FPS: ${fps.toFixed(1)})`);
        }
    }
    
    applyQualitySettings() {
        const settings = this.game.qualitySettings;
        
        // Apply to visual effects system
        if (this.game.visualEffects) {
            this.game.visualEffects.effectQuality = settings.particleReduction;
        }
        
        // Apply to sprite manager
        if (this.game.spriteManager && !settings.sprites) {
            // Temporarily disable sprite system
            this.game.spriteManager.enabled = false;
        } else if (this.game.spriteManager) {
            this.game.spriteManager.enabled = true;
        }
        
        // Apply to particle system
        if (this.game.systems && this.game.systems.particle) {
            const particleSystem = this.game.systems.particle;
            if (particleSystem.update) {
                // Pass quality settings to particle system
                particleSystem.qualitySettings = settings;
            }
        }
    }
    
    handleInitializationFailure() {
        // Disable all enhancements and fall back to original system
        this.features = {
            sprites: false,
            enhancedEffects: false,
            proceduralFallback: true,
            adaptiveQuality: false,
            layeredRendering: false
        };
        
        console.log('🔄 Falling back to original rendering system');
    }
    
    // Public methods for manual quality control
    setQuality(level) {
        if (!this.game.qualitySettings) return;
        
        const settings = this.game.qualitySettings;
        settings.effects = level;
        
        switch (level) {
            case 'high':
                settings.particleReduction = 1.0;
                settings.sprites = true;
                break;
            case 'medium':
                settings.particleReduction = 0.7;
                settings.sprites = true;
                break;
            case 'low':
                settings.particleReduction = 0.5;
                settings.sprites = false;
                break;
        }
        
        settings.apply();
        console.log(`🎨 Quality manually set to ${level}`);
    }
    
    toggleSprites() {
        if (this.game.qualitySettings) {
            this.game.qualitySettings.sprites = !this.game.qualitySettings.sprites;
            this.game.qualitySettings.apply();
            console.log(`🖼️ Sprites ${this.game.qualitySettings.sprites ? 'enabled' : 'disabled'}`);
        }
    }
    
    toggleLayeredRendering() {
        if (this.game.qualitySettings) {
            this.game.qualitySettings.layeredRendering = !this.game.qualitySettings.layeredRendering;
            this.game.qualitySettings.apply();
            console.log(`🎨 Layered Rendering ${this.game.qualitySettings.layeredRendering ? 'enabled' : 'disabled'}`);
        }
    }
    
    // Debug and performance information
    getStatus() {
        return {
            initialized: this.isInitialized,
            features: this.features,
            qualitySettings: this.game.qualitySettings,
            spriteManager: this.game.spriteManager?.getPerformanceStats(),
            visualEffects: this.game.visualEffects?.getPerformanceInfo(),
            layeredRenderer: this.game.layeredRenderer?.getPerformanceStats(),
            performanceDashboard: this.game.performanceDashboard ? 'initialized' : 'disabled'
        };
    }
    
    // Cleanup
    destroy() {
        if (this.qualityMonitorInterval) {
            clearInterval(this.qualityMonitorInterval);
        }
        
        // Clean up layered renderer
        if (this.game.layeredRenderer) {
            this.game.layeredRenderer.destroy();
            this.game.layeredRenderer = null;
        }
        
        // Clean up performance dashboard
        if (this.game.performanceDashboard) {
            this.game.performanceDashboard.destroy();
            this.game.performanceDashboard = null;
        }
        
        console.log('🧹 GraphicsUpgrade system cleaned up');
    }
}