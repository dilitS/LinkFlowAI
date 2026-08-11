/**
 * Chrome Built-in AI provider (on-device, free tier).
 *
 * Wraps the platform APIs exposed in Chrome (and Chrome extensions):
 *   - Translator API        → text translation
 *   - Language Detector API → source detection for `auto`
 *   - Prompt API (Gemini Nano via `LanguageModel`) → correction, prompt
 *     generation, and translation fallback for unsupported language pairs.
 *
 * Design notes:
 *  - Context-agnostic: every capability check goes through `globalThis`, so the
 *    same module works in the popup/side panel (window) and the background
 *    service worker. In tests, globals can be stubbed on `globalThis`.
 *  - Fail loud, fail typed: when nothing is available we throw an Error with a
 *    machine-readable `code`, which the UI maps to a localized, actionable
 *    message (e.g. "update Chrome or add your own API key").
 *  - No network, ever. This is the whole point of the free tier.
 */

export const CHROME_AI_ERRORS = {
    UNAVAILABLE: 'CHROME_AI_UNAVAILABLE',
    PAIR_UNSUPPORTED: 'CHROME_AI_PAIR_UNSUPPORTED',
    HARDWARE_UNSUPPORTED: 'CHROME_AI_HARDWARE_UNSUPPORTED',
    DOWNLOAD_REQUIRED: 'CHROME_AI_DOWNLOAD_REQUIRED'
};

export const CHROME_AI_STATUS = {
    AVAILABLE: 'available',
    DOWNLOADABLE: 'downloadable',
    DOWNLOADING: 'downloading',
    UNAVAILABLE: 'unavailable'
};

// Languages currently supported by the Prompt API (Gemini Nano).
// Treat this as a runtime capability, not a permanent guarantee.
export const PROMPT_API_LANGUAGES = ['en', 'ja', 'es', 'de', 'fr'];

function typedError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
}

export class ChromeAIProvider {
    /** @returns {boolean} Translator API present in this context. */
    hasTranslator() {
        return typeof globalThis !== 'undefined' && 'Translator' in globalThis;
    }

    /** @returns {boolean} Language Detector API present. */
    hasLanguageDetector() {
        return typeof globalThis !== 'undefined' && 'LanguageDetector' in globalThis;
    }

    /** @returns {boolean} Prompt API (`LanguageModel`) present. */
    hasLanguageModel() {
        return typeof globalThis !== 'undefined' && 'LanguageModel' in globalThis;
    }

    /** @returns {boolean} At least one usable surface exists. */
    isSupported() {
        return this.hasTranslator() || this.hasLanguageModel();
    }

    /**
     * Check availability of each Chrome AI surface.
     * @returns {Promise<{translator: string, languageModel: string, detector: string}>}
     *   Each value is one of: 'available', 'downloadable', 'downloading', 'unavailable'.
     */
    async checkAvailability() {
        const result = { translator: 'unavailable', languageModel: 'unavailable', detector: 'unavailable' };

        if (this.hasTranslator()) {
            try {
                result.translator = await globalThis.Translator.availability({
                    sourceLanguage: 'en', targetLanguage: 'pl'
                }) || 'unavailable';
            } catch { result.translator = 'unavailable'; }
        }
        if (this.hasLanguageModel()) {
            try {
                result.languageModel = await globalThis.LanguageModel.availability() || 'unavailable';
            } catch { result.languageModel = 'unavailable'; }
        }
        if (this.hasLanguageDetector()) {
            try {
                result.detector = await globalThis.LanguageDetector.availability() || 'unavailable';
            } catch { result.detector = 'unavailable'; }
        }
        return result;
    }

    /**
     * Download progress monitor with optional UI callback.
     * @param {function(number): void} [onProgress] - receives 0..100
     */
    _downloadMonitor(onProgress) {
        return (m) => {
            m?.addEventListener?.('downloadprogress', (event) => {
                const pct = Math.round((event?.loaded || 0) * 100);
                console.info(`[LingFlow] Chrome AI model download: ${pct}%`);
                if (onProgress) onProgress(pct);
            });
        };
    }

