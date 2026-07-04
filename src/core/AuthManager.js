/**
 * AuthManager - Handles user authentication using localStorage as database.
 * Stores username/password pairs and manages login state.
 */
const DB_KEY = 'vampire_survivors_users';
const SESSION_KEY = 'vampire_survivors_session';
const TEMP_SAVE_KEY = 'vampire-survivors-enhanced-save';
const TEMP_LEADERBOARD_KEY = 'vampire-survivors-leaderboard';
const ACHIEVEMENT_KEY = 'vs_achievements';

function getUsers() {
    try {
        const raw = localStorage.getItem(DB_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveUsers(users) {
    localStorage.setItem(DB_KEY, JSON.stringify(users));
}

function hashPassword(password) {
    // Simple hash for demo purposes (not cryptographically secure)
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
}

function getUserKey(username, baseKey) {
    return `${baseKey}_${username}`;
}

export class AuthManager {
    /**
     * Register a new user.
     * @returns {{ success: boolean, message: string }}
     */
    static register(username, password) {
        const name = username.trim();
        if (!name) return { success: false, message: '用户名不能为空' };
        if (name.length < 2) return { success: false, message: '用户名至少需要2个字符' };
        if (!password) return { success: false, message: '密码不能为空' };
        if (password.length < 4) return { success: false, message: '密码至少需要4个字符' };

        const users = getUsers();
        if (users[name]) return { success: false, message: '用户名已存在' };

        users[name] = { password: hashPassword(password), createdAt: Date.now() };
        saveUsers(users);
        return { success: true, message: '注册成功' };
    }

    /**
     * Login with username and password.
     * Syncs user data on login.
     * @returns {{ success: boolean, message: string }}
     */
    static login(username, password) {
        const name = username.trim();
        if (!name || !password) return { success: false, message: '请输入用户名和密码' };

        const users = getUsers();
        const user = users[name];
        if (!user) return { success: false, message: '用户不存在' };
        if (user.password !== hashPassword(password)) return { success: false, message: '密码错误' };

        // Save current temp data (if any from previous session) before switching
        AuthManager._saveCurrentToUser(AuthManager.getCurrentUser());

        // Set session
        localStorage.setItem(SESSION_KEY, name);

        // Load user-specific data
        AuthManager._loadUserData(name);

        return { success: true, message: '登录成功' };
    }

    /**
     * Logout current user.
     * Saves current data to user's account before logging out.
     */
    static logout() {
        const currentUser = AuthManager.getCurrentUser();

        // Save current data to user's account
        AuthManager._saveCurrentToUser(currentUser);

        // Clear session
        localStorage.removeItem(SESSION_KEY);

        // Reset temp keys to defaults (clear current data from memory)
        localStorage.removeItem(TEMP_SAVE_KEY);
        localStorage.removeItem(TEMP_LEADERBOARD_KEY);
        localStorage.removeItem(ACHIEVEMENT_KEY);
    }

    /**
     * Check if a user is currently logged in.
     * @returns {string|null} The logged-in username, or null.
     */
    static getCurrentUser() {
        return localStorage.getItem(SESSION_KEY);
    }

    /**
     * Check if logged in (convenience).
     */
    static isLoggedIn() {
        return !!AuthManager.getCurrentUser();
    }

    /**
     * Save current localStorage data to a specific user's account.
     * @param {string|null} username
     */
    static _saveCurrentToUser(username) {
        if (!username) return;

        // Save game save data
        const saveData = localStorage.getItem(TEMP_SAVE_KEY);
        if (saveData) {
            localStorage.setItem(getUserKey(username, TEMP_SAVE_KEY), saveData);
        }

        // Save leaderboard data
        const leaderboardData = localStorage.getItem(TEMP_LEADERBOARD_KEY);
        if (leaderboardData) {
            localStorage.setItem(getUserKey(username, TEMP_LEADERBOARD_KEY), leaderboardData);
        }

        // Save achievement data
        const achievementData = localStorage.getItem(ACHIEVEMENT_KEY);
        if (achievementData) {
            localStorage.setItem(getUserKey(username, ACHIEVEMENT_KEY), achievementData);
        }
    }

    /**
     * Load user-specific data from their account into active localStorage keys.
     * @param {string} username
     */
    static _loadUserData(username) {
        // Load game save data
        const userSaveData = localStorage.getItem(getUserKey(username, TEMP_SAVE_KEY));
        if (userSaveData) {
            localStorage.setItem(TEMP_SAVE_KEY, userSaveData);
        } else {
            localStorage.removeItem(TEMP_SAVE_KEY);
        }

        // Load leaderboard data
        const userLeaderboardData = localStorage.getItem(getUserKey(username, TEMP_LEADERBOARD_KEY));
        if (userLeaderboardData) {
            localStorage.setItem(TEMP_LEADERBOARD_KEY, userLeaderboardData);
        } else {
            localStorage.removeItem(TEMP_LEADERBOARD_KEY);
        }

        // Load achievement data
        const userAchievementData = localStorage.getItem(getUserKey(username, ACHIEVEMENT_KEY));
        if (userAchievementData) {
            localStorage.setItem(ACHIEVEMENT_KEY, userAchievementData);
        } else {
            localStorage.removeItem(ACHIEVEMENT_KEY);
        }
    }

    /**
     * Sync current data to the logged-in user's account.
     * Call this to manually save progress to the user's account.
     */
    static syncData() {
        const currentUser = AuthManager.getCurrentUser();
        if (currentUser) {
            AuthManager._saveCurrentToUser(currentUser);
        }
    }
}
