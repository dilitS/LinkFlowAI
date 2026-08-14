import { elements } from './dom-elements.js';
import { MODE_COLORS } from './constants.js';
import { updateToneVisibility } from './tone.js';

const MODE_STORAGE_KEY = 'lingflow_mode';
let currentMode = localStorage.getItem(MODE_STORAGE_KEY) || 'translate';

export const PROMPT_CATEGORIES = {
    graphics: [
        { value: 'image-photo', key: 'promptTypePhoto' },
        { value: 'image-graphic', key: 'promptTypeGraphic' },
        { value: 'image-enhance', key: 'promptTypeEnhance' },
        { value: 'ui-web', key: 'promptTypeUiWeb' },
        { value: 'ui-mobile', key: 'promptTypeUiMobile' },
        { value: 'ui-collage', key: 'promptTypeUiCollage' }
    ],
    video: [
        { value: 'video-cinematic', key: 'promptTypeVideoCinematic' },
        { value: 'video-i2v', key: 'promptTypeVideoI2V' },
        { value: 'video-product', key: 'promptTypeVideoProduct' },
        { value: 'video-social', key: 'promptTypeVideoSocial' },
        { value: 'video-loop', key: 'promptTypeVideoLoop' }
    ],
    code: [
        { value: 'code-agent', key: 'promptTypeCodeAgent' },
        { value: 'code-ui-aesthetic', key: 'promptTypeCodeUiAesthetic' }
    ]
};

export function getPromptCategoryFromType(type) {
    if (type?.startsWith('video')) return 'video';
    if (type?.startsWith('code')) return 'code';
    return 'graphics';
}

export function populatePromptStyles(category, selectedType = null) {
    if (!elements.promptTypeSelect) return;
    elements.promptTypeSelect.innerHTML = '';

    const styles = PROMPT_CATEGORIES[category] || [];
    styles.forEach(style => {
        const option = document.createElement('option');
        option.value = style.value;
        option.textContent = chrome.i18n.getMessage(style.key) || style.value;
        elements.promptTypeSelect.appendChild(option);
    });

    if (selectedType && styles.some(s => s.value === selectedType)) {
        elements.promptTypeSelect.value = selectedType;
    } else if (styles.length > 0) {
        elements.promptTypeSelect.value = styles[0].value;
    }

    localStorage.setItem('lingflow_prompt_type', elements.promptTypeSelect.value);
    updatePromptParameterVisibility(elements.promptTypeSelect.value);
}

export function selectPromptCategory(category) {
    localStorage.setItem('lingflow_prompt_category', category);
    
    // Update pills styling
    elements.promptCategoryBtns.forEach(btn => {
        const isActive = btn.dataset.category === category;
        btn.className = `prompt-category-btn flex-1 py-1.5 text-[10px] font-bold rounded-lg ${isActive ? 'text-white bg-[#27272a] shadow-sm' : 'text-gray-500 hover:text-gray-300'} transition-all duration-200 flex justify-center items-center gap-1.5 tracking-wider uppercase`;
        btn.setAttribute('aria-selected', String(isActive));
        btn.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    const savedType = localStorage.getItem('lingflow_prompt_type');
    populatePromptStyles(category, savedType);
}

function normalizeMode(mode) {
    return mode === 'prompt' ? 'prompt' : 'translate';
}

/**
 * Switch between product modes (translate, prompt).
 */
export function switchMode(mode) {
    currentMode = normalizeMode(mode);
    localStorage.setItem(MODE_STORAGE_KEY, currentMode);
    const provider = document.querySelector('input[name="api-provider-select"]:checked')?.value || 'chrome-ai';
    updateToneVisibility(currentMode, provider);
    window.dispatchEvent(new CustomEvent('lingflow:modechange', { detail: currentMode }));

    elements.modeTabs.forEach(tab => {
        const isActive = tab.dataset.mode === currentMode;
        tab.className = `mode-tab flex-1 py-1.5 text-[10px] font-bold rounded-lg ${isActive ? 'text-white bg-[#27272a] shadow-sm' : 'text-gray-500 hover:text-gray-300'} transition-all duration-200 flex justify-center items-center gap-2 tracking-wider uppercase`;
        tab.setAttribute('aria-selected', String(isActive));
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
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
        
        const savedType = getSelectedPromptType();
        const category = getPromptCategoryFromType(savedType);
        selectPromptCategory(category);
    }
}

/**
 * Update visibility of advanced prompt parameters based on selected type
 */
export function updatePromptParameterVisibility(type) {
    const isVideo = type?.startsWith('video');
    const isCode = type?.startsWith('code');

    if (elements.cameraMotionContainer) {
        elements.cameraMotionContainer.style.display = isVideo ? 'flex' : 'none';
    }

    if (elements.aspectRatioContainer) {
        elements.aspectRatioContainer.style.display = isCode ? 'none' : 'flex';
    }
}

/**
 * Get selected prompt type
 */
export function getSelectedPromptType() {
    return elements.promptTypeSelect?.value || localStorage.getItem('lingflow_prompt_type') || 'image-photo';
}

/**
 * Get selected prompt parameters (aspect ratio, camera motion)
 */
export function getPromptParameters() {
    return {
        aspectRatio: elements.promptAspectRatio?.value || localStorage.getItem('lingflow_prompt_ar') || 'auto',
        cameraMotion: elements.promptCameraMotion?.value || localStorage.getItem('lingflow_prompt_camera') || 'auto'
    };
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
