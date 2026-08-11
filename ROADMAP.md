# LingFlow AI — Roadmap

> Aktywny plan rozwoju: [`PLAN-AKTUALIZACJI-V2.md`](PLAN-AKTUALIZACJI-V2.md)
> Wersja bazowa: 1.6.0 · Cel: 2.0.0 (publikacja w Chrome Web Store)

## Status sprintów

| Sprint | Cel | Status |
|---|---|---|
| **0** | Porządki: wycofanie Piper TTS, aktualizacja modeli, prawda produktowa, CSS | Done |
| **1** | Chrome AI: kontekst wykonania, przeniesienie poza SW, capability matrix, operacje AI, języki Prompt API | Done |
| **2** | Providery, modele i poprawność danych (Gemini SDK, OpenAI, cache/fallback) | In progress |
| **3** | Bezpieczeństwo i poprawność danych (XSS, walidacja wejścia) | Planned |
| **4** | Sprzężenie zwrotne i obsługa błędów | Planned |
| **5** | Funkcje produktowe (ton, warianty promptu grafiki) | Planned |
| **6** | Jakość: testy i CI (domknięcie) | Planned |
| **7** | Dopracowanie i przygotowanie do publikacji | Planned |

## Decyzje architektoniczne

- **Free tier = Chrome Built-in AI (on-device).** Translator API, Language Detector, Prompt API (Gemini Nano).
- **BYOK** = OpenAI, Google Gemini — klucz użytkownika, nigdy proxy.
- **OCR = wyłącznie BYOK** (Chrome AI APIs nie obsługują wizji w v2.0).
- **Kontekst wykonania:** Chrome AI działa w page context (popup, side panel, content script). Service worker routuje tylko BYOK. Szczegóły: [`docs/ADR-001-chrome-ai-context.md`](docs/ADR-001-chrome-ai-context.md).

## Po v2.0

- Piper TTS offline synthesis (wymaga ewaluacji WASM vs Chrome TTS)
- Proofreader/Rewriter API (progresywne ulepszenie)
- Multimodal Prompt API (OCR on-device)
