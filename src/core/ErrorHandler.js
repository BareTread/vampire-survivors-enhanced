/**
 * Error Handling and Logging System
 * 
 * Comprehensive error handling with graceful degradation,
 * performance monitoring, and developer-friendly debugging tools.
 * Designed for production-ready browser games.
 * 
 * @author Game Architecture Specialist
 * @version 1.0.0
 */

/**
 * Log levels in order of severity
 */
export const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    FATAL: 4
};

/**
 * Error categories for better organization
 */
export const ErrorCategory = {
    SYSTEM: 'System',
    RENDERING: 'Rendering',
    AUDIO: 'Audio',
    INPUT: 'Input',
    NETWORK: 'Network',
    PERFORMANCE: 'Performance',
    MEMORY: 'Memory',
    CONFIGURATION: 'Configuration',
    GAMEPLAY: 'Gameplay'
};

/**
 * Game-specific error types
 */
export class GameError extends Error {
    constructor(message, category = ErrorCategory.SYSTEM, severity = LogLevel.ERROR) {
        super(message);
        this.name = 'GameError';
        this.category = category;
        this.severity = severity;
        this.timestamp = Date.now();
        this.stack = this.stack || new Error().stack;
    }
}

export class RenderingError extends GameError {
    constructor(message, context = null) {
        super(message, ErrorCategory.RENDERING, LogLevel.ERROR);
        this.name = 'RenderingError';
        this.context = context;
    }
}

export class PerformanceError extends GameError {
    constructor(message, metrics = null) {
        super(message, ErrorCategory.PERFORMANCE, LogLevel.WARN);
        this.name = 'PerformanceError';
        this.metrics = metrics;
    }
}

export class ConfigurationError extends GameError {
    constructor(message, configPath = null) {
        super(message, ErrorCategory.CONFIGURATION, LogLevel.ERROR);
        this.name = 'ConfigurationError';
        this.configPath = configPath;
    }
}

/**
 * Logger class with multiple output targets and filtering
 */
class Logger {
    constructor() {
        this.level = LogLevel.INFO;
        this.outputs = [];
        this.filters = [];
        this.buffer = [];
        this.maxBufferSize = 1000;
        
        // Add default console output
        this.addOutput(new ConsoleLogOutput());
        
        // Performance tracking
        this.performanceMarks = new Map();
        this.performanceData = [];
    }

    /**
     * Set minimum log level
     * @param {number} level - Log level
     */
    setLevel(level) {
        this.level = level;
    }

    /**
     * Add a log output target
     * @param {LogOutput} output - Log output implementation
     */
    addOutput(output) {
        this.outputs.push(output);
    }

    /**
     * Add a log filter
     * @param {function} filter - Filter function
     */
    addFilter(filter) {
        this.filters.push(filter);
    }

    /**
     * Log a message
     * @param {number} level - Log level
     * @param {string} message - Log message
     * @param {object} metadata - Additional metadata
     */
    log(level, message, metadata = {}) {
        if (level < this.level) return;

        const logEntry = {
            level,
            message,
            metadata,
            timestamp: Date.now(),
            stack: level >= LogLevel.ERROR ? new Error().stack : null
        };

        // Apply filters
        for (const filter of this.filters) {
            if (!filter(logEntry)) return;
        }

        // Add to buffer
        this.buffer.push(logEntry);
        if (this.buffer.length > this.maxBufferSize) {
            this.buffer.shift();
        }

        // Send to outputs
        for (const output of this.outputs) {
            try {
                output.write(logEntry);
            } catch (error) {
                // Fallback to console if output fails
                console.error('Log output failed:', error);
                console.log(logEntry);
            }
        }
    }

    /**
     * Debug level logging
     * @param {string} message - Message
     * @param {object} metadata - Metadata
     */
    debug(message, metadata = {}) {
        this.log(LogLevel.DEBUG, message, metadata);
    }

    /**
     * Info level logging
     * @param {string} message - Message
     * @param {object} metadata - Metadata
     */
    info(message, metadata = {}) {
        this.log(LogLevel.INFO, message, metadata);
    }

