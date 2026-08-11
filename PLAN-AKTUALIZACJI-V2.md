# LingFlow AI — plan aktualizacji i przygotowania publicznego wydania

> Data planu: 2026-08-11  
> Wersja bazowa: 1.6.0  
> Cel: stabilne v2.0.0, publiczne repozytorium i paczka gotowa do Chrome Web Store  
> Założenie wydania: Piper TTS nie blokuje v2.0.0; wraca jako osobny milestone po ustabilizowaniu podstawowych funkcji.

## Jak korzystać z planu

- Każde zadanie kończy się spełnieniem sekcji **DoD** (Definition of Done).
- Nie rozpoczynamy kolejnego sprintu, jeśli pozostał krytyczny błąd z poprzedniego.
- Każdy PR powinien obejmować jeden spójny problem i zawierać testy odpowiednie do ryzyka.
- Przed scaleniem PR musi przejść `npm run verify`.
- Statusy: `[ ]` do zrobienia, `[-]` w trakcie, `[x]` ukończone.

## Cel produktu v2.0.0

LingFlow AI ma zapewniać:

1. lokalne tłumaczenie w Chrome AI, jeśli urządzenie i para językowa są obsługiwane;
2. korektę, zmianę tonu i generowanie promptów tylko tam, gdzie wybrany provider rzeczywiście je obsługuje;
3. świadomy fallback do OpenAI lub Gemini wyłącznie po wybraniu providera i podaniu własnego klucza;
4. spójne działanie popupu, side panelu, tłumaczenia zaznaczenia i OCR;
5. zgodność dokumentacji, materiałów sklepowych i polityki prywatności z faktycznym zachowaniem kodu;
6. powtarzalny build oraz weryfikowaną paczkę wydania.

## Zasady architektoniczne

- Chrome Built-in AI nie jest uruchamiane w MV3 service workerze.
- Aplikacja nigdy nie przełącza się automatycznie z lokalnego AI na zewnętrzne API.
- `Translator API` służy do zwykłego tłumaczenia.
- Korekta i zmiana tonu korzystają z odpowiedniego API zadaniowego lub Prompt API tylko dla obsługiwanych języków.
- OCR pozostaje funkcją BYOK do czasu wdrożenia i przetestowania lokalnego wejścia obrazowego.
- Model, provider i capability są częścią klucza cache.
- Klucze API i historia nie są bezpośrednio dostępne dla content scriptów.
- Lista providerów i modeli ma jedno źródło prawdy.

---

## Sprint 0 — stabilny i uczciwy baseline

**Cel:** usunąć funkcje pozorne, nieaktualne konfiguracje i rozjazdy utrudniające dalszą pracę.  
**Priorytet:** krytyczny  
**Szacunek:** 1–2 dni  
**Zależności:** brak

### Zadanie 0.1 — wycofanie niedokończonego Piper TTS z v2.0

- [ ] Usunąć opcję `Piper` z ustawień TTS.
- [ ] Usunąć UI pobierania i kasowania modeli głosu.
- [ ] Usunąć nieużywany `PiperManager` z bundla popupu.
- [ ] Usunąć obsługę `piper_speak` z backgroundu.
- [ ] Usunąć niedziałający import `lib/piper/piper.js` z dokumentu offscreen.
- [ ] Usunąć permission `offscreen`, jeśli po zmianie nic innego go nie używa.
- [ ] Zachować działające Web Speech i Chrome TTS.
- [ ] Dodać Piper do sekcji „Po v2.0” zamiast reklamować go jako gotową funkcję.

**DoD:** w interfejsie i dokumentacji nie ma opcji, która zawsze kończy się fallbackiem lub błędem; TTS działa przez dwa wspierane silniki.

### Zadanie 0.2 — porządek w modelach AI

