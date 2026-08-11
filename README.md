<div align="center">

<img src="assets/store/promo-marquee-1400x560.png" alt="LingFlow AI — your AI language workspace: translate, correct & prompt in 26 languages" width="820">

<h1>LingFlow AI</h1>

<p><strong>AI-powered translation, text correction, and prompt engineering — right in your browser.</strong></p>

<p>
  <a href="#installation"><img src="https://img.shields.io/badge/version-1.6.0-blue?style=flat-square" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/Manifest-V3-orange?style=flat-square" alt="Manifest V3">
  <img src="https://img.shields.io/badge/languages-26-success?style=flat-square" alt="26 languages">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs welcome">
</p>

<p>
  <a href="#installation">Install</a> ·
  <a href="#features">Features</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#build-from-source">Build from source</a> ·
  <a href="#privacy">Privacy</a>
</p>

</div>

---

LingFlow AI is an open-source, Manifest V3 browser extension that combines AI translation, text correction, OCR, text-to-speech, and image-prompt engineering in a single workspace. Work from the popup, side panel, or directly on any page.

### How it works

LingFlow AI supports two tiers:

| Tier | What you get | Requirements |
| --- | --- | --- |
| **Chrome AI (Free)** | Translation via Chrome's built-in Translator API; text generation via Prompt API (correction, tone, prompts — limited to supported languages) | A compatible Chromium browser with Built-in AI enabled. First use downloads the on-device model (~1 GB, one-time). No API key needed. Your text is never sent to external servers. |
| **BYOK (Bring Your Own Key)** | Full translation, correction, tone rewriting, prompt engineering, and OCR/vision via OpenAI or Google Gemini | Your own API key. Text is sent to the chosen provider over HTTPS. |

> Chrome AI does not send your content to any network endpoint. However, the browser may need an internet connection the first time to download the on-device model.

## Installation

### Chrome Web Store

1. Visit the **LingFlow AI** listing *(link coming soon)*.
2. Click **Add to Chrome**.
3. Pin the extension for quick access.

### From source

