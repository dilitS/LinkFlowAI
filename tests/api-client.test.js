import { describe, it, expect } from 'vitest';
import { APIClient, CHROME_AI_PROVIDER, CHROME_AI_MODEL_ID } from '../lib/api-client.js';

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
