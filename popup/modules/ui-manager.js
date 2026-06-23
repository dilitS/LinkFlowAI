import { elements } from './dom-elements.js';
import { MODE_COLORS } from './constants.js';
import { updateToneVisibility } from './tone.js';

const MODE_STORAGE_KEY = 'lingflow_mode';
let currentMode = localStorage.getItem(MODE_STORAGE_KEY) || 'translate';

function normalizeMode(mode) {
    return mode === 'prompt' ? 'prompt' : 'translate';
}

/**
 * Switch between product modes (translate, prompt).
 */
export function switchMode(mode) {
    currentMode = normalizeMode(mode);
    localStorage.setItem(MODE_STORAGE_KEY, currentMode);
    updateToneVisibility(currentMode);
    window.dispatchEvent(new CustomEvent('lingflow:modechange', { detail: currentMode }));

    // Update Tabs UI
    elements.modeTabs.forEach(tab => {
        if (tab.dataset.mode === currentMode) {
            tab.className = 'mode-tab flex-1 py-1.5 text-[10px] font-bold rounded-lg text-white bg-[#27272a] shadow-sm transition-all duration-200 flex justify-center items-center gap-2 tracking-wider uppercase';
        } else {
            tab.className = 'mode-tab flex-1 py-1.5 text-[10px] font-bold rounded-lg text-gray-500 hover:text-gray-300 transition-all duration-200 flex justify-center items-center gap-2 tracking-wider uppercase';
        }
    });

    // Update Action Button
    const btnSpan = elements.actionBtn.querySelector('span');
    elements.actionBtn.className = `relative z-10 text-white text-sm font-bold uppercase tracking-wider py-3.5 px-12 rounded-full transition-all hover:scale-105 active:scale-95 group ${MODE_COLORS[currentMode].btn} ${MODE_COLORS[currentMode].shadow}`;
    btnSpan.textContent = MODE_COLORS[currentMode].text;

    // Update UI visibility
    if (currentMode === 'translate') {
        elements.promptOptions.classList.add('hidden');
        elements.ocrBtn.style.display = 'flex';
        elements.inputText.placeholder = chrome.i18n.getMessage("inputPlaceholder");
        elements.outputLabel.textContent = chrome.i18n.getMessage("outputLabel");
    } else if (currentMode === 'prompt') {
        elements.promptOptions.classList.remove('hidden');
        elements.ocrBtn.style.display = 'none';
        elements.inputText.placeholder = chrome.i18n.getMessage("inputPlaceholderPrompt");
        elements.outputLabel.textContent = chrome.i18n.getMessage("promptMode");
        updatePromptTypeVisuals(getSelectedPromptType());
    }
}

/**
 * Update prompt type button visuals
 */
export function updatePromptTypeVisuals(type) {
    elements.promptTypeBtns.forEach(btn => {
        if (btn.dataset.type === type) {
            if (type === 'image-universal') {
                btn.className = 'prompt-type-btn flex-1 py-2 px-3 text-xs font-medium rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 flex items-center justify-center gap-2 hover:bg-green-500/20 transition-colors';
            } else {
                btn.className = 'prompt-type-btn flex-1 py-2 px-3 text-xs font-medium rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-400 flex items-center justify-center gap-2 hover:bg-orange-500/20 transition-colors';
            }
        } else {
            btn.className = 'prompt-type-btn flex-1 py-2 px-3 text-xs font-medium rounded-lg border border-gray-700 bg-[#1e1e1e] text-gray-500 flex items-center justify-center gap-2 hover:bg-[#252525] hover:text-gray-300 transition-colors';
        }
    });
}

/**
 * Get selected prompt type
 */
export function getSelectedPromptType() {
    for (const radio of elements.promptTypeRadios) {
        if (radio.checked) return radio.value;
    }
    return 'image-photo';
}

/**
 * Show toast notification
 */
export function showToast(msg) {
    const toast = elements.toast;
    toast.querySelector('span').innerText = msg;
    toast.classList.remove('translate-y-24', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-24', 'opacity-0');
    }, 2000);
}

/**
 * Set loading state on action button.
 * While processing the button turns into a clickable "Stop" control so the
 * user can abort an in-flight (streaming) request.
 * @param {boolean} isLoading
 * @param {boolean} [streaming=false] - true once tokens start arriving
 */
export function setLoading(isLoading, streaming = false) {
    const btnSpan = elements.actionBtn.querySelector('span');
    if (isLoading) {
        elements.actionBtn.classList.add('is-processing');
        if (streaming) {
            btnSpan.innerHTML = '<i class="fa-solid fa-stop text-xs"></i> STOP';
        } else {
            btnSpan.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        }
    } else {
        elements.actionBtn.classList.remove('is-processing');
        btnSpan.textContent = MODE_COLORS[currentMode].text;
    }
}

/**
 * Get current mode
 */
export function getCurrentMode() {
    return currentMode;
}
