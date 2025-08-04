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
        this.canvas = document.getElementById('gameCanvas') || this.createCanvas();
        this.ctx = this.canvas.getContext('2d', {
            alpha: false,
            desynchronized: true,
            powerPreference: 'high-performance'
        });
        
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
            margin: 0;
            padding: 0;
            background: #000;
            cursor: crosshair;
        `;
        
        // Remove existing content and add canvas
        document.body.innerHTML = '';
        document.body.style.cssText = `
            margin: 0;
            padding: 0;
            overflow: hidden;
            background: #000;
            font-family: Arial, sans-serif;
        `;
        document.body.appendChild(canvas);
        
        return canvas;
    }

    resizeCanvas() {
        const displayWidth = window.innerWidth;
        const displayHeight = window.innerHeight;
        
        // Set canvas size
        this.canvas.width = displayWidth;
        this.canvas.height = displayHeight;
        
        // Update canvas style
        this.canvas.style.width = displayWidth + 'px';
        this.canvas.style.height = displayHeight + 'px';
        
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

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const gameBootstrap = new VampireGameBootstrap();
    gameBootstrap.init().catch(console.error);
});

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
    }
};

// Debug commands available in development mode
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    console.log('Debug commands available: debugCommands.showDebug(), debugCommands.getGameState()');
}