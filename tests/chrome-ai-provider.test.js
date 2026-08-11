import { describe, it, expect, afterEach, vi } from 'vitest';
import { ChromeAIProvider, CHROME_AI_ERRORS, PROMPT_API_LANGUAGES, expectedInputLanguages } from '../lib/chrome-ai-provider.js';

const GLOBAL_KEYS = ['Translator', 'LanguageDetector', 'LanguageModel'];

afterEach(() => {
    for (const key of GLOBAL_KEYS) delete globalThis[key];
    vi.restoreAllMocks();
});

describe('ChromeAIProvider capability detection', () => {
    it('reports unsupported when no globals are present', () => {
        const provider = new ChromeAIProvider();
        expect(provider.hasTranslator()).toBe(false);
        expect(provider.hasLanguageModel()).toBe(false);
        expect(provider.isSupported()).toBe(false);
    });

    it('reports supported when at least one surface exists', () => {
        globalThis.LanguageModel = {};
        const provider = new ChromeAIProvider();
        expect(provider.isSupported()).toBe(true);
    });
});

describe('ChromeAIProvider.translateText', () => {
    it('short-circuits when source equals target (no API call)', async () => {
        globalThis.Translator = { availability: vi.fn(), create: vi.fn() };
        const provider = new ChromeAIProvider();
        const out = await provider.translateText({ text: 'hej', sourceLang: 'pl', targetLang: 'pl' });
        expect(out).toBe('hej');
        expect(globalThis.Translator.create).not.toHaveBeenCalled();
    });

    it('flags an unsupported pair so the caller can fall back', async () => {
        globalThis.Translator = { availability: vi.fn().mockResolvedValue('unavailable'), create: vi.fn() };
        const provider = new ChromeAIProvider();
        await expect(
            provider.translateText({ text: 'hello', sourceLang: 'en', targetLang: 'pl' })
        ).rejects.toMatchObject({ code: CHROME_AI_ERRORS.PAIR_UNSUPPORTED });
    });

    it('translates via the Translator API when available', async () => {
        const translate = vi.fn().mockResolvedValue('cześć');
        globalThis.Translator = {
            availability: vi.fn().mockResolvedValue('available'),
            create: vi.fn().mockResolvedValue({ translate, destroy: vi.fn() })
        };
        const provider = new ChromeAIProvider();
        const out = await provider.translateText({ text: 'hello', sourceLang: 'en', targetLang: 'pl' });
        expect(out).toBe('cześć');
        expect(translate).toHaveBeenCalledWith('hello');
    });
});

describe('ChromeAIProvider.generateText', () => {
    it('throws CHROME_AI_UNAVAILABLE without the Prompt API', async () => {
        const provider = new ChromeAIProvider();
        await expect(provider.generateText({ prompt: 'hi' }))
            .rejects.toMatchObject({ code: CHROME_AI_ERRORS.UNAVAILABLE });
    });

    it('runs a prompt through the Prompt API', async () => {
        const prompt = vi.fn().mockResolvedValue('result');
        globalThis.LanguageModel = {
            availability: vi.fn().mockResolvedValue('available'),
            create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() })
        };
        const provider = new ChromeAIProvider();
        const out = await provider.generateText({ systemInstruction: 'sys', prompt: 'go' });
        expect(out).toBe('result');
        expect(prompt).toHaveBeenCalled();
    });
});

describe('ChromeAIProvider language validation', () => {
    it('passes expectedInputs/expectedOutputs to availability', async () => {
        const availabilitySpy = vi.fn().mockResolvedValue('available');
        globalThis.LanguageModel = {
            availability: availabilitySpy,
            create: vi.fn().mockResolvedValue({ prompt: vi.fn().mockResolvedValue('ok'), destroy: vi.fn() })
        };
        const provider = new ChromeAIProvider();
        await provider.generateText({ prompt: 'test', inputLang: 'en', outputLang: 'ja' });
        const calledWith = availabilitySpy.mock.calls[0][0];
        expect(calledWith.expectedInputs).toBeDefined();
        expect(calledWith.expectedOutputs).toBeDefined();
        expect(calledWith.expectedOutputs[0].languages).toContain('ja');
    });

    it('throws when model reports unavailable for language', async () => {
        globalThis.LanguageModel = {
            availability: vi.fn().mockResolvedValue('unavailable'),
            create: vi.fn()
        };
        const provider = new ChromeAIProvider();
        await expect(
            provider.generateText({ prompt: 'test', inputLang: 'pl', outputLang: 'pl' })
        ).rejects.toMatchObject({ code: CHROME_AI_ERRORS.UNAVAILABLE });
    });

    it('lists known supported languages', () => {
        expect(PROMPT_API_LANGUAGES).toContain('en');
        expect(PROMPT_API_LANGUAGES).toContain('ja');
        expect(PROMPT_API_LANGUAGES.length).toBeGreaterThanOrEqual(5);
    });

    it('always declares the English system prompt alongside the input language', () => {
        expect(expectedInputLanguages('de')).toEqual(['en', 'de']);
        expect(expectedInputLanguages('en')).toEqual(['en']);
        expect(expectedInputLanguages(undefined)).toEqual(['en']);
        expect(expectedInputLanguages('auto')).toEqual(['en']);
        expect(expectedInputLanguages('de', 'de')).toEqual(['en', 'de']);
    });

    it('declares en + input language on both availability and create', async () => {
        const availability = vi.fn().mockResolvedValue('available');
        const create = vi.fn().mockResolvedValue({ prompt: vi.fn().mockResolvedValue('ok'), destroy: vi.fn() });
        globalThis.LanguageModel = { availability, create };

        const provider = new ChromeAIProvider();
        await provider.generateText({ prompt: 'test', inputLang: 'de', outputLang: 'de' });

        for (const args of [availability.mock.calls[0][0], create.mock.calls[0][0]]) {
            expect(args.expectedInputs[0].languages).toEqual(['en', 'de']);
            expect(args.expectedOutputs[0].languages).toEqual(['de']);
        }
    });
});

