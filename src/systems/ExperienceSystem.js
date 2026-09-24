import { ExperienceGem } from '../entities/ExperienceGem.js';
import { managedSetTimeout, globalTimerManager } from '../core/TimerManager.js';

export class ExperienceSystem {
    constructor(game) {
        this.game = game;

        // Experience gem pools for performance
        this.gemPool = [];
        this.activeGems = [];
        this.maxActiveGems = 60; // Reduced for visual clarity

        // Collection mechanics - ENHANCED
        this.magnetRange = 80;
        this.autoCollectRange = 25;

        // Gem spawn mechanics
        this.gemValues = {
            small: 5,
            medium: 15,
            large: 25,
            rare: 50
        };

        // Performance optimization
        this.spatialGrid = new Map();
        this.gridSize = 64;
        this.lastCleanupTime = 0;
        this.cleanupInterval = 2000; // Cleanup every 2 seconds

        // Global magnet timer (system-level). When > 0, all gems are pulled regardless of range
        this.globalMagnetTimer = 0;

        // Area magnet (radius-limited timed magnet)
        this.areaMagnetRadius = 0;
        this.areaMagnetTimer = 0;
        this.areaMagnetPulse = 0.25; // seconds per-frame forced pull
        // Magnetic Field: radius derived from effective pickup range, recomputed
        // each frame while active. Explicit activations keep their own radius.
        this.magneticFieldAuto = false;
        this.areaMagnetExplicitRadius = 0;

        // Consolidation: expired, far, unclaimed gems merge into a neighbour
        this.consolidationDistance = 600;

        // Conservation ledger (raw fields; public telemetry lands in phase 5)
        this.droppedXP = 0;
        this.collectedXP = 0;

        // Reused scratch buffer for deferred pool returns during updateGems
        this._pendingPool = [];
        this._gemUpdateInPass = false;
        this.initializePool();
    }

    initializePool() {
        // Pre-create gem pool
        const poolSize = 100;

        for (let i = 0; i < poolSize; i++) {
            const gem = new ExperienceGem(this.game, 0, 0, 5);
            gem.active = false;
            gem._inPool = true;
            this.gemPool.push(gem);
        }
    }

    update(dt) {
        // 1) Decrement timers first
        if (this.globalMagnetTimer > 0) {
            this.globalMagnetTimer = Math.max(0, this.globalMagnetTimer - dt);
        }
        if (this.areaMagnetTimer > 0) {
            this.areaMagnetTimer = Math.max(0, this.areaMagnetTimer - dt);
            if (this.areaMagnetTimer <= 0) {
                this.magneticFieldAuto = false;
                this.areaMagnetExplicitRadius = 0;
                this.areaMagnetRadius = 0;
            } else if (this.magneticFieldAuto) {
                // Magnetic Field radius follows effective pickup range while active
                this.areaMagnetRadius = Math.max(
                    this.areaMagnetExplicitRadius,
                    this.magneticFieldRadius()
                );
            }
        }

        // 2) Build spatial grid for efficient pulse queries
        this.updateSpatialGrid();

        // 3) Apply area magnet pulse before gem updates so movement happens this frame
        if (this.areaMagnetTimer > 0 && this.areaMagnetRadius > 0 && this.game.player && this.game.player.isAlive()) {
            this.magnetizeGemsInRadius(this.areaMagnetRadius, this.areaMagnetPulse);
        }

        // 4) Update all active gems (forced-magnetized gems will move immediately)
        this.updateGems(dt);

        // 5) Auto-collect nearby gems
        this.autoCollectGems();

        // 6) Periodic cleanup
        const currentTime = performance.now();
        if (currentTime - this.lastCleanupTime > this.cleanupInterval) {
            this.cleanup();
            this.lastCleanupTime = currentTime;
        }
    }

    updateGems(dt) {
        // Use write-index pattern to avoid expensive splice operations.
        // Pool returns are deferred until after the pass: a gem re-popped by a
        // synchronous createGem mid-pass would otherwise be listed twice.
        this._gemUpdateInPass = true;
        const pendingPool = this._pendingPool;
        pendingPool.length = 0;
        let writeIndex = 0;
        for (let i = 0; i < this.activeGems.length; i++) {
            const gem = this.activeGems[i];

            if (!gem.active) {
                pendingPool.push(gem);
                continue;
            }

            gem.update(dt);

            if (!gem.active) {
                pendingPool.push(gem);
                continue;
            }

            this.activeGems[writeIndex++] = gem;
        }
        // Trim array to new size
        this.activeGems.length = writeIndex;
        this._gemUpdateInPass = false;

        for (const gem of pendingPool) {
            this.returnGemToPool(gem);
        }
        pendingPool.length = 0;
    }

