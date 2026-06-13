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

// Cached Web Speech voices (populated async by the browser).
let pageVoices = [];

const TTS_LANG_MAP = {
    pl: 'pl-PL', en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR', it: 'it-IT',
    pt: 'pt-PT', nl: 'nl-NL', uk: 'uk-UA', cs: 'cs-CZ', sk: 'sk-SK', hu: 'hu-HU',
    ro: 'ro-RO', bg: 'bg-BG', el: 'el-GR', tr: 'tr-TR', sv: 'sv-SE', no: 'nb-NO',
    da: 'da-DK', fi: 'fi-FI', ja: 'ja-JP', ko: 'ko-KR', zh: 'zh-CN', ru: 'ru-RU',
    ar: 'ar-SA', hi: 'hi-IN'
};

function loadPageVoices() {
    try {
        pageVoices = window.speechSynthesis.getVoices() || [];
    } catch (e) {
        pageVoices = [];
    }
}

function toBcp47(lang) {
    if (!lang) return 'en-US';
    return TTS_LANG_MAP[lang] || (lang.includes('-') ? lang : `${lang}-${lang.toUpperCase()}`);
}

/**
 * Pick the best-sounding installed voice for a language, preferring local,
 * non-default system voices over the robotic fallback.
 */
function pickVoice(lang) {
    if (!pageVoices.length) loadPageVoices();
    const bcp = toBcp47(lang).toLowerCase();
    const base = bcp.split('-')[0];
    const matches = pageVoices.filter(v => {
        const vl = (v.lang || '').replace('_', '-').toLowerCase();
        return vl === bcp || vl.startsWith(base);
    });
    if (!matches.length) return null;
    // Prefer higher-quality voices (named "Premium"/"Enhanced"/"Natural") and local ones.
    return (
        matches.find(v => /premium|enhanced|natural|neural/i.test(v.name)) ||
        matches.find(v => v.localService) ||
        matches[0]
    );
}

/**
 * Speak text from the inline tooltip. Defaults to the page Web Speech API
 * (which exposes the user's good system voices). Only routes through Chrome
 * TTS when the user explicitly selected that engine in Settings.
 */
async function speakInline(text, lang) {
    let settings = {};
    try {
        const stored = await chrome.storage.local.get('settings');
        settings = stored.settings || {};
    } catch (e) {
        settings = {};
    }

    const effectiveLang = settings.ttsLanguage || lang || 'en';

    if (settings.ttsEngine === 'chrome') {
        try {
            const res = await chrome.runtime.sendMessage({
                action: 'tts_speak',
                text,
                lang: effectiveLang
            });
            if (res?.success) return;
        } catch (e) {
            // Fall back to Web Speech below.
        }
    }

    try {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        const voice = pickVoice(effectiveLang);
        if (voice) utt.voice = voice;
        utt.lang = voice ? voice.lang : toBcp47(effectiveLang);
        utt.rate = 1;
        utt.pitch = 1;
        window.speechSynthesis.speak(utt);
    } catch (e) {
        /* no-op */
    }
}

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
    loadPageVoices();
    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadPageVoices;
    }
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
            renderOcrResult(request.transcription, request.translation);
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
        renderTooltipResult(translation);
        showTooltip(rect.left + window.scrollX, rect.bottom + window.scrollY + 10, rect);
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
        renderTooltipError(error);
        showTooltip(rect.left + window.scrollX, rect.bottom + window.scrollY + 10, rect);
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
        renderTooltipLoading(chrome.i18n.getMessage("ocrLoadingText"));
        showTooltip(rect.left + window.scrollX, rect.bottom + window.scrollY + 10, rect);

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

function showTooltip(x, y, referenceRect = null) {
    // Content is rendered beforehand via the render* helpers (safe DOM), so the
    // size measurement below reflects the final layout used for flip logic.
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

// Safety net so the icon never pulses forever if the service worker is asleep
// or never answers.
const TRANSLATE_TIMEOUT_MS = 30000;

function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const error = new Error('Request timed out');
            error.code = 'TIMEOUT';
            reject(error);
        }, ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function handleTranslateClick(e) {
    e.stopPropagation(); // Prevent deselection

    // Capture replacement context BEFORE the selection is lost.
    replaceContext = captureReplaceContext();
    const targetLang = await getTargetLang();
    currentResultLang = targetLang;

    // Start pulsing and record the anchor while the button is still visible.
    floatingBtn.classList.add('pulsing');
    const btnRect = floatingBtn.getBoundingClientRect();
    const anchorX = btnRect.left + window.scrollX;
    const anchorY = btnRect.top + window.scrollY;

    try {
        const response = await withTimeout(
            chrome.runtime.sendMessage({
                action: 'translate_selection',
                text: currentSelection,
                targetLang
            }),
            TRANSLATE_TIMEOUT_MS
        );

        if (response && response.success) {
            renderTooltipResult(response.data);
        } else {
            renderTooltipError((response && response.error) || chrome.i18n.getMessage('communicationError'));
        }
        showTooltip(anchorX, anchorY, btnRect);
    } catch (error) {
        const message = error?.code === 'TIMEOUT'
            ? (chrome.i18n.getMessage('errorTimeout') || 'Request timed out. Please try again.')
            : chrome.i18n.getMessage('communicationError');
        renderTooltipError(message);
        showTooltip(anchorX, anchorY, btnRect);
    } finally {
        // Lifecycle guarantee: always return the icon to rest.
        floatingBtn.classList.remove('pulsing');
        hideFloatingButton();
    }
}

