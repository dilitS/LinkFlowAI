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
     * Handle API errors with user-friendly messages
     * @param {Error} error - The error object
     * @param {string} context - Context where error occurred
     * @returns {string} User-friendly error message
     */
    handleAPIError(error, context = 'API Request') {
        const errorMessage = error.message || error.toString();
        let userMessage = '';

        // Rate limiting
        if (error.status === 429 || errorMessage.includes('rate limit')) {
            userMessage = 'Too many requests. Please wait a moment and try again.';
        }
        // Authentication errors
        else if (error.status === 401 || errorMessage.includes('API key') || errorMessage.includes('unauthorized')) {
            userMessage = 'Invalid API key. Please check your settings and ensure your API key is correct.';
        }
        // Quota exceeded
        else if (error.status === 402 || errorMessage.includes('quota') || errorMessage.includes('billing')) {
            userMessage = 'API quota exceeded. Please check your API account billing and limits.';
        }
        // Network errors
        else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
            userMessage = 'Network error. Please check your internet connection and try again.';
        }
        // Timeout errors
        else if (errorMessage.includes('timeout')) {
            userMessage = 'Request timed out. Please try again with a shorter text.';
        }
        // Content too large
        else if (errorMessage.includes('too large') || errorMessage.includes('max tokens')) {
            userMessage = 'Text is too long. Please try with a shorter text.';
        }
        // Generic API error
        else {
            userMessage = `Error: ${errorMessage}. Please try again.`;
        }

        // Log error
        this.logError({
            context,
            error: errorMessage,
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
