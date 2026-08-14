import { GoogleGenAI } from '@google/genai';
import { errorHandler } from './error-handler.js';
import { performanceOptimizer } from './performance-optimizer.js';
import { validateInputLength, MAX_INPUT_CHARS } from './sanitize.js';
import { ChromeAIProvider } from './chrome-ai-provider.js';
import { MODELS, DEFAULT_MODELS, CHROME_AI_PROVIDER, CHROME_AI_MODEL_ID, PROMPT_VERSION } from '../popup/modules/constants.js';

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
        const { onStream, signal, force = false, onProgress } = options;

        try {
            const config = await this.getEffectiveConfig();

            const cacheKey = this.optimizer.generateCacheKey(operation, {
                ...cacheParams,
                provider: config.provider,
                model: config.model,
                promptVersion: PROMPT_VERSION
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
                        temperature: genConfig.temperature,
                        onProgress
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
        const config = await this.getEffectiveConfig();
        const isChromeAi = config.provider === CHROME_AI_PROVIDER;
        const targetLangName = this.getLanguageName(targetLang);
        const sanitizedText = this.validateInput(text);
        // Tone only applies to cloud providers; the on-device Translator API ignores it.
        const tone = isChromeAi ? 'auto' : (options.tone || 'auto');
        const sourceLang = options.sourceLang || 'auto';

        const systemInstruction = `You are a professional translator. Your task is to translate text accurately while following these rules:
1. Provide ONLY the translation, no explanations or additional comments
2. Maintain original formatting and structure
3. Preserve proper nouns, names, and technical terms appropriately
4. Use natural, fluent grammar in the target language
5. Do not add prefixes like 'Translation:', 'Here is the translation:', etc.
6. If the text is already in the target language, still provide the best possible translation or improvement${isChromeAi ? '' : this.getToneInstruction(tone)}`;

        const prompt = `Translate the following text to ${targetLangName}. Respond only with the translation, no explanations or additional text:\n\n${sanitizedText}`;

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
            // Correction keeps the text in its own language, so input == output.
            chromeAI: { kind: 'correct', text: sanitizedText, sourceLang: targetLang, targetLang }
        });
    }

    async generatePrompt(text, targetLang, type = 'image-photo', options = {}) {
        const targetLangName = this.getLanguageName(targetLang);
        const sanitizedText = this.validateInput(text);
        const aspectRatio = options.aspectRatio && options.aspectRatio !== 'auto' ? options.aspectRatio : null;
        const cameraMotion = options.cameraMotion && options.cameraMotion !== 'auto' ? options.cameraMotion : null;

        let systemInstruction, prompt;

        // Camera motion directive helper
        const cameraNote = cameraMotion ? `\nCamera Motion: ${cameraMotion}. Incorporate this specific camera movement into the prompt description.` : '';

        if (type === 'image-photo') {
            systemInstruction = `You are a senior AI photography prompt director specializing in the Nano Banana image generation model.
Your task is to transform rough user intent into a highly detailed, premium photorealistic image prompt.
The prompt must be formatted as a detailed description following this structured formula (in natural prose, without headers):
1. Subject: Detailed subject, emotion, actions, and features
2. Style: Artistic medium, visual style, photorealism cues
3. Composition: Camera angle, framing, layout
4. Lighting: Light source, mood, direction
5. Camera/Render Hint: Lens type, depth of field, camera settings
6. Constraints: No text, no artifacts, clean background${aspectRatio ? `, aspect ratio: ${aspectRatio}` : ''}
${cameraNote}
Rules:
- Respond in ${targetLangName}.
- Generate a long, detailed, and descriptive prompt.
- Provide ONLY the final prompt, no explanations.`;

            prompt = `Turn this idea into a professional photorealistic image prompt in ${targetLangName}:\n\n${sanitizedText}`;
        } else if (type === 'image-graphic') {
            systemInstruction = `You are a senior art director and graphic design prompt specialist for the Nano Banana image generation model.
Your task is to turn user intent into a clean, modern, and detailed prompt for graphic visuals (illustration, vector, poster, logo, 3D icon, or design asset).
The prompt must be formatted as a detailed description following this structured formula (in natural prose, without headers):
1. Subject: Core visual concept, elements, and hierarchy
2. Style: Art direction (vector, 3D isometric, minimal, editorial, brand asset)
3. Composition: Layout arrangement, balance, alignment
4. Lighting: Colors, lighting style, mood
5. Camera/Render Hint: Texture detail, rendering cues, clarity settings
6. Constraints: Clean layout, specific colors, no text unless requested${aspectRatio ? `, aspect ratio: ${aspectRatio}` : ''}
Rules:
- Respond in ${targetLangName}.
- Generate a long, detailed, and descriptive prompt.
- Provide ONLY the final prompt, no explanations.`;

            prompt = `Turn this idea into a professional graphic design / illustration prompt in ${targetLangName}:\n\n${sanitizedText}`;
        } else if (type === 'ui-web') {
            systemInstruction = `You are an expert UI/UX visual designer creating prompts for Dribbble/Behance-level Web UI mockups using the Nano Banana image generation model.
Structure the prompt as a detailed description in natural prose using the Nano Banana formula:
1. Subject: Web interface type (modern SaaS dashboard, luxury landing page, web app hero section)
2. Style: Sleek dark mode, frosted glassmorphism, subtle gradients, tactile depth
3. Composition: Bento grid, asymmetric cards, hero split, responsive navigation, layout structure
4. Lighting: Color scheme, glowing accents, premium UI polish
5. Camera/Render Hint: Pristine digital rendering, clean layout
6. Constraints: Clean digital Web UI mockup / interface showcase on a neutral studio background. Strictly NO laptops held by people, NO hands, NO stock photography office backgrounds. No text placeholder garbage.${aspectRatio ? ` Aspect ratio: ${aspectRatio}.` : ''}
Rules:
- Respond in ${targetLangName}.
- Generate a long, detailed, and descriptive prompt.
- This is a visual UI mockup prompt for AI image generators. Do not generate code.
- Provide ONLY the final prompt, no explanations.`;

            prompt = `Turn this concept into a premium Web UI visual mockup prompt in ${targetLangName}:\n\n${sanitizedText}`;
        } else if (type === 'ui-mobile') {
            systemInstruction = `You are an expert Mobile UI/UX visual designer creating prompts for high-end Mobile App UI mockups using the Nano Banana image generation model.
Structure the prompt as a detailed description in natural prose using the Nano Banana formula:
1. Subject: Mobile screen context (iOS/Android mobile app interface, onboarding, card stack, dashboard)
2. Style: Modern minimalism, vibrant micro-gradients, soft shadows, rounded corners, dark/light theme
3. Composition: Floating action buttons, bottom navigation bar, interactive widgets, status bar, layout hierarchy
4. Lighting: Color chemistry, highlights, premium UI polish
5. Camera/Render Hint: Pixel-perfect screen composition, flat front-facing device frame or bezel-less screen presentation
6. Constraints: Clean digital UI design mockup, clean solid/gradient studio backdrop. Strictly NO hands, NO fingers, NO real-world human holding the phone, NO photorealistic lifestyle photo setting. No gibberish text.${aspectRatio ? ` Aspect ratio: ${aspectRatio}.` : ''}
Rules:
- Respond in ${targetLangName}.
- Generate a long, detailed, and descriptive prompt.
- This is a visual mobile UI mockup prompt for AI image generators. Do not generate code.
- Provide ONLY the final prompt, no explanations.`;

            prompt = `Turn this concept into a premium Mobile App UI visual mockup prompt in ${targetLangName}:\n\n${sanitizedText}`;
        } else if (type === 'ui-collage') {
            systemInstruction = `You are an expert Mobile UI/UX visual designer creating prompts for a high-end 4-screen mobile app UI showcase / collage in widescreen format using the Nano Banana image generation model.
Structure the prompt as a detailed description in natural prose using the Nano Banana formula:
1. Subject: Horizontal showcase / portfolio collage of 4 connected, cohesive mobile app screens arranged side-by-side (or in a dynamic floating isometric perspective):
   - Screen 1: Welcome / Onboarding / Splash hero screen with sleek typography and branding.
   - Screen 2: Main Dashboard / Discovery feed with modern Bento cards and micro-widgets.
   - Screen 3: Detailed view / Core interactive feature screen with rich data elements.
   - Screen 4: User Profile / Analytics / Summary screen with charts and stats.
2. Style: Sleek modern design language (frosted glassmorphism, soft multi-layer drop shadows, micro-gradients, dark or light theme, pristine iconography).
3. Composition: Dynamic layout alignment on a minimalist studio backdrop.
4. Lighting: Ambient highlights, premium UI polish, color chemistry.
5. Camera/Render Hint: Pristine digital portfolio presentation.
6. Constraints: Clean digital Behance/Dribbble UI mockup presentation. Strictly NO hands, NO fingers, NO human holding phones, NO photorealistic lifestyle background. Aspect ratio: ${aspectRatio || '16:9'}.
Rules:
- Respond in ${targetLangName}.
- Generate a long, detailed, and descriptive prompt.
- This is a visual UI showcase prompt for AI image generators. Do not generate code.
- Provide ONLY the final prompt, no explanations.`;

            prompt = `Turn this concept into a premium 4-screen Mobile UI showcase / collage prompt (16:9 widescreen) in ${targetLangName}:\n\n${sanitizedText}`;
        } else if (type === 'video-cinematic' || type === 'video') {
            systemInstruction = `You are an expert AI cinematic video prompt engineer (specializing in Sora, Runway Gen-3, Kling, Luma, Veo).
Your task is to generate a high-end cinematic text-to-video prompt describing:
1. Scene setting, subjects, and specific actions
2. Dynamic camera movement, framing, and lens behavior
3. Lighting evolution, atmosphere, volumetric fog, and cinematic color grade
4. Motion physics, fluid dynamics, and temporal continuity (4K, cinematic, 60fps)
${aspectRatio ? `Aspect ratio: ${aspectRatio}.` : ''}${cameraNote}
Rules:
- Respond in ${targetLangName}.
- Provide ONLY the final improved prompt, no conversational filler.`;

            prompt = `Create a cinematic text-to-video prompt in ${targetLangName} for:\n\n${sanitizedText}`;
        } else if (type === 'video-i2v') {
            systemInstruction = `You are an expert AI video animator specializing in Image-to-Video (I2V) prompting.
Your task is to describe the dynamic motion originating from an initial static frame:
1. Initial state to motion progression
2. Specific camera movements (pan, slow zoom, dolly, orbit)
3. Ambient environmental motion (hair blowing, smoke drifting, flickering lights, water ripples)
4. Subject consistency preservation (keeping characters, clothing, and background stable while animating)
${aspectRatio ? `Aspect ratio: ${aspectRatio}.` : ''}${cameraNote}
Rules:
- Respond in ${targetLangName}.
- Provide ONLY the final image-to-video prompt, no explanations.`;

            prompt = `Create an Image-to-Video animation motion prompt in ${targetLangName} starting from this concept:\n\n${sanitizedText}`;
        } else if (type === 'video-product') {
            systemInstruction = `You are an expert commercial 3D video director creating prompts for luxury product reveals and commercials.
Describe:
1. Product positioning, materials, and high-end industrial design details
2. Studio lighting (rim light, caustics, glossy reflections, soft shadows)
3. Smooth camera transitions (macro close-up, slow 360-degree orbit, dynamic pull-back)
4. Pristine, high-end commercial advertising aesthetic
${aspectRatio ? `Aspect ratio: ${aspectRatio}.` : ''}${cameraNote}
Rules:
- Respond in ${targetLangName}.
- Provide ONLY the final prompt, no explanations.`;

            prompt = `Create a 3D product commercial video prompt in ${targetLangName} for:\n\n${sanitizedText}`;
        } else if (type === 'video-social') {
            systemInstruction = `You are a viral social media video creator (TikTok, Reels, Shorts).
Create a fast-paced, high-engagement video prompt featuring:
1. Instant visual hook in the first seconds
2. Fast, dynamic pacing and energetic subject motion
3. Trendy camera transitions and vibrant lighting
4. High-energy visual storytelling
${aspectRatio ? `Aspect ratio: ${aspectRatio}.` : ''}${cameraNote}
Rules:
- Respond in ${targetLangName}.
- Provide ONLY the final prompt, no explanations.`;

            prompt = `Create an energetic Reels/TikTok social media video prompt in ${targetLangName} for:\n\n${sanitizedText}`;
        } else if (type === 'video-loop') {
            systemInstruction = `You are an expert in seamless looping AI video generation (ambient backgrounds, lofi animations, wallpaper motion).
Describe:
1. Continuous ambient scene with cyclic movement
2. Seamless loop dynamics where the end frame connects smoothly with the start frame
3. Subtle particle effects, light breathing, or repetitive natural motion
${aspectRatio ? `Aspect ratio: ${aspectRatio}.` : ''}${cameraNote}
Rules:
- Respond in ${targetLangName}.
- Provide ONLY the final prompt, no explanations.`;

            prompt = `Create a seamless loop video prompt in ${targetLangName} for:\n\n${sanitizedText}`;
        } else if (type === 'code-agent') {
            systemInstruction = `You are an expert prompt engineer for AI coding agents (Cursor, Claude Code, Antigravity, GitHub Copilot).
Generate a concise, direct, and actionable task prompt for a code generator to implement a specific function, component, or module.
The prompt must clearly specify:
1. Objective & Scope (what to build)
2. Key Inputs, Outputs, and Signatures
3. Core Logic & Implementation Rules
4. Critical Edge Cases & Error Handling
Rules:
- Keep the prompt concise, direct, and focused strictly on the task.
- Respond in ${targetLangName}.
- Provide ONLY the prompt ready to be sent to a coding assistant, no preamble.`;

            prompt = `Create a concise AI coding agent task prompt in ${targetLangName} for:\n\n${sanitizedText}`;
        } else if (type === 'code-ui-aesthetic') {
            systemInstruction = `You are an avant-garde design director defining UI aesthetic guidelines for frontend development.
Generate a rich, sophisticated design aesthetic specification using elevated design terminology.
Describe:
1. Visual Vibe & Aesthetic Philosophy (e.g. Warm Brutalism, Kinetic Minimalism, Luminous Dark Mode, Editorial Swiss)
2. Spatial Hierarchy & Rhythm (whitespace balance, asymmetric balance, grid structure)
3. Color Chemistry & Surface Depth (tactile layers, glassmorphic refraction, subtle contrast)
4. Micro-interaction Spirit (fluid easing, spring kinetics, responsive tactile feedback)
Rules:
- Do NOT generate code (no HTML/CSS/JS).
- Do NOT mention specific frameworks or libraries (no Tailwind, React, etc.).
- Focus purely on visual language, styling nuances, and aesthetic direction.
- Respond in ${targetLangName}.
- Provide ONLY the aesthetic specification prompt.`;

            prompt = `Create a sophisticated UI aesthetic and styling prompt in ${targetLangName} for:\n\n${sanitizedText}`;
        } else {
            // Default: image-enhance / image
            systemInstruction = `You are a senior prompt editor for the Nano Banana image model. Your task is to expand and enhance a user's rough prompt.
Structure the final prompt in natural prose using the Nano Banana formula:
1. Subject: Maintain core intent and subject, expanding on details.
2. Style: Artistic medium, visual style, atmosphere.
3. Composition: Camera framing, angle, depth of field.
4. Lighting: Direction, source, mood.
5. Camera/Render Hint: Specific rendering details or camera settings.
6. Constraints: Avoiding clutter, focusing on clarity.${aspectRatio ? ` Aspect ratio: ${aspectRatio}.` : ''}
Rules:
- Respond in ${targetLangName}.
- Provide ONLY the improved prompt, no explanations.`;

            prompt = `Improve and expand this image prompt in ${targetLangName}:\n\n${sanitizedText}`;
        }

        return this._runText({
            operation: 'prompt',
            systemInstruction,
            prompt,
            cacheParams: { text: sanitizedText, targetLang, type, aspectRatio: aspectRatio || 'auto', cameraMotion: cameraMotion || 'auto' },
            genConfig: { temperature: 0.7, maxOutputTokens: 4000, topP: 0.9 },
            options,
            context: 'Prompt Generation',
            chromeAI: {
                kind: 'generate',
                text: sanitizedText,
                sourceLang: options.sourceLang || 'auto',
                targetLang
            }
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
            const text = data.choices?.[0]?.message?.content;
            if (!text) throw new Error('OpenAI returned an empty response');
            return text.trim();
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';

        const processLines = (lines) => {
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

        return accumulated.trim();
    }

    async callOpenAIVision(systemInstruction, userPrompt, base64Image, config) {
        const { key, model } = await this.getEffectiveConfig();
        const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

        const response = await fetch(this.OPENAI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
                model: model || this.DEFAULT_OPENAI_MODEL,
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
            const body = await response.json().catch(() => ({}));
            const err = new Error(body.error?.message || `OpenAI Vision API error (${response.status})`);
            err.status = response.status;
            err.providerCode = body.error?.code;
            throw err;
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new Error('OpenAI returned an empty response');
        return text.trim();
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

    async callGemini(systemInstruction, userPrompt, config = {}) {
        const { key, model } = await this.getEffectiveConfig();
        const { onStream, signal } = config;

        const requestConfig = {
            systemInstruction,
            temperature: config.temperature ?? 0.3,
            maxOutputTokens: config.maxOutputTokens || 2000,
        };
        if (signal) requestConfig.abortSignal = signal;

        try {
            const ai = this.getGeminiClient(key);

            if (!onStream) {
                const response = await ai.models.generateContent({
                    model: model || this.DEFAULT_GEMINI_MODEL,
                    contents: userPrompt,
                    config: requestConfig,
                });
                const text = (response.text ?? '').trim();
                if (!text) {
                    const err = new Error('Gemini returned an empty response');
                    err.code = 'EMPTY_RESPONSE';
                    throw err;
                }
                return text;
            }

            const stream = await ai.models.generateContentStream({
                model: model || this.DEFAULT_GEMINI_MODEL,
                contents: userPrompt,
                config: requestConfig,
            });
            let accumulated = '';
            for await (const chunk of stream) {
                if (signal?.aborted) {
                    const err = new Error('Aborted');
                    err.name = 'AbortError';
                    throw err;
                }
                const piece = chunk.text ?? '';
                if (piece) {
                    accumulated += piece;
                    onStream(accumulated, piece);
                }
            }
            const trimmed = accumulated.trim();
            if (!trimmed) {
                const err = new Error('Gemini returned an empty response');
                err.code = 'EMPTY_RESPONSE';
                throw err;
            }
            return trimmed;
        } catch (error) {
            throw this._geminiError(error, 'Gemini API request failed');
        }
    }

    async callGeminiVision(systemInstruction, userPrompt, base64Image, config) {
        const { key } = await this.getEffectiveConfig();
        const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

        try {
            const ai = this.getGeminiClient(key);
            const response = await ai.models.generateContent({
                model: config.model || this.DEFAULT_GEMINI_MODEL,
                contents: [
                    userPrompt,
                    { inlineData: { mimeType: 'image/png', data: imageData } }
                ],
                config: {
                    systemInstruction,
                    temperature: config.temperature || 0.2,
                    maxOutputTokens: config.maxOutputTokens || 4096,
                },
            });
            const text = (response.text ?? '').trim();
            if (!text) {
                const err = new Error('Gemini returned an empty response');
                err.code = 'EMPTY_RESPONSE';
                throw err;
            }
            return text;
        } catch (error) {
            throw this._geminiError(error, 'Gemini Vision API request failed');
        }
    }
}
