import { describe, it, expect, vi } from 'vitest';
import { APIClient, CHROME_AI_PROVIDER, CHROME_AI_MODEL_ID } from '../lib/api-client.js';
import { MODELS, DEPRECATED_MODELS, DEFAULT_MODELS } from '../popup/modules/constants.js';
import { PerformanceOptimizer } from '../lib/performance-optimizer.js';

const mockModels = {
    generateContent: vi.fn().mockResolvedValue({ text: 'gemini response' }),
    generateContentStream: vi.fn().mockImplementation(() => (async function*() {
        yield { text: 'chunk1' };
        yield { text: 'chunk2' };
    })()),
};

vi.mock('@google/genai', () => ({
    GoogleGenAI: vi.fn().mockImplementation(function () { this.models = mockModels; })
}));

const makeClient = (state = {}) => new APIClient({ state });

describe('APIClient.normalizeProvider', () => {
    const client = makeClient();

    it('maps the retired free tier and unknowns to chrome-ai', () => {
        expect(client.normalizeProvider('builtin')).toBe(CHROME_AI_PROVIDER);
        expect(client.normalizeProvider(undefined)).toBe(CHROME_AI_PROVIDER);
        expect(client.normalizeProvider('whatever')).toBe(CHROME_AI_PROVIDER);
    });

    it('keeps BYOK providers intact', () => {
        expect(client.normalizeProvider('openai')).toBe('openai');
        expect(client.normalizeProvider('gemini')).toBe('gemini');
    });
});

describe('APIClient.getEffectiveConfig', () => {
    it('returns the keyless on-device config for chrome-ai', async () => {
        const config = await makeClient({ apiProvider: 'chrome-ai' }).getEffectiveConfig();
        expect(config).toEqual({ provider: CHROME_AI_PROVIDER, key: null, model: CHROME_AI_MODEL_ID });
    });

    it('migrates a stored legacy builtin provider to chrome-ai', async () => {
        const config = await makeClient({ apiProvider: 'builtin' }).getEffectiveConfig();
        expect(config.provider).toBe(CHROME_AI_PROVIDER);
        expect(config.key).toBeNull();
    });

    it('resolves an OpenAI key and default model', async () => {
        const config = await makeClient({ apiProvider: 'openai', openaiApiKey: 'sk-test' }).getEffectiveConfig();
        expect(config).toMatchObject({ provider: 'openai', key: 'sk-test' });
        expect(config.model).toBeTruthy();
    });

    it('falls back to the legacy userApiKey for Gemini', async () => {
        const config = await makeClient({ apiProvider: 'gemini', userApiKey: 'legacy-key' }).getEffectiveConfig();
        expect(config).toMatchObject({ provider: 'gemini', key: 'legacy-key' });
    });

    it('throws a typed NO_API_KEY error when a BYOK provider has no key', async () => {
        await expect(makeClient({ apiProvider: 'openai' }).getEffectiveConfig())
            .rejects.toMatchObject({ code: 'NO_API_KEY' });
    });
});

describe('APIClient helpers', () => {
    const client = makeClient();

    it('maps language codes to names with an English fallback', () => {
        expect(client.getLanguageName('pl')).toBe('Polish');
        expect(client.getLanguageName('zz')).toBe('English');
    });

    it('builds tone directives only for known tones', () => {
        expect(client.getToneInstruction('formal')).toContain('formal register');
        expect(client.getToneInstruction('auto')).toBe('');
        expect(client.getToneInstruction(undefined)).toBe('');
    });
});

describe('Model registry', () => {
    const allModelIds = Object.values(MODELS).flatMap(arr => arr.map(m => m.id));

    it('never contains a deprecated model', () => {
        const overlap = allModelIds.filter(id => DEPRECATED_MODELS.includes(id));
        expect(overlap).toEqual([]);
    });

    it('has at least one model per provider', () => {
        for (const [provider, models] of Object.entries(MODELS)) {
            expect(models.length).toBeGreaterThan(0);
        }
    });

    it('default models exist in their provider lists', () => {
        for (const [provider, defaultId] of Object.entries(DEFAULT_MODELS)) {
            expect(MODELS[provider].find(m => m.id === defaultId)).toBeTruthy();
        }
    });

    it('migrates an unknown/deprecated stored model to the provider default', async () => {
        const config = await makeClient({
            apiProvider: 'gemini',
            geminiApiKey: 'test-key',
            selectedModel: 'gemini-2.0-flash'
        }).getEffectiveConfig();
        expect(config.model).toBe(DEFAULT_MODELS.gemini);
    });
});

