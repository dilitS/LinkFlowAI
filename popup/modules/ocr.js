import { elements } from './dom-elements.js';
import { showToast } from './ui-manager.js';

/**
 * Handle OCR capture
 */
export async function handleOCRCapture(apiClient, screenshotManager) {
    try {
        // Check if using free tier
        await apiClient.stateManager.loadState();
        const { apiProvider } = apiClient.stateManager.state;

        if (!apiProvider || apiProvider === 'builtin') {
            showToast(chrome.i18n.getMessage("ocrApiRequired"));
            return;
        }

        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
            throw new Error('No active tab found');
        }

        // Get OCR target lang from state or fallback to 'pl'
        const ocrLang = apiClient.stateManager.state.settings?.defaultTargetLang || 'pl';

        // Send message to content script to start selection
        await chrome.tabs.sendMessage(tab.id, {
            action: 'start_ocr_selection',
            targetLang: ocrLang
        });

        // Close popup to allow selection
        window.close();

    } catch (error) {
        console.error('OCR initiation failed:', error);
        showToast(chrome.i18n.getMessage("ocrInitError") + error.message);
    }
}

/**
 * Close OCR modal
 */
export function closeOCRModal() {
    elements.ocrModal.classList.add('hidden');
    elements.screenshotPreview.classList.add('hidden');
    elements.ocrLoading.classList.add('hidden');
    elements.ocrResults.classList.add('hidden');
}

/**
 * Setup OCR event listeners
 */
export function setupOCRListeners(apiClient, screenshotManager, ttsManager) {
    elements.ocrBtn.addEventListener('click', () => handleOCRCapture(apiClient, screenshotManager));
    elements.closeOcrModal.addEventListener('click', closeOCRModal);

    elements.copyTranscription.addEventListener('click', () => {
        navigator.clipboard.writeText(elements.ocrTranscription.innerText);
        showToast(chrome.i18n.getMessage("toastTranscriptionCopied"));
    });

    elements.copyTranslation.addEventListener('click', () => {
        navigator.clipboard.writeText(elements.ocrTranslation.innerText);
        showToast(chrome.i18n.getMessage("toastTranslationCopied"));
    });

    elements.ocrTranslationTts.addEventListener('click', () => {
        const text = elements.ocrTranslation.innerText;
        const ocrLang = apiClient.stateManager.state.settings?.defaultTargetLang || 'pl';

        const icon = elements.ocrTranslationTts.querySelector('i');
        elements.ocrTranslationTts.classList.add('text-blue-500');
        icon.classList.add('fa-beat-fade');

        ttsManager.speak(text, ocrLang, () => {
            elements.ocrTranslationTts.classList.remove('text-blue-500');
            icon.classList.remove('fa-beat-fade');
        });
    });
}
