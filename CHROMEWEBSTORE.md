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
| `activeTab` | Access the current tab's content for inline translation of selected text |
| `sidePanel` | Provide a persistent side panel UI for translation and prompts |
| `storage` | Store user preferences, API keys, and translation history locally |
| `contextMenus` | Add "Translate with LingFlow AI" to the right-click context menu |
| `offscreen` | Create offscreen documents for Chrome AI operations not available in service workers |
| `scripting` | Inject content scripts for inline translation and text replacement |
| Host permission `http://*/*`, `https://*/*` | Content scripts need access to web pages for inline translation features |

## Privacy Practices

- **No personal data collected**
- **No data sold to third parties**
- **No data used for purposes unrelated to the extension**
- **No data used for creditworthiness or lending**
- API keys stored in `chrome.storage.local` with `TRUSTED_CONTEXTS` access level
- Translation history stored locally only
- Remote API calls (OpenAI/Gemini) transmit only the user's text for processing
