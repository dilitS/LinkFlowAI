// LingFlow AI Content Script

let floatingBtn = null;
let tooltip = null;
let currentSelection = null;

// Result state (for tooltip actions: copy / listen / replace)
let currentResult = '';
let currentResultLang = 'pl';
let replaceContext = null;

// OCR Selection State
let isSelecting = false;
let selectionStart = null;
let selectionOverlay = null;
let selectionBox = null;
let ocrTargetLang = 'pl';

/**
 * Read the user's configured target language from extension storage.
 */
async function getTargetLang() {
    try {
        const { settings } = await chrome.storage.local.get('settings');
        return settings?.defaultTargetLang || 'pl';
    } catch (e) {
        return 'pl';
    }
}

/**
 * Capture enough context to replace the current selection in place,
 * supporting <input>/<textarea> fields and contenteditable regions.
 * Returns null when the selection is not editable.
 */
function captureReplaceContext() {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        if (active.selectionStart != null && active.selectionStart !== active.selectionEnd) {
            return { type: 'field', el: active, start: active.selectionStart, end: active.selectionEnd };
        }
    }

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        let node = sel.getRangeAt(0).commonAncestorContainer;
        node = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        if (node && node.isContentEditable) {
            return { type: 'range', range: sel.getRangeAt(0).cloneRange() };
        }
    }
    return null;
}

/**
 * Replace the originally selected text with the provided string.
 */
function performReplace(ctx, text) {
    if (!ctx) return false;
    try {
        if (ctx.type === 'field') {
            const el = ctx.el;
            const value = el.value;
            el.value = value.slice(0, ctx.start) + text + value.slice(ctx.end);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.focus();
            return true;
        }
        if (ctx.type === 'range') {
            const range = ctx.range;
            range.deleteContents();
            range.insertNode(document.createTextNode(text));
            return true;
        }
    } catch (e) {
        console.error('LingFlow replace failed:', e);
    }
    return false;
}

// Initialize UI
function init() {
    createFloatingButton();
    createTooltip();
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);

    // Listen for messages from the background service worker.
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'show_translation_result') {
            showResultFromBackground(request.translation);
        } else if (request.action === 'show_translation_error') {
            showErrorFromBackground(request.error);
        } else if (request.action === 'start_ocr_selection') {
            ocrTargetLang = request.targetLang || 'pl';
            startOCRSelection();
        } else if (request.action === 'process_ocr_crop') {
            processOCRCrop(request.image, request.area);
        } else if (request.action === 'show_ocr_result') {
            renderTooltipHtml(request.text);
        }
    });
}

function handleKeyDown(e) {
    if (e.key === 'Escape') {
        hideFloatingButton();
        hideTooltip();
    }
}

function showResultFromBackground(translation) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        showTooltip(rect.left + window.scrollX, rect.bottom + window.scrollY + 10, '', rect);
        renderTooltipResult(translation);
    }
}

function showErrorFromBackground(error) {
    // If tooltip is already visible (e.g. OCR loading), just update it
    if (tooltip.classList.contains('visible')) {
        renderTooltipError(error);
        return;
    }

    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        showTooltip(rect.left + window.scrollX, rect.bottom + window.scrollY + 10, '', rect);
        renderTooltipError(error);
    }
}

function startOCRSelection() {
    // Create overlay if not exists
    if (!selectionOverlay) {
        selectionOverlay = document.createElement('div');
        selectionOverlay.id = 'lingflow-ocr-overlay';
        selectionBox = document.createElement('div');
        selectionBox.id = 'lingflow-selection-box';
        selectionOverlay.appendChild(selectionBox);
        document.body.appendChild(selectionOverlay);

        // Only listen for mousedown on the overlay
        selectionOverlay.addEventListener('mousedown', handleOCRMouseDown);
    }

    selectionOverlay.style.display = 'block';
    document.body.style.cursor = 'crosshair';
}

function handleOCRMouseDown(e) {
    e.preventDefault(); // Prevent text selection
    isSelecting = true;
    selectionStart = { x: e.clientX, y: e.clientY };
    selectionBox.style.display = 'block';
    updateSelectionBox(e.clientX, e.clientY);

    // Add listeners to document to handle drag outside overlay if needed (though overlay is full screen)
    // and to ensure we catch the mouseup
    document.addEventListener('mousemove', handleOCRMouseMove);
    document.addEventListener('mouseup', handleOCRMouseUp);
}

function handleOCRMouseMove(e) {
    if (!isSelecting) return;
    updateSelectionBox(e.clientX, e.clientY);
}

