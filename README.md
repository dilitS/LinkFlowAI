<div align="center">

<img src="assets/store/promo-marquee-1400x560.png" alt="LingFlow AI — translate, correct and prompt in your browser" width="820">

<h1>LingFlow AI</h1>

<p><strong>AI-powered translation, text correction, and prompt engineering — right in your browser.</strong></p>

<p>
  <a href="#installation"><img src="https://img.shields.io/badge/version-2.0.0--rc.2-blue?style=flat-square" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/Manifest-V3-orange?style=flat-square" alt="Manifest V3">
  <img src="https://img.shields.io/badge/UI-locales%20en%20%2B%20pl-success?style=flat-square" alt="UI locales">
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

LingFlow AI is an open-source, Manifest V3 browser extension that combines AI translation, text correction, OCR, text-to-speech, and prompt engineering (graphics, video & code) in a single workspace. Work from the popup, side panel, or directly on any page.

> **v2.0 UI languages:** English and Polish (`_locales/en`, `_locales/pl`). Translation targets still include 26 languages in the language picker.

### How it works

LingFlow AI supports two tiers:

| Tier | What you get | Requirements |
| --- | --- | --- |
| **Chrome AI (Free)** | Translation via Chrome's built-in Translator API; correction and prompts via Prompt API (limited to supported languages) | Chromium 138+ with Built-in AI. First use downloads the on-device model (~1 GB). No API key. Text stays on-device. |
| **BYOK (Bring Your Own Key)** | Full translation, correction, tone rewriting, prompt engineering, and OCR via OpenAI or Google Gemini | Your own API key. Text sent to the provider over HTTPS. |

> Chrome AI does not send your content to external servers. The browser may need internet on first use to download the on-device model.

## Installation

### Chrome Web Store

1. Visit the **LingFlow AI** listing *(link coming soon)*.
2. Click **Add to Chrome**.
3. Pin the extension for quick access.

### From a release ZIP

