import { describe, it, expect, beforeEach, vi } from 'vitest';

const speechSynthesisMock = {
    getVoices: vi.fn().mockReturnValue([
        { name: 'Google US English', lang: 'en-US', localService: false },
        { name: 'Alex', lang: 'en-US', localService: true },
        { name: 'Google Polish', lang: 'pl-PL', localService: false },
        { name: 'Zosia Premium', lang: 'pl-PL', localService: true },
        { name: 'Anna Neural', lang: 'de-DE', localService: true },
    ]),
    speak: vi.fn(),
    cancel: vi.fn(),
    speaking: false,
    onvoiceschanged: undefined,
};

globalThis.window = { speechSynthesis: speechSynthesisMock };
globalThis.speechSynthesis = speechSynthesisMock;
globalThis.SpeechSynthesisUtterance = vi.fn().mockImplementation(function (text) {
    this.text = text;
    this.voice = null;
    this.lang = '';
    this.rate = 1;
    this.pitch = 1;
    this.onend = null;
    this.onerror = null;
});

const { TTSManager } = await import('../lib/tts-manager.js');

describe('TTSManager voice selection', () => {
    let tts;

    beforeEach(() => {
        tts = new TTSManager();
    });

    it('maps "pl" to a Polish voice', () => {
        const voice = tts.mapLanguageToVoice('pl');
        expect(voice).toBeDefined();
        expect(voice.lang).toBe('pl-PL');
    });

    it('prefers premium/neural voices when available', () => {
        const voice = tts.mapLanguageToVoice('de');
        expect(voice.name).toContain('Neural');
    });

    it('prefers local system voices over remote ones', () => {
        const voice = tts.mapLanguageToVoice('pl');
        expect(voice.name).toContain('Premium');
    });

    it('falls back to en-US for unknown language codes', () => {
        const voice = tts.mapLanguageToVoice('zz');
        expect(voice).toBeDefined();
        expect(voice.lang).toBe('en-US');
    });

    it('returns null when no voices match at all', () => {
        tts.voices = [];
        const voice = tts.mapLanguageToVoice('pl');
        expect(voice).toBeNull();
    });
});