describe('APIClient operation routing', () => {
    function makeAiClient(state = {}) {
        const client = makeClient(state);
        const kinds = [];
        const calls = [];
        client.chromeAI.run = async (args) => { kinds.push(args.kind); calls.push(args); return 'out'; };
        client.optimizer = {
            generateCacheKey: () => Math.random().toString(),
            getCache: () => null,
            setCache: () => {},
            retryWithBackoff: (fn) => fn()
        };
        return { client, kinds, calls };
    }

    it('correct() uses the correct chromeAI kind', async () => {
        const { client, kinds } = makeAiClient({ apiProvider: 'chrome-ai' });
        await client.correct('test text', 'en');
        expect(kinds).toContain('correct');
    });

    it('translate() uses the translate chromeAI kind', async () => {
        const { client, kinds } = makeAiClient({ apiProvider: 'chrome-ai' });
        await client.translate('hello', 'pl');
        expect(kinds).toContain('translate');
    });

    it('correct() declares the text language on both sides and forwards the text', async () => {
        const { client, calls } = makeAiClient({ apiProvider: 'chrome-ai' });
        await client.correct('tekst', 'pl');
        expect(calls[0]).toMatchObject({ kind: 'correct', sourceLang: 'pl', targetLang: 'pl', text: 'tekst' });
    });

    it('generatePrompt() forwards the user-selected source language, not the target', async () => {
        const { client, calls } = makeAiClient({ apiProvider: 'chrome-ai' });
        await client.generatePrompt('pomysł na zdjęcie', 'en', 'image-photo', { sourceLang: 'pl' });
        expect(calls[0]).toMatchObject({ kind: 'generate', sourceLang: 'pl', text: 'pomysł na zdjęcie' });
    });

    it('generatePrompt() defaults to auto when no source language is given', async () => {
        const { client, calls } = makeAiClient({ apiProvider: 'chrome-ai' });
        await client.generatePrompt('an idea', 'en', 'image-photo');
        expect(calls[0].sourceLang).toBe('auto');
    });

    it('generatePrompt() supports all specialized graphic, video, and code types', async () => {
        const { client, calls } = makeAiClient({ apiProvider: 'chrome-ai' });
        const types = [
            'image-photo', 'image-graphic', 'image-enhance',
            'ui-web', 'ui-mobile', 'ui-collage',
            'video-cinematic', 'video-i2v', 'video-product', 'video-social', 'video-loop',
            'code-agent', 'code-ui-aesthetic'
        ];

        for (const type of types) {
            await client.generatePrompt('test prompt idea', 'pl', type);
        }

        expect(calls.length).toBe(types.length);
        calls.forEach(call => {
            expect(call.kind).toBe('generate');
            expect(call.targetLang).toBe('pl');
        });
    });

    it('generatePrompt() includes aspectRatio and cameraMotion in options', async () => {
        const client = makeClient({ apiProvider: 'openai', openaiApiKey: 'test-key' });
        let capturedArgs = null;
        client._runText = (args) => {
            capturedArgs = args;
            return Promise.resolve('ok');
        };

        await client.generatePrompt('scenic view', 'en', 'video-cinematic', {
            aspectRatio: '16:9',
            cameraMotion: 'zoom-in'
        });

        expect(capturedArgs.systemInstruction).toContain('Aspect ratio: 16:9');
        expect(capturedArgs.systemInstruction).toContain('Camera Motion: zoom-in');
        expect(capturedArgs.cacheParams.aspectRatio).toBe('16:9');
        expect(capturedArgs.cacheParams.cameraMotion).toBe('zoom-in');
    });

    it('generatePrompt() for ui-collage defaults to 16:9 widescreen format and clean mockup', async () => {
        const client = makeClient({ apiProvider: 'openai', openaiApiKey: 'test-key' });
        let capturedArgs = null;
        client._runText = (args) => {
            capturedArgs = args;
            return Promise.resolve('ok');
        };

        await client.generatePrompt('fitness tracker app', 'en', 'ui-collage');

        expect(capturedArgs.systemInstruction).toContain('Aspect ratio: 16:9');
        expect(capturedArgs.systemInstruction).toContain('4-screen');
        expect(capturedArgs.systemInstruction).toContain('NO hands');
    });

    it('correct() and translate() invoke different operations', async () => {
        const { client, kinds } = makeAiClient({ apiProvider: 'chrome-ai' });
        await client.translate('hi', 'en');
        await client.correct('hi', 'en');
        expect(kinds[0]).not.toBe(kinds[1]);
    });
});

