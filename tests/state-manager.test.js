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

describe('history privacy', async () => {
    const { pruneHistory } = await import('../lib/state-manager.js');
    const day = 24 * 60 * 60 * 1000;
    const now = Date.parse('2026-11-10T12:00:00Z');
    const items = [
        { id: 'new', timestamp: new Date(now - day).toISOString() },
        { id: 'old', timestamp: new Date(now - 10 * day).toISOString() },
        { id: 'old-pinned', pinned: true, timestamp: new Date(now - 40 * day).toISOString() }
    ];

    it('keeps everything when retention is 0', () => {
        expect(pruneHistory(items, 0, now)).toHaveLength(3);
    });

    it('drops entries older than the retention but keeps pinned ones', () => {
        expect(pruneHistory(items, 7, now).map(i => i.id)).toEqual(['new', 'old-pinned']);
    });

    it('does not record history when saving is turned off', async () => {
        const sm = new StateManager();
        sm.state.settings = { saveHistory: false };
        await sm.addToHistory({ id: '1', input: 'a', output: 'b' });
        expect(sm.state.history).toEqual([]);
    });

    it('keeps API keys off disk in session-only mode', () => {
        const sm = new StateManager();
        sm.state.geminiApiKey = 'secret';
        sm.state.settings = { keysSessionOnly: true };
        const plan = sm.storagePlan();
        expect(plan.local.geminiApiKey).toBeNull();
        expect(plan.session.geminiApiKey).toBe('secret');

        sm.state.settings = { keysSessionOnly: false };
        expect(sm.storagePlan()).toMatchObject({ local: { geminiApiKey: 'secret' }, session: null });
    });
});