function handleOCRMouseUp(e) {
    if (!isSelecting) return;

    isSelecting = false;

    // Clean up listeners
    document.removeEventListener('mousemove', handleOCRMouseMove);
    document.removeEventListener('mouseup', handleOCRMouseUp);

    // IMPORTANT: Get rect BEFORE hiding the element!
    const rect = selectionBox.getBoundingClientRect();

    // Now hide the selection UI
    selectionOverlay.style.display = 'none';
    selectionBox.style.display = 'none';
    document.body.style.cursor = 'default';

    // Ensure valid selection (at least 10x10)
    if (rect.width > 10 && rect.height > 10) {
        // Show loading tooltip at selection center
        showTooltip(rect.left + window.scrollX, rect.bottom + window.scrollY + 10, `
            <div class="lingflow-loading">
                <div class="lingflow-spinner"></div>
                <span>${chrome.i18n.getMessage("ocrLoadingText")}</span>
            </div>
        `, rect);

        // Send area to background to capture tab
        chrome.runtime.sendMessage({
            action: 'ocr_area_selected',
            area: {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height,
                devicePixelRatio: window.devicePixelRatio
            },
            targetLang: ocrTargetLang
        });
    }
}

function updateSelectionBox(currentX, currentY) {
    const x = Math.min(selectionStart.x, currentX);
    const y = Math.min(selectionStart.y, currentY);
    const width = Math.abs(currentX - selectionStart.x);
    const height = Math.abs(currentY - selectionStart.y);

    selectionBox.style.left = `${x}px`;
    selectionBox.style.top = `${y}px`;
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;
}

async function processOCRCrop(dataUrl, area) {
    try {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Adjust for device pixel ratio if the screenshot is high-res
            // captureVisibleTab usually returns image scaled by devicePixelRatio
            const scale = area.devicePixelRatio || 1;

            canvas.width = area.width * scale;
            canvas.height = area.height * scale;

            ctx.drawImage(
                img,
                area.x * scale,
                area.y * scale,
                area.width * scale,
                area.height * scale,
                0,
                0,
                area.width * scale,
                area.height * scale
            );

            const croppedDataUrl = canvas.toDataURL('image/png');

            // Send back to background for OCR
            chrome.runtime.sendMessage({
                action: 'perform_ocr',
                image: croppedDataUrl,
                targetLang: ocrTargetLang
            });
        };
        img.src = dataUrl;
    } catch (error) {
        renderTooltipError(chrome.i18n.getMessage("imageProcessingFailed"));
    }
}

function createFloatingButton() {
    floatingBtn = document.createElement('div');
    floatingBtn.id = 'lingflow-floating-btn';
    const iconUrl = chrome.runtime.getURL('assets/icons/icon32.png');
    floatingBtn.innerHTML = `<img src="${iconUrl}" alt="Translate" draggable="false">`;
    document.body.appendChild(floatingBtn);

    floatingBtn.addEventListener('click', handleTranslateClick);
}

function createTooltip() {
    tooltip = document.createElement('div');
    tooltip.id = 'lingflow-tooltip';
    document.body.appendChild(tooltip);
}

function handleMouseUp(e) {
    // Ignore if clicking inside our UI
    if (floatingBtn.contains(e.target) || tooltip.contains(e.target)) return;
    if (isSelecting) return; // Ignore if selecting for OCR

    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 0) {
        currentSelection = text;
        // Position next to cursor
        showFloatingButton(e.pageX + 15, e.pageY + 15);
    } else {
        hideFloatingButton();
    }
}

function handleMouseDown(e) {
    // Hide UI if clicking outside
    if (!floatingBtn.contains(e.target) && !tooltip.contains(e.target) && !isSelecting) {
        hideFloatingButton();
        hideTooltip();
    }
}

function showFloatingButton(x, y) {
    floatingBtn.style.left = `${x}px`;
    floatingBtn.style.top = `${y}px`;
    floatingBtn.classList.add('visible');
}

function hideFloatingButton() {
    floatingBtn.classList.remove('visible');
    floatingBtn.classList.remove('pulsing');
}

