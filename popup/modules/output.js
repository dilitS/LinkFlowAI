import { elements } from './dom-elements.js';
import { diffWords, countChanges } from '../../lib/text-diff.js';

// Plain result text, independent of how the output is rendered (diff view).
// Copy / TTS / history always use this, never the rendered DOM.
let currentOutput = '';

const SETTINGS_CTA_CODES = new Set([
    'NO_API_KEY',
    'CHROME_AI_UNAVAILABLE',
    'CHROME_AI_LANGUAGE_UNSUPPORTED',
    'OCR_REQUIRES_KEY'
]);

export function getCurrentOutput() {
    return currentOutput;
}

function setMeta(text) {
    if (!elements.outputMeta) return;
    elements.outputMeta.textContent = text || '';
    elements.outputMeta.classList.toggle('hidden', !text);
}

function markFilled() {
    elements.outputText.classList.remove('italic', 'text-gray-500');
    elements.outputText.classList.add('text-gray-200');
}

/** Render plain result text. */
export function setOutputText(text) {
    currentOutput = text || '';
    setMeta('');
    elements.outputText.textContent = currentOutput;
    markFilled();
}

/** Clear the stored result (e.g. while a new request is running). */
export function resetOutput() {
    currentOutput = '';
    setMeta('');
}

/**
 * Render a proofreading result as an inline word diff: removed text struck
 * through in red, added text highlighted in green. Built with text nodes only
 * (model output is untrusted).
 */
export function renderCorrection(original, corrected) {
    currentOutput = corrected || '';
    const parts = diffWords(original, currentOutput);
    const changes = countChanges(parts);

    const fragment = document.createDocumentFragment();
    for (const part of parts) {
        if (part.type === 'equal') {
            fragment.append(document.createTextNode(part.text));
            continue;
        }
        const el = document.createElement(part.type === 'delete' ? 'del' : 'ins');
        el.className = part.type === 'delete' ? 'lf-diff-del' : 'lf-diff-ins';
        el.textContent = part.text;
        fragment.append(el);
    }
    elements.outputText.replaceChildren(fragment);
    elements.outputText.classList.add('whitespace-pre-wrap');
    markFilled();

    setMeta(changes === 0
        ? (chrome.i18n.getMessage('correctionNoChanges') || 'No changes needed')
        : (chrome.i18n.getMessage('correctionChanges', [String(changes)]) || `Changes: ${changes}`));
}

/**
 * Show an error, adding an "Open settings" button when the fix lives there
 * (missing key, unsupported on-device language, ...).
 */
export function renderError(message, code) {
    currentOutput = '';
    setMeta('');
    const text = document.createElement('span');
    text.textContent = `${chrome.i18n.getMessage('errorPrefix')}${message}`;
    const nodes = [text];

    if (SETTINGS_CTA_CODES.has(code)) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mt-3 flex items-center gap-2 rounded-lg border border-gray-700 bg-[#27272a] px-3 py-1.5 text-xs font-semibold text-gray-200 hover:border-gray-500 hover:text-white';
        btn.textContent = chrome.i18n.getMessage('btnOpenSettings') || 'Open settings';
        btn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('lingflow:open-settings')));
        nodes.push(btn);
    }

    elements.outputText.replaceChildren(...nodes);
    elements.outputText.classList.remove('italic', 'text-gray-500');
}
