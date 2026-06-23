import { GoogleGenerativeAI } from '@google/generative-ai';
import { errorHandler } from './error-handler.js';
import { performanceOptimizer } from './performance-optimizer.js';
import { validateInputLength, MAX_INPUT_CHARS } from './sanitize.js';
import { ChromeAIProvider } from './chrome-ai-provider.js';

// On-device free tier identifier (Gemini Nano via Chrome Built-in AI).
export const CHROME_AI_PROVIDER = 'chrome-ai';
export const CHROME_AI_MODEL_ID = 'gemini-nano';

export class APIClient {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.defaultApiKey = null; // No default key - users must provide their own

        // API endpoints (BYOK only — no author-hosted endpoints).
        this.OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
        this.GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

        // Default models per provider (kept as config constants, not buried string literals,
        // so preview -> GA migrations are a one-line change).
        this.DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';
        this.DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

        // Available Models
        this.MODELS = {
            [CHROME_AI_PROVIDER]: [
                { id: CHROME_AI_MODEL_ID, name: 'Gemini Nano (on-device)' }
            ],
            openai: [
                { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
                { id: 'gpt-4o', name: 'GPT-4o' },
                { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
            ],
            gemini: [
                { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' },
                { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite (Preview)' },
                { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)' },
                { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
                { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' }
            ]
        };

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

        // BYOK providers: resolve model and require a key.
        let modelId = selectedModel;
        if (!modelId || !this.MODELS[provider]?.find(m => m.id === modelId)) {
            modelId = this.MODELS[provider]?.[0]?.id;
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
        return languageMap[code] || 'English';
    }

    /**
     * Build a tone/style directive injected into system prompts.
     * Lets users steer formality the way premium translators (e.g. DeepL) do.
     * @param {string} tone - 'auto' | 'formal' | 'casual' | 'professional' | 'friendly'
     * @returns {string} A directive sentence, or '' for auto.
     */
    getToneInstruction(tone) {
        const tones = {
            formal: 'Use a strictly formal register: polite, respectful, no contractions or slang.',
            casual: 'Use a relaxed, conversational register with natural everyday phrasing.',
            professional: 'Use a clear, confident business register suitable for professional correspondence.',
            friendly: 'Use a warm, approachable and friendly tone while staying natural.'
        };
        const directive = tones[tone];
        return directive ? `\nTONE & REGISTER: ${directive}` : '';
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
        const result = validateInputLength(text, MAX_INPUT_CHARS);
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
     * @param {Object} args.genConfig - { temperature, maxOutputTokens, topP }
     * @param {Object} args.options - { onStream, signal, force }
     * @param {string} args.context - human label for error messages
     * @returns {Promise<string>}
     */
    async _runText({ operation, systemInstruction, prompt, cacheParams, genConfig, options = {}, context, chromeAI }) {
        const { onStream, signal, force = false } = options;

        try {
            const config = await this.getEffectiveConfig();

            const cacheKey = this.optimizer.generateCacheKey(operation, {
                ...cacheParams,
                provider: config.provider
            });

            if (!force) {
                const cached = this.optimizer.getCache(cacheKey);
                if (cached) {
                    if (onStream) onStream(cached, cached);
                    return cached;
                }
            }

            const dispatch = async () => {
                if (config.provider === CHROME_AI_PROVIDER) {
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
                        temperature: genConfig.temperature
                    });
                } else if (config.provider === 'openai') {
                    return await this.callOpenAI(systemInstruction, prompt, {
                        temperature: genConfig.temperature,
                        max_tokens: genConfig.maxOutputTokens,
                        onStream,
                        signal
                    });
                }
                return await this.callGemini(systemInstruction, prompt, {
                    temperature: genConfig.temperature,
                    maxOutputTokens: genConfig.maxOutputTokens,
                    topP: genConfig.topP,
                    onStream,
                    signal
                });
            };

            // Genuine token streaming runs as a single attempt — re-emitting
            // partial output on retry would be jarring. Non-streaming calls
            // (e.g. inline translation) keep the resilient backoff.
            const willStream = !!onStream;
            const result = willStream
                ? await dispatch()
                : await this.optimizer.retryWithBackoff(dispatch, 3, 1000);

            this.optimizer.setCache(cacheKey, result);
            return result;
        } catch (error) {
            if (error.name === 'AbortError') throw error;
            const userMessage = this.errorHandler.handleAPIError(error, context);
            const wrapped = new Error(userMessage);
            // Preserve a machine-readable code so the UI can offer a next step.
            wrapped.code = error.code || this.errorHandler.classify(error);
            throw wrapped;
        }
    }

    async translate(text, targetLang, options = {}) {
        const targetLangName = this.getLanguageName(targetLang);
        const sanitizedText = this.validateInput(text);
        const tone = options.tone || 'auto';
        const sourceLang = options.sourceLang || 'auto';

        const systemInstruction = `You are a professional translator. Your task is to translate text accurately while following these rules:
1. Provide ONLY the translation, no explanations or additional comments
2. Maintain original formatting and structure
3. Preserve proper nouns, names, and technical terms appropriately
4. Use natural, fluent grammar in the target language
5. Do not add prefixes like 'Translation:', 'Here is the translation:', etc.
6. If the text is already in the target language, still provide the best possible translation or improvement${this.getToneInstruction(tone)}`;

        const prompt = `Translate the following text to ${targetLangName}. Respond only with the translation, no explanations or additional text:\n\n${sanitizedText}`;

        return this._runText({
            operation: 'translate',
            systemInstruction,
            prompt,
            cacheParams: { text: sanitizedText, sourceLang, targetLang, tone },
            genConfig: { temperature: 0.3, maxOutputTokens: 2000, topP: 0.8 },
            options,
            context: 'Translation',
            chromeAI: { kind: 'translate', text: sanitizedText, sourceLang, targetLang }
        });
    }

    async correct(text, targetLang, options = {}) {
        const targetLangName = this.getLanguageName(targetLang);
        const sanitizedText = this.validateInput(text);
        const tone = options.tone || 'auto';

        const systemInstruction = `You are a professional text editor and proofreader. Your task is to correct and improve text by:
1. Fixing spelling errors and typos
2. Correcting grammar and syntax mistakes
3. Improving punctuation and capitalization
4. Enhancing sentence structure and flow
5. Maintaining the original meaning and tone
6. Using appropriate style for the text type
7. Preserving the author's voice and intent
8. Providing ONLY the corrected text, no explanations or markup${this.getToneInstruction(tone)}`;

        const prompt = `Correct the following text in ${targetLangName}. Fix spelling errors, grammar mistakes, punctuation, and improve style while maintaining the original meaning. Respond only with the corrected text:\n\n${sanitizedText}`;

        return this._runText({
            operation: 'correct',
            systemInstruction,
            prompt,
            cacheParams: { text: sanitizedText, targetLang, tone },
            genConfig: { temperature: 0.2, maxOutputTokens: 2000, topP: 0.8 },
            options,
            context: 'Text Correction',
            chromeAI: { kind: 'generate' }
        });
    }

    async generatePrompt(text, targetLang, type = 'image', options = {}) {
        const targetLangName = this.getLanguageName(targetLang);
        const sanitizedText = this.validateInput(text);

        let systemInstruction, prompt;

            if (type === 'image-photo') {
                systemInstruction = `You are a senior AI photography prompt director for Gemini image models (Nano Banana / Gemini image generation).
Your job is to transform rough user intent into a premium photorealistic image prompt.

Use natural, narrative prose rather than keyword soup. Structure the final prompt around:
1. Subject and specific action/expression
2. Environment/context
3. Composition, framing, angle, and aspect ratio
4. Lighting direction, mood, color grade, and film/camera feel
5. Camera/lens/focus details when useful
6. Material texture and realism cues

Rules:
- Output ONLY the final prompt in English.
- Prefer positive instructions (describe what should be present).
- For people, include realism cues like visible pores and natural skin texture when appropriate.
- If text must appear in the image, wrap the exact text in double quotes and describe font/placement.
- Avoid generic filler. Make it concrete and production-ready.`;

                prompt = `Turn this idea into a professional photorealistic Gemini/Nano Banana image prompt. Make it cinematic, concrete, and easy for the model to follow:\n\n${sanitizedText}`;
            } else if (type === 'image-graphic') {
                systemInstruction = `You are a senior AI art director and graphic design prompt engineer for Gemini image models (Nano Banana / Gemini image generation).
Your job is to turn rough user intent into a clean prompt for non-photographic visuals: illustration, poster, logo, UI-style graphic, sticker, social asset, product graphic, or layout.

Use natural, direct prose. Include:
1. Main concept and visual hierarchy
2. Style direction (illustration, vector, 3D, editorial, minimal, brand system, etc.)
3. Composition/layout and aspect ratio
4. Color palette, typography, spacing, and texture
5. Text rendering instructions when needed
6. Production constraints (clean edges, readable text, no clutter)

Rules:
- Output ONLY the final prompt in English.
- Wrap exact visible text in double quotes and specify font style, placement, and contrast.
- Be specific about layout and visual hierarchy.
- Keep the prompt suitable for Gemini/Nano Banana, not Stable Diffusion tag soup.`;

                prompt = `Turn this idea into a professional Gemini/Nano Banana prompt for a graphic/design asset. Make it clear, structured, and production-ready:\n\n${sanitizedText}`;
            } else if (type === 'video') {
                systemInstruction = `You are an expert AI video prompt engineer (specializing in Sora, Runway, Pika). Your task is to improve and translate video generation prompts by:
1. Describing camera movements (pan, zoom, tilt, tracking shot, FPV)
2. Specifying motion and action details (speed, fluidity, physics, transformation)
3. Defining the atmosphere, lighting, and weather changes over time
4. Including technical video terms (4k, 60fps, photorealistic, cinematic, slow motion)
5. Ensuring temporal consistency and narrative flow
6. Translating to the target language while preserving technical terms
7. Providing ONLY the improved prompt, no explanations`;

                prompt = `Improve the following video generation prompt and translate it to ${targetLangName}. Focus on camera movement, specific action, motion dynamics, physics, and cinematic style. Respond only with the improved prompt:\n\n${sanitizedText}`;
            } else if (type === 'image-universal') {
                systemInstruction = `You are an expert AI prompt engineer for image generation. Your job is to transform rough user intent into a premium, universal image prompt. These prompts should be optimized for Nano Banana Pro (Google Gemini) but must work exceptionally well with any text-to-image model including Nano Banana 2, Seedream 5.0, GPT Image 1.5, Midjourney, DALL-E 3, Flux, and Stable Diffusion. Output ONLY the final prompt in English.`;

                prompt = `Turn this idea into a universal, high-quality image prompt optimized for Nano Banana but compatible with any text-to-image model. Respond only with the prompt:\n\n${sanitizedText}`;
            } else {
                systemInstruction = `You are a senior prompt editor for AI image models. Your task is to expand and clean up a user's existing image prompt without changing its core intent.

Rules:
1. Keep the original idea, subject, and constraints.
2. Improve specificity: subject, action, environment, composition, lighting, style, materials, and aspect ratio when useful.
3. Use natural prose instead of comma-only tag soup.
4. Preserve exact required text in double quotes.
5. Translate the final prompt to ${targetLangName}, unless the user clearly asks for English.
6. Provide ONLY the improved prompt, no explanations.`;

                prompt = `Improve and expand the following image prompt. Keep the user's intent, make it more useful for modern Gemini/Nano Banana-style image models, and respond only with the improved prompt:\n\n${sanitizedText}`;
            }

        return this._runText({
            operation: 'prompt',
            systemInstruction,
            prompt,
            cacheParams: { text: sanitizedText, targetLang, type },
            genConfig: { temperature: 0.7, maxOutputTokens: 2000, topP: 0.9 },
            options,
            context: 'Prompt Generation',
            chromeAI: { kind: 'generate' }
        });
    }

    async translateScreenshot(base64Image, targetLang) {
        const config = await this.getEffectiveConfig();
        const targetLangName = this.getLanguageName(targetLang);

        const systemInstruction = `You are an expert OCR and translation specialist. Your task is to:
1. TRANSCRIBE: Extract ALL visible text from images with maximum accuracy
2. TRANSLATE: Provide professional translation maintaining context
3. PRESERVE: Keep original formatting, structure, and meaning
4. BE THOROUGH: Never skip text elements, even small ones
5. BE PRECISE: Follow the exact output format specified`;

        const prompt = `IMPORTANT: You must provide a complete transcription of ALL visible text in this image, then translate it to ${targetLangName}.

TASK REQUIREMENTS:
1. TRANSCRIPTION PHASE: Extract and transcribe every single piece of text visible in the image with pixel-perfect accuracy
2. TRANSLATION PHASE: Translate the transcribed text to ${targetLangName} maintaining context and meaning

FORMAT YOUR RESPONSE EXACTLY AS:

TRANSCRIPTION:
[Write here ALL the text you can see in the image, preserving line breaks, formatting, and layout. Include even small text, watermarks, buttons, labels, etc.]

TRANSLATION:
[Write here the complete translation to ${targetLangName} of all the transcribed text]

CRITICAL INSTRUCTIONS:
- Do NOT skip any visible text, no matter how small or unclear
- Maintain original formatting and structure
- If text is partially obscured, indicate with [unclear] but transcribe what you can see
- Include text from UI elements, buttons, menus, captions, etc.
- Preserve line breaks and spatial relationships
- Be thorough and comprehensive in your transcription`;

        let result;
        if (config.provider === CHROME_AI_PROVIDER) {
            // On-device tier is text-only; OCR/vision requires a BYOK provider.
            const error = new Error('OCR requires a personal API key. Please go to Settings, select Gemini or OpenAI, and enter your API key.');
            error.code = 'OCR_REQUIRES_KEY';
            throw error;
        } else if (config.provider === 'openai') {
            result = await this.callOpenAIVision(systemInstruction, prompt, base64Image, {
                temperature: 0.2,
                max_tokens: 4096
            });
        } else {
            result = await this.callGeminiVision(systemInstruction, prompt, base64Image, {
                model: config.model,
                temperature: 0.2,
                maxOutputTokens: 4096,
                topP: 1,
                topK: 32
            });
        }

        // Parse the result to extract transcription and translation
        return this.parseOCRResult(result);
    }

    parseOCRResult(text) {
        const transcriptionMatch = text.match(/TRANSCRIPTION:\s*([\s\S]*?)(?=TRANSLATION:|$)/i);
        const translationMatch = text.match(/TRANSLATION:\s*([\s\S]*?)$/i);

        return {
            transcription: transcriptionMatch ? transcriptionMatch[1].trim() : text,
            translation: translationMatch ? translationMatch[1].trim() : ''
        };
    }

    async callOpenAI(systemInstruction, userPrompt, config = {}) {
        const { key, model } = await this.getEffectiveConfig();
        const { onStream, signal } = config;

        const body = {
            model: model || this.DEFAULT_OPENAI_MODEL,
            messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: userPrompt }
            ],
            temperature: config.temperature ?? 0.3,
            max_tokens: config.max_tokens || 2000
        };

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
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || 'OpenAI API request failed');
        }

        if (!onStream) {
            const data = await response.json();
            return data.choices[0].message.content.trim();
        }

        // Stream Server-Sent Events and accumulate deltas.
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const payload = trimmed.slice(5).trim();
                if (payload === '[DONE]') continue;
                try {
                    const json = JSON.parse(payload);
                    const delta = json.choices?.[0]?.delta?.content;
                    if (delta) {
                        accumulated += delta;
                        onStream(accumulated, delta);
                    }
                } catch (e) {
                    // Ignore keep-alive / partial frames.
                }
            }
        }

