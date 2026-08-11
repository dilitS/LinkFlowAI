import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const LOCALES_DIR = path.resolve(import.meta.dirname || __dirname, '..', '_locales');

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
