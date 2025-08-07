// Vampire Survivors Game - Main Entry Point

import { VampireSurvivorsGame } from './core/VampireSurvivorsGame.js';
import { InputManager } from './core/InputManager.js';
import { AudioManager } from './core/AudioManager.js';

class VampireGameBootstrap {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.game = null;
        this.isInitialized = false;
        this.loadingProgress = 0;
        
        // Performance monitoring
        this.frameCount = 0;
        this.lastFPSUpdate = 0;
        this.currentFPS = 60;
    }

    async init() {
        try {
            // Setup canvas
            this.setupCanvas();
            
            // Update loading status
            this.updateLoadingStatus('Loading core systems...', 20);
            
            // Initialize core systems
            await this.initializeSystems();
            this.updateLoadingStatus('Loading game...', 60);
            
            // Initialize game
            await this.initializeGame();
            this.updateLoadingStatus('Ready!', 100);
            
            // Hide loading screen
            setTimeout(() => this.hideLoadingScreen(), 500);
            
        } catch (error) {
            console.error('Failed to initialize game:', error);
            this.showErrorScreen(error);
        }
    }

    setupCanvas() {
        this.canvas = document.getElementById('gameCanvas');
        
        if (!this.canvas) {
            console.error('❌ Canvas element not found! Creating one...');
            this.canvas = this.createCanvas();
        }
        
        this.ctx = this.canvas.getContext('2d', {
            alpha: false,
            desynchronized: true,
            powerPreference: 'high-performance'
        });
        
        if (!this.ctx) {
            throw new Error('Failed to get 2D context from canvas');
        }
        
        console.log('✅ Canvas setup complete:', this.canvas.width + 'x' + this.canvas.height);
        
        // Set canvas size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Disable context menu on canvas
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        
        // Make canvas focusable for keyboard events
        this.canvas.tabIndex = 1;
        this.canvas.focus();
    }

    createCanvas() {
        const canvas = document.createElement('canvas');
        canvas.id = 'gameCanvas';
        canvas.style.cssText = `
            display: block;
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            margin: 0 !important;
            padding: 0;
            background: #000;
            cursor: crosshair;
        `;
        
        // Clear body content but preserve overflow constraints
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        
        // Ensure body maintains overflow hidden to prevent white rectangle bug
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.overflow = 'hidden';
        document.body.style.background = '#000';
        document.body.style.fontFamily = 'Arial, sans-serif';
        document.body.style.width = '100%';
        document.body.style.height = '100%';
        
        document.body.appendChild(canvas);
        
        return canvas;
    }

    resizeCanvas() {
        // Use slightly smaller dimensions to prevent overflow
        const displayWidth = Math.floor(window.innerWidth);
        const displayHeight = Math.floor(window.innerHeight);
        
        // Set canvas size
        this.canvas.width = displayWidth;
        this.canvas.height = displayHeight;
        
        // Use viewport units to ensure no overflow
        this.canvas.style.width = '100vw';
        this.canvas.style.height = '100vh';
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.margin = '0';  // Remove any margin
        
        // Update game camera if game exists
        if (this.game && this.game.camera) {
            this.game.camera.resize(displayWidth, displayHeight);
        }
    }

    async initializeSystems() {
        // Initialize input manager
        this.inputManager = new InputManager(this.canvas);
        
        // Initialize audio manager (optional - can work without)
        try {
            this.audioManager = new AudioManager();
        } catch (error) {
            // Fallback audio manager if audio fails
            this.audioManager = { playSound: () => {}, stopAll: () => {} };
        }
    }

    async initializeGame() {
        // Create game configuration
        const config = {
            inputManager: this.inputManager,
            audioManager: this.audioManager
        };
        
        // Create game instance
        this.game = new VampireSurvivorsGame(this.canvas, config);
        
        // Start the game
        this.game.start();
        
        // Force a resize to ensure canvas fills viewport
        this.resizeCanvas();
        
        this.isInitialized = true;
    }

    updateLoadingStatus(status, progress) {
        this.loadingProgress = progress;
        
        // Create loading screen if it doesn't exist
        let loadingScreen = document.getElementById('loadingScreen');
        if (!loadingScreen) {
            loadingScreen = this.createLoadingScreen();
        }
        
        // Update progress bar
        const progressBar = document.getElementById('loadingProgress');
        if (progressBar) {
            progressBar.style.width = progress + '%';
        }
        
        // Update status text
        const statusText = document.getElementById('loadingStatus');
        if (statusText) {
            statusText.textContent = status;
        }
    }

    createLoadingScreen() {
        const loadingScreen = document.createElement('div');
        loadingScreen.id = 'loadingScreen';
        loadingScreen.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            color: white;
            font-family: Arial, sans-serif;
        `;
        
        loadingScreen.innerHTML = `
            <div style="text-align: center;">
                <h1 style="font-size: 3rem; margin-bottom: 2rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">
                    🧛 VAMPIRE SURVIVORS
                </h1>
                <div style="width: 300px; height: 20px; background: rgba(255,255,255,0.3); border-radius: 10px; overflow: hidden; margin-bottom: 1rem;">
                    <div id="loadingProgress" style="width: 0%; height: 100%; background: linear-gradient(90deg, #ff6b6b, #feca57); transition: width 0.3s ease;"></div>
                </div>
                <p id="loadingStatus" style="font-size: 1.2rem; margin: 0;">Initializing...</p>
                <p style="font-size: 0.9rem; margin-top: 2rem; opacity: 0.8;">
                    Survive the endless horde! WASD to move, auto-attacks enabled.
                </p>
            </div>
        `;
        
        document.body.appendChild(loadingScreen);
        return loadingScreen;
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            loadingScreen.style.transition = 'opacity 0.5s ease';
            setTimeout(() => {
                if (loadingScreen.parentNode) {
                    loadingScreen.parentNode.removeChild(loadingScreen);
                }
            }, 500);
        }
    }

    showErrorScreen(error) {
        let errorScreen = document.getElementById('errorScreen');
        if (!errorScreen) {
            errorScreen = document.createElement('div');
            errorScreen.id = 'errorScreen';
            errorScreen.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1001;
                color: white;
                font-family: Arial, sans-serif;
            `;
        }
        
        errorScreen.innerHTML = `
            <div style="text-align: center; max-width: 500px; padding: 2rem;">
                <h1 style="font-size: 2.5rem; margin-bottom: 1rem;">❌ Error</h1>
                <p style="font-size: 1.2rem; margin-bottom: 1rem;">Failed to load the game:</p>
                <p style="font-size: 1rem; background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 5px; margin-bottom: 2rem;">
                    ${error.message}
                </p>
                <button onclick="location.reload()" style="
                    background: white; 
                    color: #ee5a24; 
                    border: none; 
                    padding: 15px 30px; 
                    border-radius: 5px; 
                    font-size: 1.1rem; 
                    font-weight: bold;
                    cursor: pointer;
                    transition: transform 0.2s ease;
                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    🔄 Reload Game
                </button>
            </div>
        `;
        
        document.body.appendChild(errorScreen);
    }
}

