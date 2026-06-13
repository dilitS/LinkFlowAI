import { elements } from './dom-elements.js';
import { MODELS } from './constants.js';
import { getCurrentMode } from './ui-manager.js';
import { getCurrentTone } from './tone.js';

const PROVIDER_LABELS = {
    builtin: 'OpenRouter Free',
    openai: 'OpenAI',
    gemini: 'Gemini'
};

function getModelName(provider, selectedModel) {
    return MODELS[provider]?.find(model => model.id === selectedModel)?.name || selectedModel || 'Default';
}

function getDirectionLabel() {
    const source = elements.sourceLang.value === 'auto' ? 'Auto' : String(elements.sourceLang.value).toUpperCase();
    const target = String(elements.targetLang.value || 'en').toUpperCase();
    return `${source} → ${target}`;
}

function getToneLabel(tone) {
    const labels = {
        auto: 'Auto',
        formal: 'Formalny',
        casual: 'Swobodny',
        professional: 'Biznesowy',
        friendly: 'Przyjazny'
    };
    return labels[tone] || 'Auto';
}

export function renderSessionMeta(state) {
    if (!elements.outputMeta) return;

    const provider = state.apiProvider || 'builtin';
    const modelName = getModelName(provider, state.selectedModel);
    const mode = getCurrentMode();
    const tone = getCurrentTone();

    const parts = [
        PROVIDER_LABELS[provider] || provider,
        modelName,
        getDirectionLabel()
    ];

    if (mode === 'translate' || mode === 'correct') {
        parts.push(`Ton: ${getToneLabel(tone)}`);
    }

    elements.outputMeta.textContent = parts.join(' • ');
}

export function initSessionMeta(stateManager) {
    const rerender = () => renderSessionMeta(stateManager.state);
    elements.sourceLang.addEventListener('change', rerender);
    elements.targetLang.addEventListener('change', rerender);
    window.addEventListener('lingflow:modechange', rerender);
    window.addEventListener('lingflow:tonechange', rerender);
    rerender();
}
