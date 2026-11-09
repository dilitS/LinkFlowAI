import { describe, it, expect } from 'vitest';
import { diffWords, countChanges, tokenize } from '../lib/text-diff.js';

const join = (parts, types) => parts.filter(p => types.includes(p.type)).map(p => p.text).join('');

describe('diffWords', () => {
    it('returns a single equal part for identical text', () => {
        expect(diffWords('Ala ma kota.', 'Ala ma kota.')).toEqual([{ type: 'equal', text: 'Ala ma kota.' }]);
    });

    it('marks replaced words and keeps both sides reconstructible', () => {
        const before = 'Wczoraj poszlem do sklepu, niewiem czemu.';
        const after = 'Wczoraj poszedłem do sklepu, nie wiem czemu.';
        const parts = diffWords(before, after);
        expect(join(parts, ['equal', 'delete'])).toBe(before);
        expect(join(parts, ['equal', 'insert'])).toBe(after);
        expect(parts).toContainEqual({ type: 'delete', text: 'poszlem' });
        expect(parts).toContainEqual({ type: 'insert', text: 'poszedłem' });
        expect(countChanges(parts)).toBe(2);
    });

    it('handles pure insertions and deletions', () => {
        const ins = diffWords('to jest test', 'to jest dobry test');
        expect(ins).toContainEqual({ type: 'insert', text: 'dobry ' });
        expect(countChanges(ins)).toBe(1);

        const del = diffWords('to jest bardzo dobry test', 'to jest dobry test');
        expect(del).toContainEqual({ type: 'delete', text: 'bardzo ' });
    });

    it('handles empty inputs', () => {
        expect(diffWords('', 'nowy tekst')).toEqual([{ type: 'insert', text: 'nowy tekst' }]);
        expect(diffWords('stary', '')).toEqual([{ type: 'delete', text: 'stary' }]);
        expect(tokenize('')).toEqual([]);
    });

    it('preserves line breaks as tokens', () => {
        const parts = diffWords('a\nb', 'a\nc');
        expect(join(parts, ['equal', 'insert'])).toBe('a\nc');
    });
});
