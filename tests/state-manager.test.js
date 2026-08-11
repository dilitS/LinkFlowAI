import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '../lib/state-manager.js';

describe('StateManager', () => {
    let sm;

    beforeEach(() => {
        sm = new StateManager();
    });

    it('initialises with chrome-ai as default provider', () => {
        expect(sm.state.apiProvider).toBe('chrome-ai');
    });

    it('migrates legacy "builtin" provider to chrome-ai', () => {
        sm.state.apiProvider = 'builtin';
        sm.migrateLegacyProvider();
        expect(sm.state.apiProvider).toBe('chrome-ai');
    });

    it('migrates legacy :free model to gemini-nano', () => {
        sm.state.apiProvider = 'builtin';
        sm.state.selectedModel = 'some-model:free';
        sm.migrateLegacyProvider();
        expect(sm.state.selectedModel).toBe('gemini-nano');
    });

    it('does not migrate already-valid providers', () => {
        sm.state.apiProvider = 'openai';
        sm.migrateLegacyProvider();
        expect(sm.state.apiProvider).toBe('openai');
    });

    it('adds items to history and caps at 100', async () => {
        for (let i = 0; i < 105; i++) {
            await sm.addToHistory({ id: `h${i}`, mode: 'translate', input: `in${i}`, output: `out${i}`, targetLang: 'en' });
        }
        expect(sm.state.history.length).toBe(100);
        expect(sm.state.history[0].id).toBe('h104');
    });

    it('deduplicates history entries and preserves pin', async () => {
        await sm.addToHistory({ id: 'a', mode: 'translate', input: 'hi', output: 'cześć', targetLang: 'pl', pinned: true });
        await sm.addToHistory({ id: 'b', mode: 'translate', input: 'hi', output: 'cześć', targetLang: 'pl' });
        expect(sm.state.history.length).toBe(1);
        expect(sm.state.history[0].pinned).toBe(true);
    });

    it('removes a history entry by id', async () => {
        await sm.addToHistory({ id: 'x', mode: 'translate', input: 'a', output: 'b', targetLang: 'en' });
        await sm.removeFromHistory('x');
        expect(sm.state.history.length).toBe(0);
    });

    it('toggles pin on a history entry', async () => {
        await sm.addToHistory({ id: 'p', mode: 'translate', input: 'a', output: 'b', targetLang: 'en' });
        await sm.toggleHistoryPin('p');
        expect(sm.state.history[0].pinned).toBe(true);
        await sm.toggleHistoryPin('p');
        expect(sm.state.history[0].pinned).toBe(false);
    });

    it('notifies subscribers on state change', async () => {
        const calls = [];
        sm.subscribe((state) => calls.push(state.apiProvider));
        await sm.setState({ apiProvider: 'gemini' });
        expect(calls).toContain('gemini');
    });

    it('unsubscribe stops notifications', async () => {
        const calls = [];
        const unsub = sm.subscribe(() => calls.push(1));
        unsub();
        await sm.setState({ apiProvider: 'openai' });
        expect(calls.length).toBe(0);
    });
});
