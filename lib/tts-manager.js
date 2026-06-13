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

    async getSettings() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                const { settings } = await chrome.storage.local.get('settings');
                return settings || {};
            }
        } catch (e) {
            // Fall back to Web Speech below.
        }
        return {};
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
        const targetLang = (langMap[languageCode] || 'en-US').toLowerCase();
        const base = targetLang.split('-')[0];

        const matches = this.voices.filter(voice => {
            const vl = (voice.lang || '').replace('_', '-').toLowerCase();
            return vl === targetLang || vl.startsWith(base);
        });
        if (!matches.length) return null;

        // Prefer higher-quality voices and local system voices over the
        // robotic default fallback.
        return (
            matches.find(voice => /premium|enhanced|natural|neural/i.test(voice.name)) ||
            matches.find(voice => voice.localService) ||
            matches.find(voice => voice.lang.replace('_', '-').toLowerCase() === targetLang) ||
            matches[0]
        );
    }

    async speak(text, language, onEnd = null) {
        const settings = await this.getSettings();
        const effectiveLanguage = settings.ttsLanguage || language;

        if (settings.ttsEngine === 'chrome' && typeof chrome !== 'undefined' && chrome.tts?.speak) {
            chrome.tts.stop?.();
            chrome.tts.speak(text, {
                lang: effectiveLanguage,
                voiceName: settings.ttsVoiceName || undefined,
                enqueue: false,
                onEvent: (event) => {
                    if (!onEnd) return;
                    if (event.type === 'end' || event.type === 'interrupted' || event.type === 'cancelled' || event.type === 'error') {
                        onEnd();
                    }
                }
            }, () => {
                if (chrome.runtime?.lastError) {
                    console.warn('Chrome TTS failed, falling back to Web Speech:', chrome.runtime.lastError.message);
                    this.speakWithWebSpeech(text, effectiveLanguage, onEnd);
                }
            });
            return;
        }

        this.speakWithWebSpeech(text, effectiveLanguage, onEnd);
    }

    speakWithWebSpeech(text, language, onEnd = null) {
        if (this.synthesis.speaking) {
            this.synthesis.cancel();
        }
        if (!this.voices.length) {
            this.loadVoices();
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
        chrome.tts?.stop?.();
        this.synthesis.cancel();
    }
}