- [ ] Usunąć wyłączone modele Gemini, w tym `gemini-3.1-flash-lite-preview` i `gemini-2.0-flash`.
- [ ] Usunąć `gpt-3.5-turbo` oraz inne modele oznaczone przez providera jako deprecated.
- [ ] Wybrać jeden tani model domyślny na providera po krótkim teście jakości tłumaczenia i OCR.
- [ ] Dodać test blokujący ponowne wprowadzenie modeli ze znaną datą shutdown.
- [ ] Zdefiniować modele w jednym module zamiast duplikować listę w `api-client.js` i `constants.js`.
- [ ] Dodać strategię migracji, gdy zapisany model przestaje być dostępny.

**DoD:** każdy model widoczny w UI istnieje, obsługuje używany endpoint i ma udokumentowany powód obecności.

### Zadanie 0.3 — prawda produktowa

- [ ] Zaktualizować README tak, aby odróżniało tłumaczenie od korekty, tonu i generowania promptów.
- [ ] Opisać wymagania sprzętowe oraz pierwsze pobranie modeli Chrome AI.
- [ ] Usunąć sformułowanie „no network” i zastąpić je informacją „brak wysyłania treści; sieć może być potrzebna do pobrania modelu”.
- [ ] Oznaczyć OCR jako BYOK.
- [ ] Zaktualizować roadmapę zgodnie ze stanem kodu.
- [ ] Usunąć z materiałów promocyjnych nieistniejącą zakładkę `Correct`.
- [ ] Ujednolicić nazwę `LingFlow AI` w produkcie, README i przyszłej nazwie repozytorium.

**DoD:** wszystkie funkcje opisane jako gotowe dają się uruchomić w aktualnym buildzie.

### Zadanie 0.4 — aktualizacja wygenerowanego CSS

- [ ] Uruchomić `npm run build:css`.
- [ ] Sprawdzić wizualnie klasy dodane dla aktualnego UI.
- [ ] Zacommitować aktualny `popup/output.css` albo przestać go śledzić i generować wyłącznie podczas builda.
- [ ] Zapisać wybraną strategię w README dla contributorów.

**DoD:** świeży clone i udokumentowany build dają identyczny wygląd jak środowisko maintenera.

### Bramka Sprintu 0

- [ ] `npm run lint` przechodzi.
- [ ] `npm test` przechodzi.
- [ ] `npm run build` przechodzi.
- [ ] `npm run build:css` przechodzi.
- [ ] W UI nie ma Piper TTS ani wyłączonych modeli.
- [ ] README nie deklaruje niedziałających funkcji.

---

## Sprint 1 — poprawna architektura Chrome Built-in AI

**Cel:** zapewnić, że lokalne AI działa w dozwolonym kontekście i ma przewidywalny fallback.  
**Priorytet:** krytyczny  
**Szacunek:** 3–5 dni  
**Zależności:** Sprint 0

### Zadanie 1.1 — spike kontekstów wykonania

- [ ] Przygotować minimalny test `Translator`, `LanguageDetector` i `LanguageModel` w popupie.
- [ ] Powtórzyć test w side panelu.
- [ ] Sprawdzić API w isolated world content scriptu po bezpośrednim geście użytkownika.
- [ ] Sprawdzić zachowanie dokumentu offscreen, w tym wymaganie user activation.
- [ ] Potwierdzić, że API są niedostępne w service workerze.
- [ ] Zapisać macierz wyników: kontekst × API × user activation × pierwsze pobranie × kolejne użycie.
- [ ] Na podstawie testu wybrać jeden kontekst wykonania dla tłumaczenia inline.

**DoD:** decyzja architektoniczna jest poparta działającym testem na aktualnym stabilnym Chrome, a nie wyłącznie mockiem jednostkowym.

### Zadanie 1.2 — przeniesienie Chrome AI poza service worker

