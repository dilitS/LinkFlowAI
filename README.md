# 🌐 LingFlow AI - Browser Extension

> **AI-powered translation, text correction, and prompt engineering browser extension**

![Version](https://img.shields.io/badge/version-1.6.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Status](https://img.shields.io/badge/status-ready%20for%20release-success)
![Sprints](https://img.shields.io/badge/sprints-9%2F9%20completed-brightgreen)

---

## ✨ Features

LingFlow AI is a comprehensive browser extension that brings the power of AI to your browsing experience. With support for **26 languages** and a simplified two-mode workflow, it's your companion for translation, text improvement, OCR, TTS, and creative prompt generation.

### 🆕 What's new in 1.6.0
- **Default engine upgraded to Gemini 3.1 Flash Lite** — faster and far cheaper.
- **Live streaming responses** — results appear token by token with a typing caret, plus a **Stop** control to abort mid-generation.
- **Tone & register control** (DeepL-style): Auto, Formal, Casual, Business, Friendly — applied directly in Translate.
- **Regenerate** button to re-run any result while bypassing the cache.
- **In-place replace** from the on-page tooltip (works in inputs, textareas and contenteditable fields), plus copy & listen actions.
- **Side panel workspace** for longer sessions, plus a keyboard shortcut to open it fast.
- **Settings-driven inline language**: the language selected in Settings is the target for on-page selection translation and OCR.
- **History power-ups**: search, mode filters, pin important items, and restore mode/tone/language in one click.
- **Piper-compatible TTS**: use Chrome TTS voices (including installed Piper voices) and choose voice/language in Settings.
- **Full 26-language coverage** for the AI target language and text-to-speech (previously only 8 languages were mapped, silently defaulting the rest to English).
- **Live character counter** and `Esc` to close overlays.

### 🌍 Translation Mode
- **Multi-language Support**: Translate between 26 languages (Polish, English, German, Spanish, French, Italian, Portuguese, Dutch, Ukrainian, Czech, Slovak, Hungarian, Romanian, Bulgarian, Greek, Turkish, Swedish, Norwegian, Danish, Finnish, Japanese, Korean, Chinese, Russian, Arabic, Hindi)
- **Auto-detect**: Automatically detect source language
- **Text-to-Speech**: Listen to both input and output text
- **Language Swap**: Quickly swap source and target languages
- **Smart Caching**: Instant results for repeated translations

### ✏️ Text Improvement
- **Same-language cleanup**: select the same source/target language in Translate to correct grammar and improve style.
- **Tone-aware rewriting**: choose Formal, Casual, Business, or Friendly tone before translating/improving text.
- **Meaning preservation**: the translate prompt keeps the original intent while improving fluency when the text is already in the target language.

### 🎨 Prompt Mode
- **Photo Prompts**: Photorealistic prompts built around subject, action, environment, composition, lighting, lens, and realism cues
- **Graphic Prompts**: Prompt structure for illustrations, brand assets, posters, UI-style graphics, stickers, and layouts
- **Prompt Expansion**: Clean up and expand an existing image prompt without changing the core intent
- **Artistic Enhancement**: Adds visual details, style references, and technical specs
- **Multi-language**: Translate prompts to any supported language
- **Creative Boost**: Temperature 0.7 for maximum creativity

### 📸 OCR & Screenshot Translation
- **Screen Capture**: Capture screenshots of browser tabs or selected areas
- **Text Extraction**: Advanced OCR powered by GPT-4o-mini Vision or Gemini Vision
- **Dual Output**: View both transcription and translation
- **Smart Resize**: Automatically optimizes images to reduce API costs
- **Full Features**: Copy and TTS functionality for results

### 🌐 On-Page Translation
- **Floating Button**: Select text on any webpage to see instant translation button
- **Instant Tooltip**: View translations directly on the page
- **Non-intrusive**: Dark mode design that doesn't interfere with browsing
- **Smart Positioning**: Tooltip follows your selection

### 💾 History & Storage
- **Persistent History**: All translations, text improvements, and prompts saved
- **Cross-Session**: History persists across browser restarts
- **Auto-Cleanup**: Automatically manages history (max 100 items)
- **Quick Restore**: Click any history item to restore it
- **Mode Indicators**: Color-coded by mode (translate/prompt)

### ⚙️ Settings & Configuration
- **Dual API Support**: Choose between OpenAI GPT-4o-mini or Google Gemini
- **Custom API Keys**: Bring your own API key for full control
- **Secure Proxy**: Free tier uses a secure proxy server to protect API keys
- **Default Target Language**: Configure popup, selected-text translation, and OCR target language
- **TTS Voice Selection**: Choose Web Speech or Chrome TTS/Piper-compatible voices
- **Local Storage**: API keys are stored locally in the browser extension storage

### 🚀 Performance & Optimization
- **Smart Caching**: LRU cache with 100 items, 1-hour TTL
- **Retry Logic**: Automatic retry with exponential backoff
- **Error Handling**: User-friendly error messages
- **Toast Notifications**: Visual feedback for all actions
- **Optimized API Calls**: Reduced costs through intelligent caching

---

## 📋 Requirements

- **Browser**: Chrome 88+ / Firefox 78+ / Edge 88+
- **API Key**: OpenAI or Google Gemini
  - [OpenAI API Keys](https://platform.openai.com/api-keys)
  - [Google Gemini API Keys](https://aistudio.google.com/app/apikey)

---

## 🔧 Installation

### Chrome Web Store
**LingFlow AI** is available directly from the Chrome Web Store.

1. Go to the [LingFlow AI Chrome Web Store page](#) *(Link coming soon)*
2. Click **Add to Chrome**
3. Pin the extension icon for easy access

### Configuration

1. **Configure API Key**:
   - Click the LingFlow AI extension icon
   - Click Settings (⚙️ icon)
   - **Option A: Free Tier (Built-in)**:
     - Select "Built-in (Free)"
     - *Ready to use immediately!*
   - **Option B: Custom Key**:
     - Select your API provider (OpenAI or Gemini)
     - Enter your API key
   - Click "Save Settings"

2. **Start Using**:
   - Try translating "Hello world" to Polish
   - Test OCR with a screenshot
   - Select text on any webpage

---

## 📖 Usage Guide

### 🌍 Translation

1. Click the LingFlow AI extension icon
2. Select **Translate** mode (default)
3. Choose source language (or use Auto-detect)
4. Choose target language
5. Enter or paste text
6. Click **Translate**
7. Use TTS 🔊 to listen or Copy 📋 to clipboard

**Tip**: Use the swap button ↔️ to quickly reverse languages!

### 📸 OCR (Screenshot Translation)

1. Select **Translate** mode
2. Make sure the default target language is set in Settings
3. Click the 📷 (Camera) icon
4. Drag over the area of the page you want to read
5. Wait for processing (OCR + Translation)
6. View both transcription and translation in the on-page tooltip
7. Copy the result or use TTS

**Best practices**:
- Use clear, readable text in images
- Avoid very small fonts
- Good lighting improves accuracy

### ✏️ Text Improvement

1. Select **Translate** mode
2. Set source and target to the same language (or keep source on Auto)
3. Pick the tone/style you want
4. Enter text
5. Click **Translate**
6. Review the corrected, cleaner version

### 🎨 Prompt Generation

1. Select **Prompt** mode
2. Choose prompt type:
   - **Photo**: photorealistic Gemini/Nano Banana-style scene direction
   - **Graphic**: illustration, poster, logo, UI-style graphic, sticker, or layout
   - **Expand**: improve an existing image prompt without changing intent
3. Describe what you want to see
4. Click **Generate Prompt**
5. Copy enhanced prompt

**Example**:
- Input: "sunset over mountains"
- Output: "Breathtaking sunset over majestic mountain peaks, golden hour lighting, dramatic clouds with pink and orange hues, photorealistic, 8k resolution, cinematic composition..."

### 🌐 On-Page Translation

**Method 1: Floating Button**
1. Select any text on a webpage
2. Click the floating LingFlow button that appears
3. View translation in tooltip
4. Copy if needed

**Tip**: The target language for selected text is the default language set in Settings.

---

## 🛠️ Technology Stack

### Frontend
- **HTML5**: Semantic markup
- **CSS3**: Tailwind CSS for styling
- **JavaScript**: Vanilla ES6+ (no frameworks)

### APIs
- **OpenAI GPT-4o-mini**: Text + Vision (streaming)
- **Google Gemini 3.1 Flash Lite**: Text + Vision (streaming)

### Browser APIs
- **Chrome Storage API**: Persistent storage
- **Chrome Tabs API**: Screenshot capture
- **Web Speech API**: Text-to-Speech
- **Chrome TTS API**: Piper-compatible voice selection when installed

### Architecture
- **Manifest V3**: Latest Chrome extension standard
- **Service Worker**: Background processing
- **Content Scripts**: On-page functionality
- **State Management**: Centralized state with observers

---

## 🔐 Privacy & Security

- ✅ **Local Storage**: API keys stored locally in browser extension storage
- ✅ **Secure Proxy**: API requests for free tier go through a secure proxy
- ✅ **No Telemetry**: Zero tracking or analytics
- ✅ **Local-First**: Data stays on your device
- ✅ **HTTPS Only**: Secure communication with APIs
- ✅ **Minimal Permissions**: Only requests necessary permissions
- ✅ **No Data Collection**: We don't collect or store your data
- ✅ **User Control**: You control your API keys and data

---

## 📝 API Configuration

### OpenAI (GPT-4o-mini)
| Mode | Temperature | Max Tokens | Model |
|------|-------------|------------|-------|
| Translation | 0.3 | 2000 | gpt-4o-mini |
| Prompt | 0.7 | 2000 | gpt-4o-mini |
| OCR | 0.2 | 4096 | gpt-4o-mini |

### Google Gemini (3.1 Flash Lite — default)
| Mode | Temperature | Max Tokens | Model |
|------|-------------|------------|-------|
| Translation | 0.3 | 2000 | gemini-3.1-flash-lite |
| Prompt | 0.7 | 2000 | gemini-3.1-flash-lite |
| OCR | 0.2 | 4096 | gemini-3.1-flash-lite |

> Model IDs are stored as configuration constants in `lib/api-client.js`
> (`DEFAULT_GEMINI_MODEL`). When the model graduates from preview to GA, this is a
> one-line change. Translate and Prompt responses are **streamed** token
> by token for Gemini and OpenAI; the free tier falls back to a single response.

---

## 🐛 Known Issues & Limitations

1. **OCR Requires API Key**: OCR functionality requires user's own API key (no default provided)
2. **First Screenshot Permission**: Browser will ask for screen capture permission on first use
3. **Image Size Limit**: Large images automatically scaled to 1920x1080 to reduce API costs
4. **API Rate Limits**: Subject to API provider's rate limits
5. **Browser Compatibility**: Optimized for Chrome; Firefox support may vary

---

## 🚀 Performance Metrics

### Cache Performance
- **Cache Hit Rate**: ~30-50% for typical usage
- **Cache Size**: 100 items (LRU eviction)
- **Cache TTL**: 1 hour
- **Response Time (cached)**: < 10ms
- **Response Time (uncached)**: 1-3s

### Error Recovery
- **Retry Attempts**: 3 (with exponential backoff)
- **Backoff Delays**: 1s, 2s, 4s
- **Success Rate Improvement**: ~20-30%

### Storage
- **History Limit**: 100 items
- **Auto-cleanup**: Enabled
- **Storage Type**: Chrome Storage API (local)

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 👥 Contributing

This is a personal project, but suggestions and bug reports are welcome!

### How to Contribute
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---


**Built with ❤️ using AI-powered development**