    addExperienceToPlayer(amount) {
        if (!this.game.player || !this.game.player.isAlive()) return 0;

        this.game.player.gainExperience(amount);
        return amount;
    }

    updateSpatialGrid() {
        // Clear grid
        this.spatialGrid.clear();

        // Add all active gems to grid
        for (const gem of this.activeGems) {
            if (!gem.active) continue;

            const gridX = Math.floor(gem.x / this.gridSize);
            const gridY = Math.floor(gem.y / this.gridSize);
            const key = `${gridX},${gridY}`;

            if (!this.spatialGrid.has(key)) {
                this.spatialGrid.set(key, []);
            }
            this.spatialGrid.get(key).push(gem);
        }
    }

    /**
     * Effective pickup range: base magnet range scaled by player luck and the
     * Attractorb passive (additive bonus, +0.25 per level). Single source for
     * auto-collect and the Magnetic Field radius.
     */
    getEffectivePickupRange() {
        const player = this.game.player;
        let pickupBonus = 1;
        if (this.game.systems && this.game.systems.passiveItems) {
            const mods = this.game.systems.passiveItems.getStatModifiers();
            pickupBonus = 1 + (mods.pickupRange || 0);
        }
        return this.magnetRange * ((player && player.stats.luck) || 1) * pickupBonus;
    }

    autoCollectGems() {
        if (!this.game.player || !this.game.player.isAlive()) return;

        const player = this.game.player;
        const effectiveMagnetRange = this.getEffectivePickupRange();

        // Check gems near player for collection
        const nearbyGems = this.getGemsInRange(player.x, player.y, effectiveMagnetRange);

        for (const gem of nearbyGems) {
            const distanceSquared = this.getDistanceToPlayer(gem);

            // Auto-collect very close gems (compare squared distances)
            const autoCollectRangeSquared = this.autoCollectRange * this.autoCollectRange;
            if (distanceSquared <= autoCollectRangeSquared) {
                gem.collect();
            } else if (effectiveMagnetRange > this.magnetRange) {
                // Extended pickup range (Attractorb/luck): gems beyond their own
                // magnetRange but inside effectiveMagnetRange get a brief forced
                // pull so they drift toward the player even before the gem's own
                // physics would normally kick in.
                const normalRangeSq =
                    (gem.magnetRange || this.magnetRange) * (gem.magnetRange || this.magnetRange);
                if (distanceSquared > normalRangeSq) {
                    gem.forceMagnetTimer = Math.max(gem.forceMagnetTimer || 0, 0.1);
                }
            }
        }
    }

    createGem(x, y, value = null, type = null) {
        // Check for lucky gem (5% chance when no value is specified)
        let isLucky = false;
        if (value === null && Math.random() < 0.05) {
            isLucky = true;
            value = this.determineGemValue() * 5; // 5x experience
        } else if (value === null) {
            value = this.determineGemValue();
        }

        // Conservation ledger: every dropped point is tracked before placement
        this.droppedXP += value;

        if (this.activeGems.length >= this.maxActiveGems) {
            // The cap limits rendered objects, never value. First reclaim slots
            // held by gems collected since the last update pass...
            this.compactInactiveGems();
        }

        if (this.activeGems.length >= this.maxActiveGems) {
            // ...then merge the new gem into the nearest existing gem (claimed
            // gems may receive value but are never merge victims).
            const target = this.findNearestGem(x, y);
            if (target) {
                target.value += value;
                target.initializeVisuals(); // recompute tier/colour
                return target;
            }
            return null;
        }

        // Get gem from pool
        const gem = this.getGemFromPool();
        if (!gem) return null;

        // Initialize gem
        gem.reset(x, y, value);

        // Make it a lucky gem with special properties
        if (isLucky) {
            gem.isLucky = true;
            gem.color = '#FFD700'; // Gold color
            gem.size = Math.max(12, gem.size * 1.5); // Bigger
            gem.glowEffect = true;
            gem.pulseRate = 2.0; // Faster pulse

            // Enhanced visual effects for lucky gems
            if (this.game.systems.particle) {
                this.game.systems.particle.createLuckyGemSparkles(x, y);
            }
        }

        this.activeGems.push(gem);
        return gem;
    }

