import { GoogleGenAI } from '@google/genai';
import { errorHandler } from './error-handler.js';
import { performanceOptimizer } from './performance-optimizer.js';
import { validateInputLength, getInputLimit } from './sanitize.js';
import { ChromeAIProvider } from './chrome-ai-provider.js';
import { MODELS, DEFAULT_MODELS, CHROME_AI_PROVIDER, CHROME_AI_MODEL_ID, PROMPT_VERSION } from '../popup/modules/constants.js';
import { GEN_SETTINGS, OCR_SCHEMA, buildTranslatePrompt, buildCorrectPrompt, buildGeneratePrompt, buildOcrPrompt } from './prompts.js';

export { CHROME_AI_PROVIDER, CHROME_AI_MODEL_ID };

export class APIClient {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.defaultApiKey = null; // No default key - users must provide their own

        this.OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

        this.MODELS = MODELS;
        this.DEFAULT_GEMINI_MODEL = DEFAULT_MODELS.gemini;
        this.DEFAULT_OPENAI_MODEL = DEFAULT_MODELS.openai;

        // On-device provider (free tier).
        this.chromeAI = new ChromeAIProvider();

        // Gemini client (will be initialized when needed)
        this.geminiClient = null;

        // Performance optimization
        this.errorHandler = errorHandler;
        this.optimizer = performanceOptimizer;
    }

    /**
     * Normalize a stored provider id to a currently-supported one.
     * Legacy free tier (`builtin` = OpenRouter via proxy) and missing values
     * map to the on-device Chrome AI free tier.
     * @param {string|undefined} provider
     * @returns {'chrome-ai'|'openai'|'gemini'}
     */
    normalizeProvider(provider) {
        if (provider === 'openai' || provider === 'gemini') return provider;
        return CHROME_AI_PROVIDER;
    }

    async getEffectiveConfig() {
        const { userApiKey, openaiApiKey, geminiApiKey, apiProvider, selectedModel } = this.stateManager.state;
        const provider = this.normalizeProvider(apiProvider);

        // Free, on-device tier: no key, no network, no model selection.
        if (provider === CHROME_AI_PROVIDER) {
            return { provider: CHROME_AI_PROVIDER, key: null, model: CHROME_AI_MODEL_ID };
        }

        let modelId = selectedModel;
        if (!modelId || !this.MODELS[provider]?.find(m => m.id === modelId)) {
            modelId = DEFAULT_MODELS[provider] || this.MODELS[provider]?.[0]?.id;
        }

        let key = null;
        if (provider === 'openai') {
            key = openaiApiKey || userApiKey; // Fallback to userApiKey for backward compatibility
        } else if (provider === 'gemini') {
            key = geminiApiKey || userApiKey; // Fallback to userApiKey for backward compatibility
        }

        if (key) {
            return { key, provider, model: modelId };
        }

        const error = new Error('API key required. Please add your API key in Settings.');
        error.code = 'NO_API_KEY';
        throw error;
    }

    getLanguageName(code) {
        const languageMap = {
            'en': 'English',
            'pl': 'Polish',
            'de': 'German',
            'es': 'Spanish',
            'fr': 'French',
            'it': 'Italian',
            'pt': 'Portuguese',
            'nl': 'Dutch',
            'uk': 'Ukrainian',
            'cs': 'Czech',
            'sk': 'Slovak',
            'hu': 'Hungarian',
            'ro': 'Romanian',
            'bg': 'Bulgarian',
            'el': 'Greek',
            'tr': 'Turkish',
            'sv': 'Swedish',
            'no': 'Norwegian',
            'da': 'Danish',
            'fi': 'Finnish',
            'ja': 'Japanese',
            'ko': 'Korean',
            'zh': 'Chinese (Simplified)',
            'ru': 'Russian',
            'ar': 'Arabic',
            'hi': 'Hindi',
            'auto': 'the same language as the source text'
        };
        if (languageMap[code]) return languageMap[code];
        // Unknown codes must not silently become English.
        try {
            return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code;
        } catch {
            return code || 'English';
        }
    }

    /**
     * Validate user input length WITHOUT mutating the content.
     *
     * The previous implementation stripped `<`/`>` and silently truncated at
     * 5000 chars, which corrupted code, markup and math (e.g. `a < b`). We now
     * preserve the text verbatim and throw a typed error the UI can localize.
     *
     * @param {string} text
     * @returns {string} the unmodified input
     * @throws {Error & { code: 'INPUT_TOO_LONG' }} when over the limit
     */
    validateInput(text) {
        const provider = this.normalizeProvider(this.stateManager.state?.apiProvider);
        const result = validateInputLength(text, getInputLimit(provider));
        if (!result.ok) {
            const error = new Error(this.errorHandler.messageForCode('INPUT_TOO_LONG', { limit: result.limit }));
            error.code = result.code;
            error.limit = result.limit;
            error.length = result.length;
            throw error;
        }
        return result.value;
    }

    /**
     * Core text-generation dispatcher shared by translate/correct/prompt.
     * Transparently supports streaming (Gemini & OpenAI), graceful fallback for
     * the free tier, response caching, retry-with-backoff and cancellation.
     *
     * @param {Object} args
     * @param {string} args.operation - cache namespace ('translate'|'correct'|'prompt')
     * @param {string} args.systemInstruction
     * @param {string} args.prompt
     * @param {Object} args.cacheParams - params used to build the cache key
     * @param {Object} args.genConfig - GEN_SETTINGS entry: { thinkingLevel, reasoningEffort, maxOutputTokens, temperature }
     * @param {Object} args.options - { onStream, signal, force }
     * @param {string} args.context - human label for error messages
     * @returns {Promise<string>}
     */
    async _runText({ operation, systemInstruction, prompt, cacheParams, genConfig, options = {}, context, chromeAI }) {
        const { onStream, signal, force = false, onProgress, onNotice } = options;

        try {
            let config = await this.getEffectiveConfig();
            const cacheKeyFor = (cfg) => this.optimizer.generateCacheKey(operation, {
                ...cacheParams,
                provider: cfg.provider,
                model: cfg.model,
                promptVersion: PROMPT_VERSION
            });

            if (!force) {
                const cached = await this.optimizer.getResponse(cacheKeyFor(config));
                if (cached) {
                    if (onStream) onStream(cached, cached);
                    return cached;
                }
            }

            const dispatch = async (cfg, gen, meta) => {
                if (cfg.provider === CHROME_AI_PROVIDER) {
                    // On-device: Translator API for translation (Prompt API
                    // fallback for unsupported pairs), Prompt API otherwise.
                    return await this.chromeAI.run({
                        kind: chromeAI?.kind || 'generate',
                        text: chromeAI?.text,
                        sourceLang: chromeAI?.sourceLang,
                        targetLang: chromeAI?.targetLang,
                        systemInstruction,
                        prompt,
                        onStream,
                        signal,
                        temperature: gen.temperature,
                        onProgress
                    });
                } else if (cfg.provider === 'openai') {
                    return await this.callOpenAI(systemInstruction, prompt, {
                        reasoningEffort: gen.reasoningEffort,
                        maxOutputTokens: gen.maxOutputTokens,
                        onStream,
                        signal,
                        meta
                    });
                }
                return await this.callGemini(systemInstruction, prompt, {
                    thinkingLevel: gen.thinkingLevel,
                    maxOutputTokens: gen.maxOutputTokens,
                    onStream,
                    signal,
                    meta
                });
            };

            // Genuine token streaming runs as a single attempt — re-emitting
            // partial output on retry would be jarring. Non-streaming calls
            // (e.g. inline translation) keep the resilient backoff.
            const attempt = (cfg, gen, meta) => (onStream
                ? dispatch(cfg, gen, meta)
                : this.optimizer.retryWithBackoff(() => dispatch(cfg, gen, meta), 3, 1000));

            let gen = genConfig;
            let meta = {};
            let result;
            try {
                result = await attempt(config, gen, meta);
            } catch (error) {
                if (this.isModelUnavailable(error, config)) {
                    // The selected model was retired: switch to the provider
                    // default once, remember it, and tell the user.
                    const from = config.model;
                    const to = DEFAULT_MODELS[config.provider];
                    await this.persistModel(to);
                    config = await this.getEffectiveConfig();
                    onNotice?.('MODEL_FALLBACK', { from, to });
                    meta = {};
                    result = await attempt(config, gen, meta);
                } else if (error.code === 'OUTPUT_TRUNCATED') {
                    // Thinking used the whole budget before any answer: retry
                    // once with less thinking and a bigger cap.
                    gen = {
                        ...gen,
                        thinkingLevel: 'MINIMAL',
                        reasoningEffort: 'low',
                        maxOutputTokens: (gen.maxOutputTokens || 8192) * 2
                    };
                    meta = {};
                    result = await attempt(config, gen, meta);
                } else {
                    throw error;
                }
            }

            if (meta.truncated) {
                // Partial answer: show it, but say so and never cache it.
                onNotice?.('OUTPUT_TRUNCATED');
            } else {
                await this.optimizer.setResponse(cacheKeyFor(config), result);
            }
            return result;
        } catch (error) {
            throw this._userError(error, context);
        }
    }

    /**
     * True when the provider says the requested model does not exist (any
     * more) and a different default is available to fall back to.
     */
    isModelUnavailable(error, config) {
        if (!config || config.provider === CHROME_AI_PROVIDER) return false;
        if (!DEFAULT_MODELS[config.provider] || config.model === DEFAULT_MODELS[config.provider]) return false;
        if (error?.name === 'AbortError') return false;
        const code = String(error?.providerCode || '').toLowerCase();
        if (code === 'model_not_found') return true;
        const message = String(error?.message || '').toLowerCase();
        const mentionsModel = message.includes('model');
        if (error?.status === 404 && (mentionsModel || code === 'not_found')) return true;
        return mentionsModel && /(not found|does not exist|no longer (available|supported)|has been (deprecated|shut ?down|retired)|is not supported)/.test(message);
    }

    async persistModel(modelId) {
        if (typeof this.stateManager.setState === 'function') {
            await this.stateManager.setState({ selectedModel: modelId });
        } else {
            this.stateManager.state.selectedModel = modelId;
        }
    }

    /** Localize an error for the UI while keeping its machine-readable code. */
    _userError(error, context) {
        if (error.name === 'AbortError' || error.localized) return error;
        const userMessage = this.errorHandler.handleAPIError(error, context);
        const wrapped = new Error(userMessage);
        // Preserve a machine-readable code so the UI can offer a next step.
        wrapped.code = error.code || this.errorHandler.classify(error);
        wrapped.localized = true;
        return wrapped;
    }

    async translate(text, targetLang, options = {}) {
        const config = await this.getEffectiveConfig();
        const isChromeAi = config.provider === CHROME_AI_PROVIDER;
        const sanitizedText = this.validateInput(text);
        // Tone only applies to cloud providers; the on-device Translator API ignores it.
        const tone = isChromeAi ? 'auto' : (options.tone || 'auto');
        const sourceLang = options.sourceLang || 'auto';

        const { systemInstruction, prompt } = buildTranslatePrompt({
            text: sanitizedText,
            targetLangName: this.getLanguageName(targetLang),
            sourceLangName: sourceLang !== 'auto' ? this.getLanguageName(sourceLang) : null,
            tone
        });

        return this._runText({
            operation: 'translate',
            systemInstruction,
            prompt,
            cacheParams: {
                text: sanitizedText,
                sourceLang,
                targetLang,
                ...(isChromeAi ? {} : { tone })
            },
            genConfig: GEN_SETTINGS.translate,
            options,
            context: 'Translation',
            chromeAI: { kind: 'translate', text: sanitizedText, sourceLang, targetLang }
        });
    }

    /**
     * Proofread `text` in its own language.
     * @param {string} text
     * @param {string} lang - language of the text, or 'auto' to detect
     */
    async correct(text, lang, options = {}) {
        const sanitizedText = this.validateInput(text);
        const tone = options.tone || 'auto';
        const targetLang = lang || 'auto';

        const { systemInstruction, prompt } = buildCorrectPrompt({
            text: sanitizedText,
            langName: targetLang === 'auto' ? null : this.getLanguageName(targetLang),
            tone
        });

        return this._runText({
            operation: 'correct',
            systemInstruction,
            prompt,
            cacheParams: { text: sanitizedText, targetLang, tone },
            genConfig: GEN_SETTINGS.correct,
            options,
            context: 'Text Correction',
            // Correction keeps the text in its own language, so input == output.
            chromeAI: { kind: 'correct', text: sanitizedText, sourceLang: targetLang, targetLang }
        });
    }

    async generatePrompt(text, targetLang, type = 'image-photo', options = {}) {
        const sanitizedText = this.validateInput(text);
        const aspectRatio = options.aspectRatio && options.aspectRatio !== 'auto' ? options.aspectRatio : null;
        const cameraMotion = options.cameraMotion && options.cameraMotion !== 'auto' ? options.cameraMotion : null;

        // Gemini Nano only speaks a few languages. Pivot unsupported input
        // through the on-device Translator and fall back to English output.
        let ideaText = sanitizedText;
        let inputLang = options.sourceLang || 'auto';
        let outputLang = targetLang;
        const config = await this.getEffectiveConfig();
        if (config.provider === CHROME_AI_PROVIDER) {
            let plan;
            try {
                plan = await this.chromeAI.planPromptLanguages({
                    text: sanitizedText,
                    sourceLang: inputLang,
                    targetLang,
                    onProgress: options.onProgress
                });
            } catch (error) {
                throw this._userError(error, 'Prompt Generation');
            }
            ideaText = plan.text;
            inputLang = plan.inputLang || 'auto';
            outputLang = plan.outputLang;
            if (plan.outputFallback) options.onNotice?.('PROMPT_OUTPUT_ENGLISH');
        }

        const { systemInstruction, prompt } = buildGeneratePrompt({
            text: ideaText,
            type,
            targetLangName: this.getLanguageName(outputLang),
            aspectRatio,
            cameraMotion
        });

        return this._runText({
            operation: 'prompt',
            systemInstruction,
            prompt,
            cacheParams: { text: sanitizedText, targetLang: outputLang, type, aspectRatio: aspectRatio || 'auto', cameraMotion: cameraMotion || 'auto' },
            genConfig: GEN_SETTINGS.prompt,
            options,
            context: 'Prompt Generation',
            chromeAI: {
                kind: 'generate',
                text: ideaText,
                sourceLang: inputLang,
                targetLang: outputLang
            }
        });
    }

    async translateScreenshot(base64Image, targetLang) {
        const config = await this.getEffectiveConfig();
        const { systemInstruction, prompt } = buildOcrPrompt({ targetLangName: this.getLanguageName(targetLang) });

        if (config.provider === CHROME_AI_PROVIDER) {
            // On-device tier is text-only; OCR/vision requires a BYOK provider.
            const error = new Error('OCR requires a personal API key. Please go to Settings, select Gemini or OpenAI, and enter your API key.');
            error.code = 'OCR_REQUIRES_KEY';
            throw this._userError(error, 'OCR');
        }

        const run = (cfg) => (cfg.provider === 'openai'
            ? this.callOpenAIVision(systemInstruction, prompt, base64Image, GEN_SETTINGS.ocr)
            : this.callGeminiVision(systemInstruction, prompt, base64Image, { ...GEN_SETTINGS.ocr, model: cfg.model }));

        try {
            let result;
            try {
                result = await run(config);
            } catch (error) {
                if (!this.isModelUnavailable(error, config)) throw error;
                await this.persistModel(DEFAULT_MODELS[config.provider]);
                result = await run(await this.getEffectiveConfig());
            }
            return this.parseOCRResult(result);
        } catch (error) {
            throw this._userError(error, 'OCR');
        }
    }

    parseOCRResult(text) {
        // Structured output (JSON), tolerating a Markdown code fence.
        const json = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        if (json.startsWith('{')) {
            try {
                const data = JSON.parse(json);
                if (typeof data.transcription === 'string') {
                    return {
                        transcription: data.transcription.trim(),
                        translation: typeof data.translation === 'string' ? data.translation.trim() : ''
                    };
                }
            } catch {
                // Fall through to the legacy header format.
            }
        }

        const transcriptionMatch = text.match(/TRANSCRIPTION:\s*([\s\S]*?)(?=TRANSLATION:|$)/i);
        const translationMatch = text.match(/TRANSLATION:\s*([\s\S]*?)$/i);

        return {
            transcription: transcriptionMatch ? transcriptionMatch[1].trim() : text,
            translation: translationMatch ? translationMatch[1].trim() : ''
        };
    }

    /**
     * Chat Completions body for GPT-5.x reasoning models: they reject custom
     * `temperature` and the legacy `max_tokens`; the token cap is
     * `max_completion_tokens` and covers reasoning + visible output.
     */
    _openAIBody(model, messages, config = {}) {
        const body = {
            model: model || this.DEFAULT_OPENAI_MODEL,
            messages,
            max_completion_tokens: config.maxOutputTokens || 8192
        };
        if (config.reasoningEffort) body.reasoning_effort = config.reasoningEffort;
        if (config.responseFormat) body.response_format = config.responseFormat;
        return body;
    }

    async callOpenAI(systemInstruction, userPrompt, config = {}) {
        const { key, model } = await this.getEffectiveConfig();
        const { onStream, signal } = config;

        const body = this._openAIBody(model, [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt }
        ], config);

        if (onStream) body.stream = true;

        const response = await fetch(this.OPENAI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify(body),
            signal
        });

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            const err = new Error(body.error?.message || `OpenAI API error (${response.status})`);
            err.status = response.status;
            err.providerCode = body.error?.code;
            const retryAfter = response.headers?.get?.('retry-after');
            if (retryAfter) err.retryAfter = parseFloat(retryAfter) || 0;
            throw err;
        }

        if (!onStream) {
            const data = await response.json();
            const choice = data.choices?.[0];
            return this._finishText(choice?.message?.content || '', choice?.finish_reason, config.meta, 'OpenAI');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';
        let finishReason;

        const processLines = (lines) => {
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const payload = trimmed.slice(5).trim();
                if (payload === '[DONE]') continue;
                try {
                    const json = JSON.parse(payload);
                    finishReason = json.choices?.[0]?.finish_reason || finishReason;
                    const delta = json.choices?.[0]?.delta?.content;
                    if (delta) {
                        accumulated += delta;
                        onStream(accumulated, delta);
                    }
                } catch {
                    // Ignore keep-alive / partial frames.
                }
            }
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            processLines(lines);
        }

        if (buffer.trim()) {
            processLines([buffer]);
        }

        return this._finishText(accumulated, finishReason, config.meta, 'OpenAI');
    }

    async callOpenAIVision(systemInstruction, userPrompt, base64Image, config = {}) {
        const { key, model } = await this.getEffectiveConfig();
        const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

        const response = await fetch(this.OPENAI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify(this._openAIBody(model, [
                { role: 'system', content: systemInstruction },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: userPrompt },
                        { type: 'image_url', image_url: { url: `data:image/png;base64,${imageData}`, detail: 'high' } }
                    ]
                }
            ], {
                ...config,
                responseFormat: { type: 'json_schema', json_schema: { name: 'ocr_result', strict: true, schema: OCR_SCHEMA } }
            }))
        });

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            const err = new Error(body.error?.message || `OpenAI Vision API error (${response.status})`);
            err.status = response.status;
            err.providerCode = body.error?.code;
            throw err;
        }

        const data = await response.json();
        const choice = data.choices?.[0];
        return this._finishText(choice?.message?.content || '', choice?.finish_reason, null, 'OpenAI');
    }

    getGeminiClient(apiKey) {
        if (!this.geminiClient || this.lastGeminiKey !== apiKey) {
            this.geminiClient = new GoogleGenAI({ apiKey });
            this.lastGeminiKey = apiKey;
        }
        return this.geminiClient;
    }

    _geminiError(error, fallbackMessage) {
        if (error.name === 'AbortError') throw error;
        const err = new Error(error.message || fallbackMessage);
        err.status = error.status ?? error.statusCode;
        if (error.code) {
            if (err.status) err.providerCode = error.code;
            else err.code = error.code;
        }
        const retryAfter = error.headers?.get?.('retry-after') ?? error.retryAfter;
        if (retryAfter) err.retryAfter = parseFloat(retryAfter) || 0;
        return err;
    }

    /**
     * Normalize a finished generation. `MAX_TOKENS` / `length` means the cap
     * (which includes thinking tokens) was hit: a partial answer is returned
     * and flagged on `meta`; an empty one becomes OUTPUT_TRUNCATED so the
     * caller can retry with less thinking.
     */
    _finishText(text, finishReason, meta, providerLabel) {
        const trimmed = (text || '').trim();
        const truncated = finishReason === 'MAX_TOKENS' || finishReason === 'length';
        if (!trimmed) {
            const err = new Error(truncated
                ? `${providerLabel} used the whole output budget before answering`
                : `${providerLabel} returned an empty response`);
            err.code = truncated ? 'OUTPUT_TRUNCATED' : 'EMPTY_RESPONSE';
            throw err;
        }
        if (truncated && meta) meta.truncated = true;
        return trimmed;
    }

    /**
     * GenerateContent config for Gemini 3.x: sampling params (temperature,
     * topP, topK) are deprecated and ignored, so effort is steered with
     * `thinkingLevel`. `maxOutputTokens` includes thinking tokens.
     */
    _geminiConfig(systemInstruction, config = {}) {
        const requestConfig = {
            systemInstruction,
            maxOutputTokens: config.maxOutputTokens || 8192
        };
        if (config.thinkingLevel) {
            requestConfig.thinkingConfig = { thinkingLevel: config.thinkingLevel };
        }
        return requestConfig;
    }

    async callGemini(systemInstruction, userPrompt, config = {}) {
        const { key, model } = await this.getEffectiveConfig();
        const { onStream, signal } = config;

        const requestConfig = this._geminiConfig(systemInstruction, config);
        if (signal) requestConfig.abortSignal = signal;

        try {
            const ai = this.getGeminiClient(key);

            if (!onStream) {
                const response = await ai.models.generateContent({
                    model: model || this.DEFAULT_GEMINI_MODEL,
                    contents: userPrompt,
                    config: requestConfig,
                });
                return this._finishText(response.text ?? '', response.candidates?.[0]?.finishReason, config.meta, 'Gemini');
            }

            const stream = await ai.models.generateContentStream({
                model: model || this.DEFAULT_GEMINI_MODEL,
                contents: userPrompt,
                config: requestConfig,
            });
            let accumulated = '';
            let finishReason;
            for await (const chunk of stream) {
                if (signal?.aborted) {
                    const err = new Error('Aborted');
                    err.name = 'AbortError';
                    throw err;
                }
                finishReason = chunk.candidates?.[0]?.finishReason || finishReason;
                const piece = chunk.text ?? '';
                if (piece) {
                    accumulated += piece;
                    onStream(accumulated, piece);
                }
            }
            return this._finishText(accumulated, finishReason, config.meta, 'Gemini');
        } catch (error) {
            throw this._geminiError(error, 'Gemini API request failed');
        }
    }

    async callGeminiVision(systemInstruction, userPrompt, base64Image, config = {}) {
        const { key } = await this.getEffectiveConfig();
        const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

        try {
            const ai = this.getGeminiClient(key);
            const response = await ai.models.generateContent({
                model: config.model || this.DEFAULT_GEMINI_MODEL,
                contents: [
                    userPrompt,
                    {
                        inlineData: { mimeType: 'image/png', data: imageData },
                        // Small UI text needs the high-detail image tokenization.
                        mediaResolution: { level: 'MEDIA_RESOLUTION_HIGH' }
                    }
                ],
                config: {
                    ...this._geminiConfig(systemInstruction, config),
                    responseMimeType: 'application/json',
                    responseJsonSchema: OCR_SCHEMA
                },
            });
            return this._finishText(response.text ?? '', response.candidates?.[0]?.finishReason, null, 'Gemini');
        } catch (error) {
            throw this._geminiError(error, 'Gemini Vision API request failed');
        }
    }
}
