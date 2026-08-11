import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname || __dirname, '..');
const LOCALES_DIR = path.join(ROOT, '_locales');

// Source directories that ship UI strings. Anything user-visible in here must
// come from chrome.i18n, so localized text has no business being hardcoded.
const UI_DIRS = ['popup', 'content', 'background', 'sidepanel', 'lib'];
const UI_EXTENSIONS = ['.js', '.html'];
const POLISH_CHARS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

function walkUiFiles(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkUiFiles(full, out);
        else if (UI_EXTENSIONS.some(ext => entry.name.endsWith(ext))) out.push(full);
    }
    return out;
}

function loadLocale(locale) {
    const filePath = path.join(LOCALES_DIR, locale, 'messages.json');
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function getLocales() {
    return fs.readdirSync(LOCALES_DIR).filter(d =>
        fs.statSync(path.join(LOCALES_DIR, d)).isDirectory()
    );
}

describe('i18n locale completeness', () => {
    const enMessages = loadLocale('en');
    const enKeys = Object.keys(enMessages).sort();
    const locales = getLocales().filter(l => l !== 'en');

    test('en locale has keys', () => {
        expect(enKeys.length).toBeGreaterThan(0);
    });

    for (const locale of locales) {
        test(`${locale} has all keys from en`, () => {
            const messages = loadLocale(locale);
            const localeKeys = Object.keys(messages).sort();
            const missing = enKeys.filter(k => !localeKeys.includes(k));

            expect(missing, `Missing keys in ${locale}: ${missing.join(', ')}`).toEqual([]);
        });

        test(`${locale} has no extra keys beyond en`, () => {
            const messages = loadLocale(locale);
            const localeKeys = Object.keys(messages);
            const extra = localeKeys.filter(k => !enKeys.includes(k));

            expect(extra, `Extra keys in ${locale}: ${extra.join(', ')}`).toEqual([]);
        });

        test(`${locale} has non-empty messages`, () => {
            const messages = loadLocale(locale);
            const empty = Object.entries(messages)
                .filter(([, v]) => !v.message || v.message.trim() === '')
                .map(([k]) => k);

            expect(empty, `Empty messages in ${locale}: ${empty.join(', ')}`).toEqual([]);
        });
    }

    test('en messages all have non-empty message field', () => {
        const empty = Object.entries(enMessages)
            .filter(([, v]) => !v.message || v.message.trim() === '')
            .map(([k]) => k);

        expect(empty).toEqual([]);
    });

    test('en messages all have valid JSON structure', () => {
        for (const [key, value] of Object.entries(enMessages)) {
            expect(value, `Key "${key}" must be an object`).toBeTypeOf('object');
            expect(value.message, `Key "${key}" must have a "message" field`).toBeDefined();
        }
    });
});

describe('UI source carries no hardcoded localized strings', () => {
    test('no Polish text outside _locales', () => {
        const offenders = [];
        for (const dir of UI_DIRS) {
            for (const file of walkUiFiles(path.join(ROOT, dir))) {
                const lines = fs.readFileSync(file, 'utf-8').split('\n');
                lines.forEach((line, i) => {
                    if (POLISH_CHARS.test(line)) {
                        offenders.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
                    }
                });
            }
        }

        expect(offenders, `Hardcoded Polish strings:\n${offenders.join('\n')}`).toEqual([]);
    });
});