    // Remove collected/inactive gems still listed from a mid-frame collect.
    // During an update pass, pooling is deferred (see updateGems) so a gem can
    // never be re-popped while its stale slot is still being iterated.
    compactInactiveGems() {
        let writeIndex = 0;
        for (let i = 0; i < this.activeGems.length; i++) {
            const gem = this.activeGems[i];
            if (!gem.active) {
                if (this._gemUpdateInPass) {
                    this._pendingPool.push(gem);
                } else {
                    this.returnGemToPool(gem);
                }
            } else {
                this.activeGems[writeIndex++] = gem;
            }
        }
        this.activeGems.length = writeIndex;
    }

    determineGemValue() {
        // Random gem value based on probabilities
        const rand = Math.random();

        if (rand < 0.6) {
            return this.gemValues.small; // 60% chance
        } else if (rand < 0.85) {
            return this.gemValues.medium; // 25% chance
        } else if (rand < 0.98) {
            return this.gemValues.large; // 13% chance
        } else {
            return this.gemValues.rare; // 2% chance
        }
    }

    createMultipleGems(x, y, count, totalValue) {
        const baseValue = Math.floor(totalValue / count);
        const remainder = totalValue % count;

        for (let i = 0; i < count; i++) {
            // Spread gems in a small circle
            const angle = (i / count) * Math.PI * 2;
            const distance = 15 + Math.random() * 15;
            const gemX = x + Math.cos(angle) * distance;
            const gemY = y + Math.sin(angle) * distance;

            // Give some gems extra value from remainder
            const gemValue = baseValue + (i < remainder ? 1 : 0);

            this.createGem(gemX, gemY, gemValue);
        }
    }

    createBonusGem(x, y, multiplier = 2) {
        // Create a special bonus gem worth more experience
        const baseValue = this.determineGemValue();
        const bonusValue = Math.floor(baseValue * multiplier);

        const gem = this.createGem(x, y, bonusValue);
        if (gem) {
            // Special visual effects for bonus gems
            this.game.systems.particle.createBonusGemEffect(x, y, gem.color);
        }

        return gem;
    }

    createGemExplosion(x, y, totalValue, minGems = 3, maxGems = 8) {
        // Create an explosion of gems. The advertised total is conserved exactly:
        // base share per gem plus the remainder spread one point at a time.
        // Fewer gems than points would force value inflation, so the count is
        // capped at the total (every gem is worth at least 1).
        const gemCount = Math.min(
            minGems + Math.floor(Math.random() * (maxGems - minGems + 1)),
            Math.max(1, totalValue)
        );
        const baseValue = Math.floor(totalValue / gemCount);
        const remainder = totalValue - baseValue * gemCount;

        for (let i = 0; i < gemCount; i++) {
            // Random explosion pattern
            const angle = Math.random() * Math.PI * 2;
            const distance = 20 + Math.random() * 40;
            const gemX = x + Math.cos(angle) * distance;
            const gemY = y + Math.sin(angle) * distance;

            const gemValue = baseValue + (i < remainder ? 1 : 0);
            const gem = this.createGem(gemX, gemY, gemValue);


            if (gem && gem.velocity) {
                // Add explosion velocity
                gem.velocity.x = Math.cos(angle) * (100 + Math.random() * 100);
                gem.velocity.y = Math.sin(angle) * (100 + Math.random() * 100) - 150;
            }
        }

        // Visual explosion effect
        this.game.systems.particle?.createGemExplosionEffect?.(x, y);
    }

    getGemFromPool() {
        if (this.gemPool.length > 0) {
            const gem = this.gemPool.pop();
            gem._inPool = false;
            return gem;
        }

        // Create new gem if pool is empty
        return new ExperienceGem(this.game, 0, 0, 5);
    }