- [ ] Usunąć wykonywanie `ChromeAIProvider` z backgroundu.
- [ ] Pozostawić background jako router komunikatów, OCR/BYOK i integrację z API rozszerzeń.
- [ ] Uruchamiać lokalne tłumaczenie w kontekście wybranym w Zadaniu 1.1.
- [ ] Zaprojektować komunikaty jako dane strukturalne, bez przekazywania wykonywalnego kodu lub dowolnych URL-i.
- [ ] Zachować anulowanie i timeout.
- [ ] Obsłużyć zamknięcie popupu/side panelu podczas żądania.
- [ ] Obsłużyć uśpienie i ponowne uruchomienie service workera.

**DoD:** tłumaczenie zaznaczonego tekstu działa w darmowym tierze bez klucza API na wspieranym Chrome.

### Zadanie 1.3 — capability matrix i onboarding modelu

- [ ] Dla każdego API wywoływać `availability()` z tymi samymi opcjami, które trafią do `create()`.
- [ ] Rozróżniać `unavailable`, `downloadable`, `downloading` i `available`.
- [ ] Pokazać użytkownikowi rozmiar/charakter pierwszego pobrania w onboardingu.
- [ ] Wyświetlać realny postęp `downloadprogress` w UI.
- [ ] Dodać akcję ponowienia po przerwanym pobraniu.
- [ ] Dodać komunikaty dla niewspieranego systemu, sprzętu, języka i braku miejsca.
- [ ] Nie sugerować BYOK jako automatycznie aktywowanego fallbacku.

**DoD:** użytkownik zawsze wie, czy model jest gotowy, pobierany czy niedostępny, oraz zna dostępne następne kroki.

### Zadanie 1.4 — rozdzielenie operacji AI

- [ ] Utworzyć jawne operacje `translate`, `correct`, `rewriteTone` i `generatePrompt`.
- [ ] Używać Translator API tylko do czystego tłumaczenia.
- [ ] Przy takim samym języku źródłowym i docelowym uruchamiać korektę zamiast zwracać oryginał.
- [ ] Nie pokazywać wyboru tonu, gdy aktualna ścieżka nie potrafi go zastosować.
- [ ] Użyć Prompt/Rewriter/Proofreader tylko po potwierdzeniu dostępności i języka.
- [ ] Dla niewspieranych języków pokazać jasny komunikat oraz opcjonalny wybór BYOK.
- [ ] Dodać test, że korekta rzeczywiście wywołuje inną operację niż tłumaczenie.
- [ ] Dodać test, że ton nie jest ignorowany bez informacji dla użytkownika.

**DoD:** translate, correct i tone mają osobne, testowalne ścieżki; nie ma cichego zwracania tekstu bez zmian.

### Zadanie 1.5 — języki Prompt API

- [ ] Przekazywać `expectedInputs` i `expectedOutputs` do `availability()` oraz `create()`.
- [ ] Walidować język wejściowy i wyjściowy przed uruchomieniem modelu.
- [ ] Traktować aktualną listę wspieranych języków jako capability, nie stałą obietnicę produktu.
- [ ] Dodać testy dla języka wspieranego i niewspieranego.

**DoD:** lokalna korekta i generowanie promptów nie są reklamowane dla języków, których model nie obsługuje.

### Bramka Sprintu 1

- [ ] Popup: lokalne translate/correct/prompt przechodzą test smoke.
- [ ] Side panel: lokalne translate/correct/prompt przechodzą test smoke.
- [ ] Inline: lokalne tłumaczenie działa albo ma jawnie udokumentowane ograniczenie.
- [ ] Pierwsze pobranie modelu ma widoczny postęp.
- [ ] Brak Chrome AI nie powoduje nieczytelnego wyjątku.

---

## Sprint 2 — providery, modele i poprawność danych

**Cel:** unowocześnić integracje BYOK i usunąć błędy wynikające z cache oraz starych SDK.  
**Priorytet:** wysoki  
**Szacunek:** 2–3 dni  
**Zależności:** Sprint 1

### Zadanie 2.1 — migracja Gemini SDK

