/**
 * Runtime message validation for the MV3 service worker.
 * Extracted for unit testing — background.js imports from here.
 */

import { SUPPORTED_LANGUAGES } from '../popup/modules/constants.js';

export const MAX_TEXT_LENGTH = 5000;
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB base64

const VALID_LANG_CODES = new Set(SUPPORTED_LANGUAGES.map(l => l.code));

// OCR captures are always base64 data URLs produced by captureVisibleTab.
const IMAGE_DATA_URL_RE = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export const MESSAGE_SCHEMA = {
    translate_selection: { required: ['text', 'targetLang'], text: MAX_TEXT_LENGTH, lang: 'target' },
    ocr_area_selected:  { required: ['area'], needsTab: true },
    perform_ocr:        { required: ['image'], image: MAX_IMAGE_SIZE, lang: 'targetOptional', needsTab: true },
    tts_speak:          { required: ['text', 'lang'], text: MAX_TEXT_LENGTH, lang: 'required' },
    stop_tts:           {},
    get_preferences:    {}
};

/**
 * @param {chrome.runtime.MessageSender} sender
 * @param {string} [extensionId]
 */
export function validateSender(sender, extensionId) {
    if (!sender || typeof sender !== 'object') {
        return { valid: false, code: 'INVALID_SENDER', message: 'Missing sender' };
    }
    // Chrome sets `sender.id` for every message from our own content scripts and
    // extension pages, so a missing id means the message did not come from us.
    if (extensionId) {
        if (!sender.id) {
            return { valid: false, code: 'INVALID_SENDER', message: 'Message without a sender extension ID' };
        }
        if (sender.id !== extensionId) {
            return { valid: false, code: 'INVALID_SENDER', message: 'Message from foreign extension' };
        }
    }
    return { valid: true };
}

function isValidLang(code) {
    return typeof code === 'string' && VALID_LANG_CODES.has(code);
}

function validateArea(area) {
    if (!area || typeof area !== 'object') {
        return { valid: false, code: 'INVALID_AREA', message: 'OCR area must be an object' };
    }
    const { x, y, width, height } = area;
    const nums = [x, y, width, height];
    if (nums.some(v => typeof v !== 'number' || !Number.isFinite(v))) {
        return { valid: false, code: 'INVALID_AREA', message: 'OCR area coordinates must be finite numbers' };
    }
    if (width <= 0 || height <= 0) {
        return { valid: false, code: 'INVALID_AREA', message: 'OCR area must have positive width and height' };
    }
    if (width > 10000 || height > 10000) {
        return { valid: false, code: 'INVALID_AREA', message: 'OCR area exceeds maximum size' };
    }
    return { valid: true };
}

/**
 * @param {Object} request
 * @param {chrome.runtime.MessageSender} sender
 * @param {string} [extensionId]
 */
export function validateMessage(request, sender, extensionId) {
    const senderCheck = validateSender(sender, extensionId);
    if (!senderCheck.valid) return senderCheck;

    const action = request?.action;
    if (!action || typeof action !== 'string') {
        return { valid: false, code: 'INVALID_ACTION', message: 'Missing or invalid action' };
    }

    const schema = MESSAGE_SCHEMA[action];
    if (!schema) {
        return { valid: false, code: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` };
    }

    if (schema.needsTab && !sender.tab?.id) {
        return { valid: false, code: 'INVALID_SENDER', message: 'Action requires an active tab context' };
    }

    for (const field of schema.required || []) {
        const value = request[field];
        if (value === undefined || value === null) {
            return { valid: false, code: 'MISSING_FIELD', message: `Missing required field: ${field}` };
        }
    }

    if (schema.text !== undefined) {
        if (typeof request.text !== 'string') {
            return { valid: false, code: 'INVALID_TYPE', message: 'text must be a string' };
        }
        if (request.text.length > schema.text) {
            return { valid: false, code: 'INPUT_TOO_LONG', message: `Text exceeds ${schema.text} character limit` };
        }
    }

    if (schema.image !== undefined) {
        if (typeof request.image !== 'string') {
            return { valid: false, code: 'INVALID_TYPE', message: 'image must be a string' };
        }
        if (!IMAGE_DATA_URL_RE.test(request.image)) {
            return { valid: false, code: 'INVALID_IMAGE', message: 'image must be a base64 data URL (data:image/…;base64,…)' };
        }
        if (request.image.length > schema.image) {
            return { valid: false, code: 'IMAGE_TOO_LARGE', message: 'Image data exceeds size limit' };
        }
    }

    if (schema.lang === 'target' && !isValidLang(request.targetLang)) {
        return { valid: false, code: 'INVALID_LANGUAGE', message: `Unsupported target language: ${request.targetLang}` };
    }

    if (schema.lang === 'targetOptional' && request.targetLang != null && !isValidLang(request.targetLang)) {
        return { valid: false, code: 'INVALID_LANGUAGE', message: `Unsupported target language: ${request.targetLang}` };
    }

    if (schema.lang === 'required' && !isValidLang(request.lang)) {
        return { valid: false, code: 'INVALID_LANGUAGE', message: `Unsupported language: ${request.lang}` };
    }

    if (action === 'ocr_area_selected') {
        const areaCheck = validateArea(request.area);
        if (!areaCheck.valid) return areaCheck;
    }

    return { valid: true };
}
