import { APIClient } from '../dist/lib/api-client.bundle.js';
import { StateManager } from '../dist/lib/state-manager.bundle.js';
import { validateMessage } from '../lib/message-validation.js';
import { ensureContentScript, unregisterSelectionScript, ALL_SITES } from '../lib/content-injection.js';

console.log('LingFlow AI Background Service Worker Loaded');

const stateManager = new StateManager();
const apiClient = new APIClient(stateManager);

const MENU = {
    translate: 'lingflow-translate',
    correct: 'lingflow-correct',
    ocr: 'lingflow-ocr'
};

function createContextMenus() {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({ id: MENU.translate, title: chrome.i18n.getMessage('ctxTranslate'), contexts: ['selection'] });
        chrome.contextMenus.create({ id: MENU.correct, title: chrome.i18n.getMessage('ctxCorrect'), contexts: ['selection', 'editable'] });
        chrome.contextMenus.create({ id: MENU.ocr, title: chrome.i18n.getMessage('ctxOcr'), contexts: ['page', 'image'] });
    });
}

chrome.runtime.onInstalled.addListener(() => {
    console.log('LingFlow AI Installed');
    chrome.storage.local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' });
    createContextMenus();
});

// A context-menu click grants activeTab, so the content script can be
// injected into this tab without broad host permissions.
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id || tab.id < 0) return;
    try {
        await ensureContentScript(tab.id);
    } catch (error) {
        console.warn('LingFlow cannot run on this page:', error.message);
        return;
    }

    if (info.menuItemId === MENU.ocr) {
        await stateManager.loadState();
        const provider = stateManager.state.apiProvider;
        if (provider !== 'openai' && provider !== 'gemini') {
            chrome.tabs.sendMessage(tab.id, {
                action: 'show_translation_error',
                error: chrome.i18n.getMessage('errorOcrRequiresKey')
            });
            return;
        }
        chrome.tabs.sendMessage(tab.id, {
            action: 'start_ocr_selection',
            targetLang: stateManager.state.settings?.defaultTargetLang || 'pl'
        });
        return;
    }

    const kind = info.menuItemId === MENU.correct ? 'correct' : 'translate';
    chrome.tabs.sendMessage(tab.id, {
        action: 'run_selection_action',
        kind,
        text: info.selectionText || ''
    }, { frameId: 0 });
});

// If the user revokes "all sites" access in chrome://extensions, stop the
// opt-in selection script so it does not fail on every page load.
chrome.permissions.onRemoved.addListener(async (removed) => {
    const lostAllSites = (removed.origins || []).some(origin => ALL_SITES.origins.includes(origin));
    if (lostAllSites) await unregisterSelectionScript();
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
    const validation = validateMessage(request, sender, chrome.runtime.id);
    if (!validation.valid) {
        sendResponse({ success: false, error: validation.message, code: validation.code });
        return false;
    }

    if (request.action === 'correct_selection') {
        handleCorrection(request.text)
            .then(result => sendResponse({ success: true, data: result }))
            .catch(error => sendResponse({ success: false, error: error.message, code: error.code }));
        return true;
    } else if (request.action === 'translate_selection') {
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

async function handleCorrection(text) {
    await stateManager.loadState();
    const provider = stateManager.state.apiProvider;
    if (provider !== 'openai' && provider !== 'gemini') {
        const error = new Error(chrome.i18n.getMessage('errorInlineCorrectNeedsKey'));
        error.code = 'CHROME_AI_WRONG_CONTEXT';
        throw error;
    }
    return await apiClient.correct(text, 'auto');
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