    /**
     * Warning level logging
     * @param {string} message - Message
     * @param {object} metadata - Metadata
     */
    warn(message, metadata = {}) {
        this.log(LogLevel.WARN, message, metadata);
    }

    /**
     * Error level logging
     * @param {string} message - Message
     * @param {object} metadata - Metadata
     */
    error(message, metadata = {}) {
        this.log(LogLevel.ERROR, message, metadata);
    }

    /**
     * Fatal level logging
     * @param {string} message - Message
     * @param {object} metadata - Metadata
     */
    fatal(message, metadata = {}) {
        this.log(LogLevel.FATAL, message, metadata);
    }

    /**
     * Start a performance measurement
     * @param {string} name - Measurement name
     */
    startPerformanceMark(name) {
        this.performanceMarks.set(name, performance.now());
    }

    /**
     * End a performance measurement
     * @param {string} name - Measurement name
     * @returns {number} Duration in milliseconds
     */
    endPerformanceMark(name) {
        const startTime = this.performanceMarks.get(name);
        if (!startTime) {
            this.warn(`Performance mark '${name}' not found`);
            return 0;
        }

        const duration = performance.now() - startTime;
        this.performanceMarks.delete(name);

        // Store performance data
        this.performanceData.push({
            name,
            duration,
            timestamp: Date.now()
        });

        // Trim performance data
        if (this.performanceData.length > 1000) {
            this.performanceData = this.performanceData.slice(-500);
        }

        this.debug(`Performance: ${name} took ${duration.toFixed(2)}ms`);
        return duration;
    }

    /**
     * Get performance statistics
     * @returns {object} Performance stats
     */
    getPerformanceStats() {
        const stats = {};
        
        for (const entry of this.performanceData) {
            if (!stats[entry.name]) {
                stats[entry.name] = {
                    count: 0,
                    total: 0,
                    min: Infinity,
                    max: -Infinity,
                    avg: 0
                };
            }
            
            const stat = stats[entry.name];
            stat.count++;
            stat.total += entry.duration;
            stat.min = Math.min(stat.min, entry.duration);
            stat.max = Math.max(stat.max, entry.duration);
            stat.avg = stat.total / stat.count;
        }
        
        return stats;
    }

    /**
     * Get recent log entries
     * @param {number} count - Number of entries to return
     * @returns {Array} Recent log entries
     */
    getRecentLogs(count = 50) {
        return this.buffer.slice(-count);
    }

    /**
     * Clear log buffer
     */
    clearBuffer() {
        this.buffer.length = 0;
    }
}

/**
 * Base class for log output targets
 */
class LogOutput {
    constructor() {
        this.formatter = new DefaultLogFormatter();
    }

    /**
     * Write a log entry
     * @param {object} entry - Log entry
     */
    write(entry) {
        throw new Error('LogOutput.write() must be implemented');
    }

    /**
     * Set the log formatter
     * @param {LogFormatter} formatter - Log formatter
     */
    setFormatter(formatter) {
        this.formatter = formatter;
    }
}

/**
 * Console log output
 */
class ConsoleLogOutput extends LogOutput {
    write(entry) {
        const formatted = this.formatter.format(entry);
        
        switch (entry.level) {
            case LogLevel.DEBUG:
                console.debug(formatted);
                break;
            case LogLevel.INFO:
                console.info(formatted);
                break;
            case LogLevel.WARN:
                console.warn(formatted);
                break;
            case LogLevel.ERROR:
            case LogLevel.FATAL:
                console.error(formatted);
                if (entry.stack) {
                    console.error(entry.stack);
                }
                break;
        }
    }
}

/**
 * HTML log output for in-game debug console
 */
class HTMLLogOutput extends LogOutput {
    constructor(containerId) {
        super();
        this.containerId = containerId;
        this.maxEntries = 100;
    }

    write(entry) {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const formatted = this.formatter.format(entry);
        const logElement = document.createElement('div');
        logElement.className = `log-entry log-${this.getLevelName(entry.level).toLowerCase()}`;
        logElement.textContent = formatted;
        logElement.title = new Date(entry.timestamp).toLocaleString();

        container.appendChild(logElement);

        // Limit number of entries
        while (container.children.length > this.maxEntries) {
            container.removeChild(container.firstChild);
        }

        // Auto-scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    getLevelName(level) {
        const names = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
        return names[level] || 'UNKNOWN';
    }
}

