import { describe, it, expect, vi } from 'vitest';

vi.mock('@google/genai', () => ({ GoogleGenAI: vi.fn() }));

const { runChecks } = await import('../scripts/eval-prompts.mjs');

describe('eval runChecks', () => {
    it('passes when every check holds', () => {
        const failures = runChecks({
            contains: ['KOT'],
            notContains: ['8k'],
            mustKeep: ['{name}'],
            startsWith: '##',
            regex: 'kot',
            minWords: 2,
            maxWords: 10
        }, 'in', '## Kot {name} na dachu');
        expect(failures).toEqual([]);
    });

    it('reports each failed check', () => {
        const failures = runChecks({
            contains: ['pies'],
            notContains: ['kot'],
            mustKeep: ['{name}'],
            unchanged: true,
            sameParagraphs: true
        }, 'a\n\nb', 'kot');
        expect(failures).toHaveLength(5);
    });
});
