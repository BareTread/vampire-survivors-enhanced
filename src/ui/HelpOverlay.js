/**
 * HelpOverlay.js
 * 
 * In-game help and controls overlay
 */

export class HelpOverlay {
    constructor(game) {
        this.game = game;
        this.visible = false;
        this.element = null;
        
        this.createOverlay();
    }
    
    createOverlay() {
        this.element = document.createElement('div');
        this.element.id = 'help-overlay';
        this.element.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95);
            border: 3px solid #FFD700;
            border-radius: 15px;
            padding: 30px;
            color: #FFF;
            font-family: 'Courier New', monospace;
            z-index: 10000;
            display: none;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
        `;
        
        this.element.innerHTML = `
            <h2 style="color: #FFD700; text-align: center; margin-bottom: 20px;">
                🎮 Game Controls
            </h2>
            
            <div style="margin-bottom: 25px;">
                <h3 style="color: #FF6B6B; margin-bottom: 10px;">Movement</h3>
                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 8px;">
                    <span style="color: #AAA;">WASD / Arrows</span>
                    <span>Move character</span>
                    <span style="color: #AAA;">Mouse</span>
                    <span>Aim direction</span>
                </div>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h3 style="color: #FF6B6B; margin-bottom: 10px;">Game Controls</h3>
                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 8px;">
                    <span style="color: #AAA;">ESC</span>
                    <span>Pause/Resume</span>
                    <span style="color: #AAA;">F1</span>
                    <span>Settings Menu</span>
                    <span style="color: #AAA;">1-5</span>
                    <span>Select upgrade option</span>
                </div>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h3 style="color: #FF6B6B; margin-bottom: 10px;">Debug Tools</h3>
                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 8px;">
                    <span style="color: #AAA;">Shift + D</span>
                    <span>Projectile Debug Overlay</span>
                    <span style="color: #AAA;">F4</span>
                    <span>General Debug Info</span>
                    <span style="color: #AAA;">F5</span>
                    <span>Progression Telemetry</span>
                    <span style="color: #AAA;">F2</span>
                    <span>Performance Dashboard</span>
                </div>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h3 style="color: #FF6B6B; margin-bottom: 10px;">Tips</h3>
                <ul style="margin: 0; padding-left: 20px; color: #CCC;">
                    <li>Weapons auto-fire at nearest enemies</li>
                    <li>Collect green gems to level up</li>
                    <li>Survive as long as possible!</li>
                    <li>Enemies get stronger over time</li>
                    <li>Critical hits deal 2x damage</li>
                </ul>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
                <button id="help-close" style="
                    background: #FFD700;
                    color: #000;
                    border: none;
                    padding: 10px 30px;
                    font-size: 16px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                ">Close (H)</button>
            </div>
        `;
        
        document.body.appendChild(this.element);
        
        // Bind close button
        document.getElementById('help-close').addEventListener('click', () => {
            this.hide();
        });
        
        // Close on click outside
        this.element.addEventListener('click', (e) => {
            if (e.target === this.element) {
                this.hide();
            }
        });
    }
    
    show() {
        this.visible = true;
        this.element.style.display = 'block';
        
        // Pause game if playing
        if (this.game.gameState === 'playing') {
            this.wasPlaying = true;
            this.game.pauseGame();
        }
    }
    
    hide() {
        this.visible = false;
        this.element.style.display = 'none';
        
        // Resume if was playing
        if (this.wasPlaying && this.game.gameState === 'paused') {
            this.game.resumeGame();
            this.wasPlaying = false;
        }
    }
    
    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }
}