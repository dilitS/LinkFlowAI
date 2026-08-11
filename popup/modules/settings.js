import { elements } from './dom-elements.js';
import { SUPPORTED_LANGUAGES, MODELS } from './constants.js';
import { escapeHtml } from '../../lib/sanitize.js';
import { ChromeAIProvider, CHROME_AI_STATUS } from '../../lib/chrome-ai-provider.js';
import { getCurrentMode } from './ui-manager.js';
import { updateToneVisibility } from './tone.js';

/**
 * Populate language dropdowns
 */
export function populateLanguages() {
    const createOption = (lang) => `<option value="${lang.code}">${lang.name}</option>`;
    const options = SUPPORTED_LANGUAGES.map(createOption).join('');

    elements.sourceLang.innerHTML = `<option value="auto">${chrome.i18n.getMessage("detectLanguageOption")}</option>` + options;
    elements.targetLang.innerHTML = options;

    // Populate settings dropdowns
    // Populate settings dropdowns
    elements.settingsTargetLang.innerHTML = options;
    if (elements.ttsLanguage) {
        elements.ttsLanguage.innerHTML = options;
    }

    // Set defaults
    elements.targetLang.value = 'en';
}

function getChromeTtsVoices() {
    return new Promise(resolve => {
        if (!chrome.tts?.getVoices) {
            resolve([]);
            return;
        }
        chrome.tts.getVoices(voices => resolve(voices || []));
    });
}

async function populateTtsVoices(settings = {}) {
    if (!elements.ttsVoice) return;

    const lang = elements.ttsLanguage?.value || settings.ttsLanguage || settings.defaultTargetLang || 'en';
    const base = lang.split('-')[0].toLowerCase();

    let voiceOptions = ['<option value="">Auto</option>'];

    const voices = await getChromeTtsVoices();
    const filtered = voices.filter(voice => {
        const voiceLang = String(voice.lang || '').toLowerCase();
        return !voiceLang || voiceLang.startsWith(base);
    });
    voiceOptions.push(...filtered.map(voice => {
        const name = escapeHtml(voice.voiceName);
        const vlang = voice.lang ? ` (${escapeHtml(voice.lang)})` : '';
        return `<option value="${name}">${name}${vlang}</option>`;
    }));

    elements.ttsVoice.innerHTML = voiceOptions.join('');
    if (settings.ttsVoiceName && [...elements.ttsVoice.options].some(option => option.value === settings.ttsVoiceName)) {
        elements.ttsVoice.value = settings.ttsVoiceName;
    }
}

/**
 * Populate model dropdown based on provider
 */
export function populateModels(provider, selectedModelId = null) {
    const models = MODELS[provider] || [];
    elements.modelSelect.innerHTML = models.map(m =>
        `<option value="${m.id}">${m.name}</option>`
    ).join('');

    if (selectedModelId && models.find(m => m.id === selectedModelId)) {
        elements.modelSelect.value = selectedModelId;
    } else if (models.length > 0) {
        elements.modelSelect.value = models[0].id;
    }
}

/**
 * Toggle settings panel
 */
export function toggleSettings() {
    elements.settingsView.classList.toggle('translate-y-full');
}

/**
 * Load settings from state to UI
 */
// Treat any legacy/unknown provider (e.g. the old `builtin` OpenRouter tier) as
// the on-device Chrome AI free tier.
function normalizeProvider(provider) {
    return provider === 'openai' || provider === 'gemini' ? provider : 'chrome-ai';
}

const chromeAI = new ChromeAIProvider();
let chromeAiStatusChecked = false;

async function updateChromeAiStatus() {
    if (!elements.chromeAiStatus) return;
    if (chromeAiStatusChecked) return;
    chromeAiStatusChecked = true;

    if (!chromeAI.isSupported()) {
        elements.chromeAiStatus.textContent = 'Niedostępne w tej przeglądarce. Wymagany Chrome 138+ z obsługą AI.';
        elements.chromeAiStatus.classList.remove('hidden');
        elements.chromeAiStatus.classList.add('text-red-400');
        return;
    }

    try {
        const status = await chromeAI.checkAvailability();
        const states = [status.translator, status.languageModel];

        if (states.includes(CHROME_AI_STATUS.DOWNLOADING)) {
            elements.chromeAiStatus.textContent = 'Pobieranie modelu AI...';
            elements.chromeAiStatus.classList.remove('hidden');
            elements.chromeAiProgress.classList.remove('hidden');
        } else if (states.includes(CHROME_AI_STATUS.DOWNLOADABLE)) {
            elements.chromeAiStatus.textContent = 'Model wymaga pobrania (~1 GB). Pobieranie rozpocznie się przy pierwszym użyciu.';
            elements.chromeAiStatus.classList.remove('hidden');
        } else if (states.every(s => s === CHROME_AI_STATUS.UNAVAILABLE)) {
            elements.chromeAiStatus.textContent = 'Niedostępne — sprzęt lub konfiguracja nie obsługują AI na urządzeniu.';
            elements.chromeAiStatus.classList.remove('hidden');
            elements.chromeAiStatus.classList.add('text-yellow-400');
        } else {
            elements.chromeAiStatus.textContent = 'Gotowe do użycia';
            elements.chromeAiStatus.classList.remove('hidden');
            elements.chromeAiStatus.classList.add('text-green-400');
        }
    } catch {
        elements.chromeAiStatus.textContent = 'Nie udało się sprawdzić dostępności Chrome AI.';
        elements.chromeAiStatus.classList.remove('hidden');
    }
}

