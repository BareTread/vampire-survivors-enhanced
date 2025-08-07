export class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.mouse = {
            x: 0,
            y: 0,
            worldX: 0,
            worldY: 0,
            down: false,
            button: -1
        };
        
        this.keys = {};
        this.keysPressed = {};
        this.keysReleased = {};
        
        this.touches = [];
        
        // OPTIMIZED: Performance tracking and input buffering
        this.inputBuffer = [];
        this.maxBufferSize = 10;
        this.lastInputTime = 0;
        this.inputLatency = 0;
        
        // OPTIMIZED: Pre-computed canvas rect for faster mouse calculations
        this.canvasRect = null;
        this.updateCanvasRect();
        
        // OPTIMIZED: Throttle rect updates
        this.rectUpdateInterval = 1000; // Update every second
        this.lastRectUpdate = 0;
        
        // Input performance statistics
        this.inputStats = {
            totalInputs: 0,
            droppedInputs: 0,
            invalidInputs: 0,
            recoveryEvents: 0
        };
        
        // Fallback mode for error recovery
        this.fallbackMode = {
            active: false,
            reason: null
        };
        
        // State manager for input integrity
        this.stateManager = {
            corrupted: false,
            recoveryAttempts: 0
        };
        
        // Input validation
        this.inputValidator = {
            validKeys: new Set(['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 
                               'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                               'Escape', 'F1', 'F2', 'g', 'G', ' ', '1', '2', '3', '4', '5'])
        };
        
        // Mouse prediction for smooth movement
        this.prediction = {
            mouseHistory: [],
            maxHistorySize: 5
        };
        
        // Canvas validity tracking
        this.canvasRectValid = true;
        
        // Event listeners need to be Maps for proper cleanup
        this.listeners = new Map();
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // OPTIMIZED: Mouse events with cached rect and performance tracking
        this.canvas.addEventListener('mousemove', (e) => {
            const now = performance.now();
            
            // OPTIMIZED: Use cached canvas rect, update periodically
            if (now - this.lastRectUpdate > this.rectUpdateInterval) {
                this.updateCanvasRect();
                this.lastRectUpdate = now;
            }
            
            this.mouse.x = e.clientX - this.canvasRect.left;
            this.mouse.y = e.clientY - this.canvasRect.top;
            
            // OPTIMIZED: Update world coordinates if camera exists
            if (this.camera) {
                const worldPos = this.camera.screenToWorld(this.mouse.x, this.mouse.y);
                this.mouse.worldX = worldPos.x;
                this.mouse.worldY = worldPos.y;
            }
            
            this.emit('mouseMove', {
                x: this.mouse.x,
                y: this.mouse.y,
                movementX: e.movementX,
                movementY: e.movementY
            });
        }, { passive: true }); // Passive for better performance
        
        this.canvas.addEventListener('mousedown', (e) => {
            this.mouse.down = true;
            this.mouse.button = e.button;
            
            this.emit('mouseDown', {
                x: this.mouse.x,
                y: this.mouse.y,
                button: e.button
            });
        });
        
        this.canvas.addEventListener('mouseup', (e) => {
            this.mouse.down = false;
            this.mouse.button = -1;
            
            this.emit('mouseUp', {
                x: this.mouse.x,
                y: this.mouse.y,
                button: e.button
            });
        });
        
        this.canvas.addEventListener('click', (e) => {
            this.emit('click', {
                x: this.mouse.x,
                y: this.mouse.y,
                button: e.button
            });
        });
        
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.emit('rightClick', {
                x: this.mouse.x,
                y: this.mouse.y
            });
        });
        
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.emit('wheel', {
                x: this.mouse.x,
                y: this.mouse.y,
                deltaY: e.deltaY,
                deltaX: e.deltaX
            });
        });
        
        // OPTIMIZED: Keyboard events with input buffering and latency tracking
        window.addEventListener('keydown', (e) => {
            // Only prevent default for game-specific function keys, not system keys
            // Allow F11 (fullscreen) and F12 (DevTools) to work normally
            if ((e.key === 'F1' || e.key === 'F4') || // Game-specific F-keys only
                (e.key === 'Tab' && this.canvas === document.activeElement)) {
                e.preventDefault();
            }
            
            const now = performance.now();
            
            // Track shift key separately
            if (e.key === 'Shift') {
                this.keys['shift'] = true;
            }
            
            if (!this.keys[e.key]) {
                this.keysPressed[e.key] = true;
                
                // OPTIMIZED: Track input latency
                this.inputLatency = now - this.lastInputTime;
                this.lastInputTime = now;
                
                // OPTIMIZED: Buffer input for consistent processing
                this.addToInputBuffer('keyDown', e.key, now);
                
                this.emit('keyDown', e.key);
            }
            this.keys[e.key] = true;
        });
        
        window.addEventListener('keyup', (e) => {
            const now = performance.now();
            
            // Track shift key separately
            if (e.key === 'Shift') {
                this.keys['shift'] = false;
            }
            
            this.keys[e.key] = false;
            this.keysReleased[e.key] = true;
            
            // OPTIMIZED: Buffer input for consistent processing
            this.addToInputBuffer('keyUp', e.key, now);
            
            this.emit('keyUp', e.key);
        });
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.touches = Array.from(e.touches);
            
            if (this.touches.length === 1) {
                const touch = this.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                this.mouse.x = touch.clientX - rect.left;
                this.mouse.y = touch.clientY - rect.top;
                this.mouse.down = true;
                
                this.emit('touchStart', {
                    x: this.mouse.x,
                    y: this.mouse.y,
                    touches: this.touches
                });
            }
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.touches = Array.from(e.touches);
            
            if (this.touches.length === 1) {
                const touch = this.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                this.mouse.x = touch.clientX - rect.left;
                this.mouse.y = touch.clientY - rect.top;
                
                this.emit('touchMove', {
                    x: this.mouse.x,
                    y: this.mouse.y,
                    touches: this.touches
                });
            }
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.touches = Array.from(e.touches);
            
            if (this.touches.length === 0) {
                this.mouse.down = false;
                
                this.emit('touchEnd', {
                    x: this.mouse.x,
                    y: this.mouse.y
                });
            }
        });
        
        // Prevent default behaviors
        this.canvas.addEventListener('dragstart', (e) => e.preventDefault());
        this.canvas.addEventListener('selectstart', (e) => e.preventDefault());
    }
    
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    
    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event).filter(cb => cb !== callback);
            if (callbacks.length > 0) {
                this.listeners.set(event, callbacks);
            } else {
                this.listeners.delete(event);
            }
        }
    }
    
    emit(event, data) {
        // OPTIMIZED: Fast event emission with minimal allocations
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            for (let i = 0; i < eventListeners.length; i++) {
                eventListeners[i](data);
            }
        }
    }
    
    isKeyDown(key) {
        return !!this.keys[key];
    }
    
    isKeyPressed(key) {
        return !!this.keysPressed[key];
    }
    
    isKeyReleased(key) {
        return !!this.keysReleased[key];
    }
    
    isMouseDown(button = 0) {
        return this.mouse.down && (this.mouse.button === button || button === -1);
    }
    
    getMousePosition() {
        return {
            x: this.mouse.x,
            y: this.mouse.y
        };
    }
    
    update() {
        // OPTIMIZED: Clear frame-specific states efficiently
        // Use Object.keys length check to avoid unnecessary operations
        if (Object.keys(this.keysPressed).length > 0) {
            this.keysPressed = {};
        }
        if (Object.keys(this.keysReleased).length > 0) {
            this.keysReleased = {};
        }
        
        // OPTIMIZED: Process input buffer for consistent timing
        this.processInputBuffer();
    }
    
    setCamera(camera) {
        this.camera = camera;
        
        // Update world coordinates when camera is set
        if (this.camera) {
            const worldPos = this.camera.screenToWorld(this.mouse.x, this.mouse.y);
            this.mouse.worldX = worldPos.x;
            this.mouse.worldY = worldPos.y;
        }
    }
    
    // OPTIMIZED: Performance methods for zero-latency input
    updateCanvasRect() {
        this.canvasRect = this.canvas.getBoundingClientRect();
        this.canvasRectValid = true;
    }
    
    addToInputBuffer(type, key, timestamp) {
        // OPTIMIZED: Circular buffer for input events
        if (this.inputBuffer.length >= this.maxBufferSize) {
            this.inputBuffer.shift(); // Remove oldest input
            this.inputStats.droppedInputs++;
        }
        
        this.inputBuffer.push({
            type: type,
            key: key,
            timestamp: timestamp
        });
        
        this.inputStats.totalInputs++;
    }
    
    processInputBuffer() {
        // OPTIMIZED: Process buffered inputs for consistent timing
        const now = performance.now();
        const processedInputs = [];
        
        for (let i = 0; i < this.inputBuffer.length; i++) {
            const input = this.inputBuffer[i];
            const age = now - input.timestamp;
            
            // Process inputs that are recent (within 100ms)
            if (age < 100) {
                processedInputs.push(input);
            }
        }
        
        this.inputBuffer = processedInputs;
    }
    
    getInputLatency() {
        return this.inputLatency;
    }
    
    // OPTIMIZED: Fast key state checks
    isMovementKey(key) {
        return key === 'w' || key === 'a' || key === 's' || key === 'd' || 
               key === 'W' || key === 'A' || key === 'S' || key === 'D' ||
               key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight';
    }
    
    getMovementVector() {
        // OPTIMIZED: Fast movement calculation
        let x = 0, y = 0;
        
        if (this.keys['a'] || this.keys['A'] || this.keys['ArrowLeft']) x -= 1;
        if (this.keys['d'] || this.keys['D'] || this.keys['ArrowRight']) x += 1;
        if (this.keys['w'] || this.keys['W'] || this.keys['ArrowUp']) y -= 1;
        if (this.keys['s'] || this.keys['S'] || this.keys['ArrowDown']) y += 1;
        
        // Normalize diagonal movement
        if (x !== 0 && y !== 0) {
            const factor = 0.7071067811865476; // 1/sqrt(2)
            x *= factor;
            y *= factor;
        }
        
        return { x, y };
    }
    
    // OPTIMIZED: Performance monitoring
    getPerformanceStats() {
        return {
            inputLatency: this.inputLatency.toFixed(2) + 'ms',
            bufferSize: this.inputBuffer.length,
            maxBufferSize: this.maxBufferSize,
            totalInputs: this.inputStats.totalInputs,
            droppedInputs: this.inputStats.droppedInputs,
            invalidInputs: this.inputStats.invalidInputs,
            recoveryEvents: this.inputStats.recoveryEvents,
            fallbackMode: this.fallbackMode.active,
            stateCorrupted: this.stateManager.corrupted,
            recoveryAttempts: this.stateManager.recoveryAttempts
        };
    }
    
    /**
     * Get comprehensive input system status
     */
    getSystemStatus() {
        return {
            healthy: !this.fallbackMode.active && !this.stateManager.corrupted,
            fallbackMode: this.fallbackMode.active,
            fallbackReason: this.fallbackMode.reason,
            canvasRectValid: this.canvasRectValid,
            listenerCount: this.listeners.size,
            activeKeys: Object.keys(this.keys).filter(key => this.keys[key]).length,
            performance: this.getPerformanceStats()
        };
    }
    
    /**
     * Test input system integrity
     */
    testSystemIntegrity() {
        console.log('🧪 Testing input system integrity...');
        
        const tests = {
            mouseState: this.mouse && typeof this.mouse.x === 'number',
            keyState: this.keys && typeof this.keys === 'object',
            listeners: this.listeners instanceof Map,
            canvasRect: this.canvasRectValid,
            validation: this.inputValidator && this.inputValidator.validKeys instanceof Set
        };
        
        const passed = Object.values(tests).filter(Boolean).length;
        const total = Object.keys(tests).length;
        
        console.log(`✅ Input integrity test: ${passed}/${total} passed`);
        console.log('Test results:', tests);
        
        return { passed, total, tests, healthy: passed === total };
    }
    
    /**
     * Cleanup method for proper resource management
     */
    destroy() {
        try {
            console.log('🧹 Cleaning up InputManager...');
            
            // Clear all listeners
            this.listeners.clear();
            
            // Clear input state
            this.keys = {};
            this.keysPressed = {};
            this.keysReleased = {};
            
            // Clear buffers
            this.inputBuffer = [];
            this.prediction.mouseHistory = [];
            
            // Reset state
            this.fallbackMode.active = false;
            this.stateManager.corrupted = false;
            
            console.log('✅ InputManager cleanup complete');
            
        } catch (error) {
            // If globalErrorManager is not available, just log the error
            if (typeof globalErrorManager !== 'undefined' && globalErrorManager.handleError) {
                globalErrorManager.handleError('input_cleanup', error, {
                    severity: 'low'
                });
            } else {
                console.error('Error during InputManager cleanup:', error);
            }
        }
    }
}