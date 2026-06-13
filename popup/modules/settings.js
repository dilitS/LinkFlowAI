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

    const engine = elements.ttsEngine?.value || settings.ttsEngine || 'web';
    const lang = elements.ttsLanguage?.value || settings.ttsLanguage || settings.defaultTargetLang || 'en';
    const base = lang.split('-')[0].toLowerCase();

    let voiceOptions = ['<option value="">Auto</option>'];

    if (engine === 'piper') {
        const filtered = PIPER_VOICE_HINTS.filter(v => v.toLowerCase().startsWith(base));
        voiceOptions.push(...filtered.map(voice => `<option value="${voice}">${voice}</option>`));
        elements.piperVoiceCatalog?.classList.remove('hidden');
    } else {
        elements.piperVoiceCatalog?.classList.add('hidden');
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
    }

    elements.ttsVoice.innerHTML = voiceOptions.join('');
    if (settings.ttsVoiceName && [...elements.ttsVoice.options].some(option => option.value === settings.ttsVoiceName)) {
        elements.ttsVoice.value = settings.ttsVoiceName;
    }
    
    // Dispatch event to update piper download UI
    elements.ttsVoice.dispatchEvent(new Event('piper-voice-changed'));
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

    // Piper download UI logic
    const updatePiperUI = async () => {
        const engine = elements.ttsEngine?.value;
        const voiceId = elements.ttsVoice?.value;
        if (engine !== 'piper' || !voiceId) {
            elements.downloadPiperVoiceBtn?.classList.add('hidden');
            elements.deletePiperVoiceBtn?.classList.add('hidden');
            return;
        }

        const hasVoice = await piperManager.hasVoice(voiceId);
        if (hasVoice) {
            elements.downloadPiperVoiceBtn?.classList.add('hidden');
            elements.deletePiperVoiceBtn?.classList.remove('hidden');
            if (elements.piperStatusText) elements.piperStatusText.innerText = 'Gotowy do użycia offline.';
        } else {
            elements.downloadPiperVoiceBtn?.classList.remove('hidden');
            elements.deletePiperVoiceBtn?.classList.add('hidden');
            if (elements.piperStatusText) elements.piperStatusText.innerText = 'Wybierz głos i kliknij przycisk, aby go pobrać.';
        }
    };

    elements.ttsVoice?.addEventListener('piper-voice-changed', updatePiperUI);
    elements.ttsVoice?.addEventListener('change', updatePiperUI);

    elements.downloadPiperVoiceBtn?.addEventListener('click', async () => {
        const voiceId = elements.ttsVoice?.value;
        if (!voiceId) return;

        elements.downloadPiperVoiceBtn.disabled = true;
        elements.piperDownloadProgress.classList.remove('hidden');
        elements.piperStatusText.innerText = 'Przygotowanie pobierania...';
        
        try {
            // Helper for fetching with progress
            const fetchWithProgress = async (url, typeLabel) => {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                const contentLength = +response.headers.get('Content-Length');
                const reader = response.body.getReader();
                let receivedLength = 0;
                let chunks = [];
                
                while(true) {
                    const {done, value} = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    receivedLength += value.length;
                    
                    if (contentLength) {
                        const percent = Math.round((receivedLength / contentLength) * 100);
                        elements.piperProgressBar.style.width = `${percent}%`;
                        elements.piperProgressText.innerText = `${percent}%`;
                        elements.piperStatusText.innerText = `Pobieranie ${typeLabel}... (${percent}%)`;
                    }
                }
                
                let allChunks = new Uint8Array(receivedLength);
                let position = 0;
                for(let chunk of chunks) {
                    allChunks.set(chunk, position);
                    position += chunk.length;
                }
                return allChunks.buffer;
            };

            // Piper Repository URL construction
            // Format: lang/lang_id/name/quality/lang_id-name-quality.onnx
            const parts = voiceId.split('-'); // [pl_PL, gosia, medium]
            const langCode = parts[0].split('_')[0]; // pl
            const name = parts[1];
            const quality = parts[2];
            const baseUrl = `https://huggingface.co/rhasspy/piper-voices/resolve/main/${langCode}/${parts[0]}/${name}/${quality}/${voiceId}.onnx`;

            // 1. Download JSON config
            const jsonBuffer = await fetchWithProgress(`${baseUrl}.json`, 'konfiguracji');
            
            // 2. Download ONNX model
            const onnxBuffer = await fetchWithProgress(baseUrl, 'modelu');

            // 3. Save to IndexedDB
            await piperManager.saveVoice(voiceId, onnxBuffer, jsonBuffer);
            
            showToast('Pobrano model głosu!');
            updatePiperUI();
        } catch (e) {
            console.error('Download error:', e);
            elements.piperStatusText.innerText = 'Błąd pobierania: ' + e.message;
            showToast('Pobieranie nie powiodło się');
        } finally {
            elements.downloadPiperVoiceBtn.disabled = false;
            elements.piperDownloadProgress.classList.add('hidden');
        }
    });

    elements.deletePiperVoiceBtn?.addEventListener('click', async () => {
        const voiceId = elements.ttsVoice?.value;
        if (!voiceId) return;
        await piperManager.deleteVoice(voiceId);
        showToast('Usunięto model z dysku');
        updatePiperUI();
    });
}