function showTooltip(x, y, content = null, referenceRect = null) {
    if (content) {
        tooltip.innerHTML = content;
    }

    // Adjust position to keep on screen
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let finalX = x;
    let finalY = y;

    if (referenceRect) {
        // Check if tooltip would go off the bottom of the screen
        // We use a threshold (e.g. 10px margin)
        if (finalY - window.scrollY + tooltipRect.height > viewportHeight - 10) {
            // Flip to above the selection
            finalY = referenceRect.top + window.scrollY - tooltipRect.height - 10;
        }
    }

    // Horizontal check (keep within viewport width)
    if (finalX - window.scrollX + tooltipRect.width > viewportWidth) {
        finalX = window.scrollX + viewportWidth - tooltipRect.width - 10;
    }
    if (finalX - window.scrollX < 0) {
        finalX = window.scrollX + 10;
    }

    tooltip.style.left = `${finalX}px`;
    tooltip.style.top = `${finalY}px`;

    tooltip.classList.add('visible');
}

function hideTooltip() {
    tooltip.classList.remove('visible');
}

async function handleTranslateClick(e) {
    e.stopPropagation(); // Prevent deselection

    // Capture replacement context BEFORE the selection is lost.
    replaceContext = captureReplaceContext();
    const targetLang = await getTargetLang();
    currentResultLang = targetLang;

    // Start pulsing
    floatingBtn.classList.add('pulsing');

    try {
        // Send message to background
        const response = await chrome.runtime.sendMessage({
            action: 'translate_selection',
            text: currentSelection,
            targetLang
        });

        // Stop pulsing and hide button
        floatingBtn.classList.remove('pulsing');
        hideFloatingButton();

        // Get position for tooltip (where button was)
        const btnRect = floatingBtn.getBoundingClientRect();

        // Show result
        if (response.success) {
            showTooltip(btnRect.left + window.scrollX, btnRect.top + window.scrollY, '', btnRect);
            renderTooltipResult(response.data);
        } else {
            showTooltip(btnRect.left + window.scrollX, btnRect.top + window.scrollY, '', btnRect);
            renderTooltipError(response.error);
        }
    } catch (error) {
        floatingBtn.classList.remove('pulsing');
        hideFloatingButton();
        const btnRect = floatingBtn.getBoundingClientRect();
        showTooltip(btnRect.left + window.scrollX, btnRect.top + window.scrollY, '', btnRect);
        renderTooltipError(chrome.i18n.getMessage("communicationError"));
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Render pre-formatted HTML content (e.g. OCR transcription + translation).
 * No action bar — the markup is trusted output produced by the extension.
 */
function renderTooltipHtml(html) {
    tooltip.innerHTML = `<div class="lingflow-content">${html}</div>`;
}

function renderTooltipResult(translation) {
    currentResult = typeof translation === 'string' ? translation : '';
    const canReplace = !!replaceContext;

    tooltip.innerHTML = `
        <div class="lingflow-content">${escapeHtml(currentResult)}</div>
        <div class="lingflow-actions">
            <button class="lingflow-action-btn" data-action="copy" title="${chrome.i18n.getMessage('toastCopied') || 'Copy'}">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            <button class="lingflow-action-btn" data-action="listen" title="Listen">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
            </button>
            ${canReplace ? `
            <button class="lingflow-action-btn lingflow-action-replace" data-action="replace" title="Replace">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            </button>` : ''}
            <button class="lingflow-action-btn" data-action="close" title="Close">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </div>
    `;

    const copyBtn = tooltip.querySelector('[data-action="copy"]');
    const listenBtn = tooltip.querySelector('[data-action="listen"]');
    const replaceBtn = tooltip.querySelector('[data-action="replace"]');
    const closeBtn = tooltip.querySelector('[data-action="close"]');

    if (copyBtn) {
        copyBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            navigator.clipboard.writeText(currentResult);
            copyBtn.classList.add('lingflow-action-done');
            setTimeout(() => copyBtn.classList.remove('lingflow-action-done'), 1200);
        });
    }

    if (listenBtn) {
        listenBtn.addEventListener('click', async (ev) => {
            ev.stopPropagation();
            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'tts_speak',
                    text: currentResult,
                    lang: currentResultLang
                });
                if (response?.success) return;
            } catch (e) {
                // Fall back to the page's Web Speech API below.
            }

            try {
                window.speechSynthesis.cancel();
                const utt = new SpeechSynthesisUtterance(currentResult);
                utt.lang = currentResultLang;
                window.speechSynthesis.speak(utt);
            } catch (e) { /* no-op */ }
        });
    }

    if (replaceBtn) {
        replaceBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (performReplace(replaceContext, currentResult)) {
                hideTooltip();
            }
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            hideTooltip();
        });
    }
}

function renderTooltipError(error) {
    tooltip.innerHTML = `
        <div class="lingflow-content" style="color: #fca5a5;">
            ${error}
        </div>
    `;
}

// Start
init();
