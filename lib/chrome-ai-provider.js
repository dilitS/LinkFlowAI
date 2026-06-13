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
    PAIR_UNSUPPORTED: 'CHROME_AI_PAIR_UNSUPPORTED'
};

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
     * Best-effort download progress monitor. Surfaces progress to the console;
     * a richer UI hook can be added later without touching call sites.
     */
    _downloadMonitor() {
        return (m) => {
            m?.addEventListener?.('downloadprogress', (event) => {
                const pct = Math.round((event?.loaded || 0) * 100);
                console.info(`[LingFlow] Chrome AI model download: ${pct}%`);
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
    async translateText({ text, sourceLang, targetLang, onStream, signal }) {
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
            monitor: this._downloadMonitor()
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
     */
    async generateText({ systemInstruction, prompt, onStream, signal, temperature }) {
        if (!this.hasLanguageModel()) {
            throw typedError('Prompt API unavailable', CHROME_AI_ERRORS.UNAVAILABLE);
        }

        const availability = await globalThis.LanguageModel.availability();
        if (availability === 'unavailable') {
            throw typedError('On-device model unavailable', CHROME_AI_ERRORS.UNAVAILABLE);
        }

        const createOptions = { monitor: this._downloadMonitor() };
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
    async run({ kind, text, sourceLang, targetLang, systemInstruction, prompt, onStream, signal, temperature }) {
        if (kind === 'translate') {
            try {
                return await this.translateText({ text, sourceLang, targetLang, onStream, signal });
            } catch (error) {
                if (error?.code === CHROME_AI_ERRORS.PAIR_UNSUPPORTED) {
                    return await this.generateText({ systemInstruction, prompt, onStream, signal, temperature });
                }
                throw error;
            }
        }
        return await this.generateText({ systemInstruction, prompt, onStream, signal, temperature });
    }
}

export const chromeAIProvider = new ChromeAIProvider();