    returnGemToPool(gem) {
        if (!gem || gem._inPool) return;

        // Cancel any callbacks still owned by this gem, then reset state
        globalTimerManager.clearContext(gem);
        gem.active = false;
        gem.collected = false;
        gem.claimed = false;
        gem.claimAge = 0;

        // Return to pool if not full
        if (this.gemPool.length < 150) {
            gem._inPool = true;
            this.gemPool.push(gem);
        }
    }

    cleanup() {
        // Remove inactive gems using write-index pattern
        let writeIndex = 0;
        for (let i = 0; i < this.activeGems.length; i++) {
            const gem = this.activeGems[i];

            if (!gem.active) {
                this.returnGemToPool(gem);
            } else {
                this.activeGems[writeIndex++] = gem;
            }
        }
        this.activeGems.length = writeIndex;

        // Gems never expire into nothing: periodically consolidate old, far,
        // unclaimed gems into their nearest neighbour via the spatial grid.
        this.consolidateExpiredGems();
    }

    /**
     * Merge expired (lifetime <= 0), far, unclaimed gems into their nearest
     * active neighbour. Value is conserved; claimed gems are never victims.
     * Uses the spatial grid — no all-pairs scans.
     */
    consolidateExpiredGems() {
        const player = this.game.player;
        if (!player) return;
        const farSq = this.consolidationDistance * this.consolidationDistance;

        for (let i = this.activeGems.length - 1; i >= 0; i--) {
            const gem = this.activeGems[i];
            if (!gem.active || gem.collected || gem.claimed || gem.lifetime > 0) continue;

            const dx = gem.x - player.x;
            const dy = gem.y - player.y;
            if (dx * dx + dy * dy <= farSq) continue; // still near the player

            const target = this.findNearestGemViaGrid(gem.x, gem.y, gem);
            if (!target) continue; // alone on the floor: keep it, value conserved

            target.value += gem.value;
            target.initializeVisuals(); // recompute tier/colour
            gem.active = false;
            this.activeGems.splice(i, 1);
            this.returnGemToPool(gem);
        }
    }

    /**
     * Enforce a rendered-gem cap without losing value: merge farthest
     * unclaimed gems into their nearest neighbour until count <= maxCount.
     * Claimed gems are never victims and may occupy the cap until collected.
     * Victims are sorted once by distance; each merge target is found via the
     * spatial grid — no all-pairs scans.
     * @returns {number} how many gems were merged away
     */
    consolidateGems(maxCount = this.maxActiveGems) {
        if (this.activeGems.length <= maxCount) return 0;

        // Refresh the grid so merge targets reflect current positions
        this.updateSpatialGrid();

        // Victim candidates: unclaimed gems, farthest from the player first.
        // Sorted once — merging a victim never changes victim ordering.
        const victims = this.activeGems
            .filter((gem) => gem.active && !gem.collected && !gem.claimed)
            .sort((a, b) => this.getDistanceSquaredToPlayer(b) - this.getDistanceSquaredToPlayer(a));

        let merged = 0;
        for (const victim of victims) {
            if (this.activeGems.length <= maxCount) break;

            const target = this.findNearestGemViaGrid(victim.x, victim.y, victim);
            if (!target) continue; // lone gem: nothing to merge into

            target.value += victim.value;
            target.initializeVisuals(); // recompute tier/colour
            victim.active = false;
            this.activeGems.splice(this.activeGems.indexOf(victim), 1);
            this.returnGemToPool(victim);
            merged++;
        }
        return merged;
    }

    /**
     * Nearest active, uncollected gem to (x, y). Linear scan over the capped
     * active list — used for single merges, not periodic sweeps.
     */
    findNearestGem(x, y, exclude = null) {
        let best = null;
        let bestSq = Infinity;
        for (const gem of this.activeGems) {
            if (gem === exclude || !gem.active || gem.collected) continue;
            const dx = gem.x - x;
            const dy = gem.y - y;
            const dSq = dx * dx + dy * dy;
            if (dSq < bestSq) {
                bestSq = dSq;
                best = gem;
            }
        }
        return best;
    }

