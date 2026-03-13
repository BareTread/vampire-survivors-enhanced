/**
 * FlowStateSystem — Adaptive Difficulty via Player Performance Tracking
 * 
 * PURPOSE:
 * This system monitors player performance in real-time and outputs a "stress level"
 * (0-1) that other systems read to adjust difficulty dynamically. When a player is
 * dominating, enemies deal more damage and spawn faster. When struggling, difficulty
 * softens to keep them in flow state.
 * 
 * HOW IT ACTIVATES:
 * 8+ callsites throughout the codebase already reference `game.systems.flowState`
 * with null guards. Creating this file and wiring it in activates them all:
 * 
 *   - EnemySystem.js (L225-226): reads playerPerformance.stressLevel for spawn scaling
 *   - BaseWeapon.js (L818-819): calls onSkillfulAction() on precision shots
 *   - Wraith.js (L61-62): reads adaptiveDamageMultiplier for damage scaling
 *   - Demon.js (L78-79): reads adaptiveDamageMultiplier for damage scaling
 *   - Enemy.js (L154-155): reads adaptiveDamageMultiplier for base damage scaling
 *   - Enemy.js (L616-617): calls onEnemyKilled() on death
 *   - Player.js (L852-853): calls onComboAchieved() on combo milestones
 *   - Player.js (L1307-1308): calls onDamageTaken() when hit
 * 
 * DESIGN:
 * Uses a rolling 10-second window to track DPS, damage-taken rate, combo frequency,
 * and kill rate. These metrics are combined into a single stressLevel (0 = bored,
 * 1 = overwhelmed). The adaptiveDamageMultiplier ranges from 0.7 (struggling) to
 * 1.3 (dominating), providing gentle difficulty adjustment.
 * 
 * NEXT AGENT NOTES:
 * - Stress level is intentionally conservative (slow to change) to avoid whiplash
 * - The system is designed to be tuned: weights and decay rates are easily adjustable
 * - FlowState feeds into BESTIARY constellation (enemy spawning) and WORLD events
 */

export class FlowStateSystem {
    constructor(game) {
        this.game = game;
        
        // === PUBLIC API (read by other systems) ===
        this.playerPerformance = {
            stressLevel: 0.5,       // 0 = bored/struggling, 1 = overwhelmed/dominating
            killRate: 0,            // kills per second (rolling average)
            dpsEstimate: 0,         // estimated damage per second
            damageTakenRate: 0,     // damage taken per second
            comboFrequency: 0,      // combos per minute
            skillRating: 0          // 0-1, how skillfully the player is playing
        };
        
        // Adaptive damage multiplier read by enemies
        // < 1.0 = player struggling (enemies deal less damage)
        // > 1.0 = player dominating (enemies deal more damage)
        this.adaptiveDamageMultiplier = 1.0;
        
        // === INTERNAL TRACKING ===
        
        // Rolling window accumulators (reset every windowDuration)
        this.windowDuration = 10.0; // seconds
        this.windowTimer = 0;
        
        // Current window accumulators
        this.windowKills = 0;
        this.windowDamageDealt = 0;
        this.windowDamageTaken = 0;
        this.windowCombos = 0;
        this.windowSkillfulActions = 0;
        this.windowSkillBonus = 0;
        
        // Smoothed metrics (exponential moving average)
        this.smoothedKillRate = 0;
        this.smoothedDPS = 0;
        this.smoothedDamageTakenRate = 0;
        this.smoothedComboRate = 0;
        this.smoothedSkillRating = 0;
        
        // Smoothing factor: higher = more responsive, lower = more stable
        this.smoothingAlpha = 0.3;
        
        // Stress level target (smoothed separately for gentle transitions)
        this.targetStressLevel = 0.5;
        this.stressSmoothing = 0.1; // Very slow transitions to avoid whiplash
        
        // Damage multiplier config
        this.minDamageMultiplier = 0.7;   // Floor when player is struggling
        this.maxDamageMultiplier = 1.3;   // Ceiling when player is dominating
        this.damageMultiplierSmoothing = 0.05; // Even slower than stress
        this.targetDamageMultiplier = 1.0;
        
        // Performance thresholds (tunable)
        this.thresholds = {
            // Kill rate thresholds (kills/sec)
            lowKillRate: 0.5,
            highKillRate: 3.0,
            
            // Damage taken thresholds (damage/sec)
            lowDamageTaken: 2,
            highDamageTaken: 15,
            
            // Combo thresholds (combos/min)
            lowComboRate: 0.5,
            highComboRate: 4.0
        };
        
        // Total session stats (for debug/telemetry)
        this.totalKills = 0;
        this.totalDamageDealt = 0;
        this.totalDamageTaken = 0;
        this.totalCombos = 0;
    }
    
