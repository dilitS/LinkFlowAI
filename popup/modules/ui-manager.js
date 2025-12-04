import { elements } from './dom-elements.js';
import { MODE_COLORS } from './constants.js';

let currentMode = 'translate';

/**
 * Switch between translation modes (translate, correct, prompt)
 */
export function switchMode(mode) {
    currentMode = mode;

    // Update Tabs UI
    elements.modeTabs.forEach(tab => {
        if (tab.dataset.mode === mode) {
            tab.className = 'mode-tab flex-1 py-1.5 text-[10px] font-bold rounded-lg text-white bg-[#27272a] shadow-sm transition-all duration-200 flex justify-center items-center gap-2 tracking-wider uppercase';
        } else {
            tab.className = 'mode-tab flex-1 py-1.5 text-[10px] font-bold rounded-lg text-gray-500 hover:text-gray-300 transition-all duration-200 flex justify-center items-center gap-2 tracking-wider uppercase';
        }
    });

    // Update Action Button
    const btnSpan = elements.actionBtn.querySelector('span');
    elements.actionBtn.className = `relative z-10 text-white text-sm font-bold uppercase tracking-wider py-3.5 px-12 rounded-full transition-all hover:scale-105 active:scale-95 group ${MODE_COLORS[mode].btn} ${MODE_COLORS[mode].shadow}`;
    btnSpan.textContent = MODE_COLORS[mode].text;

    // Update UI visibility
    if (mode === 'translate') {
        elements.promptOptions.classList.add('hidden');
        elements.ocrBtn.style.display = 'flex';
        elements.inputText.placeholder = chrome.i18n.getMessage("inputPlaceholder");
        elements.outputLabel.textContent = chrome.i18n.getMessage("outputLabel");
    } else if (mode === 'correct') {
        elements.promptOptions.classList.add('hidden');
        elements.ocrBtn.style.display = 'none';
        elements.inputText.placeholder = chrome.i18n.getMessage("inputPlaceholderCorrect");
        elements.outputLabel.textContent = chrome.i18n.getMessage("correctMode");
    } else if (mode === 'prompt') {
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
    // Handle main type buttons
    const mainType = type.startsWith('nanobanana') ? 'nanobanana' : type;

    elements.promptTypeBtns.forEach(btn => {
        if (btn.dataset.type === mainType) {
            btn.className = 'prompt-type-btn flex-1 py-2 px-3 text-xs font-medium rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-400 flex items-center justify-center gap-2 hover:bg-orange-500/20 transition-colors';
        } else {
            btn.className = 'prompt-type-btn flex-1 py-2 px-3 text-xs font-medium rounded-lg border border-gray-700 bg-[#1e1e1e] text-gray-500 flex items-center justify-center gap-2 hover:bg-[#252525] hover:text-gray-300 transition-colors';
        }
    });

    // Show/hide Nanobanana sub-options
    if (mainType === 'nanobanana') {
        elements.nanoOptions.classList.remove('hidden');

        // Update sub-buttons visuals
        const subType = type === 'nanobanana-edit' ? 'edit' : 'gen';
        elements.nanoSubBtns.forEach(btn => {
            if (btn.dataset.subtype === subType) {
                btn.className = 'nano-sub-btn flex-1 py-1 px-2 text-[10px] font-medium rounded border border-purple-500/30 bg-purple-500/10 text-purple-400 flex items-center justify-center gap-1 hover:bg-purple-500/20 transition-colors';
            } else {
                btn.className = 'nano-sub-btn flex-1 py-1 px-2 text-[10px] font-medium rounded border border-gray-700 bg-[#1e1e1e] text-gray-500 flex items-center justify-center gap-1 hover:bg-[#252525] hover:text-gray-300 transition-colors';
            }
        });

        // Show style selector based on mode
        if (subType === 'gen') {
            elements.nanoStyleContainer.classList.remove('hidden');
            elements.nanoEditStyleContainer.classList.add('hidden');
        } else {
            elements.nanoStyleContainer.classList.add('hidden');
            elements.nanoEditStyleContainer.classList.remove('hidden');
        }
    } else {
        elements.nanoOptions.classList.add('hidden');
    }
}

/**
 * Get selected prompt type
 */
export function getSelectedPromptType() {
    for (const radio of elements.promptTypeRadios) {
        if (radio.checked) return radio.value;
    }
    return 'image';
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
 * Set loading state on action button
 */
export function setLoading(isLoading) {
    const btnSpan = elements.actionBtn.querySelector('span');
    if (isLoading) {
        elements.actionBtn.disabled = true;
        btnSpan.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        elements.actionBtn.classList.add('opacity-75', 'cursor-not-allowed');
    } else {
        elements.actionBtn.disabled = false;
        btnSpan.textContent = MODE_COLORS[currentMode].text;
        elements.actionBtn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
}

/**
 * Get current mode
 */
export function getCurrentMode() {
    return currentMode;
}
