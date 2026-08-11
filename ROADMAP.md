# LingFlow AI — Roadmap

> Plan wydania: [`PLAN-AKTUALIZACJI-V2.md`](PLAN-AKTUALIZACJI-V2.md)  
> Aktualna wersja: **2.0.0-rc.1**

## Status sprintów (v2.0)

| Sprint | Cel | Status |
|---|---|---|
| **0–6** | Baseline, Chrome AI, providery, bezpieczeństwo, i18n/a11y, build, public repo | Done |
| **7** | Paczkowanie (sidepanel w ZIP), Chrome AI (języki, progress, timeout), smoke test | RC — checklista w `SMOKE-TEST.md` |
| **8** | Gemini retry/status, walidacja wiadomości, cache z wersją promptu | Done |
| **9** | Locale en/pl, dokumentacja, CI, RC build | RC (`2.0.0-rc.1`) |

## v2.0.0 — bramka wydania

- [ ] Ręczny smoke test na czystym profilu Chrome (`SMOKE-TEST.md`)
- [ ] CI zielone (`npm run verify`, package, E2E)
- [ ] Potwierdzenie `privacy@lingflow.ai`
- [ ] GitHub Release + Chrome Web Store submission
- [ ] Tag `v2.0.0`

## Decyzje architektoniczne

- **Free tier** = Chrome Built-in AI (Translator + Prompt API).
- **BYOK** = OpenAI, Gemini — klucz użytkownika.
- **OCR** = BYOK only.
- **UI locale v2.0** = `en` + `pl` (pozostałe języki tłumaczenia w pickerze).
- **Chrome AI** działa w page context, nie w service workerze.

## Po v2.0

- Więcej locale UI (pozostałe 24 języki)
- Piper TTS offline (osobny milestone)
- Proofreader/Rewriter API
- Multimodal Prompt API (OCR on-device)
