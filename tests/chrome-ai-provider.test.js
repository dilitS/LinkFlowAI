import { describe, it, expect, afterEach, vi } from 'vitest';
import { ChromeAIProvider, CHROME_AI_ERRORS } from '../lib/chrome-ai-provider.js';

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
});