/**
 * Remote log output for analytics
 */
class RemoteLogOutput extends LogOutput {
    constructor(endpoint, apiKey = null) {
        super();
        this.endpoint = endpoint;
        this.apiKey = apiKey;
        this.buffer = [];
        this.batchSize = 10;
        this.flushInterval = 5000; // 5 seconds
        
        // Auto-flush timer
        setInterval(() => this.flush(), this.flushInterval);
    }

    write(entry) {
        // Only send warnings and errors to remote
        if (entry.level >= LogLevel.WARN) {
            this.buffer.push(entry);
            
            if (this.buffer.length >= this.batchSize) {
                this.flush();
            }
        }
    }

    async flush() {
        if (this.buffer.length === 0) return;

        const batch = [...this.buffer];
        this.buffer.length = 0;

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
                },
                body: JSON.stringify({
                    logs: batch,
                    userAgent: navigator.userAgent,
                    url: window.location.href,
                    timestamp: Date.now()
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            // Re-add failed entries to front of buffer
            this.buffer.unshift(...batch);
            console.warn('Failed to send logs to remote endpoint:', error);
        }
    }
}

/**
 * Default log formatter
 */
class DefaultLogFormatter {
    format(entry) {
        const timestamp = new Date(entry.timestamp).toLocaleTimeString();
        const level = this.getLevelName(entry.level);
        const metadata = Object.keys(entry.metadata).length > 0 
            ? ' ' + JSON.stringify(entry.metadata)
            : '';
        
        return `[${timestamp}] ${level}: ${entry.message}${metadata}`;
    }

    getLevelName(level) {
        const names = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
        return names[level] || 'UNKNOWN';
    }
}

/**
 * Error Handler class for graceful error recovery
 */
export class ErrorHandler {
    constructor() {
        this.logger = new Logger();
        this.errorHandlers = new Map();
        this.recoveryStrategies = new Map();
        this.errorCount = 0;
        this.criticalErrorThreshold = 10;
        
        // Set up global error handling
        this.setupGlobalErrorHandling();
        
        // Register default recovery strategies
        this.registerDefaultRecoveryStrategies();
    }

