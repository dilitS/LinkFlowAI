import { APIClient } from '../dist/lib/api-client.bundle.js';
import { StateManager } from '../dist/lib/state-manager.bundle.js';

console.log('LingFlow AI Background Service Worker Loaded');

const stateManager = new StateManager();
const apiClient = new APIClient(stateManager);

chrome.runtime.onInstalled.addListener(() => {
    console.log('LingFlow AI Installed');
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

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'translate_selection') {
        handleTranslation(request.text, request.targetLang)
            .then(result => sendResponse({ success: true, data: result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Will respond asynchronously
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
    } else if (request.action === 'tts_speak') {
        speakText(request.text, request.lang)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    } else if (request.action === 'piper_speak') {
        playPiperTTS(request.text, request.voiceId)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    } else if (request.action === 'stop_tts') {
        stopTTS();
        sendResponse({ success: true });
        return false;
    }
});

let creatingOffscreenPromise = null;
const OFFSCREEN_PATH = 'offscreen/offscreen.html';

async function setupOffscreenDocument() {
    if (await chrome.offscreen.hasDocument()) return;
    if (creatingOffscreenPromise) {
        await creatingOffscreenPromise;
        return;
    }
    creatingOffscreenPromise = chrome.offscreen.createDocument({
        url: OFFSCREEN_PATH,
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Synthesize and play offline Piper TTS audio'
    });
    await creatingOffscreenPromise;
    creatingOffscreenPromise = null;
}

async function playPiperTTS(text, voiceId) {
    await setupOffscreenDocument();
    const response = await chrome.runtime.sendMessage({
        action: 'play_piper_tts',
        text,
        voiceId
    });
    if (response && !response.success) {
        throw new Error(response.error);
    }
}

async function stopTTS() {
    chrome.tts.stop?.();
    if (await chrome.offscreen.hasDocument()) {
        chrome.runtime.sendMessage({ action: 'stop_tts' }).catch(() => {});
    }
}

async function handleOCR(image, targetLang) {
    await stateManager.loadState();
    if (!targetLang) {
        targetLang = stateManager.state.settings?.defaultTargetLang || 'pl';
    }
    return await apiClient.translateScreenshot(image, targetLang);
}

async function handleTranslation(text, targetLang) {
    // Ensure state is loaded
    await stateManager.loadState();

    // If targetLang is not provided, use settings or default to 'pl'
    if (!targetLang) {
        targetLang = stateManager.state.settings?.defaultTargetLang || 'pl';
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
