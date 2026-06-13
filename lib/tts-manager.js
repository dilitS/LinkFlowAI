export class TTSManager {
    constructor() {
        this.synthesis = window.speechSynthesis;
        this.voices = [];
        this.loadVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => this.loadVoices();
        }
    }

    loadVoices() {
        this.voices = this.synthesis.getVoices();
    }

    mapLanguageToVoice(languageCode) {
        const langMap = {
            'pl': 'pl-PL',
            'en': 'en-US',
            'de': 'de-DE',
            'es': 'es-ES',
            'fr': 'fr-FR',
            'it': 'it-IT',
            'pt': 'pt-PT',
            'nl': 'nl-NL',
            'uk': 'uk-UA',
            'cs': 'cs-CZ',
            'sk': 'sk-SK',
            'hu': 'hu-HU',
            'ro': 'ro-RO',
            'bg': 'bg-BG',
            'el': 'el-GR',
            'tr': 'tr-TR',
            'sv': 'sv-SE',
            'no': 'nb-NO',
            'da': 'da-DK',
            'fi': 'fi-FI',
            'ja': 'ja-JP',
            'ko': 'ko-KR',
            'zh': 'zh-CN',
            'ru': 'ru-RU',
            'ar': 'ar-SA',
            'hi': 'hi-IN'
        };
        const targetLang = langMap[languageCode] || 'en-US';
        // Prefer an exact BCP-47 match, then fall back to the base language tag.
        const base = targetLang.split('-')[0];
        return (
            this.voices.find(voice => voice.lang.replace('_', '-') === targetLang) ||
            this.voices.find(voice => voice.lang.toLowerCase().startsWith(base)) ||
            null
        );
    }

    speak(text, language, onEnd = null) {
        if (this.synthesis.speaking) {
            this.synthesis.cancel();
        }
        const utterance = new SpeechSynthesisUtterance(text);
        const voice = this.mapLanguageToVoice(language);
        if (voice) {
            utterance.voice = voice;
        }
        utterance.lang = language; // Fallback

        if (onEnd) {
            utterance.onend = onEnd;
            utterance.onerror = onEnd; // Also stop animation on error
        }

        this.synthesis.speak(utterance);
    }

    stop() {
        this.synthesis.cancel();
    }
}
