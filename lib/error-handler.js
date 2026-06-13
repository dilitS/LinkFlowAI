/**
 * Error Handler Utility
 * Provides centralized error handling with user-friendly messages
 */

export class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogSize = 50;
    }

    /**
     * Localize a key with a safe English fallback. Works in any extension
     * context (popup, background, content) and degrades gracefully under tests
     * where `chrome` is undefined.
     */
    t(key, fallback) {
        try {
            if (typeof chrome !== 'undefined' && chrome.i18n?.getMessage) {
                const message = chrome.i18n.getMessage(key);
                if (message) return message;
            }
        } catch {
            // ignore and fall back
        }
        return fallback;
    }

    /**
     * Map an arbitrary error to a stable, machine-readable code. Honors an
     * explicit `error.code` (our typed app errors) before sniffing status/text.
     * @param {Error & { code?: string, status?: number }} error
     * @returns {string}
     */
    classify(error) {
        if (error?.code) return error.code;

        const status = error?.status;
        const message = (error?.message || error?.toString() || '').toLowerCase();

        if (status === 429 || message.includes('rate limit')) return 'RATE_LIMITED';
        if (status === 401 || message.includes('api key') || message.includes('unauthorized')) return 'NO_API_KEY';
        if (status === 402 || message.includes('quota') || message.includes('billing')) return 'QUOTA_EXCEEDED';
        if (message.includes('timeout') || message.includes('timed out')) return 'TIMEOUT';
        if (message.includes('network') || message.includes('fetch')) return 'NETWORK';
        if (message.includes('too large') || message.includes('max tokens') || message.includes('too long')) return 'CONTENT_TOO_LARGE';
        if (message.includes('safety') || message.includes('blocked') || message.includes('filtered')) return 'CONTENT_FILTERED';
        return 'GENERIC';
    }

    /**
     * Localized, actionable message for a classified code. Where useful the
     * message names the next step (add a key, update Chrome, shorten text).
     * @param {string} code
     * @param {{ limit?: number }} [error]
     * @returns {string}
     */
    messageForCode(code, error = {}) {
        switch (code) {
            case 'NO_API_KEY':
                return this.t('errorNoApiKey', 'API key required. Add your OpenAI or Gemini key in Settings.');
            case 'INPUT_TOO_LONG':
                return this.t('errorInputTooLong', `Your text exceeds the ${error.limit || 5000}-character limit. Please shorten it.`);
            case 'CHROME_AI_UNAVAILABLE':
                return this.t('errorChromeAiUnavailable', 'On-device AI is unavailable here. Update Chrome, or pick OpenAI/Gemini with your own key in Settings.');
            case 'OCR_REQUIRES_KEY':
                return this.t('errorOcrRequiresKey', 'OCR needs your own API key (OpenAI or Gemini). Add one in Settings.');
            case 'RATE_LIMITED':
                return this.t('errorRateLimited', 'Too many requests. Please wait a moment and try again.');
            case 'QUOTA_EXCEEDED':
                return this.t('errorQuotaExceeded', 'API quota exceeded. Check your provider billing and limits.');
            case 'NETWORK':
                return this.t('errorNetwork', 'Network error. Check your connection and try again.');
            case 'TIMEOUT':
                return this.t('errorTimeout', 'Request timed out. Please try again with a shorter text.');
            case 'CONTENT_TOO_LARGE':
                return this.t('errorContentTooLarge', 'Text is too long for the model. Please try a shorter text.');
            case 'CONTENT_FILTERED':
                return this.t('errorContentFiltered', 'The response was filtered for safety. Try rephrasing your text.');
            default:
                return this.t('errorGeneric', 'Something went wrong. Please try again.');
        }
    }

    /**
     * Convenience for UI layers handling a raw error: classify + localize.
     * @param {Error} error
     * @returns {string}
     */
    toUserMessage(error) {
        return this.messageForCode(this.classify(error), error);
    }

    /**
     * Handle API errors with user-friendly, localized messages.
     * @param {Error} error - The error object
     * @param {string} context - Context where error occurred
     * @returns {string} User-friendly error message
     */
    handleAPIError(error, context = 'API Request') {
        const code = this.classify(error);
        const userMessage = this.messageForCode(code, error);

        this.logError({
            context,
            code,
            error: error.message || String(error),
            userMessage,
            timestamp: Date.now()
        });

        return userMessage;
    }

    /**
     * Handle general errors
     * @param {Error} error - The error object
     * @param {string} context - Context where error occurred
     * @returns {string} User-friendly error message
     */
    handleError(error, context = 'Operation') {
        const errorMessage = error.message || error.toString();

        this.logError({
            context,
            error: errorMessage,
            timestamp: Date.now()
        });

        return `${context} failed: ${errorMessage}`;
    }

    /**
     * Log error to internal log
     * @param {Object} errorInfo - Error information
     */
    logError(errorInfo) {
        this.errorLog.unshift(errorInfo);

        // Keep log size manageable
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog = this.errorLog.slice(0, this.maxLogSize);
        }

        // Also log to console in development
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
            console.error(`[${errorInfo.context}]`, errorInfo.error);
        }
    }

    /**
     * Get error log
     * @returns {Array} Error log
     */
    getErrorLog() {
        return this.errorLog;
    }

    /**
     * Clear error log
     */
    clearErrorLog() {
        this.errorLog = [];
    }

    /**
     * Show toast notification (requires toast UI element)
     * @param {string} message - Message to display
     * @param {string} type - Type of toast (error, success, info)
     */
    showToast(message, type = 'error') {
        // Create toast element if it doesn't exist
        let toast = document.getElementById('lingflow-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'lingflow-toast';
            toast.className = 'lingflow-toast';
            document.body.appendChild(toast);
        }

        // Set message and type
        toast.textContent = message;
        toast.className = `lingflow-toast lingflow-toast-${type} lingflow-toast-visible`;

        // Auto-hide after 4 seconds
        setTimeout(() => {
            toast.classList.remove('lingflow-toast-visible');
        }, 4000);
    }
}

// Singleton instance
export const errorHandler = new ErrorHandler();