    /**
     * Accumulate a streamed response. Handles both async-iterable streams
     * (Prompt API) and ReadableStream readers (Translator), normalizing to the
     * extension's `(accumulated, delta)` onStream contract.
     */
    async _consumeStream(stream, onStream, signal) {
        const abortIfNeeded = () => {
            if (signal?.aborted) {
                const error = new Error('Aborted');
                error.name = 'AbortError';
                throw error;
            }
        };

        let accumulated = '';

        if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
            for await (const chunk of stream) {
                abortIfNeeded();
                accumulated += chunk;
                if (onStream) onStream(accumulated, chunk);
            }
            return accumulated;
        }

        const reader = stream.getReader();
        try {
            for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                abortIfNeeded();
                accumulated += value;
                if (onStream) onStream(accumulated, value);
            }
        } finally {
            reader.releaseLock?.();
        }
        return accumulated;
    }

    /**
     * Check whether the Prompt API supports the given language pair.
     * @returns {Promise<boolean>}
     */
    async isPromptLanguageSupported(inputLang, outputLang) {
        if (!this.hasLanguageModel()) return false;
        try {
            const expectedInputs = [{ type: 'text', languages: [inputLang || 'en'] }];
            const expectedOutputs = [{ type: 'text', languages: [outputLang || 'en'] }];
            const availability = await globalThis.LanguageModel.availability({ expectedInputs, expectedOutputs });
            return availability !== 'unavailable';
        } catch {
            return false;
        }
    }

    /**
     * Fail fast when Chrome AI cannot handle the requested operation/language.
     * @throws {Error & { code: string }}
     */
    async assertOperationSupported({ kind, sourceLang, targetLang }) {
        const outputLang = targetLang || 'en';
        const inputLang = sourceLang && sourceLang !== 'auto' ? sourceLang : outputLang;

        if (kind === 'translate') {
            if (!this.hasTranslator() && !this.hasLanguageModel()) {
                throw typedError('Chrome AI unavailable', CHROME_AI_ERRORS.UNAVAILABLE);
            }

            // Translator API resolves `auto` at runtime; if it's present we defer pair checks.
            if (this.hasTranslator()) return;

            const promptOk = await this.isPromptLanguageSupported(
                inputLang === 'auto' ? 'en' : inputLang,
                outputLang
            );
            if (!promptOk) {
                throw typedError(
                    `On-device AI does not support this language pair. Prompt API languages: ${PROMPT_API_LANGUAGES.join(', ')}.`,
                    CHROME_AI_ERRORS.UNAVAILABLE
                );
            }
            return;
        }

        // correct, generate — Prompt API only
        const promptOk = await this.isPromptLanguageSupported(inputLang, outputLang);
        if (!promptOk) {
            throw typedError(
                `On-device model does not support language "${outputLang}". Supported: ${PROMPT_API_LANGUAGES.join(', ')}.`,
                CHROME_AI_ERRORS.UNAVAILABLE
            );
        }
    }

    /**
     * Detect the dominant language of `text`.
     * @returns {Promise<string|null>} BCP-47 short code, or null when unknown.
     */
    async detectLanguage(text) {
        if (!this.hasLanguageDetector()) return null;
        try {
            const availability = await globalThis.LanguageDetector.availability();
            if (availability === 'unavailable') return null;

            const detector = await globalThis.LanguageDetector.create({ monitor: this._downloadMonitor() });
            try {
                const results = await detector.detect(text);
                const top = Array.isArray(results) ? results[0] : null;
                if (top?.detectedLanguage && top.detectedLanguage !== 'und') {
                    return top.detectedLanguage;
                }
            } finally {
                detector.destroy?.();
            }
        } catch {
            // Detection is best-effort; callers fall back to the Prompt API.
        }
        return null;
    }

    /**
     * Translate via the Translator API, resolving `auto` through the Language
     * Detector. Throws `PAIR_UNSUPPORTED` (so the caller can fall back to the
     * Prompt API) when the source can't be determined or the pair is missing.
     */
    async translateText({ text, sourceLang, targetLang, onStream, signal, onProgress }) {
        if (!this.hasTranslator()) {
            throw typedError('Translator API unavailable', CHROME_AI_ERRORS.PAIR_UNSUPPORTED);
        }

        let source = sourceLang && sourceLang !== 'auto' ? sourceLang : null;
        if (!source) {
            source = await this.detectLanguage(text);
        }
        if (!source) {
            throw typedError('Could not determine source language', CHROME_AI_ERRORS.PAIR_UNSUPPORTED);
        }
        if (source === targetLang) {
            if (onStream) onStream(text, text);
            return text;
        }

        const availability = await globalThis.Translator.availability({
            sourceLanguage: source,
            targetLanguage: targetLang
        });
        if (availability === 'unavailable') {
            throw typedError(`Unsupported pair ${source}→${targetLang}`, CHROME_AI_ERRORS.PAIR_UNSUPPORTED);
        }

        const translator = await globalThis.Translator.create({
            sourceLanguage: source,
            targetLanguage: targetLang,
            monitor: this._downloadMonitor(onProgress)
        });
        try {
            if (onStream && typeof translator.translateStreaming === 'function') {
                return await this._consumeStream(translator.translateStreaming(text), onStream, signal);
            }
            const output = await translator.translate(text);
            if (onStream) onStream(output, output);
            return output;
        } finally {
            translator.destroy?.();
        }
    }

    /**
     * Run a freeform prompt through Gemini Nano (Prompt API). Used for
     * correction, prompt generation, and translation fallback.
     * @param {Object} opts
     * @param {string} [opts.inputLang]  - BCP-47 short code of the input text
     * @param {string} [opts.outputLang] - BCP-47 short code of the desired output
     */
    async generateText({ systemInstruction, prompt, onStream, signal, temperature, onProgress, inputLang, outputLang }) {
        if (!this.hasLanguageModel()) {
            throw typedError('Prompt API unavailable', CHROME_AI_ERRORS.UNAVAILABLE);
        }

        const expectedInputs = [{ type: 'text', languages: inputLang ? [inputLang] : ['en'] }];
        const expectedOutputs = [{ type: 'text', languages: outputLang ? [outputLang] : ['en'] }];

        const availability = await globalThis.LanguageModel.availability({ expectedInputs, expectedOutputs });
        if (availability === 'unavailable') {
            const lang = outputLang || inputLang || '';
            throw typedError(
                `On-device model does not support language "${lang}". Supported: ${PROMPT_API_LANGUAGES.join(', ')}.`,
                CHROME_AI_ERRORS.UNAVAILABLE
            );
        }

        const createOptions = {
            monitor: this._downloadMonitor(onProgress),
            expectedInputs,
            expectedOutputs
        };
        if (systemInstruction) {
            createOptions.initialPrompts = [{ role: 'system', content: systemInstruction }];
        }
        // Temperature requires topK as well ("both or neither"); pull the
        // device default for topK when we want to steer temperature.
        try {
            if (typeof temperature === 'number' && typeof globalThis.LanguageModel.params === 'function') {
                const params = await globalThis.LanguageModel.params();
                if (params) {
                    createOptions.temperature = temperature;
                    createOptions.topK = params.defaultTopK;
                }
            }
        } catch {
            // Fall back to model defaults.
        }

        const session = await globalThis.LanguageModel.create(createOptions);
        const promptOptions = signal ? { signal } : undefined;
        try {
            if (onStream && typeof session.promptStreaming === 'function') {
                return await this._consumeStream(session.promptStreaming(prompt, promptOptions), onStream, signal);
            }
            const output = await session.prompt(prompt, promptOptions);
            if (onStream) onStream(output, output);
            return output;
        } finally {
            session.destroy?.();
        }
    }

    /**
     * Orchestrate a request. `translate` prefers the Translator API and falls
     * back to the Prompt API for unsupported pairs; everything else goes
     * straight to the Prompt API.
     */
    async run({ kind, text, sourceLang, targetLang, systemInstruction, prompt, onStream, signal, temperature, onProgress }) {
        const inputLang = sourceLang && sourceLang !== 'auto' ? sourceLang : undefined;
        const outputLang = targetLang || undefined;

        await this.assertOperationSupported({ kind, sourceLang, targetLang });

        if (kind === 'translate') {
            try {
                return await this.translateText({ text, sourceLang, targetLang, onStream, signal, onProgress });
            } catch (error) {
                if (error?.code === CHROME_AI_ERRORS.PAIR_UNSUPPORTED) {
                    return await this.generateText({ systemInstruction, prompt, onStream, signal, temperature, onProgress, inputLang, outputLang });
                }
                throw error;
            }
        }
        return await this.generateText({ systemInstruction, prompt, onStream, signal, temperature, onProgress, inputLang, outputLang });
    }
}

export const chromeAIProvider = new ChromeAIProvider();
