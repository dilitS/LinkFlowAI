import { elements } from './dom-elements.js';

export function renderSessionMeta(state) {
    // UI element removed per user request
}

export function initSessionMeta(stateManager) {
    const rerender = () => renderSessionMeta(stateManager.state);
    elements.sourceLang.addEventListener('change', rerender);
    elements.targetLang.addEventListener('change', rerender);
    window.addEventListener('lingflow:modechange', rerender);
    window.addEventListener('lingflow:tonechange', rerender);
    rerender();
}

