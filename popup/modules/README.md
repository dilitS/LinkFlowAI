# Popup Modules

Ten folder zawiera zmodularyzowany kod dla interfejsu popup rozszerzenia LingFlow AI.

## Struktura

```
modules/
├── constants.js          # Stałe konfiguracyjne
├── dom-elements.js       # Referencje do elementów DOM
├── ui-manager.js         # Zarządzanie interfejsem użytkownika
├── settings.js           # Logika ustawień
├── translation.js        # Logika tłumaczenia/korekcji/promptów
├── history.js            # Zarządzanie historią
└── ocr.js               # Funkcjonalność OCR
```

## Moduły

### constants.js
Definicje stałych używanych w całej aplikacji.
- Języki obsługiwane
- Dostępne modele AI
- Kolory i konfiguracja trybów

### dom-elements.js
Centralne miejsce dla wszystkich referencji do elementów DOM.
Ułatwia debugowanie i zarządzanie elementami.

### ui-manager.js
Zarządzanie stanem wizualnym aplikacji:
- Przełączanie trybów
- Toast notifications
- Loading states
- Aktualizacje UI

### settings.js
Wszystko związane z ustawieniami:
- Wypełnianie list (języki, modele)
- Obsługa zmian dostawcy
- Zapisywanie/ładowanie konfiguracji

### translation.js
Główna logika aplikacji:
- Tłumaczenie
- Korekcja tekstu
- Generowanie promptów
- Narzędzia input/output

### history.js
Zarządzanie historią operacji:
- Renderowanie listy
- Dodawanie elementów
- Czyszczenie
- Interakcje

### ocr.js
Funkcjonalność OCR/Screenshot:
- Przechwytywanie ekranu
- Tłumaczenie obrazów
- Modal management

## Użycie

Moduły są importowane i używane w głównym pliku `popup-new.js`:

```javascript
import { elements } from './modules/dom-elements.js';
import { switchMode, showToast } from './modules/ui-manager.js';
import { setupSettingsListeners } from './modules/settings.js';
// etc.
```

## Build

Wszystkie moduły są bundlowane przez webpack do jednego pliku:
```bash
npm run build
# Output: dist/popup/popup.bundle.js
```

## Zasady

1. **Single Responsibility**: Każdy moduł ma jedną, jasno określoną odpowiedzialność
2. **Explicit Exports**: Eksportuj tylko to, co jest potrzebne
3. **No Side Effects**: Moduły nie powinny wykonywać kodu przy imporcie
4. **Clear Dependencies**: Importuj tylko to, czego potrzebujesz

## Rozwój

Przy dodawaniu nowych funkcjonalności:
1. Określ, do którego modułu pasuje nowa funkcja
2. Jeśli nie pasuje do żadnego, rozważ utworzenie nowego modułu
3. Zachowaj spójność z istniejącą strukturą
4. Dokumentuj nowe eksporty

## Testowanie

Każdy moduł może być testowany niezależnie:
```javascript
import { showToast } from './modules/ui-manager.js';
// Test showToast independently
```
