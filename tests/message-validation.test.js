import { describe, it, expect } from 'vitest';
import { validateMessage, validateSender } from '../lib/message-validation.js';

const EXT_ID = 'test-extension-id';

function contentSender(overrides = {}) {
    return { id: EXT_ID, tab: { id: 1, url: 'https://example.com' }, ...overrides };
}

describe('validateSender', () => {
    it('rejects missing sender', () => {
        expect(validateSender(null, EXT_ID)).toMatchObject({ valid: false, code: 'INVALID_SENDER' });
    });

    it('rejects foreign extension', () => {
        expect(validateSender({ id: 'other-ext' }, EXT_ID)).toMatchObject({ valid: false, code: 'INVALID_SENDER' });
    });

    it('accepts matching extension id', () => {
        expect(validateSender({ id: EXT_ID }, EXT_ID)).toEqual({ valid: true });
    });
});

describe('validateMessage — happy paths', () => {
    it('accepts translate_selection with valid fields', () => {
        const result = validateMessage({
            action: 'translate_selection',
            text: 'hello',
            targetLang: 'pl'
        }, contentSender(), EXT_ID);
        expect(result).toEqual({ valid: true });
    });

    it('accepts get_preferences without tab', () => {
        const result = validateMessage({ action: 'get_preferences' }, { id: EXT_ID }, EXT_ID);
        expect(result).toEqual({ valid: true });
    });

    it('accepts ocr_area_selected with valid area', () => {
        const result = validateMessage({
            action: 'ocr_area_selected',
            area: { x: 10, y: 20, width: 100, height: 50 }
        }, contentSender(), EXT_ID);
        expect(result).toEqual({ valid: true });
    });
});

describe('validateMessage — rejection cases', () => {
    it('rejects unknown action', () => {
        expect(validateMessage({ action: 'evil' }, contentSender(), EXT_ID))
            .toMatchObject({ valid: false, code: 'UNKNOWN_ACTION' });
    });

    it('rejects missing action', () => {
        expect(validateMessage({}, contentSender(), EXT_ID))
            .toMatchObject({ valid: false, code: 'INVALID_ACTION' });
    });

    it('rejects non-string text', () => {
        expect(validateMessage({
            action: 'translate_selection',
            text: 42,
            targetLang: 'pl'
        }, contentSender(), EXT_ID)).toMatchObject({ valid: false, code: 'INVALID_TYPE' });
    });

    it('rejects oversize text', () => {
        expect(validateMessage({
            action: 'translate_selection',
            text: 'x'.repeat(5001),
            targetLang: 'pl'
        }, contentSender(), EXT_ID)).toMatchObject({ valid: false, code: 'INPUT_TOO_LONG' });
    });

    it('rejects invalid target language', () => {
        expect(validateMessage({
            action: 'translate_selection',
            text: 'hi',
            targetLang: 'xx'
        }, contentSender(), EXT_ID)).toMatchObject({ valid: false, code: 'INVALID_LANGUAGE' });
    });

    it('rejects OCR without tab context', () => {
        expect(validateMessage({
            action: 'ocr_area_selected',
            area: { x: 0, y: 0, width: 10, height: 10 }
        }, { id: EXT_ID }, EXT_ID)).toMatchObject({ valid: false, code: 'INVALID_SENDER' });
    });

    it('rejects malicious OCR area', () => {
        expect(validateMessage({
            action: 'ocr_area_selected',
            area: { x: 0, y: 0, width: -5, height: 10 }
        }, contentSender(), EXT_ID)).toMatchObject({ valid: false, code: 'INVALID_AREA' });
    });

    it('rejects injection-style unknown action name', () => {
        expect(validateMessage({
            action: 'drop table',
            text: 'x',
            targetLang: 'pl'
        }, contentSender(), EXT_ID)).toMatchObject({ valid: false, code: 'UNKNOWN_ACTION' });
    });

    it('rejects oversize image payload', () => {
        expect(validateMessage({
            action: 'perform_ocr',
            image: 'a'.repeat(10 * 1024 * 1024 + 1)
        }, contentSender(), EXT_ID)).toMatchObject({ valid: false, code: 'IMAGE_TOO_LARGE' });
    });
});
