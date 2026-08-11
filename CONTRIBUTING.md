# Contributing to LingFlow AI

Thank you for your interest in contributing to LingFlow AI!

## Getting Started

1. **Fork and clone** the repository
2. Install dependencies: `npm install`
3. Install Playwright browsers: `npx playwright install chromium`
4. Run unit tests: `npm test`
5. Run lint: `npm run lint`
6. Build: `npm run build`
7. Full verification: `npm run verify`

## Development Workflow

### Project Structure

- `popup/` — Extension popup UI and modules
- `background/` — Service worker (background script)
- `content/` — Content script injected into web pages
- `lib/` — Shared libraries (API client, state, TTS, etc.)
- `_locales/` — i18n translations (26 languages)
- `tests/` — Vitest unit tests
- `tests/e2e/` — Playwright browser tests
- `scripts/` — Build and verification scripts

### Running the Extension Locally

1. Run `npm run build` to generate bundles
2. Open `chrome://extensions/` in Chrome
3. Enable "Developer mode"
4. Click "Load unpacked" and select the project root folder

### Making Changes

1. Create a feature branch from `main`
2. Make your changes
3. Run `npm run verify` to ensure everything passes
4. Commit with a clear, descriptive message
5. Open a Pull Request

### Testing

- Unit tests: `npm test`
- E2E browser tests: `npm run test:e2e`
- Full pipeline: `npm run verify`

### i18n

- English (`en`) is the reference locale
- All 26 locales must have matching keys (verified by automated test)
- Add new i18n keys to `_locales/en/messages.json` first, then propagate

### Code Style

- ESLint is configured — run `npm run lint` before committing
- No hardcoded UI strings — use `chrome.i18n.getMessage()` or `data-i18n` attributes

## Pull Request Guidelines

- Keep PRs focused and small
- Include a clear description of what changed and why
- All tests must pass
- Update i18n keys if you change user-facing text

## Reporting Issues

Please use GitHub Issues with the appropriate template (bug report or feature request).
