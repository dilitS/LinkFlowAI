import { elements } from './dom-elements.js';
import { getCurrentMode, getSelectedPromptType, setLoading, showToast } from './ui-manager.js';
import { addToHistory } from './history.js';

/**
 * Setup translation/action event listeners
 */
export function setupTranslationListeners(apiClient, stateManager, ttsManager) {
    // Action button (Translate/Correct/Prompt)
    elements.actionBtn.addEventListener('click', async () => {
        const text = elements.inputText.value.trim();
        if (!text) {
            showToast(chrome.i18n.getMessage("toastEnterText"));
            return;
        }

        const mode = getCurrentMode();
        const targetLang = elements.targetLang.value;

        setLoading(true);
        elements.outputText.textContent = chrome.i18n.getMessage("processingText");
        elements.outputContainer.classList.add('animate-pulse');

        try {
            let result;
            if (mode === 'translate') {
                result = await apiClient.translate(text, targetLang);
            } else if (mode === 'correct') {
                result = await apiClient.correct(text, targetLang);
            } else if (mode === 'prompt') {
                let type = getSelectedPromptType();

                // Append style for Nanobanana Generation or Editing
                if (type === 'nanobanana-gen') {
                    const style = elements.nanoStyleSelect.value;
                    type = `${type}:${style}`;
                } else if (type === 'nanobanana-edit') {
                    const style = elements.nanoEditStyleSelect.value;
                    type = `${type}:${style}`;
                }

                result = await apiClient.generatePrompt(text, targetLang, type);
            }

            elements.outputText.textContent = result;
            elements.outputText.classList.remove('italic', 'text-gray-500');
            elements.outputText.classList.add('text-gray-200');

            // Add to history
            stateManager.addToHistory({
                id: Date.now(),
                mode: mode,
                sourceText: text,
                targetText: result,
                targetLang: targetLang,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Action failed:', error);
            elements.outputText.textContent = `${chrome.i18n.getMessage("errorPrefix")}${error.message}`;
            showToast(chrome.i18n.getMessage("toastError"));
        } finally {
            setLoading(false);
            elements.outputContainer.classList.remove('animate-pulse');
        }
    });

    // Language swap
    elements.swapLangBtn.addEventListener('click', () => {
        const sourceVal = elements.sourceLang.value;
        const targetVal = elements.targetLang.value;

        if (sourceVal !== 'auto') {
            elements.sourceLang.value = targetVal;
            elements.targetLang.value = sourceVal;
        }
    });

    // Input tools
    if (elements.clearInputBtn) {
        elements.clearInputBtn.addEventListener('click', () => {
            elements.inputText.value = '';

            // Clear output as well
            elements.outputText.innerText = chrome.i18n.getMessage("outputTextPlaceholder");
            elements.outputText.classList.add('italic', 'text-gray-500');
            elements.outputText.classList.remove('text-gray-200');

            elements.inputText.focus();
        });
    }

    if (elements.pasteBtn) {
        elements.pasteBtn.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                elements.inputText.value = text;
            } catch (err) {
                console.error('Failed to read clipboard', err);
            }
        });
    }

    // Input TTS
    if (elements.inputTtsBtn) {
        elements.inputTtsBtn.addEventListener('click', () => {
            const text = elements.inputText.value.trim();
            if (!text) return;

            const icon = elements.inputTtsBtn.querySelector('i');
            icon.classList.add('speaking-icon');

            let lang = elements.sourceLang.value;
            if (lang === 'auto') lang = 'en';

            ttsManager.speak(text, lang, () => {
                icon.classList.remove('speaking-icon');
            });
        });
    }

    // Output tools
    elements.copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(elements.outputText.innerText);
        showToast(chrome.i18n.getMessage("toastCopied"));
    });

    elements.outputTtsBtn.addEventListener('click', () => {
        const text = elements.outputText.innerText;
        if (!text || text.includes('Wynik pojawi się tutaj')) return;

        const icon = elements.outputTtsBtn.querySelector('i');
        icon.classList.add('speaking-icon');

        ttsManager.speak(text, elements.targetLang.value, () => {
            icon.classList.remove('speaking-icon');
        });
    });
}
