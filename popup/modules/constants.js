// Supported languages configuration.
// `name` is the English fallback; the UI renders `getLanguageLabel()`, which
// localizes the name into the browser's UI locale.
export const SUPPORTED_LANGUAGES = [
    { code: 'pl', name: 'Polish', flag: '🇵🇱' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
    { code: 'uk', name: 'Ukrainian', flag: '🇺🇦' },
    { code: 'cs', name: 'Czech', flag: '🇨🇿' },
    { code: 'sk', name: 'Slovak', flag: '🇸🇰' },
    { code: 'hu', name: 'Hungarian', flag: '🇭🇺' },
    { code: 'ro', name: 'Romanian', flag: '🇷🇴' },
    { code: 'bg', name: 'Bulgarian', flag: '🇧🇬' },
    { code: 'el', name: 'Greek', flag: '🇬🇷' },
    { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
    { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
    { code: 'no', name: 'Norwegian', flag: '🇳🇴' },
    { code: 'da', name: 'Danish', flag: '🇩🇰' },
    { code: 'fi', name: 'Finnish', flag: '🇫🇮' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' }
];

let displayNames;

function languageDisplayNames() {
    if (displayNames !== undefined) return displayNames;
    try {
        const uiLocale = globalThis.chrome?.i18n?.getUILanguage?.() || 'en';
        displayNames = new Intl.DisplayNames([uiLocale], { type: 'language' });
    } catch {
        displayNames = null;
    }
    return displayNames;
}

/**
 * Localized name of a language, in the browser's UI locale.
 * Falls back to the English name when Intl has nothing for the code.
 * @param {string} code
 * @returns {string}
 */
export function getLanguageLabel(code) {
    const fallback = SUPPORTED_LANGUAGES.find(l => l.code === code)?.name || code;
    let label = fallback;
    try {
        label = languageDisplayNames()?.of(code) || fallback;
    } catch {
        label = fallback;
    }
    // Intl lowercases language names in many locales ("polski"); dropdowns read
    // better capitalized.
    return label.charAt(0).toUpperCase() + label.slice(1);
}

// Bump when system prompts change so cached results are invalidated.
export const PROMPT_VERSION = 1;

// Single source of truth for available AI models.
// Both the popup UI and APIClient import from here.
export const CHROME_AI_PROVIDER = 'chrome-ai';
export const CHROME_AI_MODEL_ID = 'gemini-nano';

export const MODELS = {
    [CHROME_AI_PROVIDER]: [
        { id: CHROME_AI_MODEL_ID, name: 'Gemini Nano (on-device)' }
    ],
    openai: [
        { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna' },
        { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra' },
        { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol' }
    ],
    gemini: [
        { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite' },
        { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
        { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' }
    ]
};

export const DEFAULT_MODELS = {
    openai: 'gpt-5.6-luna',
    gemini: 'gemini-3.5-flash-lite'
};

// Models with known shutdown dates — block re-introduction.
export const DEPRECATED_MODELS = [
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-0125',
    'gpt-4o-mini',
    'gpt-4o',
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gemini-3-flash-preview'
];

// Tone / register presets used by Translate mode.
// `label` is the English fallback; `i18nKey` resolves through chrome.i18n.
export const TONE_PRESETS = [
    { id: 'auto', label: 'Auto', i18nKey: 'toneAuto', icon: 'fa-wand-magic-sparkles' },
    { id: 'formal', label: 'Formal', i18nKey: 'toneFormal', icon: 'fa-user-tie' },
    { id: 'casual', label: 'Casual', i18nKey: 'toneCasual', icon: 'fa-face-smile' },
    { id: 'professional', label: 'Business', i18nKey: 'toneProfessional', icon: 'fa-briefcase' },
    { id: 'friendly', label: 'Friendly', i18nKey: 'toneFriendly', icon: 'fa-heart' }
];

/**
 * Localized tone label, falling back to the English default.
 * @param {{ i18nKey?: string, label: string }} preset
 * @returns {string}
 */
export function getToneLabel(preset) {
    return (preset.i18nKey && globalThis.chrome?.i18n?.getMessage?.(preset.i18nKey)) || preset.label;
}

// Mode colors and configuration
export const MODE_COLORS = {
    translate: {
        btn: 'bg-blue-600',
        shadow: 'shadow-[0_0_20px_rgba(37,99,235,0.4)]',
        icon: 'fa-globe',
        i18nKey: 'modeTextTranslate',
        get text() { return chrome.i18n?.getMessage('modeTextTranslate') || 'Translate'; }
    },
    prompt: {
        btn: 'bg-orange-600',
        shadow: 'shadow-[0_0_20px_rgba(234,88,12,0.4)]',
        icon: 'fa-robot',
        i18nKey: 'modeTextGenerate',
        get text() { return chrome.i18n?.getMessage('modeTextGenerate') || 'Generate'; }
    }
};
