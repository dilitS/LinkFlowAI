import { describe, it, expect, vi } from 'vitest';
import { PerformanceOptimizer } from '../lib/performance-optimizer.js';

describe('PerformanceOptimizer cache', () => {
    it('stores and retrieves a value', () => {
        const opt = new PerformanceOptimizer();
        opt.setCache('k1', 'v1');
        expect(opt.getCache('k1')).toBe('v1');
    });

    it('returns null for expired entries', () => {
        const opt = new PerformanceOptimizer();
        opt.setCache('k1', 'v1');
        opt.cacheMaxAge = -1;
        expect(opt.getCache('k1')).toBeNull();
    });

    it('evicts oldest entry when maxSize exceeded', () => {
        const opt = new PerformanceOptimizer();
        opt.cacheMaxSize = 2;
        opt.setCache('a', 1);
        opt.setCache('b', 2);
        opt.setCache('c', 3);
        expect(opt.getCache('a')).toBeNull();
        expect(opt.getCache('c')).toBe(3);
    });

    it('clearCache removes all entries', () => {
        const opt = new PerformanceOptimizer();
        opt.setCache('x', 1);
        opt.clearCache();
        expect(opt.getCache('x')).toBeNull();
    });

    it('clearCache with pattern removes matching entries', () => {
        const opt = new PerformanceOptimizer();
        opt.setCache('translate:foo', 1);
        opt.setCache('correct:foo', 2);
        opt.clearCache('translate*');
        expect(opt.getCache('translate:foo')).toBeNull();
        expect(opt.getCache('correct:foo')).toBe(2);
    });

    it('generates different keys for different params', () => {
        const opt = new PerformanceOptimizer();
        const k1 = opt.generateCacheKey('op', { a: 1 });
        const k2 = opt.generateCacheKey('op', { a: 2 });
        expect(k1).not.toBe(k2);
    });
});

describe('PerformanceOptimizer retryWithBackoff', () => {
    it('returns on first success', async () => {
        const opt = new PerformanceOptimizer();
        const result = await opt.retryWithBackoff(() => 'ok', 3, 10);
        expect(result).toBe('ok');
    });

    it('retries transient errors and succeeds', async () => {
        const opt = new PerformanceOptimizer();
        let attempt = 0;
        const result = await opt.retryWithBackoff(() => {
            attempt++;
            if (attempt < 3) {
                const e = new Error('network fail');
                throw e;
            }
            return 'recovered';
        }, 3, 1);
        expect(result).toBe('recovered');
        expect(attempt).toBe(3);
    });

    it('does not retry AbortError', async () => {
        const opt = new PerformanceOptimizer();
        const err = new Error('Aborted');
        err.name = 'AbortError';
        let attempts = 0;
        await expect(opt.retryWithBackoff(() => {
            attempts++;
            throw err;
        }, 3, 1)).rejects.toMatchObject({ name: 'AbortError' });
        expect(attempts).toBe(1);
    });

    it('does not retry 401', async () => {
        const opt = new PerformanceOptimizer();
        const err = new Error('Unauthorized');
        err.status = 401;
        let attempts = 0;
        await expect(opt.retryWithBackoff(() => {
            attempts++;
            throw err;
        }, 3, 1)).rejects.toThrow();
        expect(attempts).toBe(1);
    });

    it('does not retry errors with application code', async () => {
        const opt = new PerformanceOptimizer();
        const err = new Error('No key');
        err.code = 'NO_API_KEY';
        let attempts = 0;
        await expect(opt.retryWithBackoff(() => {
            attempts++;
            throw err;
        }, 3, 1)).rejects.toThrow();
        expect(attempts).toBe(1);
    });
});
