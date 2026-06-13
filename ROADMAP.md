# 🗺️ LingFlow AI — Plan rozwoju (Roadmap)

> Plan pracy podzielony na sprinty, zadania i podzadania. Dokument planistyczny — bez kodu.
> Data utworzenia: 2026-06-13 · Wersja bazowa: 1.6.0 · Cel: 2.0.0 (publikacja w Chrome Web Store)
> Rewizja: 2026-06-13 (v2) — kolejność prac dopasowana do realnego stanu repo i ograniczeń platformy.

## Legenda

- **Priorytet:** 🔴 krytyczny · 🟠 wysoki · 🟡 średni · 🟢 niski
- **Rozmiar (effort):** S (≤0,5 dnia) · M (1–2 dni) · L (3–5 dni)
- **DoD** = Definition of Done (kryteria ukończenia)
- **Status:** ☐ do zrobienia · ◧ w trakcie · ☑ zrobione

## Co zmieniła rewizja v2 (uzasadnienie)

Plan v1 był dobry kierunkowo, ale miał trzy ryzyka, które v2 zamyka:

1. **Zła kolejność deproxyfikacji.** Darmowy tier to dziś literalnie `apiProvider: 'builtin' → OpenRouter przez proxy` w [lib/api-client.js](lib/api-client.js). Usunięcie proxy (dawne 2.1) przed potwierdzonym parytetem Chrome AI to świadomy regres. Dlatego Sprint 2 dzielimy na **2a (spike/capability matrix) → 2b (provider chrome-ai za flagą + migracja) → 2c (dopiero teraz usunięcie proxy)**.
2. **Brak decyzji o OCR.** OCR już dziś wymaga BYOK ([popup/modules/ocr.js](popup/modules/ocr.js), `translateScreenshot` w [lib/api-client.js](lib/api-client.js)). Built-in AI tego nie zmienia (Translator/Proofreader/Prompt to ścieżki tekstowe). v2 dodaje jawną decyzję: **OCR = wyłącznie BYOK** w 2.0.
3. **Zaniżony zakres migracji i bezpieczeństwa.** Semantyka providera jest dziś niespójna ([lib/state-manager.js](lib/state-manager.js) domyślnie `openai`, reszta fallbackuje do `builtin`, [popup/modules/session-meta.js](popup/modules/session-meta.js) hardkoduje „OpenRouter Free"), a `background` ładuje zbudowane bundle z `dist/`, podczas gdy popup jada ze źródeł — więc **każda zmiana w `lib/` wymaga rebuildu**. Sprint 1 dorzuca też zasadę „żadnych surowych stringów HTML dla treści dynamicznej" zamiast samego audytu `innerHTML`, a szkielet testów wjeżdża już do Sprintu 1.

## Decyzje architektoniczne (ADR skrót)

- **Free tier = Chrome Built-in AI (on-device).** Wszystkie API dostępne w rozszerzeniach (Translator, Language Detector, Prompt, Proofreader/Rewriter). Źródło: dokumentacja „AI on Chrome".
- **Mapowanie funkcji:** tłumaczenie → Translator API (+ Language Detector dla `auto`); korekta i generowanie promptów → Prompt API (Gemini Nano) z zachowaniem obecnych, dopracowanych instrukcji systemowych; Proofreader/Rewriter jako progresywne ulepszenie później.
- **Pokrycie języków:** Translator działa per para `source→target` i bywa węższy niż 26 języków. Dla nieobsługiwanych par **fallback na Prompt API** (Nano tłumaczy dowolne pary), a gdy i to niedostępne — typowany błąd z sugestią BYOK.
- **Kontekst wykonania:** provider `chrome-ai` jest context-agnostic (detekcja po `self`); działa w popupie/side panelu oraz w service workerze (inline). Brak globali → typowany błąd `chrome-ai-unavailable`.
- **Build:** [background/background.js](background/background.js) i [popup/popup.html](popup/popup.html) ładują `dist/*` — po każdej zmianie w `lib/`/`popup/` obowiązuje `npm run build` (część DoD i CI).

## Mapa wymagań → sprinty

| # | Wymaganie | Sprint |
| --- | --- | --- |
| 1 | Naprawa XSS | Sprint 1 |
| 4 | Przeniesienie sanityzacji z wejścia na wyjście | Sprint 1 |
| 8 (szkielet) | Testy: framework + regresja XSS | Sprint 1 (start) / Sprint 6 (domknięcie) |
| 2 | Darmowy tier = wbudowane Chrome AI; poza tym BYOK | Sprint 2 |
| 3 | Pełny open source — autor nie hostuje ani nie udostępnia API | Sprint 2 |
| 5 | Lepsze stany błędu | Sprint 3 |
| 6 | Pulsowanie ikony podczas oczekiwania na odpowiedź | Sprint 3 |
| 7 | Piper TTS: pobieranie głosów, wybór języka, prędkość | Sprint 4 |
| 11 | Wybór tonu w tłumaczeniu | Sprint 5 (✅ już istnieje — patrz 5.1) |
| 12 | 6 nowych wariantów promptu grafiki | Sprint 5 |
| 8 | Testy + CI (pełne) | Sprint 6 |
| 13 | Dopracowanie UI/UX | Sprint 7 |
| 9 | Dopracowanie README i Service Workera | Sprint 7 |
| 10 | Przygotowanie pod publikację w Chrome Web Store | Sprint 7 |

> **Kolejność i zależności:** Sprint 1 (bezpieczeństwo + szkielet testów) → Sprint 2 (architektura: 2a→2b→2c) → Sprint 3 → Sprinty 4/5 (równolegle) → Sprint 6 (domknięcie testów/CI) → Sprint 7.

---

## 🔴 Sprint 1 — Bezpieczeństwo i poprawność danych

**Cel:** zamknąć wektor XSS i przestać uszkadzać treść użytkownika. Fundament pod bezpieczne renderowanie wyników modelu.
**Zależności:** brak. **Rozmiar:** M.

### Zadanie 1.1 — Zakaz surowego HTML dla treści dynamicznej 🔴
- [ ] Wspólny, czysty moduł [lib/sanitize.js](lib/sanitize.js): `escapeHtml()` + walidator wejścia (testowalny, używany w popupie i `lib/`).
- [ ] [content/content.js](content/content.js): budować treść tooltipa przez `textContent`/`createElement` zamiast wstrzykiwać stringi (`renderTooltipResult`, `renderTooltipError`, `renderTooltipHtml`, ścieżka OCR). Treść modelu/OCR/błędu nigdy nie staje się wykonywalnym HTML.
- [ ] Ścieżka OCR: `background` przesyła **dane strukturalne** `{transcription, translation}`, a content script buduje DOM bezpiecznie (koniec z `tooltip.innerHTML = html`).
- [ ] [popup/modules/history.js](popup/modules/history.js): escapować `input`, `output`, `targetLang`, `mode`, `tone` przed wstrzyknięciem do listy historii.
- [ ] [popup/modules/settings.js](popup/modules/settings.js): escapować nazwy głosów TTS (`voiceName`, `lang`) pochodzące z systemu.
- **DoD:** żadna treść z modelu, OCR ani od użytkownika nie trafia jako wykonywalny HTML; test regresyjny z ładunkiem `<img onerror>` / `<script>` nie wykonuje skryptu (Sprint 1 / 6.3).

### Zadanie 1.2 — Walidacja wejścia zamiast mutacji 🟠
- [ ] Usunąć `replace(/[<>]/g, "")` i ciche `substring(0,5000)` z `sanitizeInput` w [lib/api-client.js](lib/api-client.js) (psują kod, HTML, matematykę `a < b`).
- [ ] Centralny walidator (`lib/sanitize.js`): zwraca typowany wynik (`INPUT_TOO_LONG`) zamiast po cichu obcinać; limit pozostaje, ale jest komunikowany.
- [ ] UI ([popup/modules/translation.js](popup/modules/translation.js)) pokazuje limit (licznik już jest) i czytelny komunikat przy przekroczeniu; inline (`background`) zwraca ten sam typowany błąd.
- [ ] Przegląd translate/correct/prompt/OCR pod kątem zależności od starego zachowania.
- **DoD:** tłumaczenie tekstu z `<`, `>`, fragmentami kodu zachowuje pełną treść; limit znaków komunikowany, nie ucinany po cichu.

### Zadanie 1.3 — Szkielet testów + regresja XSS (przeniesione z 6.1/6.3) 🟠
- [ ] Vitest + `jsdom`, naprawić `npm test` (dziś `exit 1`), usunąć ad-hoc skrypty z rootu (`test-gemini-sdk.js`, `test-openrouter.js`).
- [ ] Testy regresyjne: `escapeHtml` neutralizuje `<img onerror>`/`<script>`/cudzysłowy; walidator zachowuje `<`, `>`, kod, matematykę.
- **DoD:** `npm test` uruchamia realny zestaw; ładunki XSS są zneutralizowane w testach.

---

## 🔴 Sprint 2 — Nowa architektura modeli (deproxyfikacja)

**Cel:** darmowy tier działa wyłącznie na wbudowanym Chrome AI (on-device), każdy zewnętrzny model wyłącznie na kluczu użytkownika (BYOK). Repo w 100% open source — bez żadnego API ani hostingu po stronie autora.
**Zależności:** Sprint 1. **Rozmiar:** L. **Uwaga:** breaking change dla obecnych użytkowników free.

### Sprint 2a — Spike i decyzje 🔴

#### Zadanie 2a.1 — Capability matrix Chrome AI
- [ ] Detekcja per funkcja przed użyciem: `Translator.availability({source,target})`, `LanguageDetector.availability()`, `LanguageModel.availability({expectedInputs,expectedOutputs})`, opcjonalnie `Proofreader/Rewriter.availability()`.
- [ ] Stany modelu: `unavailable | downloadable | downloading | available` + obsługa `downloadprogress` (komunikat dla użytkownika).
- [ ] Weryfikacja pokrycia 26 języków przez Translator; lista par bez wsparcia → strategia fallback (Prompt API).
- **DoD:** udokumentowana macierz „funkcja × dostępność × fallback" jako podstawa 2b.

#### Zadanie 2a.2 — Decyzja o OCR
- [ ] Potwierdzić: **OCR = wyłącznie BYOK** w 2.0 (Translator/Proofreader/Prompt są tekstowe; multimodal Prompt poza zakresem 2.0).
- **DoD:** jasny komunikat w UI przy próbie OCR na chrome-ai (kieruje do BYOK).

### Sprint 2b — Provider `chrome-ai` za flagą + migracja 🔴

#### Zadanie 2b.1 — Provider chrome-ai
- [ ] [lib/chrome-ai-provider.js](lib/chrome-ai-provider.js): detekcja + wrappery (Translator + Language Detector dla `auto`; Prompt API dla correct/prompt; streaming gdzie wspierane).
- [ ] Fallback nieobsługiwanej pary językowej → Prompt API; brak globali/modelu → typowany `chrome-ai-unavailable`.
- [ ] Integracja w [lib/api-client.js](lib/api-client.js): `provider === 'chrome-ai'` deleguje do providera; zachować cache, streaming, anulowanie.

#### Zadanie 2b.2 — Migracja stanu, UI i build
- [ ] `getEffectiveConfig` → providerzy `chrome-ai` (free), `openai`, `gemini` (BYOK).
- [ ] Migracja stanu: stare `apiProvider: 'builtin'` → `'chrome-ai'` (+ domyślny provider w [lib/state-manager.js](lib/state-manager.js)).
- [ ] UI ustawień ([popup/popup.html](popup/popup.html), [popup/modules/settings.js](popup/modules/settings.js)): „Wbudowane Chrome AI (za darmo, na urządzeniu)" jako domyślne; klucz/model ukryte dla chrome-ai.
- [ ] [popup/modules/session-meta.js](popup/modules/session-meta.js) i [popup/modules/constants.js](popup/modules/constants.js): etykiety/`MODELS` bez „OpenRouter".
- [ ] **Sync build**: rebuild `dist/` (background + popup) jako część DoD.
- **DoD:** użytkownik aktualizujący z 1.6.0 nie traci konfiguracji; na wspieranym Chrome tłumaczy/poprawia/generuje bez klucza i bez serwera autora; brak działającego AI → czytelny fallback na BYOK.

### Sprint 2c — Usunięcie proxy/OpenRouter 🔴

#### Zadanie 2c.1 — Deproxyfikacja (dopiero po parytecie 2b)
- [ ] Usunąć z [lib/api-client.js](lib/api-client.js): `PROXY_ENDPOINT`, `OPENROUTER_ENDPOINT`, `FREE_MODEL`, `MODELS.builtin`, `callOpenRouter`, `fetchRemoteConfig`, `remoteConfigCache`.
- [ ] Usunąć `host_permissions` do `link-flow-proxy.vercel.app` z [manifest.json](manifest.json) oraz wywołania `fetchRemoteConfig` w `background`/`popup`.
- [ ] (Katalog `server/` już nie istnieje — pozycja zamknięta.)
- **DoD:** `grep` po `vercel`/`openrouter`/`proxy` czysty; brak zdalnego kodu autora.

### Zadanie 2.5 — Aktualizacja dokumentacji 🟡
- [ ] [PRIVACY.md](PRIVACY.md): tryb darmowy przetwarza dane on-device (nie opuszczają urządzenia), brak proxy.
- [ ] [README.md](README.md): nowa architektura, brak self-hostu serwera.
- **DoD:** dokumentacja zgodna z architekturą; brak wzmianek o hostowanym proxy.

---

## 🟠 Sprint 3 — Sprzężenie zwrotne i obsługa błędów

**Cel:** użytkownik zawsze wie, co się dzieje i co poszło nie tak.
**Zależności:** Sprint 1 (escapowanie), Sprint 2 (typy błędów providerów). **Rozmiar:** M.

### Zadanie 3.1 — Lepsze stany błędu 🟠
- [ ] Typy błędów: brak klucza, limit zapytań, błąd sieci, model on-device niedostępny/pobiera się, treść odfiltrowana, przekroczony limit znaków.
- [ ] Przyjazne, zlokalizowane komunikaty w [lib/error-handler.js](lib/error-handler.js) (klucze i18n).
- [ ] W komunikacie akcja naprawcza („Dodaj klucz w Ustawieniach", „Pobierz model").
- [ ] Spójna prezentacja w popupie, side panelu i tooltipie (z escapowaniem ze Sprintu 1).
- **DoD:** każdy główny scenariusz błędu ma zrozumiały komunikat i — gdzie to możliwe — następny krok.

### Zadanie 3.2 — Pulsowanie ikony podczas oczekiwania 🟡
- [ ] Stan ładowania (klasa `.pulsing` z [content/content.css](content/content.css)) od kliknięcia floating buttona do odpowiedzi AI.
- [ ] Cykl życia: start przy żądaniu → stop przy sukcesie/błędzie/anulowaniu/timeout; brak „zawieszonego" pulsowania.
- **DoD:** od kliknięcia do wyniku ikona pulsuje; po zakończeniu zawsze wraca do spoczynku.

---

## 🟡 Sprint 4 — TTS / Piper

**Cel:** pełna kontrola nad mową: pobieranie głosów Piper, wybór języka i regulacja prędkości.
**Zależności:** brak twardych. **Rozmiar:** L. **Uwaga:** wymaga spike'u (poza zakresem auto-wdrożenia v2).

### Zadanie 4.1 — Spike: mechanizm głosów Piper 🟠
- [ ] Piper w przeglądarce (WASM + modele ONNX) vs. głosy Piper jako silnik Chrome TTS (obecnie UI kieruje do rozszerzenia Piper w Web Store).
- [ ] Źródło i licencje katalogu głosów + rozmiary modeli.
- **DoD:** wybrane i opisane podejście z konsekwencjami dla rozmiaru/uprawnień.

### Zadanie 4.2 — Pobieranie głosów 🟠 · 4.3 — Wybór języka 🟡 · 4.4 — Regulacja prędkości 🟡 · 4.5 — Spójność silników 🟢
- [ ] Katalog głosów z metadanymi; pobieranie ze wskaźnikiem postępu; lista zainstalowanych.
- [ ] Mapowanie 26 języków → głosy; wybór głosu per język.
- [ ] Suwak prędkości (rate)/wysokości (pitch); zapis i użycie w [lib/tts-manager.js](lib/tts-manager.js).
- [ ] Uporządkować fallback Web Speech ↔ Chrome TTS ↔ Piper.
- **DoD:** użytkownik pobiera i przypisuje głos, słyszy zmianę prędkości; brak „głuchych" przycisków.

---

## 🟡 Sprint 5 — Funkcje produktowe

**Cel:** wybór tonu w tłumaczeniu i rozszerzony generator promptów graficznych.
**Zależności:** brak. **Rozmiar:** M.

### Zadanie 5.1 — Wybór tonu w tłumaczeniu ✅ (już zaimplementowane)
- [x] Kontrolka tonu w Translate ([popup/modules/tone.js](popup/modules/tone.js), `TONE_PRESETS`), logika `getToneInstruction` ([lib/api-client.js](lib/api-client.js)), pamięć wyboru i odtwarzanie z historii, spójność popup/side panel.
- **DoD:** ✅ ton bez osobnej zakładki wpływa na wynik i jest pamiętany. Pozostało: etykiety tonu w i18n (dziś PL-only).

### Zadanie 5.2 — 6 nowych wariantów promptu grafiki 🟡
- [ ] Wybrać 6 z puli: logo, plakat/okładka, ikona/UI asset, sticker, social media, mockup/packaging, infografika, pattern.
- [ ] System prompt per wariant (rozszerzyć Photo/Graphic/Expand w [lib/api-client.js](lib/api-client.js)).
- [ ] UI wyboru wariantu w trybie Prompt ([popup/modules/](popup/modules/)) + etykiety i18n.
- **DoD:** 6 wariantów wybieralnych w UI, każdy generuje prompt zgodny ze specyfiką.

---

## 🟡 Sprint 6 — Jakość: testy i CI (domknięcie)

**Cel:** zabezpieczyć kod przed regresją i zautomatyzować weryfikację. (Szkielet + regresja XSS już w 1.3.)
**Zależności:** Sprint 1. **Rozmiar:** M.

### Zadanie 6.1 — Testy jednostkowe 🟠
- [ ] [lib/api-client.js](lib/api-client.js): `getEffectiveConfig`, klucze cache, mapowanie języków, ton, budowa promptów.
- [ ] [lib/chrome-ai-provider.js](lib/chrome-ai-provider.js): detekcja capabilities, fallback par językowych.
- [ ] [lib/error-handler.js](lib/error-handler.js): mapowanie typów błędów → komunikaty.
- **DoD:** kluczowa logika bez UI pokryta testami.

### Zadanie 6.2 — Lint i format 🟡
- [ ] ESLint (+ ewentualnie Prettier) z konfiguracją projektu.
- **DoD:** `npm run lint` przechodzi; styl spójny.

### Zadanie 6.3 — CI (GitHub Actions) 🟠
- [ ] Workflow na PR: `install → lint → test → build`.
- [ ] Status checks wymagane przed merge.
- **DoD:** każdy PR weryfikowany; czerwony build blokuje merge.

---

## 🟢 Sprint 7 — Dopracowanie i przygotowanie do publikacji

**Cel:** dopięty UI/UX, czysty Service Worker, dokumentacja i zgodność z Chrome Web Store.
**Zależności:** Sprinty 1–6. **Rozmiar:** L. **Uwaga:** część wymaga decyzji/zasobów człowieka (poza auto-wdrożeniem).

### Zadanie 7.1 — UI/UX 🟡
- [ ] Spójność popup ↔ side panel ↔ tooltip; stany puste/ładowania/skeletony; dostępność (klawiatura, focus, aria, kontrast); responsywność; mikrointerakcje.
- **DoD:** przejście przez wszystkie tryby bez usterek i z czytelnym feedbackiem.

### Zadanie 7.2 — README i Service Worker 🟡
- [ ] README po zmianie architektury (Chrome AI, brak proxy/self-host).
- [ ] SW: cykl życia MV3, cache do `chrome.storage.local` z TTL, wznowienie po uśpieniu; przegląd [lib/performance-optimizer.js](lib/performance-optimizer.js) pod kątem realnego cache w MV3.
- **DoD:** README zgodne z produktem; cache i logika SW działają mimo usypiania workera.

### Zadanie 7.3 — Gotowość do Chrome Web Store 🟠
- [ ] Minimalizacja uprawnień ([manifest.json](manifest.json)); rozważyć węższe `matches` niż `<all_urls>`.
- [ ] Uzasadnienia per uprawnienie + single-purpose description.
- [ ] Hostowana polityka prywatności (publiczny URL).
- [ ] Screenshoty 1280×800 + grafiki promo z [assets/store/](assets/store/).
- [ ] Audyt zgodności (brak zdalnego kodu — atut po 2c).
- [ ] Wersjonowanie do 2.0.0 + changelog.
- **DoD:** paczka przechodzi wewnętrzny checklist store i jest gotowa do wysłania.

---

## ⚠️ Ryzyka i otwarte kwestie

- **Dostępność wbudowanego Chrome AI** (wersja Chrome, sprzęt, pobranie modelu) — część użytkowników nie będzie mieć działającego free tieru. Mitygacja: detekcja + jasny fallback na BYOK (2b).
- **Pokrycie 26 języków przez Translator** może być węższe — fallback na Prompt API per nieobsługiwana para (2a.1/2b.1).
- **Breaking change** po usunięciu proxy — migracja `builtin → chrome-ai` i komunikat (2b.2).
- **Build sync** — `background`/`popup` jadą z `dist/`; brak rebuildu = ciche rozjechanie się kodu. Mitygacja: rebuild w DoD i CI.
- **Piper** nierozstrzygnięty — zależny od spike'u (4.1).
- **`<all_urls>`** — zawężenie może wymagać przeprojektowania wstrzykiwania content scriptu (Sprint 7).

## Sugerowana kolejność realizacji

1. **Sprint 1** (bezpieczeństwo + szkielet testów) — natychmiast.
2. **Sprint 2** w kolejności **2a → 2b → 2c** — fundament dla reszty; proxy usuwamy dopiero po parytecie.
3. **Sprint 3** (błędy + pulsowanie) — bazuje na 1 i 2.
4. **Sprinty 4 i 5** — równolegle możliwe (4 wymaga spike'u).
5. **Sprint 6** — domknięcie testów/CI.
6. **Sprint 7** — dopracowanie + publikacja.
