import { elements } from './dom-elements.js';

let isHistoryOpen = false;

/**
 * Toggle history panel
 */
export function toggleHistory() {
    isHistoryOpen = !isHistoryOpen;
    if (isHistoryOpen) {
        elements.historyList.classList.remove('hidden');
        elements.historyArrow.style.transform = 'rotate(180deg)';
        if (elements.historyList.children.length > 1) { // More than just empty message
            elements.clearHistoryBtn.classList.remove('hidden');
        }

        // Scroll to bottom
        setTimeout(() => {
            const mainContent = document.getElementById('main-content');
            mainContent.scrollTo({ top: mainContent.scrollHeight, behavior: 'smooth' });
        }, 50);
    } else {
        elements.historyList.classList.add('hidden');
        elements.historyArrow.style.transform = 'rotate(0deg)';
        elements.clearHistoryBtn.classList.add('hidden');
    }
}

/**
 * Add item to history
 */
export async function addToHistory(stateManager, input, output, mode) {
    const newItem = {
        id: Date.now().toString(),
        mode,
        input,
        output,
        timestamp: Date.now()
    };

    await stateManager.addToHistory(newItem);
}

/**
 * Render history items
 */
export function renderHistory(history, stateManager, showToast) {
    if (!history || history.length === 0) {
        elements.historyList.innerHTML = '';
        elements.historyList.appendChild(elements.emptyHistoryMsg);
        elements.emptyHistoryMsg.style.display = 'block';
        elements.historyBadge.classList.add('hidden');
        elements.clearHistoryBtn.classList.add('hidden');
        return;
    }

    elements.emptyHistoryMsg.style.display = 'none';
    elements.historyBadge.innerText = history.length;
    elements.historyBadge.classList.remove('hidden');
    if (isHistoryOpen) elements.clearHistoryBtn.classList.remove('hidden');

    // Clear list but keep empty msg
    elements.historyList.innerHTML = '';
    elements.historyList.appendChild(elements.emptyHistoryMsg);

    const itemsHtml = history.slice().reverse().map(item => {
        let badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        let label = 'EN → PL';

        if (item.mode === 'correct') {
            badgeColor = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
            label = 'Korekta';
        } else if (item.mode === 'prompt') {
            badgeColor = 'bg-orange-500/10 text-orange-400 border-orange-500/20';
            label = 'Prompt Obraz';
        }

        const date = new Date(item.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="bg-[#18181b] border border-gray-800/50 rounded-xl p-4 hover:border-gray-700 transition-all group relative overflow-hidden animate-fade-in cursor-pointer history-item" data-id="${item.id}">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-[10px] ${badgeColor} px-2 py-0.5 rounded border font-bold uppercase tracking-wider">${label}</span>
                    <span class="text-[10px] text-gray-600 font-medium">${timeStr}</span>
                </div>
                <div class="space-y-1">
                    <p class="text-gray-200 text-sm font-bold truncate leading-snug">${item.input}</p>
                    <p class="text-gray-500 text-xs truncate font-medium">${item.output}</p>
                </div>
                <div class="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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

    // Re-attach listeners for history items
    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't trigger if clicking buttons
            if (e.target.closest('button')) return;

            const id = item.dataset.id;
            const historyItem = history.find(h => h.id === id);
            if (historyItem) {
                elements.inputText.value = historyItem.input;
                elements.outputText.innerText = historyItem.output;
                elements.outputText.classList.remove('italic', 'text-gray-500');
                elements.outputText.classList.add('text-gray-200');
            }
        });
    });

    document.querySelectorAll('.copy-history-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const output = e.target.closest('.history-item').querySelector('p:nth-child(2)').innerText;
            navigator.clipboard.writeText(output);
            showToast('Skopiowano do schowka');
        });
    });

    document.querySelectorAll('.delete-history-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const item = e.target.closest('.history-item');
            const id = item.dataset.id;
            await stateManager.removeFromHistory(id);
            showToast('Usunięto element');
        });
    });
}

/**
 * Setup history event listeners
 */
export function setupHistoryListeners(stateManager) {
    elements.toggleHistoryBtn.addEventListener('click', toggleHistory);

    if (elements.clearHistoryBtn) {
        // Add hover effect class
        elements.clearHistoryBtn.classList.add('hover:text-red-500', 'transition-colors');

        elements.clearHistoryBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm('Czy na pewno chcesz usunąć całą historię?')) {
                await stateManager.clearHistory();
            }
        });
    }

    // Ensure history state matches default
    if (isHistoryOpen) {
        elements.historyList.classList.remove('hidden');
        elements.historyArrow.style.transform = 'rotate(180deg)';
    } else {
        elements.historyList.classList.add('hidden');
    }
}
