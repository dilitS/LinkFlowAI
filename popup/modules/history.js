import { elements } from './dom-elements.js';
import { switchMode } from './ui-manager.js';
import { setTone } from './tone.js';
import { resizeInputTextarea } from './translation.js';
import { escapeHtml } from '../../lib/sanitize.js';

let isHistoryOpen = false;
let historyFilter = 'all';
let historySearch = '';

function getItemBadge(item) {
    if (item.mode === 'prompt') {
        return {
            color: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
            label: chrome.i18n.getMessage('promptImage')
        };
    }
    return {
        color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        label: item.targetLang ? `→ ${String(item.targetLang).toUpperCase()}` : chrome.i18n.getMessage('translateMode')
    };
}

function normalizeHistoryItem(item) {
    return {
        ...item,
        mode: item.mode === 'correct' ? 'translate' : item.mode,
        input: item.input || item.sourceText || '',
        output: item.output || item.targetText || '',
        pinned: !!item.pinned
    };
}

function getFilteredHistory(history) {
    return history
        .map(normalizeHistoryItem)
        .sort((a, b) => {
            if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        })
        .filter(item => {
            if (historyFilter === 'pinned' && !item.pinned) return false;
            if (historyFilter !== 'all' && historyFilter !== 'pinned' && item.mode !== historyFilter) return false;

            if (!historySearch) return true;
            const haystack = `${item.input} ${item.output} ${item.targetLang || ''} ${item.tone || ''}`.toLowerCase();
            return haystack.includes(historySearch);
        });
}

function updateHistoryToolbarVisibility(hasHistory) {
    if (!elements.historyToolbar) return;
    elements.historyToolbar.classList.toggle('hidden', !hasHistory || !isHistoryOpen);
}

function updateFilterButtons() {
    elements.historyFilterBtns?.forEach(btn => {
        const active = btn.dataset.filter === historyFilter;
        btn.className = active
            ? 'history-filter-btn rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-300'
            : 'history-filter-btn rounded-full border border-gray-800 bg-[#18181b] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 hover:text-gray-300';
    });
}

/**
 * Toggle history panel
 */
export function toggleHistory() {
    isHistoryOpen = !isHistoryOpen;
    if (isHistoryOpen) {
        elements.historyList.classList.remove('hidden');
        elements.historyArrow.style.transform = 'rotate(180deg)';
        if (elements.historyList.children.length > 1) {
            elements.clearHistoryBtn.classList.remove('hidden');
        }

        setTimeout(() => {
            const mainContent = document.getElementById('main-content');
            mainContent.scrollTo({ top: mainContent.scrollHeight, behavior: 'smooth' });
        }, 50);
    } else {
        elements.historyList.classList.add('hidden');
        elements.historyArrow.style.transform = 'rotate(0deg)';
        elements.clearHistoryBtn.classList.add('hidden');
    }
    updateHistoryToolbarVisibility((elements.historyBadge?.innerText || '0') !== '0');
}

/**
 * Render history items
 */
