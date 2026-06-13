import { elements } from './dom-elements.js';
import { TONE_PRESETS } from './constants.js';

const STORAGE_KEY = 'lingflow_tone';
let currentTone = localStorage.getItem(STORAGE_KEY) || 'auto';

const ACTIVE_CLASS =
    'tone-pill flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap border border-blue-500/40 bg-blue-500/10 text-blue-300 transition-colors';
const INACTIVE_CLASS =
    'tone-pill flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap border border-gray-800 bg-[#18181b] text-gray-500 hover:text-gray-300 hover:bg-[#27272a] transition-colors';

/**
 * Render tone pills once and wire selection handlers.
 */
export function renderTonePills() {
    if (!elements.toneSelector) return;

    elements.toneSelector.innerHTML = TONE_PRESETS.map(t => `
        <button type="button" class="${t.id === currentTone ? ACTIVE_CLASS : INACTIVE_CLASS}" data-tone="${t.id}">
            <i class="fa-solid ${t.icon} text-[9px]"></i><span>${t.label}</span>
        </button>
    `).join('');

    elements.toneSelector.querySelectorAll('.tone-pill').forEach(pill => {
        pill.addEventListener('click', () => setTone(pill.dataset.tone));
    });
}

export function setTone(tone) {
    currentTone = tone;
    localStorage.setItem(STORAGE_KEY, tone);
    window.dispatchEvent(new CustomEvent('lingflow:tonechange', { detail: tone }));

    elements.toneSelector.querySelectorAll('.tone-pill').forEach(pill => {
        pill.className = pill.dataset.tone === tone ? ACTIVE_CLASS : INACTIVE_CLASS;
    });
}

export function getCurrentTone() {
    return currentTone;
}

/**
 * Tone only applies to translate; hidden in prompt mode.
 */
export function updateToneVisibility(mode) {
    if (!elements.toneSelector) return;
    const visible = mode === 'translate';
    elements.toneSelector.classList.toggle('hidden', !visible);
}