1. Download `lingflow-ai-v2.0.0-rc.2.zip` from [GitHub Releases](https://github.com/dilitS/LinkFlowAI/releases).
2. Unzip to a folder.
3. Open `chrome://extensions` → **Developer mode** → **Load unpacked** → select the folder.

### From source

See [Build from source](#build-from-source).

### First-time setup

1. Open the extension → **Settings**.
2. Pick your AI engine:
   - **Chrome AI (Free)** — on-device, no key. Model download progress is shown on first use.
   - **OpenAI** or **Google Gemini** — paste your API key for OCR and full language/tone support.
3. Set default target language and save.

> API keys: [OpenAI](https://platform.openai.com/api-keys) · [Google Gemini](https://aistudio.google.com/app/apikey)

## Features

### Translation

- 26 target languages with auto-detect and swap.
- Tone & register (BYOK only): Auto, Formal, Casual, Business, Friendly.
- Chrome AI uses the native Translator API; unsupported pairs fall back to Prompt API.
- BYOK providers support all pairs with tone control.

### Text correction

- Dedicated **Correct** tab: proofreading in the text's own language (auto-detected or chosen).
- Minimal edits: spelling, grammar, punctuation and diacritics are fixed; the author's wording is kept.
- Result shown as an inline diff (removed text in red, added in green) with a change count; Copy gives the clean text.
- Optional tone (formal, casual, business, friendly) for both Chrome AI and BYOK.
- Chrome AI: Prompt API languages only (en, ja, es, de, fr); other languages show how to add a Gemini key.

### Prompt engineering

- **Category Pills**: Quick switching between **Graphics**, **Video**, and **Code** prompt domains.
- **Graphics (Nano Banana & Diffusion models)**:
  - *Photo*: Structured formula (Subject, Style, Composition, Lighting, Camera, Constraints).
  - *Graphic design*: Vector, 3D icons, minimal, editorial, and branding visual prompts.
  - *Enhance / Expand*: Turn rough text or tag-lists into full descriptive prompts.
  - *Web UI Mockup*: Clean Dribbble/Behance-level UI mockups (strictly no hands/stock lifestyle clutter).
  - *Mobile App UI*: Flat and isometric mobile screen presentations with touch ergonomics.
  - *4-Screen UI Collage*: Panoramic 16:9 4-screen app showcase (Onboarding, Dashboard, Detail, Profile).
- **Video (Veo / Gemini Omni, Sora, Kling, Runway, Luma)** - one shot of 5-10 s with subject, action, camera move, light and an audio line (ambient, effects, short quoted dialogue):
  - *Cinematic*: film language for shot size, lens, camera move and color grade.
  - *Image-to-Video (I2V)*: motion for an existing frame with subject consistency.
  - *3D Product Commercial*: studio light, reflections and a single product move.
  - *Social Media*: a hook in the first second, vertical by default.
  - *Seamless Loop*: cyclic motion whose last frame matches the first.
- **Code (AI Assistants & Design Directives)**:
  - *AI Coding Agent*: task brief with Goal, Context, Requirements, Constraints, Edge cases and Done when, in your language.
  - *UI Aesthetic Spec*: design direction with concrete fonts, hex palette, spacing and motion values.
- Image prompts are written as a narrative paragraph, with exclusions phrased positively and without "8k/masterpiece" filler.
- With Chrome AI, ideas in unsupported languages (e.g. Polish) are translated on-device and the prompt is written in English.
- **Inline Controls**: Direct inline aspect ratio selector (`16:9`, `9:16`, `1:1`, `4:5`, `21:9`) and camera motion selector (`zoom-in/out`, `pan`, `tracking`, `orbit`, `fpv`, `static`).

### OCR & screenshot translation (BYOK only)

- Region capture on any page (camera icon or right-click menu).
- OpenAI or Gemini vision models with structured JSON output and high image resolution.
- Transcription + translation with copy and TTS.

### On-page translation

- Right-click a selection: **Translate with LingFlow** or **Correct with LingFlow** (correction on the page needs a cloud key).
- Result tooltip with copy, listen and in-place replace in editable fields.
- Optional floating button on text selection: Settings → *Show translate button when you select text*. It asks for access to all sites only when turned on and gives it back when turned off.
- No content script runs by default; LingFlow touches a page only when you invoke it.

### History, privacy & TTS

- History (max 100 items) with search, filter and pin.
- Settings → Privacy: turn history off, auto-delete entries after 1/7/30/90 days, keep API keys in memory only until the browser closes.
- Web Speech API or Chrome TTS.

### Reliability

- Cut-off answers are flagged; an empty answer that ran out of budget is retried once.
- A retired model switches to the provider default automatically.
- Results are cached for an hour in session memory (also across popup reopenings).

## Usage

| Task | How |
| --- | --- |
| **Translate** | *Translate* tab → languages → text → action button |
| **Fix text** | *Correct* tab → text → **Correct** |
| **Generate prompt** | *Prompt* tab → Category (Graphics/Video/Code) → Type & Parameters → **Generate** |
| **OCR** | Camera icon or right-click → *Translate text from a screen area* → drag region (BYOK) |
| **On-page** | Select text → right-click → *Translate / Correct with LingFlow* (or the optional floating button) |
| **Side panel** | `Ctrl+Shift+Y` / `Cmd+Shift+Y` |

## Tech stack

- Vanilla ES6+, Tailwind CSS 3.x, Manifest V3
- Chrome Built-in AI, `@google/genai`, OpenAI Chat Completions
- webpack, Vitest, Playwright

Models and defaults: [`popup/modules/constants.js`](popup/modules/constants.js)

## Build from source

**Prerequisites:** Node.js 20+ (see `.nvmrc`), Chromium browser.

```bash
git clone https://github.com/dilitS/LinkFlowAI.git
cd LinkFlowAI
npm install
npm run verify          # lint + test + build + manifest checks
npm run package         # creates releases/lingflow-ai-v<version>.zip
```

**Load unpacked:** `chrome://extensions` → Developer mode → project root folder.

> `popup/output.css` is committed so the repo loads unpacked without a CSS build; re-run `npm run build:css` after Tailwind class changes (CI fails if the committed file is stale).

**Prompt quality evals** (real API, costs a few cents):

```bash
GEMINI_API_KEY=... npm run eval -- --judge    # or OPENAI_API_KEY=... npm run eval -- --provider openai
npm run eval -- --dry-run                     # print prompts only
```

Cases live in [`evals/cases.json`](evals/cases.json); reports go to `evals/results/` (git-ignored).

**Manual QA:** see [SMOKE-TEST.md](SMOKE-TEST.md).

## Privacy

- **Chrome AI:** on-device processing; model download may use network once.
- **BYOK:** HTTPS to OpenAI or Google. Keys in `chrome.storage.local` (trusted contexts only), or in session memory only if you choose so in Settings.
- **Minimal permissions:** no access to websites by default; the optional all-sites access is only for the floating selection button.
- **No telemetry** by LingFlow AI.

Full policy: [PRIVACY.md](PRIVACY.md) · Contact: `privacy@lingflow.ai`

## Known limitations

- OCR requires BYOK (no on-device vision in v2.0).
- Chrome AI depends on hardware, OS, and browser version.
- Chrome AI Prompt API languages: en, ja, es, de, fr (correction in other languages needs a cloud key).
- Input limit: 5,000 characters with Chrome AI, 30,000 with Gemini/OpenAI.
- UI localized to English and Polish only in v2.0.
- Provider rate limits apply to BYOK.

## Roadmap

See [ROADMAP.md](ROADMAP.md) and [PLAN-AKTUALIZACJI-V2.md](PLAN-AKTUALIZACJI-V2.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Run `npm run verify` before opening a PR.

## License

[MIT License](LICENSE)
