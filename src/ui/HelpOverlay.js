/**
 * HelpOverlay.js
 * 
 * In-game help and controls overlay
 */

import { t } from '../i18n/index.js';

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
                🎮 ${t('help.title')}
            </h2>
            
            <div style="margin-bottom: 25px;">
                <h3 style="color: #FF6B6B; margin-bottom: 10px;">${t('help.movement')}</h3>
                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 8px;">
                    <span style="color: #AAA;">${t('help.moveKeys')}</span>
                    <span>${t('help.moveAction')}</span>
                    <span style="color: #AAA;">${t('help.mouse')}</span>
                    <span>${t('help.aimAction')}</span>
                </div>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h3 style="color: #FF6B6B; margin-bottom: 10px;">${t('help.gameControls')}</h3>
                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 8px;">
                    <span style="color: #AAA;">${t('help.esc')}</span>
                    <span>${t('help.pauseAction')}</span>
                    <span style="color: #AAA;">${t('help.f1')}</span>
                    <span>${t('help.settingsAction')}</span>
                    <span style="color: #AAA;">${t('help.keys15')}</span>
                    <span>${t('help.upgradeAction')}</span>
                </div>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h3 style="color: #FF6B6B; margin-bottom: 10px;">${t('help.debugTools')}</h3>
                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 8px;">
                    <span style="color: #AAA;">${t('help.shiftD')}</span>
                    <span>${t('help.debugProjectile')}</span>
                    <span style="color: #AAA;">${t('help.f4g')}</span>
                    <span>${t('help.debugInfo')}</span>
                    <span style="color: #AAA;">${t('help.f5')}</span>
                    <span>${t('help.telemetry')}</span>
                    <span style="color: #AAA;">${t('help.f2')}</span>
                    <span>${t('help.performance')}</span>
                </div>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h3 style="color: #FF6B6B; margin-bottom: 10px;">${t('help.tips')}</h3>
                <ul style="margin: 0; padding-left: 20px; color: #CCC;">
                    <li>${t('help.tip1')}</li>
                    <li>${t('help.tip2')}</li>
                    <li>${t('help.tip3')}</li>
                    <li>${t('help.tip4')}</li>
                    <li>${t('help.tip5')}</li>
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
                ">${t('help.closeButton')}</button>
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