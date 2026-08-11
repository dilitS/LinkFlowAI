# ADR-001: Chrome AI execution context

**Status:** Accepted  
**Date:** 2026-08-11

## Context

Chrome Built-in AI APIs (Translator, Language Detector, Prompt API / LanguageModel)
are **not available in service workers or web workers**. They require a page context
with a responsible document for Permissions Policy checks.

MV3 extensions run their background script as a service worker, which means
`ChromeAIProvider` cannot execute Chrome AI calls from `background.js`.

## Decision

| Context | Chrome AI | BYOK (OpenAI/Gemini) |
|---|---|---|
| Popup / Side panel | Direct call via `ChromeAIProvider` | Direct call via `APIClient` |
| Content script (inline translation) | Direct call via `ChromeAIProvider` | Message to background |
| Background service worker | **Not used** — route to content script or reject | Direct fetch to API |

### Constraints

- First model download requires a user gesture (e.g. button click). Unconditional
  page-load calls trigger `NotAllowedError`.
- `availability()` must be called with the same options as `create()` to get
  accurate status.
- Desktop only (Windows, macOS, Linux, ChromeOS). Mobile not supported.
- Hardware: 4 GB+ VRAM (GPU) or 16 GB+ RAM with 4+ CPU cores.

### Implications

- Background service worker acts as a message router and BYOK dispatcher only.
- Content script needs a lightweight Chrome AI translation path for inline use.
- Popup bundle already runs in a page context — no change needed for popup flows.

## Sources

- https://developer.chrome.com/docs/ai/translator-api
- https://developer.chrome.com/docs/ai/prompt-api
- https://extensionbooster.net/blog/chrome-translator-api-guide-extension-developers/
