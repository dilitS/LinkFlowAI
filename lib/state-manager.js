export class StateManager {
  constructor() {
    this.state = {
      userApiKey: null, // Deprecated, kept for backward compatibility
      openaiApiKey: null,
      geminiApiKey: null,
      apiProvider: 'openai', // 'openai' | 'gemini'
      history: [],
      settings: {}
    };
    this.listeners = [];
    this.loadState();
  }

  async loadState() {
    // Load from storage if available
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get(['userApiKey', 'openaiApiKey', 'geminiApiKey', 'apiProvider', 'history', 'settings']);
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
    const newHistory = [item, ...history].slice(0, 100); // Limit to 100 items
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

  subscribe(listener) {
    this.listeners.push(listener);
    return () => this.listeners = this.listeners.filter(l => l !== listener);
  }

  notify() {
    this.listeners.forEach(listener => listener(this.state));
  }
}