describe('Gemini SDK integration', () => {
    function makeGeminiClient(state = {}) {
        const client = makeClient({
            apiProvider: 'gemini',
            geminiApiKey: 'test-key',
            ...state
        });
        client.optimizer = {
            generateCacheKey: () => Math.random().toString(),
            getCache: () => null,
            setCache: () => {},
            retryWithBackoff: (fn) => fn()
        };
        return client;
    }

    it('uses @google/genai (not the legacy SDK)', async () => {
        const { GoogleGenAI } = await import('@google/genai');
        const client = makeGeminiClient();
        await client.callGemini('system', 'prompt');
        expect(GoogleGenAI).toHaveBeenCalled();
    });

    it('callGemini returns text from non-streaming response', async () => {
        const client = makeGeminiClient();
        const result = await client.callGemini('system', 'translate this');
        expect(result).toBe('gemini response');
    });

    it('callGemini streams chunks via onStream callback', async () => {
        const client = makeGeminiClient();
        const chunks = [];
        await client.callGemini('system', 'stream this', {
            onStream: (acc, delta) => chunks.push(delta)
        });
        expect(chunks).toEqual(['chunk1', 'chunk2']);
    });

    it('callGemini passes abortSignal to config', async () => {
        const client = makeGeminiClient();
        const controller = new AbortController();
        await client.callGemini('system', 'prompt', { signal: controller.signal });
        const callArgs = mockModels.generateContent.mock.calls.at(-1)[0];
        expect(callArgs.config.abortSignal).toBe(controller.signal);
    });

    it('callGeminiVision sends inline image data', async () => {
        const client = makeGeminiClient();
        const result = await client.callGeminiVision('describe', 'what is this', 'data:image/png;base64,abc123', { model: 'gemini-3.5-flash' });
        expect(result).toBe('gemini response');
        const callArgs = mockModels.generateContent.mock.calls.at(-1)[0];
        expect(callArgs.contents).toEqual(expect.arrayContaining([
            expect.objectContaining({ inlineData: { mimeType: 'image/png', data: 'abc123' } })
        ]));
    });

    it('callGemini rejects empty non-streaming response', async () => {
        mockModels.generateContent.mockResolvedValueOnce({ text: '   ' });
        const client = makeGeminiClient();
        await expect(client.callGemini('system', 'prompt'))
            .rejects.toMatchObject({ code: 'EMPTY_RESPONSE' });
    });

    it('callGemini preserves HTTP status on SDK errors', async () => {
        const sdkError = new Error('Rate limited');
        sdkError.status = 429;
        sdkError.code = 'RESOURCE_EXHAUSTED';
        mockModels.generateContent.mockRejectedValueOnce(sdkError);
        const client = makeGeminiClient();
        await expect(client.callGemini('system', 'prompt'))
            .rejects.toMatchObject({ status: 429, providerCode: 'RESOURCE_EXHAUSTED' });
    });
});

describe('APIClient.validateInput', () => {
    const client = makeClient();

    it('returns the text verbatim within the limit (no mutation)', () => {
        const text = 'keep <tags> and a < b';
        expect(client.validateInput(text)).toBe(text);
    });

    it('throws a typed INPUT_TOO_LONG error over the limit', () => {
        let thrown;
        try {
            client.validateInput('x'.repeat(5001));
        } catch (error) {
            thrown = error;
        }
        expect(thrown).toBeInstanceOf(Error);
        expect(thrown.code).toBe('INPUT_TOO_LONG');
        expect(thrown.limit).toBe(5000);
    });
});

describe('PerformanceOptimizer.isRetryable', () => {
    it('does not retry AbortError', () => {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        expect(PerformanceOptimizer.isRetryable(err)).toBe(false);
    });

    it('does not retry 401 (auth)', () => {
        const err = new Error('Unauthorized');
        err.status = 401;
        expect(PerformanceOptimizer.isRetryable(err)).toBe(false);
    });

    it('does not retry 400 (bad request)', () => {
        const err = new Error('Bad request');
        err.status = 400;
        expect(PerformanceOptimizer.isRetryable(err)).toBe(false);
    });

    it('does not retry errors with application code', () => {
        const err = new Error('No key');
        err.code = 'NO_API_KEY';
        expect(PerformanceOptimizer.isRetryable(err)).toBe(false);
    });

    it('retries 429 (rate limit)', () => {
        const err = new Error('Rate limited');
        err.status = 429;
        expect(PerformanceOptimizer.isRetryable(err)).toBe(true);
    });

    it('retries 500 (server error)', () => {
        const err = new Error('Internal');
        err.status = 500;
        expect(PerformanceOptimizer.isRetryable(err)).toBe(true);
    });

    it('retries network errors', () => {
        const err = new Error('Failed to fetch');
        expect(PerformanceOptimizer.isRetryable(err)).toBe(true);
    });
});

describe('Cache key includes provider and model', () => {
    it('produces different keys for different models with same input', () => {
        const optimizer = new PerformanceOptimizer();
        const params = { text: 'hello', targetLang: 'pl' };
        const key1 = optimizer.generateCacheKey('translate', { ...params, provider: 'openai', model: 'gpt-5.6-luna' });
        const key2 = optimizer.generateCacheKey('translate', { ...params, provider: 'openai', model: 'gpt-5.6-terra' });
        expect(key1).not.toBe(key2);
    });

    it('produces different keys for different providers with same input', () => {
        const optimizer = new PerformanceOptimizer();
        const params = { text: 'hello', targetLang: 'pl', model: 'any' };
        const key1 = optimizer.generateCacheKey('translate', { ...params, provider: 'openai' });
        const key2 = optimizer.generateCacheKey('translate', { ...params, provider: 'gemini' });
        expect(key1).not.toBe(key2);
    });

    it('produces different keys when prompt version changes', () => {
        const optimizer = new PerformanceOptimizer();
        const params = { text: 'hello', targetLang: 'pl', provider: 'openai', model: 'gpt-5.6-luna' };
        const key1 = optimizer.generateCacheKey('translate', { ...params, promptVersion: 1 });
        const key2 = optimizer.generateCacheKey('translate', { ...params, promptVersion: 2 });
        expect(key1).not.toBe(key2);
    });
});
