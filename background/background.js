import { APIClient } from '../dist/lib/api-client.bundle.js';
import { StateManager } from '../dist/lib/state-manager.bundle.js';

console.log('LingFlow AI Background Service Worker Loaded');

const stateManager = new StateManager();
const apiClient = new APIClient(stateManager);

const MAX_TEXT_LENGTH = 5000;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB base64

const MESSAGE_SCHEMA = {
    translate_selection: { required: ['text', 'targetLang'], text: MAX_TEXT_LENGTH },
    ocr_area_selected:  { required: ['area'] },
    perform_ocr:        { required: ['image'], image: MAX_IMAGE_SIZE },
    tts_speak:          { required: ['text', 'lang'], text: MAX_TEXT_LENGTH },
    stop_tts:           {},
    get_preferences:    {}
};

function validateMessage(request, sender) {
    const action = request?.action;
    if (!action || typeof action !== 'string') {
        return { valid: false, code: 'INVALID_ACTION', message: 'Missing or invalid action' };
    }
    const schema = MESSAGE_SCHEMA[action];
    if (!schema) {
        return { valid: false, code: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` };
    }
    for (const field of schema.required || []) {
        if (request[field] === undefined || request[field] === null) {
            return { valid: false, code: 'MISSING_FIELD', message: `Missing required field: ${field}` };
        }
    }
    if (schema.text && typeof request.text === 'string' && request.text.length > schema.text) {
        return { valid: false, code: 'INPUT_TOO_LONG', message: `Text exceeds ${schema.text} character limit` };
    }
    if (schema.image && typeof request.image === 'string' && request.image.length > schema.image) {
        return { valid: false, code: 'IMAGE_TOO_LARGE', message: 'Image data exceeds size limit' };
    }
    return { valid: true };
}

chrome.runtime.onInstalled.addListener(() => {
    console.log('LingFlow AI Installed');
    chrome.storage.local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' });
});

// The active tab is passed straight to the listener so we can call
// sidePanel.open() as the FIRST async op — awaiting tabs.query() first would
// consume the user gesture and make open() throw.
chrome.commands?.onCommand.addListener((command, tab) => {
    if (command !== 'open-workspace' || !chrome.sidePanel) return;
    if (!tab?.windowId) return;

    chrome.sidePanel
        .open({ windowId: tab.windowId })
        .catch((error) => console.error('Failed to open LingFlow workspace via shortcut:', error));
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const validation = validateMessage(request, sender);
    if (!validation.valid) {
        sendResponse({ success: false, error: validation.message, code: validation.code });
        return false;
    }

    if (request.action === 'translate_selection') {
        handleTranslation(request.text, request.targetLang)
            .then(result => sendResponse({ success: true, data: result }))
            .catch(error => sendResponse({ success: false, error: error.message, code: error.code }));
        return true;
    } else if (request.action === 'ocr_area_selected') {
        // Capture visible tab
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                const message = chrome.runtime.lastError.message || 'Screenshot capture failed';
                console.error('Capture failed:', chrome.runtime.lastError);
                chrome.tabs.sendMessage(sender.tab.id, {
                    action: 'show_translation_error',
                    error: message
                });
                return;
            }

            if (!dataUrl) {
                chrome.tabs.sendMessage(sender.tab.id, {
                    action: 'show_translation_error',
                    error: 'Screenshot capture returned an empty image.'
                });
                return;
            }
            // Send back to content script for cropping
            chrome.tabs.sendMessage(sender.tab.id, {
                action: 'process_ocr_crop',
                image: dataUrl,
                area: request.area
            });
        });
    } else if (request.action === 'perform_ocr') {
        handleOCR(request.image, request.targetLang)
            .then(result => {
                // Send structured data; the content script builds DOM safely
                // (no HTML string crosses the message boundary).
                chrome.tabs.sendMessage(sender.tab.id, {
                    action: 'show_ocr_result',
                    transcription: result.transcription || '',
                    translation: result.translation || result.transcription || ''
                });
            })
            .catch(error => {
                chrome.tabs.sendMessage(sender.tab.id, {
                    action: 'show_translation_error',
                    error: error.message
                });
            });
    } else if (request.action === 'get_preferences') {
        chrome.storage.local.get(['settings', 'apiProvider'])
            .then(({ settings, apiProvider }) => {
                sendResponse({
                    targetLang: settings?.defaultTargetLang || 'pl',
                    apiProvider: apiProvider || 'chrome-ai',
                    ttsEngine: settings?.ttsEngine || 'web',
                    ttsLanguage: settings?.ttsLanguage || '',
                    ttsVoiceName: settings?.ttsVoiceName || '',
                    ttsSpeed: settings?.ttsSpeed ?? 1.0
                });
            })
            .catch(() => sendResponse({ targetLang: 'pl', apiProvider: 'chrome-ai' }));
        return true;
    } else if (request.action === 'tts_speak') {
        speakText(request.text, request.lang)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    } else if (request.action === 'stop_tts') {
        stopTTS();
        sendResponse({ success: true });
        return false;
    }
});

async function stopTTS() {
    chrome.tts.stop?.();
}

async function handleOCR(image, targetLang) {
    await stateManager.loadState();
    if (!targetLang) {
        targetLang = stateManager.state.settings?.defaultTargetLang || 'pl';
    }
    return await apiClient.translateScreenshot(image, targetLang);
}

async function handleTranslation(text, targetLang) {
    await stateManager.loadState();

    if (!targetLang) {
        targetLang = stateManager.state.settings?.defaultTargetLang || 'pl';
    }

    const provider = stateManager.state.apiProvider;
    if (provider !== 'openai' && provider !== 'gemini') {
        const error = new Error('Chrome AI runs in the page context, not the service worker. Inline translation should use the content script path.');
        error.code = 'CHROME_AI_WRONG_CONTEXT';
        throw error;
    }

    return await apiClient.translate(text, targetLang);
}

async function speakText(text, lang) {
    if (!chrome.tts?.speak) {
        throw new Error('Chrome TTS API is not available');
    }

    const { settings } = await chrome.storage.local.get('settings');
    const effectiveLang = settings?.ttsLanguage || lang || settings?.defaultTargetLang || 'en';
    chrome.tts.stop?.();

    await new Promise((resolve, reject) => {
        chrome.tts.speak(text, {
            lang: effectiveLang,
            voiceName: settings?.ttsVoiceName || undefined,
            enqueue: false
        }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            resolve();
        });
    });
}
