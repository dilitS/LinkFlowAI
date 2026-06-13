import { elements } from './dom-elements.js';
import { SUPPORTED_LANGUAGES } from './constants.js';

let activeSiteContext = null;
let hasAppliedSiteTarget = false;

function getLanguageLabel(code) {
    return SUPPORTED_LANGUAGES.find(lang => lang.code === code)?.name || code || 'Auto';
}

function isSupportedTabUrl(url) {
    return typeof url === 'string' && /^https?:\/\//.test(url);
}

function getHostname(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return null;
    }
}

function updateSiteCard(stateManager) {
    if (!elements.siteContextCard) return;

    if (!activeSiteContext || !activeSiteContext.hostname) {
        elements.siteContextHost.textContent = chrome.i18n.getMessage('siteContextUnavailableTitle') || 'Strona niedostępna';
        elements.siteContextStatus.textContent = chrome.i18n.getMessage('siteContextUnavailableStatus') || 'Brak';
        elements.siteContextStatus.className = 'rounded-full border border-gray-700 bg-[#18181b] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-400';
        elements.siteContextSubtitle.textContent = chrome.i18n.getMessage('siteContextUnavailableBody') || 'To działa na zwykłych stronach HTTP/HTTPS.';
        elements.sitePauseBtn.disabled = true;
        elements.sitePauseBtn.classList.add('opacity-50', 'cursor-not-allowed');
        return;
    }

    const sitePref = stateManager.getSitePreference(activeSiteContext.hostname);
    const paused = !!sitePref.paused;
    const effectiveTarget = sitePref.targetLang || elements.targetLang.value || stateManager.state.settings?.defaultTargetLang || 'en';

    elements.sitePauseBtn.disabled = false;
    elements.sitePauseBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    elements.siteContextHost.textContent = activeSiteContext.hostname;
    elements.siteContextStatus.textContent = paused
        ? (chrome.i18n.getMessage('siteContextPausedStatus') || 'Pauza')
        : (chrome.i18n.getMessage('siteContextActiveStatus') || 'Inline aktywny');
    elements.siteContextStatus.className = paused
        ? 'rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300'
        : 'rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300';
    elements.siteContextSubtitle.textContent =
        `${chrome.i18n.getMessage('siteContextSubtitlePrefix') || 'Język dla tej strony:'} ${getLanguageLabel(effectiveTarget)}`;
    elements.sitePauseBtn.textContent = paused
        ? (chrome.i18n.getMessage('siteContextResumeButton') || 'Wznów')
        : (chrome.i18n.getMessage('siteContextPauseButton') || 'Pauza');

    if (!hasAppliedSiteTarget && sitePref.targetLang) {
        elements.targetLang.value = sitePref.targetLang;
        hasAppliedSiteTarget = true;
    }
}

export async function initSiteContext(stateManager, showToast) {
    if (!chrome.sidePanel && elements.openSidepanelBtn) {
        elements.openSidepanelBtn.disabled = true;
        elements.openSidepanelBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
        const supported = isSupportedTabUrl(tab.url);
        activeSiteContext = {
            tabId: tab.id,
            windowId: tab.windowId,
            url: tab.url,
            title: tab.title || '',
            // hostname drives the per-site pause feature; it's null on chrome:// etc.,
            // but we still keep windowId so the workspace can be opened from anywhere.
            hostname: supported ? getHostname(tab.url) : null
        };
    } else {
        activeSiteContext = null;
    }

    updateSiteCard(stateManager);

    elements.sitePauseBtn?.addEventListener('click', async () => {
        if (!activeSiteContext?.hostname) return;
        await stateManager.toggleSitePause(activeSiteContext.hostname);
        updateSiteCard(stateManager);
        showToast(
            stateManager.getSitePreference(activeSiteContext.hostname).paused
                ? (chrome.i18n.getMessage('siteContextPausedToast') || 'Inline translation paused on this site')
                : (chrome.i18n.getMessage('siteContextResumedToast') || 'Inline translation resumed on this site')
        );
    });

    elements.openSidepanelBtn?.addEventListener('click', () => {
        const windowId = activeSiteContext?.windowId;
        if (windowId == null) return;
        // Call open() first (no await before it) to preserve the user gesture.
        chrome.sidePanel
            .open({ windowId })
            .catch((error) => {
                console.error('Failed to open side panel:', error);
                showToast(chrome.i18n.getMessage('sidepanelOpenError') || 'Cannot open side panel here');
            });
    });
}

export function renderSiteContext(stateManager) {
    updateSiteCard(stateManager);
}

export async function rememberTargetLanguageForSite(stateManager, targetLang) {
    if (!activeSiteContext?.hostname) return;
    await stateManager.setSitePreference(activeSiteContext.hostname, {
        targetLang
    });
    updateSiteCard(stateManager);
}

export function getActiveSiteContext() {
    return activeSiteContext;
}