    /**
     * Nearest active, uncollected gem to (x, y) via the spatial grid.
     * Scans only each ring's perimeter cells (O(ring) per ring, not O(ring²)),
     * bounded by the farthest occupied cell — never scans empty world, no
     * hard distance cutoff. Stops once a ring's minimum possible distance
     * exceeds the best hit so far.
     */
    findNearestGemViaGrid(x, y, exclude = null) {
        const cellX = Math.floor(x / this.gridSize);
        const cellY = Math.floor(y / this.gridSize);
        let best = null;
        let bestSq = Infinity;

        const scanCell = (gx, gy) => {
            const cell = this.spatialGrid.get(`${gx},${gy}`);
            if (!cell) return;
            for (const gem of cell) {
                if (gem === exclude || !gem.active || gem.collected) continue;
                const dx = gem.x - x;
                const dy = gem.y - y;
                const dSq = dx * dx + dy * dy;
                if (dSq < bestSq) {
                    bestSq = dSq;
                    best = gem;
                }
            }
        };

        // Farthest occupied cell bounds the search — no fixed radius cutoff
        let maxRing = 0;
        for (const key of this.spatialGrid.keys()) {
            const comma = key.indexOf(',');
            const gx = parseInt(key.slice(0, comma), 10);
            const gy = parseInt(key.slice(comma + 1), 10);
            const ring = Math.max(Math.abs(gx - cellX), Math.abs(gy - cellY));
            if (ring > maxRing) maxRing = ring;
        }

        for (let ring = 0; ring <= maxRing; ring++) {
            // Cells in ring r start at least (r - 1) * gridSize away
            if (ring > 0 && (ring - 1) * this.gridSize >= Math.sqrt(bestSq)) break;

            if (ring === 0) {
                scanCell(cellX, cellY);
                continue;
            }
            // Perimeter only: top/bottom rows, then left/right columns
            for (let gx = cellX - ring; gx <= cellX + ring; gx++) {
                scanCell(gx, cellY - ring);
                scanCell(gx, cellY + ring);
            }
            for (let gy = cellY - ring + 1; gy <= cellY + ring - 1; gy++) {
                scanCell(cellX - ring, gy);
                scanCell(cellX + ring, gy);
            }
        }
        return best;
    }

    // Collection abilities
    collectAllGems() {
        // Collect all gems on screen (special ability)
        for (const gem of this.activeGems) {
            if (gem.active && !gem.collected) {
                gem.collect();
            }
        }
    }

    /**
     * Vacuum-style claim: mark every active, uncollected gem claimed.
     * Claimed gems home to the player until collected; they cannot expire,
     * be culled, or be merged away. Idempotent — already claimed gems are
     * not counted twice.
     * @returns {{count: number, xp: number}} newly claimed count and summed
     *   base gem XP of the newly claimed haul
     */
    claimAllGems() {
        let count = 0;
        let xp = 0;
        for (const gem of this.activeGems) {
            if (gem.active && !gem.collected && typeof gem.claim === 'function' && gem.claim()) {
                count++;
                xp += gem.value;
            }
        }
        return { count, xp };
    }

    // Conservation ledger hook: base gem XP actually awarded to the player
    trackCollectedGem(value) {
        this.collectedXP += value;
    }

    magnetizeAllGems() {
        // Force all gems to move toward player (special ability for level up).
        // Gems are claimed so the pull cannot be undone by expiry or culling.
        if (!this.game.player) return;

        let magnetizedCount = 0;

        for (const gem of this.activeGems) {
            if (gem.active && !gem.collected) {
                if (typeof gem.claim === 'function') gem.claim();
                // Start a timed global magnet pulse that ignores range in ExperienceGem.updateMagnetism
                if (typeof gem.forceMagnetTimer !== 'number') {
                    gem.forceMagnetTimer = 0;
                }
                gem.forceMagnetTimer = Math.max(gem.forceMagnetTimer, 1.5); // seconds of forced pull
                gem.beingMagnetized = true;
                // Ensure magnet strength baseline is sane (pulse path uses baseMagnetStrength internally)
                if (typeof gem.baseMagnetStrength === 'number') {
                    gem.magnetStrength = gem.baseMagnetStrength;
                }
                magnetizedCount++;

                // Subtler sparkle trail: only every 8th gem
                if (this.game.systems.particle && magnetizedCount % 8 === 0) {
                    this.game.systems.particle.create(gem.x, gem.y, {
                        vx: (Math.random() - 0.5) * 20,
                        vy: (Math.random() - 0.5) * 20,
                        life: 0.5, // Shorter life
                        size: 1.5, // Smaller size
                        color: '#00FFFF',
                        glow: true,
                        fadeOut: true
                    });
                }
            }
        }

        // Play satisfying audio feedback if gems were magnetized
        if (magnetizedCount > 0 && this.game.audioManager) {
            this.game.audioManager.playVampireSound('experienceGain', 0.4, 1.3);
        }

        return magnetizedCount; // Return how many gems were affected
    }

