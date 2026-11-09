/**
 * Response caching and retry-with-backoff for model calls.
 */

// Responses are mirrored to chrome.storage.session so the cache survives the
// popup closing (its JS context dies every time) and is shared with the side
// panel and service worker. Session storage lives in memory and is wiped when
// the browser closes; by default only trusted extension contexts can read it.
export const SESSION_CACHE_KEY = 'lingflowResponseCache';

function sessionStore() {
    try {
        return globalThis.chrome?.storage?.session || null;
    } catch {
        return null;
    }
}

/** SHA-256 hex of the cache key, so stored entries never contain raw text as keys. */
async function hashKey(key) {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return key;
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(key));
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export class PerformanceOptimizer {
    constructor() {
        this.cache = new Map();
        this.cacheMaxSize = 100;
        this.cacheMaxAge = 1000 * 60 * 60; // 1 hour
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
     * Cached model response: memory first, then session storage.
     * @param {string} key
     * @returns {Promise<string|null>}
     */
    async getResponse(key) {
        const memory = this.getCache(key);
        if (memory !== null) return memory;

        const store = sessionStore();
        if (!store) return null;
        try {
            const { [SESSION_CACHE_KEY]: all = {} } = await store.get(SESSION_CACHE_KEY);
            const hit = all[await hashKey(key)];
            if (!hit || Date.now() - hit.t > this.cacheMaxAge) return null;
            this.setCache(key, hit.v);
            return hit.v;
        } catch {
            return null;
        }
    }

    /**
     * Store a model response in memory and session storage (LRU by time).
     * @param {string} key
     * @param {string} value
     */
    async setResponse(key, value) {
        this.setCache(key, value);

        const store = sessionStore();
        if (!store) return;
        try {
            const { [SESSION_CACHE_KEY]: all = {} } = await store.get(SESSION_CACHE_KEY);
            const now = Date.now();
            all[await hashKey(key)] = { v: value, t: now };
            const kept = Object.entries(all)
                .filter(([, entry]) => now - entry.t <= this.cacheMaxAge)
                .sort((a, b) => b[1].t - a[1].t)
                .slice(0, this.cacheMaxSize);
            await store.set({ [SESSION_CACHE_KEY]: Object.fromEntries(kept) });
        } catch {
            // Quota or unavailable storage: the in-memory cache still works.
        }
    }

    /** Drop all cached responses (memory and session storage). */
    async clearResponses() {
        this.cache.clear();
        try {
            await sessionStore()?.remove(SESSION_CACHE_KEY);
        } catch {
            // ignore
        }
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
     * Determine whether an error is worth retrying.
     * Client errors (4xx except 429) and application-typed errors (e.g. wrong
     * key, unsupported model) are deterministic — retrying wastes quota.
     */
    static isRetryable(error) {
        if (error.name === 'AbortError') return false;

        const status = error.status;
        if (status === 429) return true;
        if (status && status >= 400 && status < 500) return false;

        if (error.code) return false;

        if (status >= 500) return true;

        const msg = (error.message || '').toLowerCase();
        return msg.includes('network') || msg.includes('fetch') || msg.includes('timeout');
    }

    /**
     * Retry operation with exponential backoff and jitter.
     * Respects `Retry-After` header when the error carries one.
     * @param {Function} operation
     * @param {number} maxRetries
     * @param {number} baseDelay - milliseconds
     * @returns {Promise<any>}
     */
    async retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
        let lastError;

        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;

                if (!PerformanceOptimizer.isRetryable(error)) throw error;

                if (i < maxRetries - 1) {
                    let delay = baseDelay * Math.pow(2, i);

                    if (error.retryAfter) {
                        delay = Math.max(delay, error.retryAfter * 1000);
                    }

                    const jitter = delay * 0.3 * Math.random();
                    await new Promise(resolve => setTimeout(resolve, delay + jitter));
                }
            }
        }

        throw lastError;
    }
}

// Singleton instance
export const performanceOptimizer = new PerformanceOptimizer();
