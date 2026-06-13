/**
 * Shared, dependency-free safety helpers.
 *
 * Security model: untrusted text (model output, OCR, user input, system voice
 * names) must never reach an `innerHTML` sink unescaped. Prefer building DOM
 * with `textContent`; use `escapeHtml` only when a string template is
 * unavoidable. This module is the single source of truth for both, so the
 * regression tests have one place to guard.
 */

export const MAX_INPUT_CHARS = 5000;

const HTML_ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '`': '&#x60;'
};

const HTML_ESCAPE_RE = /[&<>"'`]/g;

/**
 * Escape a value for safe interpolation into an HTML string.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(HTML_ESCAPE_RE, (char) => HTML_ESCAPE_MAP[char]);
}

/**
 * Validate input length WITHOUT mutating the content.
 *
 * The legacy `sanitizeInput` stripped `<`/`>` and silently truncated, which
 * corrupted code, markup and math (`a < b`). We now preserve the text verbatim
 * and surface an explicit, typed result the UI can translate.
 *
 * @param {unknown} text
 * @param {number} [maxChars=MAX_INPUT_CHARS]
 * @returns {{ ok: true, value: string } | { ok: false, code: 'INPUT_TOO_LONG', limit: number, length: number }}
 */
export function validateInputLength(text, maxChars = MAX_INPUT_CHARS) {
    const value = typeof text === 'string' ? text : String(text ?? '');
    if (value.length > maxChars) {
        return { ok: false, code: 'INPUT_TOO_LONG', limit: maxChars, length: value.length };
    }
    return { ok: true, value };
}