- [ ] Zastąpić `@google/generative-ai` przez `@google/genai`.
- [ ] Przepisać generowanie tekstu, streaming i OCR/vision na nowe API.
- [ ] Przekazywać AbortSignal, jeśli SDK go obsługuje.
- [ ] Zachować kody statusu i szczegóły błędów bez ujawniania klucza.
- [ ] Dodać test tekstu, streamingu, błędu autoryzacji i vision.
- [ ] Usunąć martwe stałe i nieużywane endpointy.

**DoD:** w `package-lock.json` i kodzie nie występuje `@google/generative-ai`.

### Zadanie 2.2 — aktualizacja OpenAI

- [ ] Potwierdzić aktualny tani model tekstowo-wizyjny dla OCR i tłumaczenia.
- [ ] Usunąć modele deprecated z UI.
- [ ] Zdecydować, czy pozostać przy Chat Completions, czy przejść na Responses API.
- [ ] Zachować kompatybilny parser streamingu SSE.
- [ ] Obsłużyć końcowy niepełny bufor streamu.
- [ ] Walidować pustą lub nietypową odpowiedź providera.

**DoD:** wszystkie oferowane modele są aktywne i przetestowane dla funkcji, do których są przypisane.

### Zadanie 2.3 — typowane błędy i retry

- [ ] Zachowywać HTTP status oraz kod błędu providera.
- [ ] Nie ponawiać błędów 400, 401, 403 i innych deterministycznych błędów klienta.
- [ ] Ponawiać tylko błędy sieciowe, 429 i wybrane 5xx.
- [ ] Obsłużyć `Retry-After`.
- [ ] Zastosować jitter w exponential backoff.
- [ ] Nie ponawiać przerwanego żądania.
- [ ] Dodać testy wszystkich klas błędów.

**DoD:** błędny klucz lub nieistniejący model nie powoduje trzech identycznych zapytań.

### Zadanie 2.4 — poprawny cache

- [ ] Dodać provider i model do klucza cache.
- [ ] Dodać wersję promptu/instrukcji do klucza cache.
- [ ] Uwzględnić operation, source language, target language, tone i prompt type.
- [ ] Czyścić cache po zmianie providera lub modelu.
- [ ] Zdecydować, czy cache ma pozostać wyłącznie w pamięci.
- [ ] Dodać test zmiany modelu z identycznym inputem.

**DoD:** po zmianie modelu użytkownik nigdy nie dostaje wyniku wygenerowanego przez poprzedni model.

### Bramka Sprintu 2

- [ ] Wszystkie ścieżki BYOK przechodzą testy z mockowanymi odpowiedziami HTTP.
- [ ] Nie ma nieaktywnych modeli w UI.
- [ ] Cache jest rozdzielony per provider i model.
- [ ] Błędy zachowują kody i nie wykonują zbędnych retry.

---

## Sprint 3 — bezpieczeństwo, prywatność i uprawnienia

**Cel:** ograniczyć konsekwencje przyszłych błędów i przygotować zgodność z Chrome Web Store.  
**Priorytet:** wysoki  
**Szacunek:** 2–3 dni  
**Zależności:** Sprint 1

### Zadanie 3.1 — izolacja kluczy API i historii

- [ ] Ustawić `chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })` podczas instalacji/startu.
- [ ] Przestać czytać `chrome.storage.local` bezpośrednio z content scriptu.
- [ ] Udostępniać content scriptowi tylko potrzebne preferencje przez wąski komunikat.
- [ ] Nigdy nie przesyłać do content scriptu kluczy ani całej historii.
- [ ] Rozważyć opcję „nie zapisuj klucza” opartą o `storage.session`.
- [ ] Dodać migrację istniejących ustawień.
- [ ] Dodać test, że żaden komunikat nie zwraca sekretów.

**DoD:** klucze i historia są dostępne wyłącznie dla zaufanych kontekstów rozszerzenia.

### Zadanie 3.2 — walidacja komunikatów