See [Build from source](#build-from-source) to load the unpacked extension during development.

### First-time setup

1. Open the extension and go to **Settings**.
2. Pick your AI engine:
   - **Chrome AI (Free)** — on-device, no key required. The browser may download the model on first use (progress is shown in the UI).
   - **OpenAI** or **Google Gemini** — paste your own API key for full feature access including OCR.
3. Set your default target language and save.

> Get API keys: [OpenAI](https://platform.openai.com/api-keys) · [Google Gemini](https://aistudio.google.com/app/apikey)

## Features

### Translation

- 26 languages with auto-detect and one-click language swap.
- Tone & register control: Auto, Formal, Casual, Business, Friendly.
- Chrome AI uses the native Translator API for supported language pairs; unsupported pairs fall back to the Prompt API.
- BYOK providers use their full model capabilities for all pairs.

### Text correction

- Set the same source and target language to correct grammar and improve style while preserving meaning.
- Tone-aware rewriting applies the selected register.
- Uses Prompt API (Chrome AI) or the BYOK provider's text generation.

### Prompt engineering

- **Photo** — photorealistic scene direction (composition, lighting, lens, realism cues).
- **Graphic** — illustrations, brand assets, posters, UI-style graphics, stickers, and layouts.
- **Expand** — clean up and enhance an existing image prompt without changing the core idea.

### OCR & screenshot translation (BYOK only)

- Drag to capture any region on the page.
- Powered by GPT-4o-mini Vision or Gemini Vision.
- Dual output: transcription + translation, with copy and TTS.
- Images auto-resized to reduce API cost.

> OCR requires an API key — Chrome AI does not support vision input at this time.

### On-page translation

- Floating button on text selection, instant tooltip, dark non-intrusive UI.
- In-place text replacement across inputs, textareas, and contenteditable fields.

### History & TTS

- Persistent, cross-session history (max 100 items, auto-cleanup).
- Search, filter by mode, and pin important items; one-click restore.
- Text-to-speech via Web Speech API or Chrome TTS.

## Usage

| Task | How |
| --- | --- |
| **Translate** | Popup → *Translate* tab → choose languages → enter text → **Translate**. Use the swap button to reverse direction. |
| **Fix text** | *Translate* tab with the same source and target language, optionally pick a tone, then **Translate**. |
| **Generate a prompt** | *Prompt* tab → choose Photo / Graphic / Expand → describe the scene → **Generate**. |
| **OCR a region** | *Translate* tab → camera icon → drag a rectangle → view transcription + translation. Requires BYOK. |
| **On-page** | Select text on any page → click the floating button → translate / replace / copy. |

## Tech stack

- **Frontend:** Vanilla ES6+ (no framework), Tailwind CSS 3.x, semantic HTML5.
- **AI providers:** Chrome Built-in AI (Translator API + Prompt API), Google Gemini (`@google/generative-ai`), OpenAI Chat Completions.
- **Default BYOK models:** Gemini 3.5 Flash Lite (Gemini), GPT-4o mini (OpenAI).
- **Platform:** Manifest V3 service worker, content scripts, side panel, Chrome Storage / Tabs / TTS APIs.
- **Tooling:** webpack, Tailwind CLI, Vitest.

### Model configuration

Models and defaults are defined in [`popup/modules/constants.js`](popup/modules/constants.js).

| Mode | Temperature | Max tokens |
| --- | --- | --- |
| Translation | 0.3 | 2000 |
| Text correction | 0.2 | 2000 |
| Prompt engineering | 0.7 | 2000 |
| OCR | 0.2 | 4096 |

## Build from source

**Prerequisites:** Node.js 18+ and a Chromium-based browser.

```bash
# 1. Clone
git clone https://github.com/dilitS/LingFlow-AI.git
cd LingFlow-AI

# 2. Install dependencies
npm install

# 3. Build the bundle and CSS
npm run build        # webpack (production)
npm run build:css    # Tailwind CSS

# During development, watch for changes:
npm run watch        # webpack --watch
npm run watch:css    # Tailwind --watch

# Run tests and lint
npm test
npm run lint
```

> **CSS strategy:** `popup/output.css` is a committed build artifact generated by `npm run build:css`. After changing Tailwind classes in HTML or JS, re-run `npm run build:css` and commit the updated file.

**Load the unpacked extension:**

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the project folder.
4. Pin LingFlow AI and open Settings to configure your AI engine.

## Privacy

- **Chrome AI tier:** text is processed entirely on your device. The browser may download the model over the internet on first use, but your content is never sent to external servers.
- **BYOK tier:** text is sent to your selected provider (OpenAI or Google Gemini) over HTTPS. Refer to their data policies: [OpenAI](https://openai.com/policies/api-data-usage-policies) · [Google](https://ai.google.dev/gemini-api/terms).
- API keys are stored locally in `chrome.storage.local`.
- **No telemetry, no tracking, no data collection** by LingFlow AI itself.

Full details: [PRIVACY.md](PRIVACY.md).

## Known limitations

- OCR requires your own API key (Chrome AI does not support vision).
- Chrome AI availability depends on hardware, OS, and browser version — not all devices support it.
- Chrome AI language support is limited; unsupported pairs use the Prompt API with reduced quality.
- The browser prompts for screen-capture permission on first OCR use.
- Large images are scaled to 1920x1080 to limit API cost.
- Subject to provider rate limits.

## Roadmap

- [ ] Migrate Gemini SDK from `@google/generative-ai` to `@google/genai`
- [ ] Improve error handling and typed retry logic
- [ ] Browser-level integration tests (Playwright)
- [ ] Complete i18n coverage (Polish + English minimum)
- [ ] Accessibility improvements (keyboard navigation, ARIA)
- [ ] Piper TTS offline synthesis (post-v2.0, requires evaluation)
- [ ] Chrome Web Store publication

## Contributing

Contributions, suggestions, and bug reports are welcome.

1. Fork the repository and create a feature branch.
2. Make your changes and run `npm test && npm run lint`.
3. Open a pull request describing what and why.

## License

Released under the [MIT License](LICENSE).

---

<div align="center">
<sub>Built with care and AI-powered development.</sub>
</div>
