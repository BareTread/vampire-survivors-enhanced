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
                🎮 游戏操作
            </h2>
            
            <div style="margin-bottom: 25px;">
                <h3 style="color: #FF6B6B; margin-bottom: 10px;">移动操作</h3>
                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 8px;">
                    <span style="color: #AAA;">WASD / 方向键</span>
                    <span>移动角色</span>
                    <span style="color: #AAA;">鼠标</span>
                    <span>瞄准方向</span>
                </div>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h3 style="color: #FF6B6B; margin-bottom: 10px;">游戏控制</h3>
                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 8px;">
                    <span style="color: #AAA;">ESC</span>
                    <span>暂停/继续</span>
                    <span style="color: #AAA;">F1</span>
                    <span>设置菜单</span>
                    <span style="color: #AAA;">1-5</span>
                    <span>选择升级选项</span>
                </div>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h3 style="color: #FF6B6B; margin-bottom: 10px;">调试工具</h3>
                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 8px;">
                    <span style="color: #AAA;">Shift + D</span>
                    <span>弹药调试面板</span>
                    <span style="color: #AAA;">F4 / G</span>
                    <span>通用调试信息</span>
                    <span style="color: #AAA;">F5</span>
                    <span>进度遥测数据</span>
                    <span style="color: #AAA;">F2</span>
                    <span>性能仪表盘</span>
                </div>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h3 style="color: #FF6B6B; margin-bottom: 10px;">游戏提示</h3>
                <ul style="margin: 0; padding-left: 20px; color: #CCC;">
                    <li>武器自动攻击最近的敌人</li>
                    <li>收集绿色宝石来升级</li>
                    <li>尽可能长时间生存！</li>
                    <li>敌人会随时间变得更强</li>
                    <li>暴击造成2倍伤害</li>
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
                ">关闭 (H)</button>
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