export function renderHistory(history, stateManager, showToast) {
    const normalizedHistory = (history || []).map(normalizeHistoryItem);

    if (elements.historySearch && elements.historySearch.value !== historySearch) {
        elements.historySearch.value = historySearch;
    }

    if (!normalizedHistory.length) {
        elements.historyList.innerHTML = '';
        elements.historyList.appendChild(elements.emptyHistoryMsg);
        elements.emptyHistoryMsg.style.display = 'block';
        elements.emptyHistoryMsg.innerHTML = `<span>${chrome.i18n.getMessage('emptyHistoryMessage')}</span>`;
        elements.historyBadge.classList.add('hidden');
        elements.clearHistoryBtn.classList.add('hidden');
        updateHistoryToolbarVisibility(false);
        updateFilterButtons();
        return;
    }

    const filteredHistory = getFilteredHistory(normalizedHistory);
    elements.emptyHistoryMsg.style.display = 'none';
    elements.historyBadge.innerText = normalizedHistory.length;
    elements.historyBadge.classList.remove('hidden');
    if (isHistoryOpen) elements.clearHistoryBtn.classList.remove('hidden');
    updateHistoryToolbarVisibility(true);
    updateFilterButtons();

    elements.historyList.innerHTML = '';
    elements.historyList.appendChild(elements.emptyHistoryMsg);

    if (!filteredHistory.length) {
        elements.emptyHistoryMsg.style.display = 'block';
        elements.emptyHistoryMsg.innerHTML = `
            <div class="space-y-1">
                <div class="text-xs font-semibold text-gray-400">Brak wyników</div>
                <div class="text-[11px] text-gray-600">Spróbuj zmienić filtr albo wyszukiwane hasło.</div>
            </div>
        `;
        return;
    }

    const itemsHtml = filteredHistory.map(item => {
        const badge = getItemBadge(item);
        const date = new Date(item.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const pinIconClass = item.pinned ? 'text-amber-300 bg-amber-500/10' : 'text-gray-500 bg-black/30';
        const meta = item.tone && item.tone !== 'auto' ? ` • ${escapeHtml(item.tone)}` : '';

        return `
            <div class="bg-[#18181b] border border-gray-800/50 rounded-xl p-4 hover:border-gray-700 transition-all group relative overflow-hidden animate-fade-in cursor-pointer history-item" data-id="${escapeHtml(item.id)}">
                <div class="flex justify-between items-start mb-2 gap-3">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="text-[10px] ${badge.color} px-2 py-0.5 rounded border font-bold uppercase tracking-wider">${escapeHtml(badge.label)}</span>
                        ${item.pinned ? '<span class="text-[10px] text-amber-300 font-bold uppercase tracking-wide">PIN</span>' : ''}
                    </div>
                    <span class="text-[10px] text-gray-600 font-medium shrink-0">${timeStr}</span>
                </div>
                <div class="space-y-1">
                    <p class="text-gray-200 text-sm font-bold truncate leading-snug">${escapeHtml(item.input)}</p>
                    <p class="text-gray-500 text-xs truncate font-medium">${escapeHtml(item.output)}</p>
                    <p class="text-[10px] text-gray-600 font-medium uppercase tracking-wide">${escapeHtml(item.mode)}${meta}</p>
                </div>
                <div class="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="w-7 h-7 flex items-center justify-center rounded-lg ${pinIconClass} hover:text-white hover:bg-white/10 transition-colors pin-history-btn" title="Przypnij">
                        <i class="fa-solid fa-thumbtack text-[10px]"></i>
                    </button>
                    <button class="w-7 h-7 flex items-center justify-center rounded-lg bg-black/30 text-gray-500 hover:text-white hover:bg-white/10 transition-colors copy-history-btn" title="Kopiuj">
                        <i class="fa-regular fa-copy text-xs"></i>
                    </button>
                    <button class="w-7 h-7 flex items-center justify-center rounded-lg bg-black/30 text-gray-500 hover:text-red-400 hover:bg-red-500/20 transition-colors delete-history-btn" title="Usuń">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    elements.historyList.insertAdjacentHTML('afterbegin', itemsHtml);

    document.querySelectorAll('.history-item').forEach(itemEl => {
        itemEl.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;

            const id = itemEl.dataset.id;
            const historyItem = normalizedHistory.find(item => item.id === id);
            if (!historyItem) return;

            switchMode(historyItem.mode || 'translate');
            if (historyItem.tone) setTone(historyItem.tone);
            if (historyItem.targetLang) {
                elements.targetLang.value = historyItem.targetLang;
                localStorage.setItem('lingflow_target_lang', historyItem.targetLang);
            }

            elements.inputText.value = historyItem.input;
            localStorage.setItem('lingflow_input_text', historyItem.input);
            resizeInputTextarea();
            elements.inputText.dispatchEvent(new Event('input', { bubbles: true }));
            elements.outputText.innerText = historyItem.output;
            elements.outputText.classList.remove('italic', 'text-gray-500');
            elements.outputText.classList.add('text-gray-200');
        });
    });

    document.querySelectorAll('.copy-history-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const output = e.target.closest('.history-item').querySelector('p:nth-child(2)').innerText;
            navigator.clipboard.writeText(output);
            showToast(chrome.i18n.getMessage('toastCopied'));
        });
    });

    document.querySelectorAll('.pin-history-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const item = e.target.closest('.history-item');
            await stateManager.toggleHistoryPin(item.dataset.id);
        });
    });

    document.querySelectorAll('.delete-history-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const item = e.target.closest('.history-item');
            const id = item.dataset.id;
            await stateManager.removeFromHistory(id);
            showToast(chrome.i18n.getMessage('toastDeleted'));
        });
    });
}

/**
 * Setup history event listeners
 */
export function setupHistoryListeners(stateManager, showToast) {
    elements.toggleHistoryBtn.addEventListener('click', toggleHistory);

    elements.historySearch?.addEventListener('input', () => {
        historySearch = elements.historySearch.value.trim().toLowerCase();
        renderHistory(stateManager.state.history, stateManager, showToast);
    });

    elements.historyFilterBtns?.forEach(btn => {
        btn.addEventListener('click', () => {
            historyFilter = btn.dataset.filter;
            renderHistory(stateManager.state.history, stateManager, showToast);
        });
    });

    if (elements.clearHistoryBtn) {
        elements.clearHistoryBtn.classList.add('hover:text-red-500', 'transition-colors');

        elements.clearHistoryBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(chrome.i18n.getMessage('confirmClearHistory'))) {
                await stateManager.clearHistory();
            }
        });
    }

    if (isHistoryOpen) {
        elements.historyList.classList.remove('hidden');
        elements.historyArrow.style.transform = 'rotate(180deg)';
    } else {
        elements.historyList.classList.add('hidden');
    }

    updateFilterButtons();
    updateHistoryToolbarVisibility((stateManager.state.history || []).length > 0);
}
