# LingFlow AI v2.0 — manual smoke test checklist

Use a **clean Chrome profile** (or guest window) and the release ZIP from `releases/lingflow-ai-v2.0.0-rc.1.zip`.

## Install

- [ ] Unzip the archive to a folder
- [ ] `chrome://extensions` → Developer mode → **Load unpacked**
- [ ] Extension loads without errors; version shows `2.0.0-rc.1`
- [ ] Side panel opens (`Ctrl+Shift+Y` / `Cmd+Shift+Y` or toolbar)

## Popup & side panel

- [ ] Popup opens from toolbar icon
- [ ] Side panel loads popup UI in iframe (`sidepanel/sidepanel.html`)
- [ ] Language selectors work; settings save
- [ ] Mode tabs: Translate ↔ Prompt

## Chrome AI (no API key)

- [ ] Provider **Chrome AI (Free)** selected by default
- [ ] Tone pills **hidden** in Translate mode (tone is BYOK-only)
- [ ] Translate `en` → `pl` returns a result
- [ ] Same source/target language triggers **correction** (not translation)
- [ ] Prompt mode → Photo generates an English prompt
- [ ] **First use:** download progress appears (settings bar + output); no 30s timeout
- [ ] Correct/Prompt with unsupported language (e.g. `pl` only) shows clear error

## On-page selection

- [ ] Select text on a webpage → floating button appears
- [ ] Click → tooltip shows translation (Chrome AI path)
- [ ] Copy / replace actions work

## BYOK (optional, with test keys)

- [ ] Switch to OpenAI or Gemini, enter key, save
- [ ] Translate works; tone pills visible
- [ ] OCR capture returns transcription + translation
- [ ] Stop button aborts streaming request

## Device without Chrome AI

- [ ] On unsupported Chrome: status shows unavailable; BYOK still works with key

## Regression

- [ ] No console errors in popup, side panel, or example.com with content script
- [ ] History saves and restores entries
- [ ] TTS plays on input/output (Web Speech or Chrome TTS)

Record Chrome version, OS, and any failures in the GitHub issue tracker before release.
