/**
 * KeyBindings - 按键绑定管理模块
 *
 * 管理所有游戏操作的按键映射，支持自定义绑定和持久化存储。
 */

const STORAGE_KEY = 'vampireSurvivors_keyBindings';

/** 默认按键绑定 */
const DEFAULT_BINDINGS = {
    moveUp:       ['w', 'arrowup'],
    moveDown:     ['s', 'arrowdown'],
    moveLeft:     ['a', 'arrowleft'],
    moveRight:    ['d', 'arrowright'],
    pause:        ['escape'],
    settings:     ['f1'],
    performance:  ['f2'],
    debug:        ['f4', 'g'],
    help:         ['h'],
    inventory:    ['tab'],
    levelUp1:     ['1'],
    levelUp2:     ['2'],
    levelUp3:     ['3'],
    levelUp4:     ['4'],
    levelUp5:     ['5'],
    restart:      ['r'],
    mainMenu:     ['m'],
};

/** 操作显示名称 */
export const ACTION_LABELS = {
    moveUp:       'Move Up',
    moveDown:     'Move Down',
    moveLeft:     'Move Left',
    moveRight:    'Move Right',
    pause:        'Pause',
    settings:     'Settings',
    performance:  'Performance',
    debug:        'Debug',
    help:         'Help',
    inventory:    'Inventory',
    levelUp1:     'Level Up #1',
    levelUp2:     'Level Up #2',
    levelUp3:     'Level Up #3',
    levelUp4:     'Level Up #4',
    levelUp5:     'Level Up #5',
    restart:      'Restart',
    mainMenu:     'Main Menu',
};

/** 当前绑定（运行时可变） */
let currentBindings = null;

function loadBindings() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // 合并：保留默认键确保所有操作都有绑定
            const merged = { ...DEFAULT_BINDINGS };
            for (const [action, keys] of Object.entries(parsed)) {
                if (merged[action] && Array.isArray(keys) && keys.length > 0) {
                    merged[action] = keys;
                }
            }
            return merged;
        }
    } catch (e) { /* ignore */ }
    return { ...DEFAULT_BINDINGS };
}

/**
 * 获取当前按键绑定
 */
export function getBindings() {
    if (!currentBindings) {
        currentBindings = loadBindings();
    }
    return currentBindings;
}

/**
 * 获取操作的默认绑定
 */
export function getDefaultBindings() {
    return { ...DEFAULT_BINDINGS };
}

/**
 * 获取某个操作绑定的按键列表
 * @param {string} action
 * @returns {string[]}
 */
export function getKeys(action) {
    const bindings = getBindings();
    return bindings[action] || DEFAULT_BINDINGS[action] || [];
}

/**
 * 设置某个操作的绑定按键
 * @param {string} action - 操作名
 * @param {string[]} keys - 按键列表
 */
export function setBinding(action, keys) {
    const bindings = getBindings();
    if (bindings[action] !== undefined && Array.isArray(keys) && keys.length > 0) {
        bindings[action] = keys;
        saveBindings(bindings);
    }
}

/**
 * 重置所有绑定为默认值
 */
export function resetAllBindings() {
    currentBindings = { ...DEFAULT_BINDINGS };
    saveBindings(currentBindings);
}

function saveBindings(bindings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
    } catch (e) { /* ignore */ }
}

/**
 * 检查某个按键是否匹配某个操作
 * @param {string} action - 操作名
 * @param {string} key - 按键（小写）
 * @returns {boolean}
 */
export function isActionKey(action, key) {
    const keys = getKeys(action);
    return keys.includes(key.toLowerCase());
}

/**
 * 格式化按键名称用于显示
 * @param {string} key
 * @returns {string}
 */
export function formatKeyName(key) {
    const map = {
        arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→',
        escape: 'Esc', ' ': 'Space', tab: 'Tab',
        enter: 'Enter', backspace: '⌫',
        shift: 'Shift', control: 'Ctrl', alt: 'Alt',
    };
    if (map[key]) return map[key];
    if (key.length === 1) return key.toUpperCase();
    return key.charAt(0).toUpperCase() + key.slice(1);
}