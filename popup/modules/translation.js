import { elements } from './dom-elements.js';
import { getCurrentMode, getSelectedPromptType, setLoading, showToast } from './ui-manager.js';
import { getCurrentTone } from './tone.js';

const MAX_CHARS = 5000;

// In-flight request state (module scoped).
let isProcessing = false;
let abortController = null;

/**
 * Resolve the prompt type string, appending the Nanobanana style when relevant.
 */
function resolvePromptType() {
    let type = getSelectedPromptType();
    if (type === 'nanobanana-gen') {
        return `${type}:${elements.nanoStyleSelect.value}`;
    }
    if (type === 'nanobanana-edit') {
        return `${type}:${elements.nanoEditStyleSelect.value}`;
    }
    return type;
}

/**
 * Update the live character counter and warn as the limit approaches.
 */
function updateCharCounter() {
    if (!elements.charCounter) return;
    const len = elements.inputText.value.length;
    elements.charCounter.textContent = `${len} / ${MAX_CHARS}`;
    elements.charCounter.classList.toggle('text-red-400', len > MAX_CHARS);
    elements.charCounter.classList.toggle('text-amber-400', len <= MAX_CHARS && len > MAX_CHARS * 0.9);
    elements.charCounter.classList.toggle('text-gray-600', len <= MAX_CHARS * 0.9);
}

function showOutputPlaceholder() {
    elements.outputText.innerHTML = `<span class="italic text-gray-500">${chrome.i18n.getMessage('outputTextPlaceholder')}</span>`;
}

function setStreamingState(streaming) {
    elements.outputContainer.classList.toggle('is-streaming', streaming);
}

/**
 * Run the current action (translate / correct / prompt) with streaming output.
 * @param {boolean} force - bypass cache (used by "Regenerate").
 */
async function runAction(apiClient, stateManager, force = false) {
    const text = elements.inputText.value.trim();
    if (!text) {
        showToast(chrome.i18n.getMessage('toastEnterText'));
        return;
    }

    const mode = getCurrentMode();
    const targetLang = elements.targetLang.value;
    const tone = getCurrentTone();

    isProcessing = true;
    abortController = new AbortController();
    let firstChunk = true;

    setLoading(true, false);
    if (elements.regenerateBtn) elements.regenerateBtn.disabled = true;
    elements.outputText.textContent = chrome.i18n.getMessage('processingText');
    elements.outputText.classList.remove('text-gray-200');
    elements.outputContainer.classList.add('animate-pulse');

    const onStream = (accumulated) => {
        if (abortController?.signal.aborted) return;
        if (firstChunk) {
            firstChunk = false;
            elements.outputContainer.classList.remove('animate-pulse');
            elements.outputText.classList.remove('italic', 'text-gray-500');
            elements.outputText.classList.add('text-gray-200');
            setStreamingState(true);
            setLoading(true, true);
        }
        elements.outputText.textContent = accumulated;
    };

    const options = { onStream, signal: abortController.signal, tone, force };

    try {
        let result;
        if (mode === 'translate') {
            result = await apiClient.translate(text, targetLang, options);
        } else if (mode === 'correct') {
            result = await apiClient.correct(text, targetLang, options);
        } else {
            result = await apiClient.generatePrompt(text, targetLang, resolvePromptType(), options);
        }

        // If the user hit Stop on a non-streaming provider, keep partial state.
        if (abortController?.signal.aborted) {
            showToast(chrome.i18n.getMessage('toastStopped'));
            return;
        }

        elements.outputText.textContent = result;
        elements.outputText.classList.remove('italic', 'text-gray-500');
        elements.outputText.classList.add('text-gray-200');

        stateManager.addToHistory({
            id: Date.now().toString(),
            mode,
            sourceText: text,
            targetText: result,
            input: text,
            output: result,
            targetLang,
            tone,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        if (error.name === 'AbortError' || abortController?.signal.aborted) {
            // User-initiated stop: keep whatever streamed so far.
            showToast(chrome.i18n.getMessage('toastStopped'));
        } else {
            console.error('Action failed:', error);
            elements.outputText.textContent = `${chrome.i18n.getMessage('errorPrefix')}${error.message}`;
            elements.outputText.classList.remove('italic', 'text-gray-500');
            elements.outputContainer.classList.remove('surface-shake');
            void elements.outputContainer.offsetWidth;
            elements.outputContainer.classList.add('surface-shake');
            showToast(chrome.i18n.getMessage('toastError'));
        }
    } finally {
        isProcessing = false;
        abortController = null;
        setLoading(false);
        setStreamingState(false);
        elements.outputContainer.classList.remove('animate-pulse');
        if (elements.regenerateBtn) elements.regenerateBtn.disabled = false;
    }
}

/**
 * Setup translation/action event listeners
 */
export function setupTranslationListeners(apiClient, stateManager, ttsManager) {
    // Initial counter state
    updateCharCounter();

    // Action button doubles as a Stop control while processing.
    elements.actionBtn.addEventListener('click', () => {
        if (isProcessing) {
            abortController?.abort();
            return;
        }
        runAction(apiClient, stateManager, false);
    });

    // Regenerate (bypass cache)
    if (elements.regenerateBtn) {
        elements.regenerateBtn.addEventListener('click', () => {
            if (isProcessing) return;
            runAction(apiClient, stateManager, true);
        });
    }

    // Language swap
    elements.swapLangBtn.addEventListener('click', () => {
        const sourceVal = elements.sourceLang.value;
        const targetVal = elements.targetLang.value;

        if (sourceVal !== 'auto') {
            elements.sourceLang.value = targetVal;
            elements.targetLang.value = sourceVal;
            localStorage.setItem('lingflow_source_lang', elements.sourceLang.value);
            localStorage.setItem('lingflow_target_lang', elements.targetLang.value);
        } else {
            showToast(chrome.i18n.getMessage('toastAutoLanguageSwapError'));
        }
    });

    // Input tools
    if (elements.clearInputBtn) {
        elements.clearInputBtn.addEventListener('click', () => {
            elements.inputText.value = '';
            localStorage.setItem('lingflow_input_text', '');
            updateCharCounter();
            elements.inputText.dispatchEvent(new Event('input', { bubbles: true }));
            showOutputPlaceholder();
            elements.inputText.focus();
        });
    }

    if (elements.pasteBtn) {
        elements.pasteBtn.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                elements.inputText.value = text;
                localStorage.setItem('lingflow_input_text', text);
                updateCharCounter();
                elements.inputText.dispatchEvent(new Event('input', { bubbles: true }));
            } catch (err) {
                console.error('Failed to read clipboard', err);
            }
        });
    }

    // Live character counter
    elements.inputText.addEventListener('input', updateCharCounter);

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
        const text = elements.outputText.innerText.trim();
        if (!text) return;
        navigator.clipboard.writeText(text);
        showToast(chrome.i18n.getMessage('toastCopied'));
    });

    elements.outputTtsBtn.addEventListener('click', () => {
        const text = elements.outputText.innerText;
        if (!text || text.includes(chrome.i18n.getMessage('outputTextPlaceholder'))) return;

        const icon = elements.outputTtsBtn.querySelector('i');
        icon.classList.add('speaking-icon');

        ttsManager.speak(text, elements.targetLang.value, () => {
            icon.classList.remove('speaking-icon');
        });
    });
}
