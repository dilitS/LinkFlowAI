const KEY_FIELDS = ['openaiApiKey', 'geminiApiKey', 'userApiKey'];
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Drop history entries older than `days` (pinned entries are kept).
 * @param {Array} history
 * @param {number} days - 0 keeps everything
 */
export function pruneHistory(history, days, now = Date.now()) {
  if (!Array.isArray(history) || !days) return history || [];
  const cutoff = now - days * DAY_MS;
  return history.filter(item => item.pinned || !item.timestamp || new Date(item.timestamp).getTime() >= cutoff);
}

export class StateManager {
    constructor() {
    this.state = {
      userApiKey: null, // Deprecated, kept for backward compatibility
      openaiApiKey: null,
      geminiApiKey: null,
      apiProvider: 'chrome-ai', // Free, on-device default
      selectedModel: null,
      history: [],
      settings: {},
      uiPreferences: {}
    };
    this.listeners = [];
    this.loadState();
  }

  async loadState() {
    // Load from storage if available
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get([
        'userApiKey',
        'openaiApiKey',
        'geminiApiKey',
        'apiProvider',
        'selectedModel',
        'history',
        'settings',
        'uiPreferences'
      ]);
      this.state = { ...this.state, ...result };

      // "Forget keys on browser close": keys live in session storage only.
      if (this.state.settings?.keysSessionOnly && chrome.storage.session) {
        const session = await chrome.storage.session.get(KEY_FIELDS);
        for (const field of KEY_FIELDS) {
          if (!this.state[field] && session[field]) this.state[field] = session[field];
        }
      }

      const days = this.state.settings?.historyRetentionDays;
      const pruned = pruneHistory(this.state.history, days);
      if (pruned.length !== (this.state.history || []).length) {
        this.state.history = pruned;
        chrome.storage.local.set({ history: pruned });
      }

      this.migrateLegacyProvider();
      this.notify();
    }
  }

  /**
   * Split state into what goes to disk and what stays in session memory.
   * @returns {{ local: Object, session: Object|null }}
   */
  storagePlan(state = this.state) {
    if (!state.settings?.keysSessionOnly) return { local: { ...state }, session: null };
    const local = { ...state };
    const session = {};
    for (const field of KEY_FIELDS) {
      session[field] = state[field] ?? null;
      local[field] = null;
    }
    return { local, session };
  }

  /**
   * Map the retired free tier (`builtin` = OpenRouter via proxy) onto the
   * on-device Chrome AI tier so users upgrading from 1.6.0 keep a working free
   * mode. Persisted once; idempotent on subsequent loads.
   */
  migrateLegacyProvider() {
    if (this.state.apiProvider && this.state.apiProvider !== 'builtin') return;

    this.state.apiProvider = 'chrome-ai';
    if (typeof this.state.selectedModel === 'string' && this.state.selectedModel.includes(':free')) {
      this.state.selectedModel = 'gemini-nano';
    }

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({
        apiProvider: 'chrome-ai',
        selectedModel: this.state.selectedModel
      });
    }
  }

  async setState(newState) {
    this.state = { ...this.state, ...newState };
    this.notify();
    // Persist to storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const { local, session } = this.storagePlan();
      await chrome.storage.local.set(local);
      if (chrome.storage.session) {
        if (session) await chrome.storage.session.set(session);
        else await chrome.storage.session.remove(KEY_FIELDS);
      }
    }
  }

  async addToHistory(item) {
    if (this.state.settings?.saveHistory === false) return;
    const history = pruneHistory(this.state.history || [], this.state.settings?.historyRetentionDays);
    const duplicateIdx = history.findIndex(existing =>
      existing.mode === item.mode &&
      existing.input === item.input &&
      existing.output === item.output &&
      existing.targetLang === item.targetLang &&
      existing.tone === item.tone
    );

    const duplicate = duplicateIdx >= 0 ? history[duplicateIdx] : null;
    const historyWithoutDuplicate = duplicateIdx >= 0
      ? history.filter((_, idx) => idx !== duplicateIdx)
      : history;

    const newHistory = [{
      ...item,
      pinned: duplicate?.pinned || item.pinned || false
    }, ...historyWithoutDuplicate].slice(0, 100);

    await this.setState({ history: newHistory });
  }

  async clearHistory() {
    await this.setState({ history: [] });
  }

  async removeFromHistory(id) {
    const history = this.state.history || [];
    const newHistory = history.filter(item => item.id !== id);
    await this.setState({ history: newHistory });
  }

  async toggleHistoryPin(id) {
    const history = (this.state.history || []).map(item =>
      item.id === id ? { ...item, pinned: !item.pinned } : item
    );
    await this.setState({ history });
  }

  async setUIPreference(key, value) {
    await this.setState({
      uiPreferences: {
        ...(this.state.uiPreferences || {}),
        [key]: value
      }
    });
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => this.listeners = this.listeners.filter(l => l !== listener);
  }

  notify() {
    this.listeners.forEach(listener => listener(this.state));
  }
}
