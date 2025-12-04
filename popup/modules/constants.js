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

// Available AI models (should match api-client.js)
export let MODELS = {
    builtin: [
        { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B (Free)' },
        { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B (Free)' },
        { id: 'nousresearch/hermes-3-llama-3.1-405b:free', name: 'Hermes 3 (Free)' }
    ],
    openai: [
        { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ],
    gemini: [
        { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' }
    ]
};

export function updateModels(provider, newModels) {
    if (MODELS[provider]) {
        MODELS[provider] = newModels;
    }
}

// Mode colors and configuration
export const MODE_COLORS = {
    translate: {
        btn: 'bg-blue-600',
        shadow: 'shadow-[0_0_20px_rgba(37,99,235,0.4)]',
        icon: 'fa-globe',
        text: 'Tłumacz'
    },
    correct: {
        btn: 'bg-purple-600',
        shadow: 'shadow-[0_0_20px_rgba(147,51,234,0.4)]',
        icon: 'fa-wand-magic-sparkles',
        text: 'Popraw'
    },
    prompt: {
        btn: 'bg-orange-600',
        shadow: 'shadow-[0_0_20px_rgba(234,88,12,0.4)]',
        icon: 'fa-robot',
        text: 'Generuj'
    }
};