    // === EVENT HANDLERS (called by existing callsites) ===
    
    /**
     * Called when an enemy is killed (Enemy.js L617)
     * @param {Enemy} enemy - The killed enemy
     */
    onEnemyKilled(enemy) {
        if (!enemy) return;
        this.windowKills++;
        this.totalKills++;
        
        // Estimate damage dealt based on enemy max health
        const estimatedDamage = enemy.maxHealth || enemy.health || 50;
        this.windowDamageDealt += estimatedDamage;
        this.totalDamageDealt += estimatedDamage;
    }
    
    /**
     * Called when the player takes damage (Player.js L1308)
     * @param {number} damage - Amount of damage taken
     */
    onDamageTaken(damage) {
        this.windowDamageTaken += damage;
        this.totalDamageTaken += damage;
    }
    
    /**
     * Called when a combo milestone is achieved (Player.js L853)
     * @param {number} count - Current combo count
     */
    onComboAchieved(count) {
        this.windowCombos++;
        this.totalCombos++;
        
        // Higher combos indicate more skillful play
        if (count >= 20) {
            this.windowSkillBonus += 0.3;
        } else if (count >= 10) {
            this.windowSkillBonus += 0.2;
        } else if (count >= 5) {
            this.windowSkillBonus += 0.1;
        }
    }
    
    /**
     * Called on precision shots and other skillful actions (BaseWeapon.js L819)
     * @param {string} type - Type of skillful action
     * @param {number} bonus - Accuracy/skill bonus value
     */
    onSkillfulAction(type, bonus) {
        this.windowSkillfulActions++;
        this.windowSkillBonus += Math.min(0.5, bonus * 0.1);
    }
    
    // === PER-FRAME UPDATE ===
    
    /**
     * Update metrics and recalculate stress level.
     * Called every frame from the game loop.
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        this.windowTimer += dt;
        
        // Process rolling window
        if (this.windowTimer >= this.windowDuration) {
            this.processWindow();
            this.windowTimer = 0;
        }
        
        // Smoothly interpolate stress level toward target
        const stressDelta = this.targetStressLevel - this.playerPerformance.stressLevel;
        this.playerPerformance.stressLevel += stressDelta * this.stressSmoothing;
        this.playerPerformance.stressLevel = Math.max(0, Math.min(1, this.playerPerformance.stressLevel));
        
        // Smoothly interpolate damage multiplier
        const dmgDelta = this.targetDamageMultiplier - this.adaptiveDamageMultiplier;
        this.adaptiveDamageMultiplier += dmgDelta * this.damageMultiplierSmoothing;
        this.adaptiveDamageMultiplier = Math.max(
            this.minDamageMultiplier,
            Math.min(this.maxDamageMultiplier, this.adaptiveDamageMultiplier)
        );
        
        // Update public metrics
        this.playerPerformance.killRate = this.smoothedKillRate;
        this.playerPerformance.dpsEstimate = this.smoothedDPS;
        this.playerPerformance.damageTakenRate = this.smoothedDamageTakenRate;
        this.playerPerformance.comboFrequency = this.smoothedComboRate;
        this.playerPerformance.skillRating = this.smoothedSkillRating;
    }
    
    /**
     * Process the accumulated window data and update smoothed metrics.
     * Called every windowDuration seconds.
     */
    processWindow() {
        const duration = this.windowDuration;
        
        // Calculate per-second/per-minute rates from the window
        const killRate = this.windowKills / duration;
        const dps = this.windowDamageDealt / duration;
        const damageTakenRate = this.windowDamageTaken / duration;
        const comboRate = (this.windowCombos / duration) * 60; // combos per minute
        const skillRating = Math.min(1, this.windowSkillBonus);
        
        // Apply exponential moving average
        this.smoothedKillRate = this.ema(this.smoothedKillRate, killRate);
        this.smoothedDPS = this.ema(this.smoothedDPS, dps);
        this.smoothedDamageTakenRate = this.ema(this.smoothedDamageTakenRate, damageTakenRate);
        this.smoothedComboRate = this.ema(this.smoothedComboRate, comboRate);
        this.smoothedSkillRating = this.ema(this.smoothedSkillRating, skillRating);
        
        // Calculate stress components (each 0-1)
        const killStress = this.normalize(
            this.smoothedKillRate,
            this.thresholds.lowKillRate,
            this.thresholds.highKillRate
        );
        
        const damageStress = this.normalize(
            this.smoothedDamageTakenRate,
            this.thresholds.lowDamageTaken,
            this.thresholds.highDamageTaken
        );
        
        const comboStress = this.normalize(
            this.smoothedComboRate,
            this.thresholds.lowComboRate,
            this.thresholds.highComboRate
        );
        
        // Weighted stress calculation:
        // High kill rate = player dominating (high stress / easy)
        // High damage taken = player struggling (high stress / hard)
        // The trick: kill-driven stress and damage-taken stress push in OPPOSITE directions
        // for the damage multiplier
        const dominanceScore = killStress * 0.4 + comboStress * 0.2 + this.smoothedSkillRating * 0.1;
        const struggleScore = damageStress * 0.3;
        
        // Overall stress is a blend: high when lots is happening either way
        this.targetStressLevel = Math.max(0, Math.min(1,
            dominanceScore * 0.6 + struggleScore * 0.4
        ));
        
        // Damage multiplier: dominated by net performance
        // Dominating → higher multiplier (enemies hit harder to compensate)
        // Struggling → lower multiplier (enemies ease up)
        const netPerformance = dominanceScore - struggleScore;
        this.targetDamageMultiplier = 1.0 + netPerformance * 0.3;
        
        // Reset window accumulators
        this.windowKills = 0;
        this.windowDamageDealt = 0;
        this.windowDamageTaken = 0;
        this.windowCombos = 0;
        this.windowSkillfulActions = 0;
        this.windowSkillBonus = 0;
    }
    