- [ ] Zdefiniować dozwolone akcje i schemat payloadu.
- [ ] Sprawdzać `sender`, typy pól oraz maksymalne rozmiary tekstu i obrazu.
- [ ] Odrzucać brakujące, nieznane lub zbyt duże komunikaty.
- [ ] Nie przyjmować dowolnego URL-a do pobrania.
- [ ] Zwracać strukturalne błędy `{ code, message }`.
- [ ] Dodać testy złośliwych i niepoprawnych komunikatów.

**DoD:** background nie wykonuje uprzywilejowanej operacji na podstawie niewalidowanych danych.

### Zadanie 3.3 — minimalizacja permissions

- [ ] Zweryfikować, czy `tabs` jest potrzebne poza możliwościami `activeTab`.
- [ ] Zweryfikować konieczność `clipboardWrite` dla używanego Clipboard API.
- [ ] Usunąć `offscreen`, jeśli Piper został wycofany i nic innego go nie używa.
- [ ] Zawęzić `<all_urls>` do `http://*/*` i `https://*/*`, jeśli nie jest potrzebne wsparcie innych schematów.
- [ ] Rozważyć dynamiczny content script i opcjonalne host permissions.
- [ ] Zawęzić `web_accessible_resources` do faktycznie używanych plików.
- [ ] Zapisać uzasadnienie każdego pozostawionego permission.

**DoD:** manifest zawiera wyłącznie uprawnienia używane przez aktualne funkcje.

### Zadanie 3.4 — polityka prywatności i disclosure

- [ ] Zastąpić placeholder adresu prawdziwym, monitorowanym kontaktem.
- [ ] Usunąć notatkę dla maintainera z publicznej polityki.
- [ ] Opisać pierwsze pobranie lokalnego modelu bez sugerowania wysyłki treści.
- [ ] Wyjaśnić przechowywanie historii oraz kluczy w UI przed ich zapisaniem.
- [ ] Dodać linki do polityk retencji danych OpenAI i Google.
- [ ] Przygotować stabilny publiczny URL polityki.
- [ ] Uzgodnić deklaracje Privacy Practices w dashboardzie z dokumentem i kodem.

**DoD:** polityka nie zawiera placeholderów i jest zgodna z faktycznym przepływem danych.

### Bramka Sprintu 3

- [ ] Content script nie może odczytać kluczy ani historii.
- [ ] Każde permission ma kod użycia i pisemne uzasadnienie.
- [ ] Privacy policy ma działający URL i prawdziwy kontakt.
- [ ] Testy bezpieczeństwa komunikatów przechodzą.

---

## Sprint 4 — testy przeglądarkowe i jakość wydania

**Cel:** wykrywać problemy, których nie pokazują mocki jednostkowe.  
**Priorytet:** wysoki  
**Szacunek:** 3–4 dni  
**Zależności:** Sprinty 1–3

### Zadanie 4.1 — testy jednostkowe brakujących modułów

- [ ] `StateManager`: inicjalizacja, migracja, zapis i limit historii.
- [ ] `PerformanceOptimizer`: cache per model, TTL, retry i abort.
- [ ] `TTSManager`: dobór głosu oraz fallback.
- [ ] OCR: parsowanie odpowiedzi i obsługa niepełnego formatu.
- [ ] History UI: XSS, filtrowanie, pin, delete i restore.
- [ ] Settings UI: provider, model i migracja kluczy.
- [ ] Background messaging: walidacja i routing.

**DoD:** kluczowa logika każdego aktywnego modułu ma test happy path i najważniejszego błędu.

### Zadanie 4.2 — testy rozszerzenia w prawdziwym Chrome

- [ ] Skonfigurować Playwright lub Puppeteer do ładowania unpacked extension.
- [ ] Test instalacji świeżej paczki.
- [ ] Test popupu i side panelu.
- [ ] Test tłumaczenia zaznaczonego tekstu na stronie testowej.
- [ ] Test zamiany tekstu w input, textarea i contenteditable.
- [ ] Test OCR z mockowanym providerem.
- [ ] Test braku klucza i braku Chrome AI.
- [ ] Test migracji z ustawień 1.6.0.
- [ ] Test, że wszystkie pliki wskazane w manifeście istnieją w paczce.

