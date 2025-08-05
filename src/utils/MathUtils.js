/**
 * Math Utilities for Performance Optimization
 * 
 * Provides optimized math functions for common game calculations,
 * particularly distance calculations that avoid expensive sqrt operations.
 */

export class MathUtils {
    /**
     * Calculate squared distance between two points
     * Much faster than regular distance as it avoids sqrt
     * @param {number} x1 - First point X
     * @param {number} y1 - First point Y
     * @param {number} x2 - Second point X
     * @param {number} y2 - Second point Y
     * @returns {number} Squared distance
     */
    static distanceSquared(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return dx * dx + dy * dy;
    }

    /**
     * Check if two circles overlap using squared distance
     * @param {number} x1 - First circle center X
     * @param {number} y1 - First circle center Y
     * @param {number} r1 - First circle radius
     * @param {number} x2 - Second circle center X
     * @param {number} y2 - Second circle center Y
     * @param {number} r2 - Second circle radius
     * @returns {boolean} True if circles overlap
     */
    static circlesOverlap(x1, y1, r1, x2, y2, r2) {
        const distSq = this.distanceSquared(x1, y1, x2, y2);
        const radiusSum = r1 + r2;
        return distSq <= radiusSum * radiusSum;
    }

    /**
     * Check if point is within circle using squared distance
     * @param {number} px - Point X
     * @param {number} py - Point Y
     * @param {number} cx - Circle center X
     * @param {number} cy - Circle center Y
     * @param {number} radius - Circle radius
     * @returns {boolean} True if point is within circle
     */
    static pointInCircle(px, py, cx, cy, radius) {
        const distSq = this.distanceSquared(px, py, cx, cy);
        return distSq <= radius * radius;
    }

    /**
     * Find nearest object from a list using squared distance
     * @param {number} x - Reference point X
     * @param {number} y - Reference point Y
     * @param {Array} objects - Array of objects with x, y properties
     * @param {number} maxDistanceSquared - Maximum squared distance (optional)
     * @returns {Object|null} Nearest object or null
     */
    static findNearest(x, y, objects, maxDistanceSquared = Infinity) {
        let nearest = null;
        let nearestDistSq = maxDistanceSquared;

        for (const obj of objects) {
            const distSq = this.distanceSquared(x, y, obj.x, obj.y);
            if (distSq < nearestDistSq) {
                nearestDistSq = distSq;
                nearest = obj;
            }
        }

        return nearest;
    }

    /**
     * Find all objects within radius using squared distance
     * @param {number} x - Center point X
     * @param {number} y - Center point Y
     * @param {number} radius - Search radius
     * @param {Array} objects - Array of objects with x, y properties
     * @returns {Array} Objects within radius
     */
    static findWithinRadius(x, y, radius, objects) {
        const radiusSq = radius * radius;
        const result = [];

        for (const obj of objects) {
            const distSq = this.distanceSquared(x, y, obj.x, obj.y);
            if (distSq <= radiusSq) {
                result.push(obj);
            }
        }

        return result;
    }

    /**
     * Clamp a value between min and max
     * @param {number} value - Value to clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Clamped value
     */
    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Lerp between two values
     * @param {number} start - Start value
     * @param {number} end - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number} Interpolated value
     */
    static lerp(start, end, t) {
        return start + (end - start) * t;
    }

    /**
     * Convert degrees to radians
     * @param {number} degrees - Angle in degrees
     * @returns {number} Angle in radians
     */
    static degToRad(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Convert radians to degrees
     * @param {number} radians - Angle in radians
     * @returns {number} Angle in degrees
     */
    static radToDeg(radians) {
        return radians * (180 / Math.PI);
    }

    /**
     * Get angle between two points in radians
     * @param {number} x1 - First point X
     * @param {number} y1 - First point Y
     * @param {number} x2 - Second point X
     * @param {number} y2 - Second point Y
     * @returns {number} Angle in radians
     */
    static angleBetween(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    }

    /**
     * Normalize a vector (make it unit length)
     * @param {number} x - Vector X component
     * @param {number} y - Vector Y component
     * @returns {Object} Normalized vector {x, y}
     */
    static normalize(x, y) {
        const length = Math.sqrt(x * x + y * y);
        if (length === 0) {
            return { x: 0, y: 0 };
        }
        return {
            x: x / length,
            y: y / length
        };
    }

    /**
     * Random float between min and max
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random value
     */
    static randomRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    /**
     * Random integer between min and max (inclusive)
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random integer
     */
    static randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Check if value is within tolerance of target
     * @param {number} value - Value to check
     * @param {number} target - Target value
     * @param {number} tolerance - Tolerance amount
     * @returns {boolean} True if within tolerance
     */
    static withinTolerance(value, target, tolerance) {
        return Math.abs(value - target) <= tolerance;
    }
}

// Pre-calculated constants for performance
export const MathConstants = {
    TWO_PI: Math.PI * 2,
    HALF_PI: Math.PI / 2,
    QUARTER_PI: Math.PI / 4,
    DEG_TO_RAD: Math.PI / 180,
    RAD_TO_DEG: 180 / Math.PI
};