    /**
     * Exponential moving average
     */
    ema(current, newValue) {
        return current + this.smoothingAlpha * (newValue - current);
    }
    
    /**
     * Normalize a value to 0-1 range between low and high thresholds
     */
    normalize(value, low, high) {
        if (high <= low) return 0.5;
        return Math.max(0, Math.min(1, (value - low) / (high - low)));
    }
    
    /**
     * Reset the system (called on game start/restart)
     */
    reset() {
        this.playerPerformance.stressLevel = 0.5;
        this.playerPerformance.killRate = 0;
        this.playerPerformance.dpsEstimate = 0;
        this.playerPerformance.damageTakenRate = 0;
        this.playerPerformance.comboFrequency = 0;
        this.playerPerformance.skillRating = 0;
        
        this.adaptiveDamageMultiplier = 1.0;
        this.targetDamageMultiplier = 1.0;
        this.targetStressLevel = 0.5;
        
        this.windowTimer = 0;
        this.windowKills = 0;
        this.windowDamageDealt = 0;
        this.windowDamageTaken = 0;
        this.windowCombos = 0;
        this.windowSkillfulActions = 0;
        this.windowSkillBonus = 0;
        
        this.smoothedKillRate = 0;
        this.smoothedDPS = 0;
        this.smoothedDamageTakenRate = 0;
        this.smoothedComboRate = 0;
        this.smoothedSkillRating = 0;
        
        this.totalKills = 0;
        this.totalDamageDealt = 0;
        this.totalDamageTaken = 0;
        this.totalCombos = 0;
    }
    
    /**
     * Debug info for performance dashboard / telemetry
     */
    getDebugInfo() {
        return {
            stressLevel: this.playerPerformance.stressLevel.toFixed(3),
            damageMultiplier: this.adaptiveDamageMultiplier.toFixed(3),
            killRate: this.smoothedKillRate.toFixed(2),
            dps: this.smoothedDPS.toFixed(0),
            damageTakenRate: this.smoothedDamageTakenRate.toFixed(2),
            comboRate: this.smoothedComboRate.toFixed(2),
            skillRating: this.smoothedSkillRating.toFixed(3),
            totalKills: this.totalKills,
            totalDamageDealt: this.totalDamageDealt,
            totalDamageTaken: this.totalDamageTaken
        };
    }
}
