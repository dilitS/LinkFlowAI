import { GoogleGenerativeAI } from '@google/generative-ai';
import { errorHandler } from './error-handler.js';
import { performanceOptimizer } from './performance-optimizer.js';

export class APIClient {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.defaultApiKey = null; // No default key - users must provide their own

        // API endpoints
        this.OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
        this.GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash';
        this.OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

        // Free Tier Configuration - using Meta Llama which is more reliable
        // Other options: 'google/gemma-2-9b-it:free', 'nousresearch/hermes-3-llama-3.1-405b:free'
        this.FREE_MODEL = 'meta-llama/llama-3.2-3b-instruct:free';
        // Proxy Configuration
        this.PROXY_ENDPOINT = 'https://link-flow-proxy.vercel.app/api/chat'; // Placeholder - user needs to update this
        this.FREE_MODEL = 'meta-llama/llama-3.2-3b-instruct:free';
        // this.FREE_API_KEY = '...'; // Removed for security

        // Available Models
        this.MODELS = {
            builtin: [
                { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B (Free)' },
                { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B (Free)' },
                { id: 'nousresearch/hermes-3-llama-3.1-405b:free', name: 'Hermes 3 (Free)' }
            ],
            openai: [
                { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
                { id: 'gpt-4o', name: 'GPT-4o' },
                { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
            ],
            gemini: [
                { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
                { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
            ]
        };

        // Gemini client (will be initialized when needed)
        this.geminiClient = null;

        // Performance optimization
        this.errorHandler = errorHandler;
        this.optimizer = performanceOptimizer;
    }

    async fetchRemoteConfig() {
        // Return cached config if available and fresh (simple implementation)
        if (this.remoteConfigCache) {
            return this.remoteConfigCache;
        }

        try {
            // Only fetch if using proxy (builtin)
            const configUrl = this.PROXY_ENDPOINT.replace('/chat', '/config');
            const response = await fetch(configUrl);
            if (response.ok) {
                const remoteConfig = await response.json();
                if (remoteConfig.freeModels) {
                    this.MODELS.builtin = remoteConfig.freeModels;
                }
                if (remoteConfig.defaultModel) {
                    this.FREE_MODEL = remoteConfig.defaultModel;
                }
                this.remoteConfigCache = remoteConfig;
                return remoteConfig;
            }
        } catch (error) {
            console.warn('Failed to fetch remote config:', error);
        }
        return null;
    }

    async getEffectiveConfig() {
        const { userApiKey, openaiApiKey, geminiApiKey, apiProvider, selectedModel } = this.stateManager.state;

        // Determine model to use
        let modelId = selectedModel;

        // If no model selected or model doesn't belong to provider, use default
        const provider = apiProvider || 'builtin';

        // Ensure models are loaded/synced if possible (though this method is sync-ish in usage usually)
        // We rely on fetchRemoteConfig being called earlier or falling back to defaults

        if (!modelId || !this.MODELS[provider]?.find(m => m.id === modelId)) {
            modelId = this.MODELS[provider]?.[0]?.id;
        }

        // Built-in (Free) provider uses OpenRouter via Proxy
        if (provider === 'builtin') {
            return {
                provider: 'builtin',
                key: null, // Key is handled on the server
                model: modelId || this.FREE_MODEL
            };
        }

        // Determine key based on provider
        let key = null;
        if (provider === 'openai') {
            key = openaiApiKey || userApiKey; // Fallback to userApiKey for backward compatibility
        } else if (provider === 'gemini') {
            key = geminiApiKey || userApiKey; // Fallback to userApiKey for backward compatibility
        }

        if (key) {
            return {
                key: key,
                provider: provider,
                model: modelId
            };
        }

        // No default key - throw error
        throw new Error('API key required. Please add your API key in Settings.');
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
            'ja': 'Japanese',
            'auto': 'English' // Default fallback
        };
        return languageMap[code] || 'English';
    }

    sanitizeInput(text) {
        return text
            .replace(/[<>]/g, "") // Remove potentially dangerous characters
            .substring(0, 5000);   // Limit length to 5000 characters
    }

    async translate(text, targetLang) {
        try {
            const config = await this.getEffectiveConfig();
            const targetLangName = this.getLanguageName(targetLang);
            const sanitizedText = this.sanitizeInput(text);

            // Generate cache key
            const cacheKey = this.optimizer.generateCacheKey('translate', {
                text: sanitizedText,
                targetLang,
                provider: config.provider
            });

            // Check cache first
            const cached = this.optimizer.getCache(cacheKey);
            if (cached) {
                return cached;
            }

            const systemInstruction = `You are a professional translator. Your task is to translate text accurately while following these rules:
1. Provide ONLY the translation, no explanations or additional comments
2. Maintain original formatting and structure
3. Preserve proper nouns, names, and technical terms appropriately
4. Use natural, fluent grammar in the target language
5. Do not add prefixes like 'Translation:', 'Here is the translation:', etc.
6. If the text is already in the target language, still provide the best possible translation or improvement`;

            const prompt = `Translate the following text to ${targetLangName}. Respond only with the translation, no explanations or additional text:\n\n${sanitizedText}`;

            // Execute with retry logic
            const result = await this.optimizer.retryWithBackoff(async () => {
                if (config.provider === 'builtin') {
                    return await this.callOpenRouter(systemInstruction, prompt);
                } else if (config.provider === 'openai') {
                    return await this.callOpenAI(systemInstruction, prompt, {
                        temperature: 0.3,
                        max_tokens: 2000
                    });
                } else {
                    return await this.callGemini(systemInstruction, prompt, {
                        temperature: 0.3,
                        maxOutputTokens: 2000,
                        topP: 0.8
                    });
                }
            }, 3, 1000);

            // Cache the result
            this.optimizer.setCache(cacheKey, result);

            return result;
        } catch (error) {
            const userMessage = this.errorHandler.handleAPIError(error, 'Translation');
            throw new Error(userMessage);
        }
    }

    async correct(text, targetLang) {
        try {
            const config = await this.getEffectiveConfig();
            const targetLangName = this.getLanguageName(targetLang);
            const sanitizedText = this.sanitizeInput(text);

            // Generate cache key
            const cacheKey = this.optimizer.generateCacheKey('correct', {
                text: sanitizedText,
                targetLang,
                provider: config.provider
            });

            // Check cache first
            const cached = this.optimizer.getCache(cacheKey);
            if (cached) {
                return cached;
            }

            const systemInstruction = `You are a professional text editor and proofreader. Your task is to correct and improve text by:
1. Fixing spelling errors and typos
2. Correcting grammar and syntax mistakes
3. Improving punctuation and capitalization
4. Enhancing sentence structure and flow
5. Maintaining the original meaning and tone
6. Using appropriate style for the text type
7. Preserving the author's voice and intent
8. Providing ONLY the corrected text, no explanations or markup`;

            const prompt = `Correct the following text in ${targetLangName}. Fix spelling errors, grammar mistakes, punctuation, and improve style while maintaining the original meaning. Respond only with the corrected text:\n\n${sanitizedText}`;

            // Execute with retry logic
            const result = await this.optimizer.retryWithBackoff(async () => {
                if (config.provider === 'builtin') {
                    return await this.callOpenRouter(systemInstruction, prompt);
                } else if (config.provider === 'openai') {
                    return await this.callOpenAI(systemInstruction, prompt, {
                        temperature: 0.2,
                        max_tokens: 2000
                    });
                } else {
                    return await this.callGemini(systemInstruction, prompt, {
                        temperature: 0.2,
                        maxOutputTokens: 2000,
                        topP: 0.8
                    });
                }
            }, 3, 1000);

            // Cache the result
            this.optimizer.setCache(cacheKey, result);

            return result;
        } catch (error) {
            const userMessage = this.errorHandler.handleAPIError(error, 'Text Correction');
            throw new Error(userMessage);
        }
    }

    async generatePrompt(text, targetLang, type = 'image') {
        try {
            const config = await this.getEffectiveConfig();
            const targetLangName = this.getLanguageName(targetLang);
            const sanitizedText = this.sanitizeInput(text);

            // Generate cache key
            const cacheKey = this.optimizer.generateCacheKey('prompt', {
                text: sanitizedText,
                targetLang,
                type,
                provider: config.provider
            });

            // Check cache first
            const cached = this.optimizer.getCache(cacheKey);
            if (cached) {
                return cached;
            }

            let systemInstruction, prompt;

            if (type === 'video') {
                systemInstruction = `You are an expert AI video prompt engineer (specializing in Sora, Runway, Pika). Your task is to improve and translate video generation prompts by:
1. Describing camera movements (pan, zoom, tilt, tracking shot, FPV)
2. Specifying motion and action details (speed, fluidity, physics, transformation)
3. Defining the atmosphere, lighting, and weather changes over time
4. Including technical video terms (4k, 60fps, photorealistic, cinematic, slow motion)
5. Ensuring temporal consistency and narrative flow
6. Translating to the target language while preserving technical terms
7. Providing ONLY the improved prompt, no explanations`;

                prompt = `Improve the following video generation prompt and translate it to ${targetLangName}. Focus on camera movement, specific action, motion dynamics, physics, and cinematic style. Respond only with the improved prompt:\n\n${sanitizedText}`;
            } else if (type.startsWith('nanobanana-gen')) {
                // Parse style if present
                const style = type.split(':')[1] || 'photorealistic';

                // Nanobanana Generation Templates
                const templates = {
                    photorealistic: {
                        instruction: `You are an expert AI image prompt engineer specializing in Gemini (Nano Banana) image generation. Your task is to create photorealistic prompts using a specific template.`,
                        template: `"A photorealistic [shot type] of [subject], [action or expression], set in [environment]. The scene is illuminated by [lighting description], creating a [mood] atmosphere. Captured with a [camera/lens details], emphasizing [key textures and details]. The image should be in a [aspect ratio] format."`
                    },
                    sticker: {
                        instruction: `You are an expert AI illustrator. Your task is to create sticker/illustration prompts for Gemini (Nano Banana) using a specific template.`,
                        template: `"A [style] sticker of a [subject], featuring [key characteristics] and a [color palette]. The design should have [line style] and [shading style]. The background must be transparent."`
                    },
                    logo: {
                        instruction: `You are an expert AI graphic designer. Your task is to create logo/text rendering prompts for Gemini (Nano Banana) using a specific template.`,
                        template: `"Create a [image type] for [brand/concept] with the text "[text to render]" in a [font style]. The design should be [style description], with a [color scheme]."`
                    },
                    product: {
                        instruction: `You are an expert AI product photographer. Your task is to create product mockup prompts for Gemini (Nano Banana) using a specific template.`,
                        template: `"A high-resolution, studio-lit product photograph of a [product description] on a [background surface/description]. The lighting is a [lighting setup] to [lighting purpose]. The camera angle is a [angle type] to showcase [specific feature]. Ultra-realistic, with sharp focus on [key detail]. [Aspect ratio]."`
                    },
                    minimalist: {
                        instruction: `You are an expert AI minimalist artist. Your task is to create minimalist composition prompts for Gemini (Nano Banana) using a specific template.`,
                        template: `"A minimalist composition featuring a single [subject] positioned in the [bottom-right/top-left/etc.] of the frame. The background is a vast, empty [color] canvas, creating significant negative space. Soft, subtle lighting. [Aspect ratio]."`
                    },
                    comic: {
                        instruction: `You are an expert AI comic artist. Your task is to create sequential art/comic prompts for Gemini (Nano Banana) using a specific template.`,
                        template: `"Make a 3 panel comic in a [style]. Put the character in a [type of scene]."`
                    }
                };

                const selected = templates[style] || templates.photorealistic;

                systemInstruction = `${selected.instruction}
                
TEMPLATE TO FOLLOW:
${selected.template}

RULES:
1. Translate the user's intent into this specific English template structure
2. Ensure all bracketed placeholders are filled with rich, descriptive details
3. Translate any specific cultural or object references appropriately
4. Provide ONLY the final prompt in English, no explanations`;

                prompt = `Convert the following description into a high-quality Gemini image generation prompt using the required template (${style}). The target language for the prompt content should be English (as required by the model), but capture the essence of: "${sanitizedText}"`;

            } else if (type.startsWith('nanobanana-edit')) {
                // Parse style if present
                const style = type.split(':')[1] || 'modify';

                // Nanobanana Editing Templates
                const templates = {
                    modify: {
                        instruction: `You are an expert AI image editing prompt engineer. Your task is to create editing instructions for Gemini (Nano Banana) using a specific template for adding/removing/modifying elements.`,
                        template: `"Using the provided image of [subject], please [add/remove/modify] [element] to/from the scene. Ensure the change is [description of how the change should integrate]."`
                    },
                    retouch: {
                        instruction: `You are an expert AI image retouching specialist. Your task is to create semantic masking/retouching prompts for Gemini (Nano Banana) using a specific template.`,
                        template: `"Using the provided image, change only the [specific element] to [new element/description]. Keep everything else in the image exactly the same, preserving the original style, lighting, and composition."`
                    },
                    'style-transfer': {
                        instruction: `You are an expert AI art style transfer specialist. Your task is to create style transfer prompts for Gemini (Nano Banana) using a specific template.`,
                        template: `"Transform the provided photograph of [subject] into the artistic style of [artist/art style]. Preserve the original composition but render it with [description of stylistic elements]."`
                    },
                    composition: {
                        instruction: `You are an expert AI image compositor. Your task is to create image combination/composition prompts for Gemini (Nano Banana) using a specific template.`,
                        template: `"Create a new image by combining the elements from the provided images. Take the [element from image 1] and place it with/on the [element from image 2]. The final image should be a [description of the final scene]."`
                    }
                };

                const selected = templates[style] || templates.modify;

                systemInstruction = `${selected.instruction}

TEMPLATE TO FOLLOW:
${selected.template}

RULES:
1. Identify the subject, action, and elements from the user's request
2. Describe how the change should integrate (lighting, style, perspective)
3. Provide ONLY the final prompt in English, no explanations`;

                prompt = `Convert the following editing request into a precise Gemini image editing prompt using the required template (${style}). Request: "${sanitizedText}"`;

            } else {
                // Default to Image (Midjourney, DALL-E)
                systemInstruction = `You are an expert AI image prompt engineer. Your task is to improve and translate image generation prompts by:
1. Adding specific visual details (colors, textures, materials)
2. Including artistic style references (photography style, art movement, etc.)
3. Specifying composition and framing details
4. Adding lighting and atmosphere descriptions
5. Including technical camera/rendering details when appropriate
6. Maintaining the original intent while making it more vivid and specific
7. Translating to the target language while preserving technical terms
8. Providing ONLY the improved prompt, no explanations`;

                prompt = `Improve the following image generation prompt and translate it to ${targetLangName}. Make it more detailed, artistic, and effective for AI image generation. Focus on visual details, style, composition, lighting, and atmosphere. Respond only with the improved prompt:\n\n${sanitizedText}`;
            }

            // Execute with retry logic
            const result = await this.optimizer.retryWithBackoff(async () => {
                if (config.provider === 'builtin') {
                    return await this.callOpenRouter(systemInstruction, prompt);
                } else if (config.provider === 'openai') {
                    return await this.callOpenAI(systemInstruction, prompt, {
                        temperature: 0.7,
                        max_tokens: 2000
                    });
                } else {
                    return await this.callGemini(systemInstruction, prompt, {
                        temperature: 0.7,
                        maxOutputTokens: 2000,
                        topP: 0.9
                    });
                }
            }, 3, 1000);

            // Cache the result
            this.optimizer.setCache(cacheKey, result);

            return result;
        } catch (error) {
            const userMessage = this.errorHandler.handleAPIError(error, 'Prompt Generation');
            throw new Error(userMessage);
        }
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
        if (config.provider === 'builtin') {
            throw new Error("OCR requires a personal API key. Please go to Settings, select Gemini or OpenAI, and enter your API key.");
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

    async callOpenRouter(systemInstruction, userPrompt) {
        const config = await this.getEffectiveConfig();
        const { key, model } = config;

        const endpoint = key ? this.OPENROUTER_ENDPOINT : this.PROXY_ENDPOINT;

        console.log('OpenRouter Request:', {
            endpoint: endpoint,
            model: model,
            usingProxy: !key
        });

        const requestBody = {
            model: model,
            messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: userPrompt }
            ]
        };

        // Add extra fields only if sending directly to OpenRouter
        if (key) {
            requestBody.site_url = 'https://lingflow.ai';
        }

        const headers = {
            'Content-Type': 'application/json'
        };

        if (key) {
            headers['Authorization'] = `Bearer ${key}`;
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });

            let errorMessage = 'API request failed';
            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.error?.message || errorData.message || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }

            throw new Error(errorMessage);
        }

        const data = await response.json();
        return data.choices[0].message.content.trim();
    }

    async callOpenAI(systemInstruction, userPrompt, config) {
        const { key, model } = await this.getEffectiveConfig();

        const response = await fetch(this.OPENAI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
                model: model || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: userPrompt }
                ],
                temperature: config.temperature || 0.3,
                max_tokens: config.max_tokens || 2000
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'OpenAI API request failed');
        }

        const data = await response.json();
        return data.choices[0].message.content.trim();
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

    async callGemini(systemInstruction, userPrompt, config) {
        const { key, model } = await this.getEffectiveConfig();

        try {
            const genAI = this.getGeminiClient(key);
            const generativeModel = genAI.getGenerativeModel({
                model: model || 'gemini-2.0-flash-exp',
                systemInstruction: systemInstruction,
                generationConfig: {
                    temperature: config.temperature || 0.3,
                    maxOutputTokens: config.maxOutputTokens || 2000,
                    topP: config.topP || 0.8,
                    topK: config.topK || 40
                }
            });

            const result = await generativeModel.generateContent(userPrompt);
            const response = result.response;
            return response.text().trim();
        } catch (error) {
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
                model: config.model || 'gemini-2.0-flash',
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
