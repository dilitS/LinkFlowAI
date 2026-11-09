# Chrome Web Store Submission Guide

## Short Description (132 chars max)

AI-powered translation, text correction, and prompts. Free on-device Chrome AI + optional OpenAI/Gemini with your own API key.

## Detailed Description

LingFlow AI is an intelligent language assistant for Chrome that helps you translate, correct, and generate text directly in your browser.

### Features
- **Translate** — Translate text between 50+ languages in the popup, side panel, or inline on any webpage
- **Correct** — Fix grammar and spelling with AI-powered suggestions
- **Prompt** — Generate text, summarize, or rewrite using customizable prompts
- **OCR** — Extract and translate text from screenshots
- **Text-to-Speech** — Listen to translations with natural-sounding voices
- **History** — Track your translations with search, filters, and pinning

### AI Providers
- **Chrome Built-in AI** (default) — Free, on-device processing. No API key needed. Requires Chrome 131+ with AI features enabled.
- **OpenAI** — GPT-5.6 models. Bring your own API key.
- **Google Gemini** — Gemini models. Bring your own API key.

### Privacy
- No data collection. No analytics. No tracking.
- API keys are stored locally and never leave your device.
- Chrome AI processes everything on-device.
- OpenAI/Gemini requests go directly to the provider — never through our servers.

## Single Purpose Statement

LingFlow AI provides AI-powered language assistance: translation, text correction, prompt generation, OCR, and text-to-speech within the browser.

## Permission Justifications

| Permission | Justification |
|---|---|
| `activeTab` | Run on the current tab only after the user clicks the extension, a context-menu item or OCR (inline result tooltip, screen-area capture) |
| `sidePanel` | Provide a persistent side panel UI for translation and prompts |
| `storage` | Store user preferences, API keys, and translation history locally |
| `contextMenus` | "Translate", "Correct" and "Translate screen area (OCR)" items in the right-click menu |
| `scripting` | Inject the inline tooltip script into the active tab on user action (no content script runs by default) |
| `clipboardWrite` | Copy results to the clipboard on the Copy button |
| `tts` | Read results aloud with Chrome TTS voices |
| Optional host permission `http://*/*`, `https://*/*` | Requested only when the user turns on "Show translate button when you select text" in Settings; removed again when it is turned off |

## Privacy Practices

- **No personal data collected**
- **No data sold to third parties**
- **No data used for purposes unrelated to the extension**
- **No data used for creditworthiness or lending**
- API keys stored in `chrome.storage.local` with `TRUSTED_CONTEXTS` access level
- Translation history stored locally only
- Remote API calls (OpenAI/Gemini) transmit only the user's text for processing