**DoD:** test przeglądarkowy wykryłby zarówno brak `dist/`, jak i próbę uruchomienia Chrome AI w service workerze.

### Zadanie 4.3 — kompletność i18n

- [ ] Ustalić oficjalne języki interfejsu v2.0; rekomendowane minimum: polski i angielski.
- [ ] Usunąć hardkodowane polskie teksty z HTML i modułów JS.
- [ ] Dodać klucze dla tone, prompt types, filtrów historii, TTS i błędów.
- [ ] Uzupełnić brakujące klucze albo usunąć nieutrzymywane locale.
- [ ] Dodać automatyczny test równości kluczy locale względem `en`.
- [ ] Sprawdzić RTL dla arabskiego, jeśli locale pozostaje wspierane.

**DoD:** każdy deklarowany język UI ma komplet kluczy i nie pokazuje przypadkowych polskich etykiet.

### Zadanie 4.4 — accessibility i UX stanów

- [ ] Dodać `aria-label` do przycisków ikonowych.
- [ ] Wprowadzić poprawne role tabs/tablist i stan `aria-selected`.
- [ ] Zapewnić nawigację klawiaturą po historii i filtrach.
- [ ] Dodać focus trap oraz powrót focusu dla ustawień i modali.
- [ ] Dodać `aria-live` dla wyników, błędów i postępu pobierania.
- [ ] Obsłużyć `prefers-reduced-motion` dla animacji aplikacji.
- [ ] Zweryfikować kontrast i widoczny focus.
- [ ] Sprawdzić popup w minimalnym i side panel w szerokim layoucie.

**DoD:** podstawowe flow można przejść bez myszy, a czytnik ekranu ogłasza wynik i błędy.

### Bramka Sprintu 4

- [ ] Unit, integration i browser smoke tests przechodzą.
- [ ] Wszystkie locale przechodzą test kompletności.
- [ ] Nie ma krytycznych problemów accessibility.
- [ ] Test świeżej instalacji używa dokładnie tej samej paczki co wydanie.

---

## Sprint 5 — build, CI i artefakt wydania

**Cel:** utworzyć deterministyczną, sprawdzoną paczkę możliwą do opublikowania.  
**Priorytet:** wysoki  
**Szacunek:** 1–2 dni  
**Zależności:** Sprint 4

### Zadanie 5.1 — jeden pipeline weryfikacji

- [ ] Dodać `npm run verify` uruchamiający lint, testy, build JS i build CSS.
- [ ] Dodać kontrolę JSON manifestu i locale.
- [ ] Dodać kontrolę wszystkich ścieżek wskazanych w manifeście i HTML.
- [ ] Dodać kontrolę nieśledzonych placeholderów, `TODO` wydaniowych i brakujących plików.
- [ ] Uruchamiać `npm audit` w cyklu Dependabot/CI z ustalonym progiem.
- [ ] Ustawić CI na wspieraną wersję Node oraz dodać `.nvmrc` lub `.node-version`.

**DoD:** lokalny `npm run verify` odpowiada bramce CI.

### Zadanie 5.2 — paczkowanie

- [ ] Utworzyć allowlistę plików wchodzących do ZIP-a.
- [ ] Wykluczyć testy, źródłowe grafiki sklepu, konfigurację dev, `.DS_Store` i dokumenty wewnętrzne.
- [ ] Dołączyć `dist/`, aktualny CSS, manifest, locale i licencje zasobów.
- [ ] Dodać `npm run package` tworzący ZIP z wersją manifestu w nazwie.
- [ ] Walidować zawartość ZIP-a w CI.
- [ ] Dołączyć SHA-256 artefaktu do GitHub Release.

