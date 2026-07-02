/**
 * i18n 国际化模块
 *
 * 用法:
 *   import { t, setLocale, getLocale } from '../i18n/index.js';
 *   const text = t('some.key');
 *   const text = t('some.key', { var1: 'value' });  // 支持插值
 *
 * 默认语言: 英语 (en)
 * 支持语言: en, zh-CN
 */

import { zhCN } from './zh-CN.js';

const locales = { 'zh-CN': zhCN };

/** 当前语言 */
let currentLocale = 'en';

/** 语言变更回调列表 */
const localeChangeCallbacks = [];

/**
 * 注册语言变更回调
 * @param {function} callback - 语言变更时调用
 */
export function onLocaleChange(callback) {
    if (typeof callback === 'function' && !localeChangeCallbacks.includes(callback)) {
        localeChangeCallbacks.push(callback);
    }
}

/**
 * 获取翻译文本
 * @param {string} key - 翻译键，支持点号分隔的嵌套键
 * @param {object} [params] - 插值参数
 * @returns {string}
 */
export function t(key, params = {}) {
    if (currentLocale === 'en') {
        // 英语直接返回 key 本身（所有代码默认就是英语）
        return interpolate(key, params);
    }

    const locale = locales[currentLocale];
    if (!locale) return interpolate(key, params);

    const value = getNested(locale, key);
    if (value === undefined) {
        // 回退到英语（key 本身）
        return interpolate(key, params);
    }
    return interpolate(value, params);
}

/**
 * 设置当前语言
 * @param {string} locale - 'en' | 'zh-CN'
 */
export function setLocale(locale) {
    if (locale === 'en' || locales[locale]) {
        currentLocale = locale;
        try {
            localStorage.setItem('vs_locale', locale);
        } catch (e) { /* ignore */ }
        // 通知所有回调
        for (const cb of localeChangeCallbacks) {
            try { cb(locale); } catch (e) { /* ignore */ }
        }
    }
}

/**
 * 获取当前语言
 * @returns {string}
 */
export function getLocale() {
    return currentLocale;
}

/**
 * 初始化语言设置（从 localStorage 读取）
 */
export function initLocale() {
    try {
        const saved = localStorage.getItem('vs_locale');
        if (saved && (saved === 'en' || locales[saved])) {
            currentLocale = saved;
        }
    } catch (e) { /* ignore */ }
}

// ---- 内部辅助 ----

function getNested(obj, path) {
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

function interpolate(template, params) {
    if (typeof template !== 'string') return template;
    return template.replace(/\{(\w+)\}/g, (_, key) => {
        return params[key] !== undefined ? String(params[key]) : `{${key}}`;
    });
}