describe('ChromeAIProvider.run', () => {
    it('falls back to the Prompt API when the translation pair is unsupported', async () => {
        globalThis.Translator = { availability: vi.fn().mockResolvedValue('unavailable'), create: vi.fn() };
        const prompt = vi.fn().mockResolvedValue('prompt-translation');
        globalThis.LanguageModel = {
            availability: vi.fn().mockResolvedValue('available'),
            create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() })
        };

        const provider = new ChromeAIProvider();
        const out = await provider.run({
            kind: 'translate',
            text: 'hello',
            sourceLang: 'en',
            targetLang: 'pl',
            systemInstruction: 'translate this',
            prompt: 'Translate: hello'
        });

        expect(out).toBe('prompt-translation');
        expect(prompt).toHaveBeenCalled();
    });

    it('passes the detected language to the Prompt API when the source is auto', async () => {
        globalThis.Translator = { availability: vi.fn().mockResolvedValue('unavailable'), create: vi.fn() };
        globalThis.LanguageDetector = {
            availability: vi.fn().mockResolvedValue('available'),
            create: vi.fn().mockResolvedValue({
                detect: vi.fn().mockResolvedValue([{ detectedLanguage: 'de', confidence: 0.9 }]),
                destroy: vi.fn()
            })
        };
        const create = vi.fn().mockResolvedValue({ prompt: vi.fn().mockResolvedValue('ok'), destroy: vi.fn() });
        globalThis.LanguageModel = { availability: vi.fn().mockResolvedValue('available'), create };

        const provider = new ChromeAIProvider();
        await provider.run({
            kind: 'translate',
            text: 'Guten Tag',
            sourceLang: 'auto',
            targetLang: 'ja',
            systemInstruction: 'translate this',
            prompt: 'Translate: Guten Tag'
        });

        expect(create.mock.calls[0][0].expectedInputs[0].languages).toEqual(['en', 'de']);
    });

    it('resolves auto for prompt generation before hitting the Prompt API', async () => {
        globalThis.LanguageDetector = {
            availability: vi.fn().mockResolvedValue('available'),
            create: vi.fn().mockResolvedValue({
                detect: vi.fn().mockResolvedValue([{ detectedLanguage: 'es', confidence: 0.9 }]),
                destroy: vi.fn()
            })
        };
        const create = vi.fn().mockResolvedValue({ prompt: vi.fn().mockResolvedValue('ok'), destroy: vi.fn() });
        globalThis.LanguageModel = { availability: vi.fn().mockResolvedValue('available'), create };

        const provider = new ChromeAIProvider();
        await provider.run({
            kind: 'generate',
            text: 'una idea',
            sourceLang: 'auto',
            targetLang: 'en',
            systemInstruction: 'sys',
            prompt: 'go'
        });

        expect(create.mock.calls[0][0].expectedInputs[0].languages).toEqual(['en', 'es']);
    });

    it('blocks correct for unsupported Prompt API language', async () => {
        globalThis.LanguageModel = {
            availability: vi.fn().mockResolvedValue('unavailable'),
            create: vi.fn()
        };
        const provider = new ChromeAIProvider();
        await expect(provider.run({
            kind: 'correct',
            sourceLang: 'pl',
            targetLang: 'pl',
            prompt: 'fix'
        })).rejects.toMatchObject({ code: CHROME_AI_ERRORS.UNAVAILABLE });
    });
});