    /**
     * Set up global error handling
     */
    setupGlobalErrorHandling() {
        // Catch unhandled JavaScript errors
        window.addEventListener('error', (event) => {
            this.handleError(new GameError(
                `Unhandled error: ${event.message}`,
                ErrorCategory.SYSTEM,
                LogLevel.ERROR
            ), {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
        });

        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(new GameError(
                `Unhandled promise rejection: ${event.reason}`,
                ErrorCategory.SYSTEM,
                LogLevel.ERROR
            ), {
                reason: event.reason,
                stack: event.reason?.stack
            });
        });

        // Catch WebGL context loss
        window.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            this.handleError(new RenderingError(
                'WebGL context lost',
                { event: event.type }
            ));
        });

        // Monitor memory usage (if available)
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                const usage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
                
                if (usage > 0.9) {
                    this.handleError(new GameError(
                        `High memory usage: ${(usage * 100).toFixed(1)}%`,
                        ErrorCategory.MEMORY,
                        LogLevel.WARN
                    ), { memory });
                }
            }, 10000); // Check every 10 seconds
        }
    }

    /**
     * Register default recovery strategies
     */
    registerDefaultRecoveryStrategies() {
        // Rendering error recovery
        this.registerRecoveryStrategy(ErrorCategory.RENDERING, (error, context) => {
            this.logger.warn('Attempting rendering recovery', { error: error.message });
            
            // Try to reset canvas context
            if (context && context.canvas) {
                const canvas = context.canvas;
                const parent = canvas.parentNode;
                const newCanvas = canvas.cloneNode();
                parent.replaceChild(newCanvas, canvas);
                return { recoveryAction: 'canvas_reset', newCanvas };
            }
            
            return { recoveryAction: 'none' };
        });

        // Performance error recovery
        this.registerRecoveryStrategy(ErrorCategory.PERFORMANCE, (error, context) => {
            this.logger.warn('Attempting performance recovery', { error: error.message });
            
            // Reduce quality settings
            return {
                recoveryAction: 'reduce_quality',
                suggestions: [
                    'Reduce particle count',
                    'Lower rendering quality',
                    'Disable non-essential effects'
                ]
            };
        });

        // Memory error recovery
        this.registerRecoveryStrategy(ErrorCategory.MEMORY, (error, context) => {
            this.logger.warn('Attempting memory recovery', { error: error.message });
            
            // Force garbage collection if available
            if (window.gc) {
                window.gc();
            }
            
            return {
                recoveryAction: 'memory_cleanup',
                suggestions: [
                    'Clear object pools',
                    'Reduce cache sizes',
                    'Cleanup unused resources'
                ]
            };
        });
    }

    /**
     * Handle an error with recovery attempts
     * @param {Error} error - Error to handle
     * @param {object} context - Additional context
     * @returns {object} Recovery result
     */
    handleError(error, context = {}) {
        this.errorCount++;
        
        // Log the error
        this.logger.error(error.message, {
            category: error.category || ErrorCategory.SYSTEM,
            severity: error.severity || LogLevel.ERROR,
            stack: error.stack,
            context
        });

        // Check for critical error threshold
        if (this.errorCount >= this.criticalErrorThreshold) {
            this.handleCriticalErrorState();
            return { recovered: false, critical: true };
        }

        // Try to recover from the error
        const recoveryResult = this.attemptRecovery(error, context);
        
        // Notify error handlers
        this.notifyErrorHandlers(error, context, recoveryResult);
        
        return recoveryResult;
    }

    /**
     * Attempt to recover from an error
     * @param {Error} error - Error to recover from
     * @param {object} context - Error context
     * @returns {object} Recovery result
     */
    attemptRecovery(error, context) {
        const category = error.category || ErrorCategory.SYSTEM;
        const strategy = this.recoveryStrategies.get(category);
        
        if (!strategy) {
            this.logger.warn(`No recovery strategy for category: ${category}`);
            return { recovered: false, reason: 'no_strategy' };
        }

        try {
            const result = strategy(error, context);
            this.logger.info(`Recovery attempted for ${category}`, result);
            return { recovered: true, ...result };
        } catch (recoveryError) {
            this.logger.error(`Recovery failed for ${category}`, {
                originalError: error.message,
                recoveryError: recoveryError.message
            });
            return { recovered: false, reason: 'recovery_failed', recoveryError };
        }
    }

    /**
     * Handle critical error state
     */
    handleCriticalErrorState() {
        this.logger.fatal('Critical error threshold reached - entering safe mode');
        
        // Emit critical error event
        window.dispatchEvent(new CustomEvent('criticalError', {
            detail: {
                errorCount: this.errorCount,
                recentErrors: this.logger.getRecentLogs(10)
            }
        }));
        
        // Could trigger safe mode, game pause, or emergency save
    }

    /**
     * Register an error handler
     * @param {string} category - Error category
     * @param {function} handler - Error handler function
     */
    registerErrorHandler(category, handler) {
        if (!this.errorHandlers.has(category)) {
            this.errorHandlers.set(category, []);
        }
        this.errorHandlers.get(category).push(handler);
    }

    /**
     * Register a recovery strategy
     * @param {string} category - Error category
     * @param {function} strategy - Recovery strategy function
     */
    registerRecoveryStrategy(category, strategy) {
        this.recoveryStrategies.set(category, strategy);
    }

    /**
     * Notify registered error handlers
     * @param {Error} error - Error that occurred
     * @param {object} context - Error context
     * @param {object} recoveryResult - Recovery result
     */
    notifyErrorHandlers(error, context, recoveryResult) {
        const category = error.category || ErrorCategory.SYSTEM;
        const handlers = this.errorHandlers.get(category) || [];
        
        for (const handler of handlers) {
            try {
                handler(error, context, recoveryResult);
            } catch (handlerError) {
                this.logger.error('Error handler failed', {
                    category,
                    handlerError: handlerError.message
                });
            }
        }
    }

    /**
     * Create a safe function wrapper that handles errors
     * @param {function} fn - Function to wrap
     * @param {string} category - Error category
     * @param {*} fallbackReturn - Fallback return value
     * @returns {function} Wrapped function
     */
    safeWrapper(fn, category = ErrorCategory.SYSTEM, fallbackReturn = null) {
        return (...args) => {
            try {
                return fn(...args);
            } catch (error) {
                this.handleError(new GameError(
                    `Safe wrapper caught error: ${error.message}`,
                    category,
                    LogLevel.ERROR
                ), {
                    originalStack: error.stack,
                    functionName: fn.name,
                    arguments: args
                });
                return fallbackReturn;
            }
        };
    }

    /**
     * Create a safe async function wrapper
     * @param {function} fn - Async function to wrap
     * @param {string} category - Error category
     * @param {*} fallbackReturn - Fallback return value
     * @returns {function} Wrapped async function
     */
    safeAsyncWrapper(fn, category = ErrorCategory.SYSTEM, fallbackReturn = null) {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                this.handleError(new GameError(
                    `Safe async wrapper caught error: ${error.message}`,
                    category,
                    LogLevel.ERROR
                ), {
                    originalStack: error.stack,
                    functionName: fn.name,
                    arguments: args
                });
                return fallbackReturn;
            }
        };
    }

    /**
     * Get error statistics
     * @returns {object} Error statistics
     */
    getErrorStats() {
        return {
            totalErrors: this.errorCount,
            criticalThreshold: this.criticalErrorThreshold,
            recentErrors: this.logger.getRecentLogs(20),
            performanceStats: this.logger.getPerformanceStats()
        };
    }

    /**
     * Reset error count (use carefully)
     */
    resetErrorCount() {
        this.errorCount = 0;
        this.logger.info('Error count reset');
    }

    /**
     * Get the logger instance
     * @returns {Logger} Logger instance
     */
    getLogger() {
        return this.logger;
    }
}