        return accumulated.trim();
    }

    async callOpenAIVision(systemInstruction, userPrompt, base64Image, config) {
        const { key } = await this.getEffectiveConfig();

        // Remove data URL prefix if present
        const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

        const response = await fetch(this.OPENAI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemInstruction },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: userPrompt },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/png;base64,${imageData}`
                                }
                            }
                        ]
                    }
                ],
                temperature: config.temperature || 0.2,
                max_tokens: config.max_tokens || 4096
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'OpenAI Vision API request failed');
        }

        const data = await response.json();
        return data.choices[0].message.content.trim();
    }

    getGeminiClient(apiKey) {
        // Initialize or update client if API key changed
        if (!this.geminiClient || this.lastGeminiKey !== apiKey) {
            this.geminiClient = new GoogleGenerativeAI(apiKey);
            this.lastGeminiKey = apiKey;
        }
        return this.geminiClient;
    }

    async callGemini(systemInstruction, userPrompt, config = {}) {
        const { key, model } = await this.getEffectiveConfig();
        const { onStream, signal } = config;

        try {
            const genAI = this.getGeminiClient(key);
            const generativeModel = genAI.getGenerativeModel({
                model: model || this.DEFAULT_GEMINI_MODEL,
                systemInstruction: systemInstruction,
                generationConfig: {
                    temperature: config.temperature ?? 0.3,
                    maxOutputTokens: config.maxOutputTokens || 2000,
                    topP: config.topP || 0.8,
                    topK: config.topK || 40
                }
            });

            if (!onStream) {
                const result = await generativeModel.generateContent(userPrompt);
                return result.response.text().trim();
            }

            // Streamed generation: surface chunks as they arrive. Honour the
            // AbortSignal by breaking the loop, which closes the underlying reader.
            const result = await generativeModel.generateContentStream(userPrompt);
            let accumulated = '';
            for await (const chunk of result.stream) {
                if (signal?.aborted) {
                    const err = new Error('Aborted');
                    err.name = 'AbortError';
                    throw err;
                }
                const piece = chunk.text();
                if (piece) {
                    accumulated += piece;
                    onStream(accumulated, piece);
                }
            }
            return accumulated.trim();
        } catch (error) {
            if (error.name === 'AbortError') throw error;
            console.error('Gemini API Error:', error);
            throw new Error(error.message || 'Gemini API request failed');
        }
    }

    async callGeminiVision(systemInstruction, userPrompt, base64Image, config) {
        const { key } = await this.getEffectiveConfig();

        try {
            // Remove data URL prefix if present
            const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

            const genAI = this.getGeminiClient(key);
            const model = genAI.getGenerativeModel({
                model: config.model || this.DEFAULT_GEMINI_MODEL,
                systemInstruction: systemInstruction,
                generationConfig: {
                    temperature: config.temperature || 0.2,
                    maxOutputTokens: config.maxOutputTokens || 4096,
                    topP: config.topP || 1,
                    topK: config.topK || 32
                }
            });

            const result = await model.generateContent([
                userPrompt,
                {
                    inlineData: {
                        mimeType: 'image/png',
                        data: imageData
                    }
                }
            ]);

            const response = result.response;
            return response.text().trim();
        } catch (error) {
            console.error('Gemini Vision API Error:', error);
            throw new Error(error.message || 'Gemini Vision API request failed');
        }
    }
}
