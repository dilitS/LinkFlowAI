// Supported languages configuration
export const SUPPORTED_LANGUAGES = [
    { code: 'pl', name: 'Polski', flag: '🇵🇱' },
    { code: 'en', name: 'Angielski', flag: '🇬🇧' },
    { code: 'de', name: 'Niemiecki', flag: '🇩🇪' },
    { code: 'es', name: 'Hiszpański', flag: '🇪🇸' },
    { code: 'fr', name: 'Francuski', flag: '🇫🇷' },
    { code: 'it', name: 'Włoski', flag: '🇮🇹' },
    { code: 'pt', name: 'Portugalski', flag: '🇵🇹' },
    { code: 'nl', name: 'Holenderski', flag: '🇳🇱' },
    { code: 'uk', name: 'Ukraiński', flag: '🇺🇦' },
    { code: 'cs', name: 'Czeski', flag: '🇨🇿' },
    { code: 'sk', name: 'Słowacki', flag: '🇸🇰' },
    { code: 'hu', name: 'Węgierski', flag: '🇭🇺' },
    { code: 'ro', name: 'Rumuński', flag: '🇷🇴' },
    { code: 'bg', name: 'Bułgarski', flag: '🇧🇬' },
    { code: 'el', name: 'Grecki', flag: '🇬🇷' },
    { code: 'tr', name: 'Turecki', flag: '🇹🇷' },
    { code: 'sv', name: 'Szwedzki', flag: '🇸🇪' },
    { code: 'no', name: 'Norweski', flag: '🇳🇴' },
    { code: 'da', name: 'Duński', flag: '🇩🇰' },
    { code: 'fi', name: 'Fiński', flag: '🇫🇮' },
    { code: 'ja', name: 'Japoński', flag: '🇯🇵' },
    { code: 'ko', name: 'Koreański', flag: '🇰🇷' },
    { code: 'zh', name: 'Chiński', flag: '🇨🇳' },
    { code: 'ru', name: 'Rosyjski', flag: '🇷🇺' },
    { code: 'ar', name: 'Arabski', flag: '🇸🇦' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' }
];

// Single source of truth for available AI models.
// Both the popup UI and APIClient import from here.
export const CHROME_AI_PROVIDER = 'chrome-ai';
export const CHROME_AI_MODEL_ID = 'gemini-nano';

export const MODELS = {
    [CHROME_AI_PROVIDER]: [
        { id: CHROME_AI_MODEL_ID, name: 'Gemini Nano (on-device)' }
    ],
    openai: [
        { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
        { id: 'gpt-4o', name: 'GPT-4o' }
    ],
    gemini: [
        { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite' },
        { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
        { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' }
    ]
};

export const DEFAULT_MODELS = {
    openai: 'gpt-4o-mini',
    gemini: 'gemini-3.5-flash-lite'
};

// Models with known shutdown dates — block re-introduction.
export const DEPRECATED_MODELS = [
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-0125',
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gemini-3-flash-preview'
];

// Tone / register presets used by Translate mode.
export const TONE_PRESETS = [
    { id: 'auto', label: 'Auto', icon: 'fa-wand-magic-sparkles' },
    { id: 'formal', label: 'Formalny', icon: 'fa-user-tie' },
    { id: 'casual', label: 'Swobodny', icon: 'fa-face-smile' },
    { id: 'professional', label: 'Biznesowy', icon: 'fa-briefcase' },
    { id: 'friendly', label: 'Przyjazny', icon: 'fa-heart' }
];

// Mode colors and configuration
export const MODE_COLORS = {
    translate: {
        btn: 'bg-blue-600',
        shadow: 'shadow-[0_0_20px_rgba(37,99,235,0.4)]',
        icon: 'fa-globe',
        text: 'Tłumacz'
    },
    prompt: {
        btn: 'bg-orange-600',
        shadow: 'shadow-[0_0_20px_rgba(234,88,12,0.4)]',
        icon: 'fa-robot',
        text: 'Generuj'
    }
};
