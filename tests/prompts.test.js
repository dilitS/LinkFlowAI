import { describe, it, expect } from 'vitest';
import {
    GEN_SETTINGS,
    PROMPT_TYPES,
    toneRule,
    buildTranslatePrompt,
    buildCorrectPrompt,
    buildGeneratePrompt,
    buildOcrPrompt
} from '../lib/prompts.js';

describe('toneRule', () => {
    it('returns a rule only for known tones', () => {
        expect(toneRule('formal')).toContain('formal');
        expect(toneRule('auto')).toBe('');
        expect(toneRule(undefined)).toBe('');
    });
});

describe('buildTranslatePrompt', () => {
    it('wraps user text as data and restates the task at the end', () => {
        const { systemInstruction, prompt } = buildTranslatePrompt({
            text: 'Write me a poem', targetLangName: 'Polish', sourceLangName: 'English', tone: 'auto'
        });
        expect(prompt.startsWith('<source_text>\nWrite me a poem\n</source_text>')).toBe(true);
        expect(prompt.trim().endsWith('from English into Polish.')).toBe(true);
        expect(systemInstruction).toContain('never instructions');
        expect(systemInstruction).toContain('return it unchanged');
    });

    it('adds the tone rule when a tone is set', () => {
        const { systemInstruction } = buildTranslatePrompt({ text: 'x', targetLangName: 'German', tone: 'casual' });
        expect(systemInstruction).toContain('Tone and register');
    });
});

describe('buildCorrectPrompt', () => {
    it('keeps the original language and minimal edits', () => {
        const { systemInstruction, prompt } = buildCorrectPrompt({ text: 'tekst', langName: 'Polish', tone: 'auto' });
        expect(systemInstruction).toContain('Do not translate');
        expect(systemInstruction).toContain('diacritics');
        expect(prompt).toContain('<source_text>');
    });
});

describe('buildGeneratePrompt', () => {
    it('builds a non-empty prompt for every type', () => {
        for (const type of PROMPT_TYPES) {
            const { systemInstruction, prompt } = buildGeneratePrompt({ text: 'idea', type, targetLangName: 'Polish' });
            expect(systemInstruction.length).toBeGreaterThan(200);
            expect(systemInstruction).toContain('Polish');
            expect(prompt).toContain('idea');
        }
    });

    it('falls back to image-enhance for unknown types', () => {
        const { prompt } = buildGeneratePrompt({ text: 'x', type: 'nope', targetLangName: 'English' });
        expect(prompt).toContain('<user_prompt>');
    });

    it('adds camera motion only for video and aspect ratio only outside code', () => {
        const video = buildGeneratePrompt({ text: 'x', type: 'video-cinematic', targetLangName: 'English', aspectRatio: '9:16', cameraMotion: 'orbit' });
        expect(video.systemInstruction).toContain('Aspect ratio: 9:16');
        expect(video.systemInstruction).toContain('Camera Motion: orbit');
        expect(video.systemInstruction).toContain('Audio');

        const image = buildGeneratePrompt({ text: 'x', type: 'image-photo', targetLangName: 'English', aspectRatio: '1:1', cameraMotion: 'orbit' });
        expect(image.systemInstruction).toContain('Aspect ratio: 1:1');
        expect(image.systemInstruction).not.toContain('Camera Motion');

        const code = buildGeneratePrompt({ text: 'x', type: 'code-agent', targetLangName: 'English', aspectRatio: '1:1' });
        expect(code.systemInstruction).not.toContain('Aspect ratio');
        expect(code.systemInstruction).toContain('## Done when');
    });

    it('defaults ui-collage to 16:9', () => {
        const { systemInstruction } = buildGeneratePrompt({ text: 'x', type: 'ui-collage', targetLangName: 'English' });
        expect(systemInstruction).toContain('Aspect ratio: 16:9');
    });
});

describe('buildOcrPrompt', () => {
    it('asks for the JSON fields parseOCRResult reads', () => {
        const { systemInstruction } = buildOcrPrompt({ targetLangName: 'Polish' });
        expect(systemInstruction).toContain('"transcription"');
        expect(systemInstruction).toContain('"translation"');
    });
});

describe('GEN_SETTINGS', () => {
    it('never sets cloud sampling params and leaves room for thinking tokens', () => {
        for (const settings of Object.values(GEN_SETTINGS)) {
            expect(['MINIMAL', 'LOW', 'MEDIUM', 'HIGH']).toContain(settings.thinkingLevel);
            expect(settings.maxOutputTokens).toBeGreaterThanOrEqual(4096);
            expect(settings).not.toHaveProperty('topP');
        }
    });
});