**DoD:** ZIP można bez dodatkowych kroków wczytać jako unpacked extension i wysłać do Chrome Web Store.

### Zadanie 5.3 — zależności i supply chain

- [ ] Wykonać kontrolowany `npm audit fix` i przejrzeć diff lockfile.
- [ ] Zaktualizować patch/minor zależności.
- [ ] Zaplanować osobny PR dla Tailwind 4 lub pozostać przy najnowszym 3.x w v2.0.
- [ ] Dodać Dependabot lub Renovate.
- [ ] Przypiąć GitHub Actions do commit SHA, jeśli projekt przyjmuje ten poziom ochrony.
- [ ] Dodać licencje/NOTICE dla Inter i Font Awesome.

**DoD:** brak znanych high vulnerabilities w aktywnym drzewie zależności i komplet informacji licencyjnych.

### Bramka Sprintu 5

- [ ] `npm run verify` przechodzi lokalnie i w CI.
- [ ] `npm run package` tworzy poprawny ZIP.
- [ ] ZIP przechodzi browser smoke test.
- [ ] Working tree po buildzie jest czysty albo różnice generowane są celowo kontrolowane.

---

## Sprint 6 — publiczne repozytorium i Chrome Web Store

**Cel:** przygotować projekt do współpracy z contributorami i publikacji.  
**Priorytet:** średni/wysoki  
**Szacunek:** 1–2 dni  
**Zależności:** Sprint 5

### Zadanie 6.1 — higiena publicznego repo

- [ ] Dodać `CONTRIBUTING.md` z setupem, testami i zasadami PR.
- [ ] Dodać `SECURITY.md` z kanałem zgłoszeń prywatnych.
- [ ] Dodać `CODE_OF_CONDUCT.md`.
- [ ] Dodać szablony bug report, feature request i pull request.
- [ ] Dodać publiczny `CHANGELOG.md`.
- [ ] Usunąć lub przenieść wewnętrzne plany, które nie pomagają contributorom.
- [ ] Uzupełnić `author`, `repository`, `bugs`, `homepage` i `keywords` w `package.json`.
- [ ] Rozważyć zmianę nazwy repo `LinkFlowAI` na `LingFlow-AI`.

**DoD:** nowa osoba potrafi zbudować projekt, uruchomić testy i przygotować PR na podstawie publicznych dokumentów.

### Zadanie 6.2 — materiały Chrome Web Store

- [ ] Przygotować aktualne screenshoty 1280×800 lub 640×400.
- [ ] Odświeżyć promo tile zgodnie z realnym UI.
- [ ] Przygotować krótki i długi opis bez niezweryfikowanych deklaracji.
- [ ] Zapisać single-purpose statement.
- [ ] Zapisać uzasadnienie każdego permission w `CHROMEWEBSTORE.md`.
- [ ] Uzupełnić Privacy Practices zgodnie z przepływem danych.
- [ ] Potwierdzić publiczny URL polityki prywatności.
- [ ] Sprawdzić własność/licencję maskotki i grafik promocyjnych.

**DoD:** listing, privacy policy, manifest i zachowanie rozszerzenia nie zawierają sprzecznych informacji.

### Zadanie 6.3 — release candidate

- [ ] Podnieść wersję do `2.0.0-rc.1`.
- [ ] Wykonać testy na czystym profilu Chrome.
- [ ] Wykonać test aktualizacji z 1.6.0.
- [ ] Wykonać test na co najmniej Windows i macOS; Linux, jeśli dostępny.
- [ ] Zebrać log znanych ograniczeń.
- [ ] Udostępnić RC małej grupie testerów.
- [ ] Naprawić wszystkie zgłoszenia severity critical/high.
- [ ] Podnieść wersję do `2.0.0` i utworzyć GitHub Release.

**DoD:** ta sama zweryfikowana paczka zostaje opublikowana w GitHub Releases i przesłana do Chrome Web Store.

