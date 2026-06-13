import { describe, it, expect } from 'vitest';
import { ErrorHandler } from '../lib/error-handler.js';

const handler = new ErrorHandler();

describe('ErrorHandler.classify', () => {
    it('honors an explicit typed code first', () => {
        expect(handler.classify({ code: 'CHROME_AI_UNAVAILABLE' })).toBe('CHROME_AI_UNAVAILABLE');
    });

    it('maps HTTP status codes', () => {
        expect(handler.classify({ status: 429 })).toBe('RATE_LIMITED');
        expect(handler.classify({ status: 401 })).toBe('NO_API_KEY');
        expect(handler.classify({ status: 402 })).toBe('QUOTA_EXCEEDED');
    });

    it('sniffs message text as a last resort', () => {
        expect(handler.classify(new Error('network request failed'))).toBe('NETWORK');
        expect(handler.classify(new Error('The operation timed out'))).toBe('TIMEOUT');
        expect(handler.classify(new Error('content blocked by safety'))).toBe('CONTENT_FILTERED');
        expect(handler.classify(new Error('total mystery'))).toBe('GENERIC');
    });
});

describe('ErrorHandler.messageForCode', () => {
    it('returns localized fallbacks with actionable hints', () => {
        expect(handler.messageForCode('NO_API_KEY')).toMatch(/Settings/i);
        expect(handler.messageForCode('CHROME_AI_UNAVAILABLE')).toMatch(/Chrome/i);
        expect(handler.messageForCode('OCR_REQUIRES_KEY')).toMatch(/API key/i);
    });

    it('interpolates the input limit', () => {
        expect(handler.messageForCode('INPUT_TOO_LONG', { limit: 1234 })).toContain('1234');
    });

    it('falls back to a generic message for unknown codes', () => {
        expect(handler.messageForCode('SOMETHING_NEW')).toMatch(/went wrong/i);
    });
});

describe('ErrorHandler.toUserMessage', () => {
    it('classifies then localizes in one step', () => {
        expect(handler.toUserMessage({ code: 'RATE_LIMITED' })).toMatch(/too many requests/i);
        expect(handler.toUserMessage(new Error('fetch failed'))).toMatch(/network/i);
    });
});
