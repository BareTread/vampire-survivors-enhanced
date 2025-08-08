// Responsive canvas scaling system for mobile and window resize support
export class ResponsiveCanvas {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.game = game;
        
        // Design dimensions (what the game is designed for)
        this.designWidth = 1200;
        this.designHeight = 800;
        this.aspectRatio = this.designWidth / this.designHeight;
        
        // Current scale and dimensions
        this.scale = 1.0;
        this.scaledWidth = this.designWidth;
        this.scaledHeight = this.designHeight;
        
        // Resize handling
        this.resizeTimeout = null;
        this.resizeDelay = 100; // ms
        
        // Mobile detection
        this.isMobile = this.detectMobile();
        this.isTouch = 'ontouchstart' in window;
        
        // Performance mode for mobile
        this.performanceMode = this.isMobile;

        // Bound handlers to ensure add/removeEventListener use same references
        this.boundResizeHandler = this.handleResize.bind(this);
        this.boundOrientationHandler = this.handleOrientationChange.bind(this);
        
        this.initialize();
    }
    
    initialize() {
        // Set initial canvas size
        this.updateCanvasSize();
        
        // Add event listeners
        window.addEventListener('resize', this.boundResizeHandler);
        window.addEventListener('orientationchange', this.boundOrientationHandler);
        
        // Apply mobile optimizations if needed
        if (this.isMobile) {
            this.applyMobileOptimizations();
        }
        
        console.log(`🖥️ ResponsiveCanvas initialized: ${this.scaledWidth}x${this.scaledHeight} (scale: ${this.scale.toFixed(2)})`);
    }
    
    detectMobile() {
        const userAgent = navigator.userAgent.toLowerCase();
        const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'tablet', 'kindle'];
        
        return mobileKeywords.some(keyword => userAgent.includes(keyword)) ||
               window.screen.width <= 768 ||
               (window.innerWidth <= 768 && window.innerHeight <= 1024);
    }
    
    handleResize() {
        // Debounce resize events
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        
        this.resizeTimeout = setTimeout(() => {
            this.updateCanvasSize();
            
            // Notify game systems of resize
            if (this.game.camera) {
                this.game.camera.handleResize(this.scaledWidth, this.scaledHeight);
            }
            
            console.log(`📱 Canvas resized: ${this.scaledWidth}x${this.scaledHeight} (scale: ${this.scale.toFixed(2)})`);
        }, this.resizeDelay);
    }
    
    handleOrientationChange() {
        // Wait for orientation change to complete
        setTimeout(() => {
            this.updateCanvasSize();
        }, 200);
    }
    
    updateCanvasSize() {
        const container = this.canvas.parentElement || document.body;
        const containerRect = container.getBoundingClientRect();
        
        // Available space
        const availableWidth = containerRect.width || window.innerWidth;
        const availableHeight = containerRect.height || window.innerHeight;
        
        // Reserve space for UI elements on mobile
        const uiPadding = this.isMobile ? 100 : 0;
        const usableWidth = availableWidth - uiPadding;
        const usableHeight = availableHeight - uiPadding;
        
        // Calculate scale to fit while maintaining aspect ratio
        const scaleX = usableWidth / this.designWidth;
        const scaleY = usableHeight / this.designHeight;
        this.scale = Math.min(scaleX, scaleY, 1.0); // Don't scale up beyond 1.0
        
        // Apply minimum scale for playability
        const minScale = this.isMobile ? 0.5 : 0.6;
        this.scale = Math.max(this.scale, minScale);
        
        // Calculate actual canvas dimensions
        this.scaledWidth = Math.floor(this.designWidth * this.scale);
        this.scaledHeight = Math.floor(this.designHeight * this.scale);
        
        // Update canvas element
        this.canvas.width = this.scaledWidth;
        this.canvas.height = this.scaledHeight;
        
        // Update CSS size for proper scaling
        this.canvas.style.width = this.scaledWidth + 'px';
        this.canvas.style.height = this.scaledHeight + 'px';
        
        // Center the canvas
        this.canvas.style.display = 'block';
        this.canvas.style.margin = '0 auto';
        
        // Update camera if available
        if (this.game.camera) {
            this.game.camera.setViewport(this.scaledWidth, this.scaledHeight);
        }
        
        // Update performance settings based on scale
        this.updatePerformanceSettings();
    }
    
    updatePerformanceSettings() {
        if (!this.game.qualitySettings) return;
        
        // Reduce quality on smaller screens/scales
        let qualityMultiplier = 1.0;
        
        if (this.scale < 0.7) {
            qualityMultiplier = 0.6; // Low quality for very small screens
        } else if (this.scale < 0.9) {
            qualityMultiplier = 0.8; // Medium quality for small screens
        }
        
        // Apply mobile-specific optimizations
        if (this.isMobile) {
            qualityMultiplier *= 0.7; // Additional reduction for mobile
        }
        
        this.game.qualitySettings.particleReduction = qualityMultiplier;
        this.game.qualitySettings.effectsReduction = qualityMultiplier;
        this.game.qualitySettings.shadowQuality = qualityMultiplier;
        this.game.qualitySettings.animationDetail = qualityMultiplier;
    }
    
    applyMobileOptimizations() {
        // Reduce maximum entities for mobile performance
        if (this.game.systems.enemy) {
            this.game.systems.enemy.maxActiveEnemies = Math.min(
                this.game.systems.enemy.maxActiveEnemies,
                100 // Lower limit for mobile
            );
        }
        
        if (this.game.systems.projectile) {
            this.game.systems.projectile.maxActiveProjectiles = Math.min(
                this.game.systems.projectile.maxActiveProjectiles,
                150 // Lower limit for mobile
            );
        }
        
        // Enable performance mode
        this.performanceMode = true;
        
        // Add mobile-specific CSS
        this.addMobileCSS();
    }
    
    addMobileCSS() {
        const style = document.createElement('style');
        style.textContent = `
            /* Mobile optimizations */
            @media (max-width: 768px) {
                body {
                    touch-action: none;
                    -webkit-touch-callout: none;
                    -webkit-user-select: none;
                    user-select: none;
                }
                
                #gameCanvas {
                    touch-action: none;
                    max-width: 100vw;
                    max-height: 100vh;
                }
                
                .ui-element {
                    font-size: 0.9em;
                }
            }
            
            @media (orientation: landscape) and (max-height: 500px) {
                #gameCanvas {
                    max-height: 90vh;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Coordinate conversion methods for touch/mouse events
    screenToCanvas(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (screenX - rect.left) / this.scale;
        const y = (screenY - rect.top) / this.scale;
        
        return { x, y };
    }
    
    canvasToWorld(canvasX, canvasY) {
        if (!this.game.camera) return { x: canvasX, y: canvasY };
        
        return {
            x: canvasX + this.game.camera.x - this.scaledWidth / 2,
            y: canvasY + this.game.camera.y - this.scaledHeight / 2
        };
    }
    
    screenToWorld(screenX, screenY) {
        const canvas = this.screenToCanvas(screenX, screenY);
        return this.canvasToWorld(canvas.x, canvas.y);
    }
    
    // UI scaling helpers
    getUIScale() {
        return Math.max(this.scale, 0.8); // Minimum UI scale for readability
    }
    
    getScaledFont(baseSize) {
        return Math.floor(baseSize * this.getUIScale());
    }
    
    // Performance monitoring
    getPerformanceInfo() {
        return {
            scale: this.scale,
            dimensions: `${this.scaledWidth}x${this.scaledHeight}`,
            isMobile: this.isMobile,
            isTouch: this.isTouch,
            performanceMode: this.performanceMode,
            qualityMultiplier: this.game.qualitySettings?.particleReduction || 1.0
        };
    }
    
    // Cleanup
    destroy() {
        window.removeEventListener('resize', this.boundResizeHandler);
        window.removeEventListener('orientationchange', this.boundOrientationHandler);
        
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
    }
}
