/**
 * Performance Optimization Utilities
 * Provides caching, debouncing, and other performance enhancements
 */

export class PerformanceOptimizer {
    constructor() {
        this.cache = new Map();
        this.cacheMaxSize = 100;
        this.cacheMaxAge = 1000 * 60 * 60; // 1 hour
        this.debounceTimers = new Map();
    }

    /**
     * Debounce function execution
     * @param {Function} func - Function to debounce
     * @param {number} delay - Delay in milliseconds
     * @param {string} key - Unique key for this debounce
     * @returns {Function} Debounced function
     */
    debounce(func, delay = 300, key = 'default') {
        return (...args) => {
            // Clear existing timer
            if (this.debounceTimers.has(key)) {
                clearTimeout(this.debounceTimers.get(key));
            }

            // Set new timer
            const timer = setTimeout(() => {
                func.apply(this, args);
                this.debounceTimers.delete(key);
            }, delay);

            this.debounceTimers.set(key, timer);
        };
    }

    /**
     * Throttle function execution
     * @param {Function} func - Function to throttle
     * @param {number} limit - Minimum time between calls in milliseconds
     * @returns {Function} Throttled function
     */
    throttle(func, limit = 300) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Generate cache key from parameters
     * @param {string} operation - Operation name
     * @param {Object} params - Parameters
     * @returns {string} Cache key
     */
    generateCacheKey(operation, params) {
        const sortedParams = Object.keys(params)
            .sort()
            .reduce((acc, key) => {
                acc[key] = params[key];
                return acc;
            }, {});
        return `${operation}:${JSON.stringify(sortedParams)}`;
    }

    /**
     * Get cached result
     * @param {string} key - Cache key
     * @returns {any|null} Cached value or null
     */
    getCache(key) {
        const cached = this.cache.get(key);

        if (!cached) {
            return null;
        }

        // Check if cache is expired
        if (Date.now() - cached.timestamp > this.cacheMaxAge) {
            this.cache.delete(key);
            return null;
        }

        return cached.value;
    }

    /**
     * Set cache value
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     */
    setCache(key, value) {
        // Implement LRU cache - remove oldest if at max size
        if (this.cache.size >= this.cacheMaxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    /**
     * Clear cache
     * @param {string} pattern - Optional pattern to match keys (supports wildcards)
     */
    clearCache(pattern = null) {
        if (!pattern) {
            this.cache.clear();
            return;
        }

        // Convert pattern to regex
        const regex = new RegExp(pattern.replace('*', '.*'));

        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.cacheMaxSize,
            maxAge: this.cacheMaxAge,
            keys: Array.from(this.cache.keys())
        };
    }

    /**
     * Lazy load data with caching
     * @param {string} key - Cache key
     * @param {Function} loader - Function that loads data
     * @returns {Promise<any>} Loaded data
     */
    async lazyLoad(key, loader) {
        // Check cache first
        const cached = this.getCache(key);
        if (cached !== null) {
            return cached;
        }

        // Load data
        const data = await loader();

        // Cache result
        this.setCache(key, data);

        return data;
    }

    /**
     * Compress string data for storage
     * @param {string} data - Data to compress
     * @returns {string} Compressed data
     */
    compressString(data) {
        // Simple compression using JSON stringify and base64
        // For production, consider using a proper compression library
        try {
            return btoa(encodeURIComponent(data));
        } catch (e) {
            console.error('Compression failed:', e);
            return data;
        }
    }

    /**
     * Decompress string data
     * @param {string} compressed - Compressed data
     * @returns {string} Decompressed data
     */
    decompressString(compressed) {
        try {
            return decodeURIComponent(atob(compressed));
        } catch (e) {
            console.error('Decompression failed:', e);
            return compressed;
        }
    }

    /**
     * Measure function execution time
     * @param {Function} func - Function to measure
     * @param {string} label - Label for measurement
     * @returns {Function} Wrapped function
     */
    measurePerformance(func, label = 'Function') {
        return async function (...args) {
            const start = performance.now();
            const result = await func.apply(this, args);
            const end = performance.now();
            console.log(`[Performance] ${label}: ${(end - start).toFixed(2)}ms`);
            return result;
        };
    }

    /**
     * Batch multiple async operations
     * @param {Array<Function>} operations - Array of async functions
     * @param {number} batchSize - Number of operations to run in parallel
     * @returns {Promise<Array>} Results
     */
    async batchOperations(operations, batchSize = 3) {
        const results = [];

        for (let i = 0; i < operations.length; i += batchSize) {
            const batch = operations.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(op => op()));
            results.push(...batchResults);
        }

        return results;
    }

    /**
     * Retry operation with exponential backoff
     * @param {Function} operation - Operation to retry
     * @param {number} maxRetries - Maximum number of retries
     * @param {number} baseDelay - Base delay in milliseconds
     * @returns {Promise<any>} Operation result
     */
    async retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
        let lastError;

        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;

                // Don't retry on certain errors
                if (error.status === 401 || error.status === 403) {
                    throw error;
                }

                // Calculate delay with exponential backoff
                const delay = baseDelay * Math.pow(2, i);

                // Wait before retrying
                if (i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    }
}

// Singleton instance
export const performanceOptimizer = new PerformanceOptimizer();
