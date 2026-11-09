/**
 * On-demand content script injection.
 *
 * LingFlow no longer declares a content script for every site (that needs the
 * "read and change all your data on all websites" warning). Instead:
 *  - user actions (context menu, OCR button) inject the script into the
 *    active tab through `activeTab` + `scripting`;
 *  - the floating "translate selection" button is opt-in: the user grants the
 *    optional host permission and we register the script dynamically.
 */

export const CONTENT_SCRIPT_FILES = {
    js: ['content/content.js'],
    css: ['assets/css/inter.css', 'content/content.css']
};

export const SELECTION_SCRIPT_ID = 'lingflow-selection';
export const ALL_SITES = { origins: ['http://*/*', 'https://*/*'] };

/**
 * Make sure the content script is running in `tabId`. Safe to call repeatedly:
 * a ping answers when it is already there, and the script itself guards
 * against double initialization.
 * @throws {Error & { code: 'PAGE_NOT_SUPPORTED' }} on protected pages
 */
export async function ensureContentScript(tabId) {
    try {
        const pong = await chrome.tabs.sendMessage(tabId, { action: 'lingflow_ping' });
        if (pong?.ok) return;
    } catch {
        // Not injected yet.
    }

    try {
        await chrome.scripting.insertCSS({ target: { tabId }, files: CONTENT_SCRIPT_FILES.css });
        await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_SCRIPT_FILES.js });
    } catch (cause) {
        const error = new Error(cause?.message || 'Cannot run on this page');
        error.code = 'PAGE_NOT_SUPPORTED';
        throw error;
    }
}

/** @returns {Promise<boolean>} floating selection button is active */
export async function isSelectionButtonEnabled() {
    try {
        const [granted, scripts] = await Promise.all([
            chrome.permissions.contains(ALL_SITES),
            chrome.scripting.getRegisteredContentScripts({ ids: [SELECTION_SCRIPT_ID] })
        ]);
        return granted && scripts.length > 0;
    } catch {
        return false;
    }
}

/**
 * Turn the floating selection button on. Must run inside a user gesture
 * (permission prompt).
 * @returns {Promise<boolean>} whether it is now enabled
 */
export async function enableSelectionButton() {
    const granted = await chrome.permissions.request(ALL_SITES);
    if (!granted) return false;
    await registerSelectionScript();
    return true;
}

export async function registerSelectionScript() {
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SELECTION_SCRIPT_ID] });
    if (existing.length) return;
    await chrome.scripting.registerContentScripts([{
        id: SELECTION_SCRIPT_ID,
        matches: ALL_SITES.origins,
        js: CONTENT_SCRIPT_FILES.js,
        css: CONTENT_SCRIPT_FILES.css,
        runAt: 'document_idle',
        persistAcrossSessions: true
    }]);
}

export async function unregisterSelectionScript() {
    try {
        await chrome.scripting.unregisterContentScripts({ ids: [SELECTION_SCRIPT_ID] });
    } catch {
        // Not registered.
    }
}

/** Turn the floating selection button off and drop the host permission. */
export async function disableSelectionButton() {
    await unregisterSelectionScript();
    try {
        await chrome.permissions.remove(ALL_SITES);
    } catch {
        // Already removed.
    }
}
