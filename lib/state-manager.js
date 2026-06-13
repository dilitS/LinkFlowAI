export class StateManager {
  constructor() {
    this.state = {
      userApiKey: null, // Deprecated, kept for backward compatibility
      openaiApiKey: null,
      geminiApiKey: null,
      apiProvider: 'openai',
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
      this.notify();
    }
  }

  async setState(newState) {
    this.state = { ...this.state, ...newState };
    this.notify();
    // Persist to storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set(this.state);
    }
  }

  async addToHistory(item) {
    const history = this.state.history || [];
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