// Static, trusted SVG markup for tooltip action buttons. These contain no
// dynamic data, so assigning them via innerHTML on a fresh element is safe.
const ACTION_ICONS = {
    copy: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
    listen: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>',
    replace: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>',
    close: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
};

/**
 * Build a tooltip action button. The icon is static, trusted markup; no
 * untrusted data is ever interpolated into HTML here.
 */
function buildActionButton(action, title, extraClass = '') {
    const btn = document.createElement('button');
    btn.className = `lingflow-action-btn${extraClass ? ' ' + extraClass : ''}`;
    btn.dataset.action = action;
    btn.title = title;
    btn.innerHTML = ACTION_ICONS[action] || '';
    return btn;
}

/** Replace tooltip contents with freshly built, safe DOM nodes. */
function setTooltipContent(...nodes) {
    tooltip.replaceChildren(...nodes);
}

/** Loading state (spinner + message) built without HTML injection. */
function renderTooltipLoading(message) {
    const wrap = document.createElement('div');
    wrap.className = 'lingflow-loading';

    const spinner = document.createElement('div');
    spinner.className = 'lingflow-spinner';

    const label = document.createElement('span');
    label.textContent = message || '';

    wrap.append(spinner, label);
    setTooltipContent(wrap);
}

/**
 * Render an OCR transcription + translation. Values come from the model and
 * are treated as untrusted: they are written via textContent only.
 */
function renderOcrResult(transcription, translation) {
    const content = document.createElement('div');
    content.className = 'lingflow-content';

    const makeBlock = (labelKey, value) => {
        const block = document.createElement('div');
        block.style.marginBottom = '8px';

        const label = document.createElement('strong');
        label.textContent = `${chrome.i18n.getMessage(labelKey)}: `;

        const body = document.createElement('div');
        body.style.whiteSpace = 'pre-wrap';
        body.textContent = value || '';

        block.append(label, body);
        return block;
    };

    content.append(
        makeBlock('transcriptionLabel', transcription),
        makeBlock('translationLabel', translation || transcription)
    );
    setTooltipContent(content);
}

function renderTooltipResult(translation) {
    if (typeof translation === 'string') {
        currentResult = translation;
    } else if (translation && typeof translation === 'object') {
        currentResult = translation.text || translation.translation || JSON.stringify(translation);
    } else {
        currentResult = String(translation || '');
    }
    
    const canReplace = !!replaceContext;

    // Untrusted model output → textContent, never innerHTML.
    const content = document.createElement('div');
    content.className = 'lingflow-content';
    content.textContent = currentResult;

    const actions = document.createElement('div');
    actions.className = 'lingflow-actions';

    const copyBtn = buildActionButton('copy', chrome.i18n.getMessage('toastCopied') || 'Copy');
    const listenBtn = buildActionButton('listen', 'Listen');
    const closeBtn = buildActionButton('close', 'Close');

    copyBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        navigator.clipboard.writeText(currentResult);
        copyBtn.classList.add('lingflow-action-done');
        setTimeout(() => copyBtn.classList.remove('lingflow-action-done'), 1200);
    });

    listenBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        speakInline(currentResult, currentResultLang);
    });

    actions.append(copyBtn, listenBtn);

    if (canReplace) {
        const replaceBtn = buildActionButton('replace', 'Replace', 'lingflow-action-replace');
        replaceBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (performReplace(replaceContext, currentResult)) {
                hideTooltip();
            }
        });
        actions.append(replaceBtn);
    }

    closeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        hideTooltip();
    });
    actions.append(closeBtn);

    setTooltipContent(content, actions);
}

function renderTooltipError(error) {
    const content = document.createElement('div');
    content.className = 'lingflow-content';
    content.style.color = '#fca5a5';
    content.textContent = typeof error === 'string' ? error : String(error ?? '');
    setTooltipContent(content);
}

// Start
init();