---

## Milestone po v2.0 — Piper TTS

**Cel:** zdecydować, czy natywny Piper WASM daje wartość uzasadniającą koszt utrzymania.  
**Szacunek:** 4–8 dni po osobnym spike’u

### Zadanie P.1 — decyzja techniczna

- [ ] Porównać Piper WASM, zewnętrzne rozszerzenie Chrome TTS i Web Speech.
- [ ] Zmierzyć rozmiar runtime, RAM, czas inicjalizacji i syntezy.
- [ ] Sprawdzić licencję runtime, ONNX oraz każdego katalogu głosów.
- [ ] Sprawdzić zachowanie MV3 offscreen i wymagane permissions.
- [ ] Zdecydować: implementować, integrować z istniejącym silnikiem czy porzucić.

### Zadanie P.2 — kompletna implementacja, jeśli zatwierdzona

- [ ] Dostarczyć lokalnie cały kod JS/WASM wymagany przez MV3.
- [ ] Nie pobierać zdalnego kodu wykonywalnego.
- [ ] Pobierać wyłącznie modele/dane z jawnie dozwolonego hosta.
- [ ] Dodać integralność, wersjonowanie i migrację modeli.
- [ ] Obsłużyć quota IndexedDB, przerwane pobranie i usuwanie głosu.
- [ ] Dodać rate, pitch, stop i kolejkę odtwarzania.
- [ ] Dodać testy przeglądarkowe i pomiary wydajności.

**DoD:** Piper syntetyzuje dźwięk offline po ponownym uruchomieniu Chrome i nie jest placeholderem ani ukrytym fallbackiem.

---

## Kolejność PR-ów

1. `chore/v2-baseline-cleanup`
2. `fix/chrome-ai-execution-context`
3. `fix/operation-capabilities`
4. `refactor/provider-model-registry`
5. `refactor/google-genai-sdk`
6. `security/storage-and-messaging`
7. `test/browser-extension-e2e`
8. `fix/i18n-accessibility`
9. `build/release-pipeline`
10. `docs/public-repo-and-store`

## Kryteria wydania v2.0.0

- [ ] Brak otwartych błędów critical/high.
- [ ] Lokalna translacja działa w obsługiwanym Chrome poza service workerem.
- [ ] Korekta i ton nie są cicho ignorowane.
- [ ] Wszystkie modele z UI są aktywne.
- [ ] OCR działa dla obu wspieranych providerów BYOK.
- [ ] Brak niedokończonego Piper w wydaniu.
- [ ] Klucze i historia są ograniczone do trusted contexts.
- [ ] Wszystkie permissions są minimalne i uzasadnione.
- [ ] Unit, integration i browser tests przechodzą.
- [ ] Wszystkie deklarowane locale są kompletne.
- [ ] `npm audit --omit=dev` nie zgłasza podatności.
- [ ] `npm run verify` i `npm run package` przechodzą.
- [ ] ZIP został przetestowany na czystym profilu Chrome.
- [ ] README, privacy policy, grafiki i listing opisują faktyczny produkt.
- [ ] Publiczne repo zawiera instrukcje contribution i security.

## Szacunek całości

| Zakres | Szacunek |
| --- | ---: |
| Sprint 0 | 1–2 dni |
| Sprint 1 | 3–5 dni |
| Sprint 2 | 2–3 dni |
| Sprint 3 | 2–3 dni |
| Sprint 4 | 3–4 dni |
| Sprint 5 | 1–2 dni |
| Sprint 6 | 1–2 dni |
| **v2.0 bez Piper** | **13–21 dni roboczych** |
| Piper po v2.0 | dodatkowe 4–8 dni |

Szacunek zakłada jedną osobę, małe PR-y i brak nieprzewidzianych ograniczeń Chrome Built-in AI. Po Sprintach 0–1 należy ponownie oszacować resztę na podstawie wyników testu prawdziwych kontekstów wykonania.
