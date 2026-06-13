// Import dependencies
import { StateManager } from '../lib/state-manager.js';
import { APIClient } from '../lib/api-client.js';
import { TTSManager } from '../lib/tts-manager.js';
import { ScreenshotManager } from '../lib/screenshot-manager.js';

// Import modules
import { elements } from './modules/dom-elements.js';
import { switchMode, updatePromptTypeVisuals, showToast } from './modules/ui-manager.js';
import { populateLanguages, setupSettingsListeners, loadSettingsToInputs, toggleSettings } from './modules/settings.js';
import { setupHistoryListeners, renderHistory } from './modules/history.js';
import { setupTranslationListeners } from './modules/translation.js';
import { setupOCRListeners, closeOCRModal } from './modules/ocr.js';
import { renderTonePills } from './modules/tone.js';
import { initSessionMeta, renderSessionMeta } from './modules/session-meta.js';

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
    applySurfaceMode();

    // Initialize i18n translations
    initI18n();

    // Populate UI
    populateLanguages();
    renderTonePills();
    initSessionMeta(stateManager);

    // Restore input text
    const savedInput = localStorage.getItem('lingflow_input_text');
    if (savedInput) {
        elements.inputText.value = savedInput;
    }

    // Setup all event listeners
    setupEventListeners();

    // Restore last active mode (syncs tabs, action button, tone & prompt options)
    switchMode(localStorage.getItem('lingflow_mode') || 'translate');


    // Subscribe to state changes
    stateManager.subscribe(renderState);

    // Initial render
    renderState(stateManager.state);
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
            const radio = document.querySelector(`input[name="prompt-type"][value="${type}"]`);
            if (radio) radio.checked = true;
            updatePromptTypeVisuals(type);
        });
    });

    // Setup module-specific listeners
    setupSettingsListeners(stateManager, showToast);
    setupHistoryListeners(stateManager, showToast);
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

    elements.targetLang.addEventListener('change', async (e) => {
        const value = e.target.value;
        localStorage.setItem('lingflow_target_lang', value);
        // Keep the on-page selection / OCR target language in sync with the
        // language the user picks here, so "the language I set" is consistent
        // across the popup, inline translation, and OCR.
        await stateManager.setState({
            settings: {
                ...stateManager.state.settings,
                defaultTargetLang: value
            }
        });
    });

    // Keyboard shortcuts
    elements.inputText.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            elements.actionBtn.click();
        }
    });

    // Global Escape: close any open overlay (settings panel / OCR modal)
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (!elements.ocrModal.classList.contains('hidden')) {
            closeOCRModal();
        } else if (!elements.settingsView.classList.contains('translate-y-full')) {
            toggleSettings();
        }
    });
}

function applySurfaceMode() {
    const params = new URLSearchParams(window.location.search);
    const surface = params.get('surface') || 'popup';

    document.body.dataset.surface = surface;
    if (surface === 'sidepanel') {
        document.body.classList.remove('w-[360px]', 'min-h-[500px]');
        document.body.classList.add('w-full', 'min-h-screen');
    }
}

/**
 * Render state changes
 */
function renderState(state) {
    renderHistory(state.history, stateManager, showToast);
    loadSettingsToInputs(state);
    renderSessionMeta(state);

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