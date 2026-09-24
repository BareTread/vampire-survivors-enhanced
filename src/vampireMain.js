// Vampire Survivors Game - Main Entry Point

import { VampireSurvivorsGame } from './core/VampireSurvivorsGame.js?v=20260924-feel1';
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

        // Set canvas size
        this.resizeCanvas();
        console.log('✅ Canvas setup complete:', this.canvas.width + 'x' + this.canvas.height);
        window.addEventListener('resize', () => this.resizeCanvas());

        // Disable context menu on canvas
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

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
        this.canvas.style.margin = '0'; // Remove any margin

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
            progressBar.style.transform = `scaleX(${progress / 100})`;
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
        // Inline critical styles so the fallback works even if stylesheet order shifts
        loadingScreen.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(180deg, #06070c 0%, #0d0c15 55%, #120d14 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            z-index: 9999;
            color: #ede3c8;
            font-family: Georgia, 'Times New Roman', serif;
        `;

        loadingScreen.innerHTML = `
            <div style="text-align: center;">
                <div style="width: 72px; height: 72px; border-radius: 50%; margin: 0 auto 34px;
                    background: radial-gradient(circle at 38% 34%, #f0e7ce 0%, #dccfaf 62%, #b9a888 100%);
                    box-shadow: 0 0 34px rgba(232,220,190,0.28), 0 0 90px rgba(232,220,190,0.12);"></div>
                <h1 style="font-family: 'Cinzel', Georgia, serif; font-size: clamp(26px, 5vw, 44px);
                    letter-spacing: 0.14em; margin: 0 0 6px; color: #ede3c8;
                    text-shadow: 0 2px 0 rgba(0,0,0,0.8), 0 0 26px rgba(224,138,60,0.25);">
                    VAMPIRE SURVIVORS
                </h1>
                <div style="color: #c9a86a; font-size: 13px; letter-spacing: 0.5em; text-indent: 0.5em; margin-bottom: 44px;">
                    ENHANCED
                </div>
                <div style="width: min(320px, 70vw); height: 8px; margin: 0 auto;
                    background: rgba(28,24,18,0.9); border: 1px solid rgba(198,160,92,0.35);
                    border-radius: 4px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.5);">
                    <div id="loadingProgress" style="width: 100%; height: 100%; transform: scaleX(0); transform-origin: left;
                        background: linear-gradient(90deg, #5a4210, #b8862e 55%, #e8c96a);
                        transition: transform 0.35s ease;"></div>
                </div>
                <p id="loadingStatus" style="font-size: 13px; margin: 16px 0 0; color: rgba(190,180,160,0.75); letter-spacing: 0.06em;">Raising the dead…</p>
                <p style="font-size: 12px; margin-top: 40px; color: rgba(170,158,132,0.5); letter-spacing: 0.04em;">
                    WASD move &nbsp;·&nbsp; SPACE evade &nbsp;·&nbsp; auto-attacks do the rest
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
                background: linear-gradient(180deg, #0c0608 0%, #140a0c 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1001;
                color: #ede3c8;
                font-family: Georgia, 'Times New Roman', serif;
            `;
        }

        errorScreen.innerHTML = `
            <div style="text-align: center; max-width: 500px; padding: 2rem;">
                <h1 style="font-family: 'Cinzel', Georgia, serif; font-size: 2rem; margin-bottom: 1rem;
                    color: #d94a3a; letter-spacing: 0.08em;">THE RITUAL FAILED</h1>
                <p style="font-size: 1.05rem; margin-bottom: 1rem; color: rgba(190,180,160,0.85);">The game could not be summoned:</p>
                <p style="font-size: 0.9rem; background: rgba(0,0,0,0.4); padding: 1rem;
                    border: 1px solid rgba(198,160,92,0.25); border-radius: 6px; margin-bottom: 2rem;
                    color: rgba(226,216,192,0.9);">
                    ${error.message}
                </p>
                <button onclick="location.reload()" style="
                    background: linear-gradient(180deg, #4a3e30, #241e1a);
                    color: #f0e2bc;
                    border: 1px solid rgba(216,180,106,0.6);
                    padding: 14px 30px;
                    border-radius: 6px;
                    font-size: 1rem;
                    font-family: 'Cinzel', Georgia, serif;
                    letter-spacing: 0.08em;
                    cursor: pointer;
                    transition: transform 0.2s ease;
                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    RAISE IT AGAIN
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

    gameBootstrap.init().catch((error) => {
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
        document.querySelectorAll('*').forEach((el) => {
            if (
                el.id === 'gameCanvas' ||
                el.tagName === 'CANVAS' ||
                el.tagName === 'HTML' ||
                el.tagName === 'BODY' ||
                el.tagName === 'SCRIPT' ||
                el.tagName === 'STYLE'
            )
                return;

            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);

            if (rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden') {
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
        console.table(
            visibleElements.map((e) => ({
                id: e.id,
                class: e.class,
                tag: e.tag,
                position: e.position,
                size: e.size,
                bg: e.bg,
                zIndex: e.zIndex
            }))
        );

        // Remove problematic ones
        let removedCount = 0;
        visibleElements.forEach((item) => {
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
