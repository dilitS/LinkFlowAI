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
        // Basic mapping, can be improved
        const langMap = {
            'pl': 'pl-PL',
            'en': 'en-US',
            'de': 'de-DE',
            'es': 'es-ES',
            'fr': 'fr-FR',
            'it': 'it-IT',
            'pt': 'pt-PT',
            'ja': 'ja-JP'
        };
        const targetLang = langMap[languageCode] || 'en-US';
        return this.voices.find(voice => voice.lang.startsWith(targetLang)) || null;
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