/**
 * Global error handler instance
 */
export const GlobalErrorHandler = new ErrorHandler();

/**
 * Default Logger instance for convenience
 */
export const LoggerInstance = new Logger();

/**
 * Utility decorators for error handling
 */
export const ErrorHandling = {
    /**
     * Method decorator for safe execution
     * @param {string} category - Error category
     * @param {*} fallbackReturn - Fallback return value
     */
    safe: (category = ErrorCategory.SYSTEM, fallbackReturn = null) => {
        return (target, propertyName, descriptor) => {
            const method = descriptor.value;
            descriptor.value = GlobalErrorHandler.safeWrapper(method, category, fallbackReturn);
            return descriptor;
        };
    },

    /**
     * Method decorator for safe async execution
     * @param {string} category - Error category
     * @param {*} fallbackReturn - Fallback return value
     */
    safeAsync: (category = ErrorCategory.SYSTEM, fallbackReturn = null) => {
        return (target, propertyName, descriptor) => {
            const method = descriptor.value;
            descriptor.value = GlobalErrorHandler.safeAsyncWrapper(method, category, fallbackReturn);
            return descriptor;
        };
    },

    /**
     * Method decorator for performance monitoring
     * @param {string} name - Performance measurement name
     */
    timed: (name) => {
        return (target, propertyName, descriptor) => {
            const method = descriptor.value;
            descriptor.value = function(...args) {
                const markName = name || `${target.constructor.name}.${propertyName}`;
                LoggerInstance.startPerformanceMark(markName);
                
                try {
                    const result = method.apply(this, args);
                    
                    // Handle async methods
                    if (result && typeof result.then === 'function') {
                        return result.finally(() => {
                            LoggerInstance.endPerformanceMark(markName);
                        });
                    }
                    
                    LoggerInstance.endPerformanceMark(markName);
                    return result;
                } catch (error) {
                    LoggerInstance.endPerformanceMark(markName);
                    throw error;
                }
            };
            return descriptor;
        };
    }
};