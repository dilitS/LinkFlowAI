import { describe, it, expect } from 'vitest';
import { escapeHtml, validateInputLength, MAX_INPUT_CHARS } from '../lib/sanitize.js';

describe('escapeHtml', () => {
    it('neutralizes an <img onerror> XSS payload', () => {
        const payload = '<img src=x onerror="alert(1)">';
        const escaped = escapeHtml(payload);
        expect(escaped).not.toContain('<img');
        expect(escaped).toContain('&lt;img');
        expect(escaped).toContain('onerror=&quot;alert(1)&quot;');
    });

    it('neutralizes a <script> payload', () => {
        const escaped = escapeHtml('<script>alert(document.cookie)</script>');
        expect(escaped).not.toContain('<script');
        expect(escaped).toBe('&lt;script&gt;alert(document.cookie)&lt;/script&gt;');
    });

    it('escapes quotes and backticks (attribute breakout vectors)', () => {
        expect(escapeHtml(`"'\``)).toBe('&quot;&#039;&#x60;');
    });

    it('does not execute a script when injected into the live DOM', () => {
        const host = document.createElement('div');
        // Simulate the unsafe pattern guarded against: even via innerHTML the
        // escaped string must not produce an executable <script> element.
        host.innerHTML = `<div>${escapeHtml('<img src=x onerror=alert(1)>')}</div>`;
        expect(host.querySelector('img')).toBeNull();
        expect(host.textContent).toContain('<img src=x onerror=alert(1)>');
    });

    it('returns empty string for null/undefined', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });
});

describe('validateInputLength', () => {
    it('preserves angle brackets, code and math verbatim (no mutation)', () => {
        const text = 'if (a < b && b > c) return `<div>${x}</div>`;';
        const result = validateInputLength(text);
        expect(result.ok).toBe(true);
        expect(result.value).toBe(text);
    });

    it('accepts input exactly at the limit', () => {
        const text = 'a'.repeat(MAX_INPUT_CHARS);
        expect(validateInputLength(text).ok).toBe(true);
    });

    it('rejects input over the limit with a typed code (no silent truncation)', () => {
        const text = 'a'.repeat(MAX_INPUT_CHARS + 1);
        const result = validateInputLength(text);
        expect(result).toMatchObject({
            ok: false,
            code: 'INPUT_TOO_LONG',
            limit: MAX_INPUT_CHARS,
            length: MAX_INPUT_CHARS + 1
        });
    });

    it('honors a custom limit', () => {
        expect(validateInputLength('hello', 3).ok).toBe(false);
        expect(validateInputLength('hi', 3).ok).toBe(true);
    });
});