    activateAreaMagnet(radius, duration = 0) {
        // Start/extend a radius-limited magnet effect centered on the player
        const r = Math.max(0, radius || 0);
        const d = Math.max(0, duration || 0);
        this.areaMagnetExplicitRadius = Math.max(this.areaMagnetExplicitRadius, r);
        this.areaMagnetRadius = Math.max(this.areaMagnetRadius, r);
        this.areaMagnetTimer = Math.max(this.areaMagnetTimer, d);
        return { radius: this.areaMagnetRadius, duration: this.areaMagnetTimer };
    }

    /**
     * Magnetic Field (timed Magnet power-up): radius derived from the
     * effective pickup range — max(3 × effective, 360) — never the viewport.
     * Recomputed each frame while active so Attractorb/modifier changes
     * rescale the field. Attracts XP and gold only.
     */
    magneticFieldRadius() {
        return Math.max(3 * this.getEffectivePickupRange(), 360);
    }

    activateMagneticField(duration = 0) {
        const d = Math.max(0, duration || 0);
        this.magneticFieldAuto = true;
        this.areaMagnetRadius = Math.max(this.areaMagnetExplicitRadius, this.magneticFieldRadius());
        this.areaMagnetTimer = Math.max(this.areaMagnetTimer, d);
        // Immediate pulse so the field visibly grabs gems this frame
        this.magnetizeGemsInRadius(this.areaMagnetRadius, this.areaMagnetPulse);
        return { radius: this.areaMagnetRadius, duration: this.areaMagnetTimer };
    }


    magnetizeGemsInRadius(radius, pulseDuration = 0.25) {
        if (!this.game.player) return 0;
        const player = this.game.player;
        const r = Math.max(0, radius);
        let count = 0;
        const nearby = this.getNearbyGems(player.x, player.y, r);
        for (const gem of nearby) {
            if (gem.active && !gem.collected) {
                if (typeof gem.forceMagnetTimer !== 'number') gem.forceMagnetTimer = 0;
                gem.forceMagnetTimer = Math.max(gem.forceMagnetTimer, pulseDuration);
                gem.beingMagnetized = true;
                count++;
            }
        }
        return count;
    }

    // System-level global magnet activation
    activateGlobalMagnet(duration = 0) {
        const d = Math.max(0, duration);
        this.globalMagnetTimer = Math.max(this.globalMagnetTimer, d);
        return this.globalMagnetTimer;
    }

    isGlobalMagnetActive() {
        return this.globalMagnetTimer > 0;
    }

    // Query methods
    getGemsInRange(x, y, range) {
        const result = [];
        const rangeSquared = range * range;

        for (const gem of this.activeGems) {
            if (!gem.active || gem.collected) continue;

            const dx = gem.x - x;
            const dy = gem.y - y;
            const distanceSquared = dx * dx + dy * dy;

            if (distanceSquared <= rangeSquared) {
                result.push(gem);
            }
        }

        return result;
    }

    getNearbyGems(x, y, range) {
        // Use spatial grid for efficient lookup
        const result = [];
        const gridRange = Math.ceil(range / this.gridSize);
        const centerGridX = Math.floor(x / this.gridSize);
        const centerGridY = Math.floor(y / this.gridSize);

        for (let gx = centerGridX - gridRange; gx <= centerGridX + gridRange; gx++) {
            for (let gy = centerGridY - gridRange; gy <= centerGridY + gridRange; gy++) {
                const key = `${gx},${gy}`;
                const gems = this.spatialGrid.get(key);

                if (gems) {
                    for (const gem of gems) {
                        const dx = gem.x - x;
                        const dy = gem.y - y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance <= range) {
                            result.push(gem);
                        }
                    }
                }
            }
        }