// Initialize game when DOM is loaded or immediately if already loaded
function initializeGame() {
    console.log('🎮 Initializing Vampire Survivors...');
    
    const gameBootstrap = new VampireGameBootstrap();
    window.gameBootstrap = gameBootstrap; // Make it globally accessible for debugging
    
    gameBootstrap.init().catch(error => {
        console.error('❌ Failed to initialize game:', error);
        console.error('Stack trace:', error.stack);
    });
}

// Check if DOM is already loaded (important for module scripts)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGame);
} else {
    // DOM is already loaded, initialize immediately
    initializeGame();
}

// Global error handling with recovery
let errorCount = 0;
let lastErrorTime = 0;

window.addEventListener('error', (event) => {
    const now = Date.now();
    
    // Rate limit error handling to prevent spam
    if (now - lastErrorTime < 1000) {
        errorCount++;
        if (errorCount > 10) {
            console.error('Too many errors, stopping error handler');
            return;
        }
    } else {
        errorCount = 1;
    }
    
    lastErrorTime = now;
    
    console.error('Uncaught error:', event.error);
    
    // Try to keep the game running
    if (window.game && window.game.running) {
        console.log('Attempting to continue game despite error...');
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    event.preventDefault();
});

// Export for debugging
window.VampireGameBootstrap = VampireGameBootstrap;

// Add some helpful console commands
window.debugCommands = {
    showDebug: () => {
        const debugInfo = document.getElementById('debug-info');
        if (debugInfo) {
            debugInfo.style.display = 'block';
        }
    },
    hideDebug: () => {
        const debugInfo = document.getElementById('debug-info');
        if (debugInfo) {
            debugInfo.style.display = 'none';
        }
    },
    getGameState: () => {
        return window.gameBootstrap?.game?.getState();
    },
    getDebugInfo: () => {
        return window.gameBootstrap?.game?.getDebugInfo();
    },
    cleanupArtifacts: () => {
        console.log('🧹 Running artifact cleanup...');
        
        // Find all visible elements
        const visibleElements = [];
        document.querySelectorAll('*').forEach(el => {
            if (el.id === 'gameCanvas' || el.tagName === 'CANVAS' || 
                el.tagName === 'HTML' || el.tagName === 'BODY' ||
                el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
            
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            
            if (rect.width > 0 && rect.height > 0 && 
                style.display !== 'none' && style.visibility !== 'hidden') {
                visibleElements.push({
                    element: el,
                    id: el.id || 'none',
                    class: el.className || 'none',
                    tag: el.tagName,
                    position: `${Math.round(rect.left)},${Math.round(rect.top)}`,
                    size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
                    bg: style.backgroundColor,
                    zIndex: style.zIndex
                });
            }
        });
        
        console.log(`Found ${visibleElements.length} visible elements:`);
        console.table(visibleElements.map(e => ({
            id: e.id,
            class: e.class,
            tag: e.tag,
            position: e.position,
            size: e.size,
            bg: e.bg,
            zIndex: e.zIndex
        })));
        
        // Remove problematic ones
        let removedCount = 0;
        visibleElements.forEach(item => {
            const el = item.element;
            const bg = item.bg;
            
            // Check for white/light backgrounds or large right-side overlays
            let shouldRemove = false;
            
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                if (match) {
                    const [_, r, g, b] = match;
                    if (parseInt(r) > 240 && parseInt(g) > 240 && parseInt(b) > 240) {
                        shouldRemove = true;
                    }
                }
            }
            
            // Check position (right side overlay)
            const rect = el.getBoundingClientRect();
            if (rect.width > 100 && rect.left > window.innerWidth * 0.7) {
                shouldRemove = true;
            }
            
            if (shouldRemove && el.id !== 'gameHUD' && el.id !== 'performanceMonitor') {
                console.log(`Removing: ${item.id || item.tag} - ${item.bg} at ${item.position}`);
                el.remove();
                removedCount++;
            }
        });
        
        console.log(`✅ Cleanup complete. Removed ${removedCount} elements.`);
        
        // Force redraw - removed DOM manipulation call
        
        return removedCount;
    }
};

// Debug commands available in development mode
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    console.log('Debug commands available: debugCommands.showDebug(), debugCommands.getGameState()');
}