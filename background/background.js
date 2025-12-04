import { APIClient } from '../dist/lib/api-client.bundle.js';
import { StateManager } from '../dist/lib/state-manager.bundle.js';

console.log('LingFlow AI Background Service Worker Loaded');

const stateManager = new StateManager();
const apiClient = new APIClient(stateManager);

chrome.runtime.onInstalled.addListener(() => {
    console.log('LingFlow AI Installed');

    // Context Menu removed as per user request
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
                console.error('Capture failed:', chrome.runtime.lastError);
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
                // Format result: Transcription + Translation
                const text = `
                    <div style="margin-bottom: 8px;"><strong>Transcription:</strong><br>${result.transcription}</div>
                    <div><strong>Translation:</strong><br>${result.translation}</div>
                `;
                chrome.tabs.sendMessage(sender.tab.id, {
                    action: 'show_ocr_result',
                    text: text
                });
            })
            .catch(error => {
                chrome.tabs.sendMessage(sender.tab.id, {
                    action: 'show_translation_error',
                    error: error.message
                });
            });
    }
});

async function handleOCR(image, targetLang) {
    await stateManager.loadState();
    await apiClient.fetchRemoteConfig();
    if (!targetLang) {
        targetLang = stateManager.state.settings?.targetLang || 'pl';
    }
    return await apiClient.translateScreenshot(image, targetLang);
}

async function handleTranslation(text, targetLang) {
    // Ensure state is loaded
    await stateManager.loadState();
    await apiClient.fetchRemoteConfig();

    // If targetLang is not provided, use settings or default to 'pl'
    if (!targetLang) {
        targetLang = stateManager.state.settings?.targetLang || 'pl';
    }

    return await apiClient.translate(text, targetLang);
}
