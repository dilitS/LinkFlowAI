# Plan Wdrożenia: Piper TTS, Poprawki UI i Chrome Web Store

## 1. Cel i Motywacja
Celem jest wprowadzenie wbudowanego, działającego w 100% offline syntezatora mowy (Piper TTS) opartego na architekturze WebAssembly. Dodatkowo rozwiązane zostaną zgłoszone problemy z interfejsem użytkownika (błąd z "pustym okienkiem" przy tłumaczeniu zaznaczonego tekstu oraz usunięcie metadanych modelu nad sekcją "WYNIK") oraz rozszerzenie zostanie przygotowane do publikacji w Chrome Web Store.

## 2. Zakres i Wpływ (Scope & Impact)
- **Piper TTS**: Architektura oparta na Manifest V3 i tzw. `Offscreen Document`. Pozwala to ominąć restrykcje Service Workerów, które nie obsługują API Audio. Głosy będą pobierane na żądanie w panelu ustawień i zapisywane lokalnie w bazie IndexedDB, utrzymując minimalny rozmiar początkowego pliku `.zip` rozszerzenia.
- **Naprawa Tooltipa (Zaznaczony Tekst)**: Zostanie dodany natychmiastowy wskaźnik ładowania (loading state), co zapobiegnie iluzji zawieszenia po kliknięciu ikony. Dodatkowo uodpornimy mechanizm renderowania wyników na wypadek, gdyby API wyjątkowo zwróciło obiekt zamiast czystego tekstu.
- **Czyszczenie UI (Popup)**: Usunięcie napisu informującego o używanym modelu i dostawcy API nad przetłumaczonym tekstem.
- **Chrome Web Store**: Przegląd polityki prywatności (`PRIVACY.md`), sprawdzenie uprawnień w `manifest.json` oraz potwierdzenie gotowości materiałów promocyjnych (grafiki).

## 3. Plan Implementacji

### Faza 1: Poprawki UI i Błędów
1. **Usunięcie Model Meta w Popupie:**
   - W `popup/popup.html`: Usunąć blok `<div id="output-meta"></div>`.
   - W `popup/modules/session-meta.js`: Usunąć obsługę aktualizacji `output-meta`.
   - W `popup/modules/dom-elements.js`: Usunąć referencję do `outputMeta`.
2. **Naprawa Pustego Tooltipa w Content Script:**
   - W `content/content.js`: W funkcji `handleTranslateClick` dodać wywołanie `renderTooltipLoading` tuż przed rozpoczęciem oczekiwania na odpowiedź z sieci, aby pokazać użytkownikowi, że proces trwa.
   - Zabezpieczyć `renderTooltipResult`, upewniając się, że nawet po odebraniu nietypowego obiektu błędu zawartość zostanie zamieniona na rzutowany tekst.

### Faza 2: Implementacja Piper TTS
1. **Architektura Offscreen:**
   - Dodać `offscreen/offscreen.html` oraz `offscreen/offscreen.js`. Ten dokument będzie posiadał pełen dostęp do `AudioContext` i będzie załadowany w tle.
   - W `background/background.js`: Dodać mechanizm zarządzający życiem dokumentu (tworzenie `chrome.offscreen.createDocument` w razie potrzeby odtworzenia dźwięku).
2. **Piper WASM & Głosy:**
   - Utworzyć plik `lib/piper-runner.js`, który załaduje moduł `piper.wasm` w offscreenie.
   - Utworzyć prosty plik JSON konfiguracyjny (np. w pamięci wtyczki) zawierający wyselekcjonowane i darmowe głosy wysokiej jakości.
3. **Menedżer Pobierania (IndexedDB):**
   - Stworzyć klasę obsługującą pobieranie plików modelu (`.onnx`) i zapisywanie ich do bazy IndexedDB za pomocą np. biblioteki `idb` (lub natywnych Promisów).
4. **Minimalistyczne UI w Ustawieniach:**
   - Zaktualizować sekcję TTS w ustawieniach (`popup.html` i `settings.js`), aby zamiast tylko wbudowanych głosów, pokazywała minimalistyczną listę głosów Piper do pobrania (np. ikonka chmurki do pobrania, kosz do usunięcia lokalnie pobranego głosu).

### Faza 3: Przygotowanie pod Chrome Web Store
1. **Weryfikacja Uprawnień:**
   - Przegląd `manifest.json`, usunięcie nieużywanych uprawnień (był np. weryfikowany dostęp `<all_urls>`, który jest niezbędny, ale musi być opisany).
2. **Polityka Prywatności:**
   - Zaktualizowanie `PRIVACY.md` w taki sposób, aby jednoznacznie opisywał brak telemetrii i wskazywał, że klucze API zapisywane są tylko lokalnie na urządzeniu.
3. **Zasoby Sklepu:**
   - Upewnienie się, że ikony są prawidłowe (zgodnie z `assets/icons`) oraz zasoby promocyjne w `assets/store/` mają poprawne wymiary.

## 4. Testy (Verification)
- **Translacja inline**: Zaznaczyć tekst na stronie, kliknąć dymek i potwierdzić, że natychmiast pojawia się informacja o ładowaniu, a po chwili wynik z widocznymi przyciskami kopiowania/czytania.
- **TTS**: Pobrać nowy głos przez ustawienia, spróbować odtworzyć tekst. Zamknąć przeglądarkę, otworzyć ponownie i odtworzyć (weryfikacja trwałości IndexedDB). Zauważyć, czy dokument `offscreen` skutecznie odbiera komendę i emituje dźwięk.

## 5. Ewentualne Opcje Alternatywne / Rollback
- Jeśli API WebAssembly/Offscreen okaże się mało wydajne na starszych komputerach, możemy dodać opcję "fallback" powracającą automatycznie do `window.speechSynthesis` z przeglądarki Chrome, aby zachować maksymalną kompatybilność.