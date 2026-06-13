import { elements } from './dom-elements.js';
import { SUPPORTED_LANGUAGES, MODELS } from './constants.js';
import { escapeHtml } from '../../lib/sanitize.js';

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

const PIPER_VOICE_HINTS = [
    'pl_PL-gosia-medium',
    'en_US-lessac-medium',
    'en_GB-alan-medium',
    'de_DE-thorsten-medium',
    'fr_FR-siwis-medium',
    'es_ES-sharvard-medium',
    'it_IT-riccardo-x_low'
];

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
    const voices = await getChromeTtsVoices();
    const base = lang.split('-')[0].toLowerCase();
    const filtered = voices.filter(voice => {
        const voiceLang = String(voice.lang || '').toLowerCase();
        return !voiceLang || voiceLang.startsWith(base);
    });

    const voiceOptions = [
        '<option value="">Auto</option>',
        ...filtered.map(voice => {
            const name = escapeHtml(voice.voiceName);
            const lang = voice.lang ? ` (${escapeHtml(voice.lang)})` : '';
            return `<option value="${name}">${name}${lang}</option>`;
        })
    ];

    elements.ttsVoice.innerHTML = voiceOptions.join('');
    if (settings.ttsVoiceName && [...elements.ttsVoice.options].some(option => option.value === settings.ttsVoiceName)) {
        elements.ttsVoice.value = settings.ttsVoiceName;
    }

    if (elements.piperVoiceCatalog) {
        elements.piperVoiceCatalog.innerHTML = PIPER_VOICE_HINTS.map(voice =>
            `<span class="rounded-full border border-gray-800 bg-[#18181b] px-2 py-1">${voice}</span>`
        ).join('');
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
            elements.ttsEngine.value = state.settings.ttsEngine || 'web';
        }
        if (elements.ttsLanguage) {
            elements.ttsLanguage.value = state.settings.ttsLanguage || state.settings.defaultTargetLang || 'en';
        }
        populateTtsVoices(state.settings);
    }
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
        });
    });

    // Save settings
    elements.saveSettingsBtn.addEventListener('click', async () => {
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
            // Clear legacy key if we're setting a new specific one
            if (stateManager.state.userApiKey) newState.userApiKey = null;
        } else if (selectedProvider === 'gemini') {
            newState.geminiApiKey = elements.apiKey.value;
            // Clear legacy key if we're setting a new specific one
            if (stateManager.state.userApiKey) newState.userApiKey = null;
        }

        await stateManager.setState(newState);

        // Apply new default language immediately
        elements.targetLang.value = elements.settingsTargetLang.value;

        toggleSettings();
        showToast(chrome.i18n.getMessage("settingsSaved"));
    });

    elements.ttsLanguage?.addEventListener('change', () => {
        populateTtsVoices({
            ...stateManager.state.settings,
            ttsLanguage: elements.ttsLanguage.value,
            ttsVoiceName: ''
        });
    });

    elements.ttsEngine?.addEventListener('change', () => {
        populateTtsVoices(stateManager.state.settings || {});
    });
}
