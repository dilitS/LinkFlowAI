// LingFlow AI Content Script

let floatingBtn = null;
let tooltip = null;
let currentSelection = null;

// OCR Selection State
let isSelecting = false;
let selectionStart = null;
let selectionOverlay = null;
let selectionBox = null;
let ocrTargetLang = 'pl';

// Initialize UI
function init() {
    createFloatingButton();
    createTooltip();
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);

    // Listen for messages from background (e.g. Context Menu results)
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
            renderTooltipResult(request.text);
        }
    });
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
                <span>Tłumaczenie OCR...</span>
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
        renderTooltipError('Image processing failed');
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

    // Start pulsing
    floatingBtn.classList.add('pulsing');

    try {
        // Send message to background
        const response = await chrome.runtime.sendMessage({
            action: 'translate_selection',
            text: currentSelection
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
        renderTooltipError('Communication error');
    }
}

function renderTooltipResult(translation) {
    tooltip.innerHTML = `
        <div class="lingflow-content">
            ${translation}
        </div>
    `;

    // Add event listeners
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
