// Import dependencies
import { StateManager } from '../lib/state-manager.js';
import { APIClient } from '../lib/api-client.js';
import { TTSManager } from '../lib/tts-manager.js';
import { ScreenshotManager } from '../lib/screenshot-manager.js';

// Import modules
import { elements } from './modules/dom-elements.js';
import { switchMode, updatePromptTypeVisuals, showToast } from './modules/ui-manager.js';
import { populateLanguages, setupSettingsListeners, loadSettingsToInputs } from './modules/settings.js';
import { setupHistoryListeners, renderHistory } from './modules/history.js';
import { setupTranslationListeners } from './modules/translation.js';
import { setupOCRListeners } from './modules/ocr.js';
import { updateModels } from './modules/constants.js';

// Initialize managers
const stateManager = new StateManager();
const apiClient = new APIClient(stateManager);
const ttsManager = new TTSManager();
const screenshotManager = new ScreenshotManager();

/**
 * Initialize i18n translations
 */
function initI18n() {
    // Replace text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const message = chrome.i18n.getMessage(key);
        if (message) {
            el.textContent = message;
        }
    });

    // Replace placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const message = chrome.i18n.getMessage(key);
        if (message) {
            el.placeholder = message;
        }
    });

    // Replace title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        const message = chrome.i18n.getMessage(key);
        if (message) {
            el.title = message;
        }
    });
}

/**
 * Initialize application
 */
async function initialize() {
    // Initialize i18n translations
    initI18n();

    // Populate UI
    populateLanguages();

    // Restore input text
    const savedInput = localStorage.getItem('lingflow_input_text');
    if (savedInput) {
        elements.inputText.value = savedInput;
    }

    // Setup all event listeners
    setupEventListeners();


    // Subscribe to state changes
    stateManager.subscribe(renderState);

    // Initial render
    renderState(stateManager.state);

    // Fetch remote config for models
    try {
        const config = await apiClient.fetchRemoteConfig();
        if (config && config.freeModels) {
            updateModels('builtin', config.freeModels);
            // Re-render settings to show new models if builtin provider is selected
            loadSettingsToInputs(stateManager.state);
        }
    } catch (e) {
        console.error('Failed to update models:', e);
    }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Mode tabs
    elements.modeTabs.forEach(tab => {
        tab.addEventListener('click', () => switchMode(tab.dataset.mode));
    });

    // Prompt type buttons
    elements.promptTypeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            let finalType = type;

            if (type === 'nanobanana') {
                // Default to gen if just clicking main button
                finalType = 'nanobanana-gen';
            }

            const radio = document.querySelector(`input[name="prompt-type"][value="${finalType}"]`);
            if (radio) radio.checked = true;
            updatePromptTypeVisuals(finalType);
        });
    });

    // Nanobanana sub-buttons
    if (elements.nanoSubBtns) {
        elements.nanoSubBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const subtype = btn.dataset.subtype;
                const finalType = `nanobanana-${subtype}`;

                const radio = document.querySelector(`input[name="prompt-type"][value="${finalType}"]`);
                if (radio) radio.checked = true;
                updatePromptTypeVisuals(finalType);
            });
        });
    }

    // Setup module-specific listeners
    setupSettingsListeners(stateManager, showToast);
    setupHistoryListeners(stateManager);
    setupTranslationListeners(apiClient, stateManager, ttsManager);
    setupOCRListeners(apiClient, screenshotManager, ttsManager);

    // Input persistence
    elements.inputText.addEventListener('input', (e) => {
        localStorage.setItem('lingflow_input_text', e.target.value);
    });

    // Language persistence
    elements.sourceLang.addEventListener('change', (e) => {
        localStorage.setItem('lingflow_source_lang', e.target.value);
    });

    elements.targetLang.addEventListener('change', (e) => {
        localStorage.setItem('lingflow_target_lang', e.target.value);
    });

    // Keyboard shortcuts
    elements.inputText.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            elements.actionBtn.click();
        }
    });
}

/**
 * Render state changes
 */
function renderState(state) {
    renderHistory(state.history, stateManager, showToast);
    loadSettingsToInputs(state);

    // Restore saved languages or apply default
    const savedSourceLang = localStorage.getItem('lingflow_source_lang');
    const savedTargetLang = localStorage.getItem('lingflow_target_lang');

    if (!window.hasAppliedDefaultLang) {
        if (savedSourceLang) {
            elements.sourceLang.value = savedSourceLang;
        }

        if (savedTargetLang) {
            elements.targetLang.value = savedTargetLang;
        } else if (state.settings && state.settings.defaultTargetLang) {
            elements.targetLang.value = state.settings.defaultTargetLang;
        }
        window.hasAppliedDefaultLang = true;
    }
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', initialize);