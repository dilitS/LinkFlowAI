# LingFlow AI — Roadmap

> Plan wydania: [`PLAN-AKTUALIZACJI-V2.md`](PLAN-AKTUALIZACJI-V2.md)  
> Aktualna wersja: **2.0.0-rc.2** (+ zmiany z sekcji *Unreleased* w CHANGELOG)

## Status sprintów (v2.0)

| Sprint | Cel | Status |
|---|---|---|
| **0–6** | Baseline, Chrome AI, providery, bezpieczeństwo, i18n/a11y, build, public repo | Done |
| **7** | Paczkowanie (sidepanel w ZIP), Chrome AI (języki, progress, timeout), smoke test | RC — checklista w `SMOKE-TEST.md` |
| **8** | Gemini retry/status, walidacja wiadomości, cache z wersją promptu | Done |
| **9** | Locale en/pl, dokumentacja, CI, RC build | Done (`2.0.0-rc.2`) |
| **10** | Prompty pod modele 2026, zakładka Korekta z diffem, content script na żądanie + menu kontekstowe, fallback językowy Chrome AI, `npm run eval` | Done |
| **11** | Ucięte odpowiedzi, fallback wycofanego modelu, cache w `storage.session`, limity per provider, OCR JSON, ustawienia prywatności, porządki | Done |

## v2.0.0 — bramka wydania

- [ ] Ręczny smoke test na czystym profilu Chrome (`SMOKE-TEST.md`); OCR opcjonalnie
- [ ] Bazowy raport `npm run eval -- --judge` zapisany do porównań
- [x] CI zielone (`npm run verify`, package, E2E)
- [ ] Podbicie wersji `2.0.0-rc.2` → `2.0.0` (manifest `version_name`, `package.json`, README, CHANGELOG)
- [ ] GitHub Release z paczką ZIP (projekt open source, bez Chrome Web Store)
- [ ] Tag `v2.0.0`

## Decyzje architektoniczne

- **Free tier** = Chrome Built-in AI (Translator + Prompt API).
- **BYOK** = OpenAI, Gemini — klucz użytkownika.
- **OCR** = BYOK only.
- **UI locale v2.0** = `en` + `pl` (pozostałe języki tłumaczenia w pickerze).
- **Chrome AI** działa w page context, nie w service workerze.
- **Brak content scriptu domyślnie**: wstrzykiwanie na żądanie (`activeTab` + `scripting`); pływający przycisk to opcja z opcjonalnym dostępem do wszystkich stron.
- **Prompty** w jednym module (`lib/prompts.js`), zmiany weryfikowane przez `npm run eval`.

## Po v2.0

- Więcej locale UI (pozostałe 24 języki)
- Piper TTS offline (osobny milestone)
- Proofreader/Rewriter API (korekta on-device, gdy dojdzie obsługa polskiego)
- Multimodal Prompt API (OCR on-device)
- Słownik użytkownika i własne instrukcje (stałe tłumaczenia terminów, forma „ty/Pan”)
- Warianty wyników („3 wersje”) dla promptów i tłumaczeń marketingowych
- Generowanie obrazu z promptu przez Nano Banana i tryb „obraz → prompt”
- Zapisane presety promptów użytkownika
- Podgląd Markdown dla briefów (kod, UI)