export function loadSettingsToInputs(state) {
    const provider = normalizeProvider(state.apiProvider);
    elements.apiProvider.value = provider;

    // Update radios
    const radio = document.querySelector(`input[name="api-provider-select"][value="${provider}"]`);
    if (radio) radio.checked = true;

    populateModels(provider, state.selectedModel);
    // On-device tier has a single, fixed model — no manual selection.
    elements.modelSelect.disabled = provider === 'chrome-ai';

    if (provider === 'chrome-ai') {
        elements.apiKey.disabled = true;
        elements.apiKey.placeholder = chrome.i18n.getMessage("apiKeyNotRequired");
        elements.apiKey.value = "";
        updateChromeAiStatus();
    } else {
        elements.apiKey.disabled = false;
        if (provider === 'openai') {
            elements.apiKey.value = state.openaiApiKey || state.userApiKey || '';
            elements.apiKey.placeholder = "sk-proj-...";
        } else if (provider === 'gemini') {
            elements.apiKey.value = state.geminiApiKey || state.userApiKey || '';
            elements.apiKey.placeholder = "AIzaSyD...";
        }
    }

    // Load language settings
    // Load language settings
    if (state.settings) {
        if (state.settings.defaultTargetLang) {
            elements.settingsTargetLang.value = state.settings.defaultTargetLang;
        } else {
            elements.settingsTargetLang.value = 'en';
        }

        if (elements.ttsEngine) {
            const engine = state.settings.ttsEngine;
            elements.ttsEngine.value = (engine === 'web' || engine === 'chrome') ? engine : 'web';
        }
        if (elements.ttsLanguage) {
            elements.ttsLanguage.value = state.settings.ttsLanguage || state.settings.defaultTargetLang || 'en';
        }
        populateTtsVoices(state.settings);
    }

    updateToneVisibility(getCurrentMode(), provider);
}

/**
 * Setup settings event listeners
 */
export function setupSettingsListeners(stateManager, showToast) {
    // Settings toggle
    elements.settingsBtn.addEventListener('click', toggleSettings);
    elements.closeSettingsBtn.addEventListener('click', toggleSettings);

    // Handle API Provider Radio Change
    const providerRadios = document.getElementsByName('api-provider-select');
    providerRadios.forEach(radio => {
        radio.addEventListener('change', async (e) => {
            const provider = e.target.value;
            elements.apiProvider.value = provider;
            populateModels(provider);
            elements.modelSelect.disabled = provider === 'chrome-ai';

            if (provider === 'chrome-ai') {
                elements.apiKey.disabled = true;
                elements.apiKey.placeholder = chrome.i18n.getMessage("apiKeyNotRequired");
                elements.apiKey.value = "";
            } else {
                elements.apiKey.disabled = false;
                if (provider === 'openai') {
                    elements.apiKey.placeholder = "sk-proj-...";
                    let val = stateManager.state.openaiApiKey;
                    if (!val && stateManager.state.apiProvider === 'openai') {
                        val = stateManager.state.userApiKey;
                    }
                    elements.apiKey.value = val || '';
                } else if (provider === 'gemini') {
                    elements.apiKey.placeholder = "AIzaSyD...";
                    let val = stateManager.state.geminiApiKey;
                    if (!val && stateManager.state.apiProvider === 'gemini') {
                        val = stateManager.state.userApiKey;
                    }
                    elements.apiKey.value = val || '';
                }
            }

            // Save provider immediately
            await stateManager.setState({ apiProvider: provider });
            updateToneVisibility(getCurrentMode(), provider);
        });
    });

    // Extract reusable save function
    const saveAllSettings = async (closePanel = false) => {
        const selectedProvider = document.querySelector('input[name="api-provider-select"]:checked')?.value || 'chrome-ai';

        const newState = {
            apiProvider: selectedProvider,
            selectedModel: elements.modelSelect.value,
            settings: {
                ...stateManager.state.settings,
                defaultTargetLang: elements.settingsTargetLang.value,
                ocrTargetLang: elements.settingsTargetLang.value,
                ttsEngine: elements.ttsEngine?.value || 'web',
                ttsLanguage: elements.ttsLanguage?.value || elements.settingsTargetLang.value,
                ttsVoiceName: elements.ttsVoice?.value || ''
            }
        };

        if (selectedProvider === 'openai') {
            newState.openaiApiKey = elements.apiKey.value;
            if (stateManager.state.userApiKey) newState.userApiKey = null;
        } else if (selectedProvider === 'gemini') {
            newState.geminiApiKey = elements.apiKey.value;
            if (stateManager.state.userApiKey) newState.userApiKey = null;
        }

        await stateManager.setState(newState);

        // Apply new default language immediately
        elements.targetLang.value = elements.settingsTargetLang.value;

        if (closePanel) {
            toggleSettings();
            showToast(chrome.i18n.getMessage("settingsSaved"));
        }
    };

    // Save settings on button click (and close panel)
    elements.saveSettingsBtn.addEventListener('click', () => saveAllSettings(true));

    // Auto-save on dropdown changes
    elements.settingsTargetLang?.addEventListener('change', () => saveAllSettings(false));
    elements.modelSelect?.addEventListener('change', () => saveAllSettings(false));
    elements.ttsVoice?.addEventListener('change', () => saveAllSettings(false));

    elements.ttsLanguage?.addEventListener('change', async () => {
        await populateTtsVoices({
            ...stateManager.state.settings,
            ttsLanguage: elements.ttsLanguage.value,
            ttsVoiceName: ''
        });
        saveAllSettings(false);
    });

    elements.ttsEngine?.addEventListener('change', async () => {
        await populateTtsVoices(stateManager.state.settings || {});
        saveAllSettings(false);
    });

}