        return result;
    }

    // OPTIMIZED: Return squared distance to avoid expensive Math.sqrt()
    getDistanceToPlayer(gem) {
        if (!this.game.player) return Infinity;

        const dx = gem.x - this.game.player.x;
        const dy = gem.y - this.game.player.y;
        return dx * dx + dy * dy; // Squared distance for performance
    }

    getDistanceSquaredToPlayer(gem) {
        if (!this.game.player) return Infinity;

        const dx = gem.x - this.game.player.x;
        const dy = gem.y - this.game.player.y;
        return dx * dx + dy * dy;
    }

    getActiveGemCount() {
        return this.activeGems.length;
    }

    getTotalGemValue() {
        let total = 0;
        for (const gem of this.activeGems) {
            if (gem.active && !gem.collected) {
                total += gem.value;
            }
        }
        return total;
    }

    // Special gem creation for specific scenarios
    createBossDrops(x, y, bossLevel) {
        // Create special gems dropped by bosses
        const baseValue = 100 * bossLevel;
        const gemCount = 3 + bossLevel;

        this.createGemExplosion(x, y, baseValue, gemCount, gemCount + 2);

        // Always create one rare gem (system-owned timer: cancelled on reset)
        managedSetTimeout(() => {
            this.createBonusGem(x, y, 3);
        }, 500, this);
    }

    createLevelUpReward(x, y) {
        // Create gems as level up reward
        const gems = 5 + Math.floor(this.game.player.level / 5);
        const totalValue = 50 + this.game.player.level * 10;

        this.createMultipleGems(x, y, gems, totalValue);
    }

    createAchievementReward(x, y, achievementTier = 1) {
        // Create gems for achievement completion
        const value = 50 * achievementTier;
        const gemCount = 2 + achievementTier;

        for (let i = 0; i < gemCount; i++) {
            managedSetTimeout(() => {
                this.createBonusGem(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40, 1.5);
            }, i * 200, this);
        }
    }

    // Clear all gems (for game reset): ends the run's ledger and cancels
    // every pending system/gem-owned callback.
    clearAll() {
        globalTimerManager.clearContext(this);

        for (const gem of this.activeGems) {
            gem.active = false;
            this.returnGemToPool(gem);
        }

        this.activeGems = [];
        this.spatialGrid.clear();

        // Reset magnet/field state and the conservation ledger
        this.globalMagnetTimer = 0;
        this.areaMagnetTimer = 0;
        this.areaMagnetRadius = 0;
        this.areaMagnetExplicitRadius = 0;
        this.magneticFieldAuto = false;
        this.droppedXP = 0;
        this.collectedXP = 0;
    }

    render(renderer) {
        const ctx = renderer.ctx;

        // Debug: visualize area magnet radius while active (world-space; camera already applied)
        if (
            this.game &&
            this.game.showDebug &&
            this.areaMagnetTimer > 0 &&
            this.areaMagnetRadius > 0 &&
            this.game.player
        ) {
            ctx.save();
            ctx.globalAlpha = 0.12;
            ctx.fillStyle = '#00FFFF';
            ctx.beginPath();
            ctx.arc(this.game.player.x, this.game.player.y, this.areaMagnetRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = '#00FFFF';
            ctx.setLineDash([8, 6]);
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        // Render all active gems
        for (const gem of this.activeGems) {
            if (gem.active && !gem.collected) {
                gem.render(renderer);
            }
        }
    }

    // Debug info
    getDebugInfo() {
        return {
            activeGems: this.activeGems.length,
            poolSize: this.gemPool.length,
            totalValue: this.getTotalGemValue(),
            gridCells: this.spatialGrid.size,
            gemTypes: this.getGemTypeDistribution(),
            droppedXP: this.droppedXP,
            collectedXP: this.collectedXP
        };
    }

    getGemTypeDistribution() {
        const distribution = { small: 0, medium: 0, large: 0, rare: 0 };

        for (const gem of this.activeGems) {
            if (!gem.active || gem.collected) continue;

            if (gem.value >= this.gemValues.rare) {
                distribution.rare++;
            } else if (gem.value >= this.gemValues.large) {
                distribution.large++;
            } else if (gem.value >= this.gemValues.medium) {
                distribution.medium++;
            } else {
                distribution.small++;
            }
        }

        return distribution;
    }
}
