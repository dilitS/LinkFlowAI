# Changelog

All notable changes to LingFlow AI will be documented in this file.

## [2.0.0-rc.2] - 2026-08-11

### Fixed
- `manifest.json` `version` is now the Chrome-legal `2.0.0`; the RC label moved to `version_name` (a `-rc.1` suffix made Chrome refuse to load the extension, which is why local E2E timed out waiting for the service worker)
- CI runs Playwright under `xvfb-run` — extensions need a headed browser and GitHub runners have no display server
- Prompt API sessions declare `['en', <input language>]` in `expectedInputs`, since the system instruction is always English
- `generatePrompt()` forwards the user-selected source language instead of the target language
- Translator API → Prompt API fallback and prompt generation resolve `auto` through the Language Detector before declaring languages
- Remaining hardcoded Polish UI strings localized: language names (via `Intl.DisplayNames`), tone presets, prompt types, Chrome AI status messages
- Popup footer reads the version from the manifest instead of a hardcoded `v2.0.0`

### Added
- `scripts/verify.js` validates the Chrome version format and manifest/package.json version agreement
- Message validation requires `sender.id` and a `data:image/…;base64,…` payload for OCR
- Regression test rejecting hardcoded Polish strings in UI source
- 15 i18n keys for tone presets, prompt types, and Chrome AI status (en, pl)

## [2.0.0-rc.1] - 2026-08-11

### Added
- `sidepanel/` included in release ZIP with post-package validation (`scripts/validate-zip.js`)
- Chrome AI download progress in popup, settings, and on-page translation
- `PROMPT_VERSION` in cache keys to invalidate stale results after prompt changes
- `lib/message-validation.js` with sender, type, language, and OCR area checks
- 15 message-validation unit tests; Chrome AI language guard tests
- `SMOKE-TEST.md` manual QA checklist for release candidate
- `chromeAiDownloading` i18n key (en, pl)
- CI: full `npm run verify`, `package:only`, ZIP validation, clean CSS tree check, Playwright E2E job

### Changed
- Version bumped to `2.0.0-rc.1`
- UI locales officially limited to **English + Polish** for v2.0 (translation picker still supports 26 languages)
- Tone control hidden for Chrome AI translate (Translator API ignores tone)
- Chrome AI: correct/prompt pass proper `inputLang`/`outputLang`; unsupported languages blocked early
- On-page Chrome AI translation: no 30s timeout during first model download
- Gemini: removed deprecated `topP`/`topK` sampling params; preserve HTTP status; reject empty responses
- `package.json` repository URL → `https://github.com/dilitS/LinkFlowAI`
- README rewritten for v2.0 RC (install from ZIP, model docs, privacy contact)

## [2.0.0] - Unreleased

### Added
- Chrome Built-in AI (Translator, Language Detector, Prompt API) with proper execution context handling
- Google Gemini integration via `@google/genai` SDK (replaces legacy `@google/generative-ai`)
- OpenAI GPT-5.6 models (Luna, Terra, Sol)
- Typed error handling with retry logic (exponential backoff + jitter + Retry-After)
- Cache key generation includes provider and model
- Message validation schema with size limits in background script
- `chrome.storage.local.setAccessLevel('TRUSTED_CONTEXTS')` for API key isolation
- 121 unit tests (Vitest) covering all core modules
- 11 end-to-end browser tests (Playwright)
- i18n completeness test ensuring the shipped UI locales (en, pl) match key-for-key
- 49 new i18n keys for buttons, labels, filters, settings, and error messages
- Accessibility: ARIA roles, labels, live regions, keyboard navigation, focus-visible rings
- `prefers-reduced-motion` support
- `npm run verify` — full verification pipeline (lint + test + build + checks)
- `npm run package` — creates versioned ZIP with SHA-256 checksum
- Architecture Decision Record: ADR-001 Chrome AI Context
- CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md
- GitHub issue and PR templates
- NOTICES.md with third-party license information

### Changed
- Content scripts fetch preferences via `getPreferences` message instead of direct storage access
- Popup HTML uses English fallback text with `data-i18n` attributes (no hardcoded Polish)
- Manifest permissions minimized: removed `tabs`, narrowed `content_scripts` to `http(s)://`, scoped `web_accessible_resources`
- README and Privacy Policy rewritten to reflect actual product behavior
- MODE_COLORS uses `chrome.i18n.getMessage()` for localized mode labels

### Removed
- Piper TTS (incomplete implementation removed from all files)
- Deprecated models: `gpt-4o-mini`, `gpt-4o` (migration to GPT-5.6)
- Legacy `@google/generative-ai` SDK
- `tabs` permission from manifest
- `<all_urls>` from content script matches

### Fixed
- SSE streaming now correctly processes trailing buffer and validates empty responses
- `callOpenAIVision` uses configured model instead of hardcoded one
- Correction mode properly triggered when source and target languages match

## [1.6.0] - Previous Release

Initial public release with Chrome AI, OpenAI, and Gemini support.
