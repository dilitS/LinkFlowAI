import { elements } from './dom-elements.js';
import { getCurrentMode } from './ui-manager.js';

const STARTERS = {
    translate: [
        { label: 'Mail EN → PL', text: 'Hello Anna, can we move our meeting to Friday afternoon?', targetLang: 'pl' },
        { label: 'PL → EN', text: 'Daj znać, czy ten termin Ci pasuje i jakie masz uwagi.', targetLang: 'en' },
        { label: 'Social post', text: 'Launching soon: the fastest way to turn messy ideas into polished prompts.', targetLang: 'de' },
        { label: 'Travel phrase', text: 'Could you tell me where platform seven is and whether the train is delayed?', targetLang: 'es' }
    ],
    correct: [
        { label: 'Email polish', text: 'hi john, i just wanted to ask if you already reviewed the proposal because client waits.' },
        { label: 'LinkedIn', text: 'Building products fast is easy. Building products people remember is the hard part.' },
        { label: 'PL copy', text: 'Ta funkcjonalnosc jest mega przydatna ale wymaga jeszcze dopracowania pod wzgledem ux.' },
        { label: 'Short note', text: 'Thanks for the update. I will check it tomorrow and send feedback before noon.' }
    ],
    prompt: [
        { label: 'Produkt hero', text: 'Premium productivity app hero shot on a dark desk with cinematic lighting' },
        { label: 'Ad concept', text: 'Short cinematic video ad for a futuristic browser extension that translates text instantly' },
        { label: 'Logo idea', text: 'Minimalist AI language assistant logo, geometric, premium, memorable' },
        { label: 'Comic scene', text: 'A developer opening a browser extension and watching raw notes transform into polished copy' }
    ]
};

function applyStarter(starter) {
    elements.inputText.value = starter.text;
    if (starter.targetLang) {
        elements.targetLang.value = starter.targetLang;
        localStorage.setItem('lingflow_target_lang', starter.targetLang);
    }
    localStorage.setItem('lingflow_input_text', starter.text);
    elements.inputText.dispatchEvent(new Event('input', { bubbles: true }));
    elements.inputText.focus();
}

function renderStarters() {
    if (!elements.smartStarters || !elements.smartStartersList) return;

    const mode = getCurrentMode();
    const hasInput = elements.inputText.value.trim().length > 0;

    elements.smartStarters.classList.toggle('hidden', hasInput);
    if (hasInput) return;

    const starters = STARTERS[mode] || STARTERS.translate;
    elements.smartStartersList.innerHTML = starters.map(starter => `
        <button
            type="button"
            class="smart-starter-btn rounded-2xl border border-gray-800/80 bg-[#141417] px-3 py-2 text-left text-xs text-gray-300 transition-all hover:-translate-y-0.5 hover:border-gray-700 hover:bg-[#19191d] hover:text-white"
            data-label="${starter.label}">
            <div class="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">${starter.label}</div>
            <div class="max-h-[2.7rem] overflow-hidden leading-relaxed">${starter.text}</div>
        </button>
    `).join('');

    elements.smartStartersList.querySelectorAll('.smart-starter-btn').forEach((btn, index) => {
        btn.addEventListener('click', () => applyStarter(starters[index]));
    });
}

export function initSmartStarters() {
    renderStarters();
    elements.inputText.addEventListener('input', renderStarters);
    window.addEventListener('lingflow:modechange', renderStarters);
}

export function refreshSmartStarters() {
    renderStarters();
}
