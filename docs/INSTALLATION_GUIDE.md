# 📥 Poradnik instalacji LinkFlowAI

Ponieważ LingFlow AI nie jest jeszcze dostępne w Chrome Web Store, możesz zainstalować rozszerzenie bezpośrednio ze źródła. Oto szczegółowy poradnik.

---

## Instalacja z kodu źródłowego (Developer Mode)

### Krok 1: Przygotuj folder z rozszerzeniem

#### Opcja A: Sklonuj repozytorium
```bash
git clone https://github.com/dilitS/LinkFlowAI.git
cd LinkFlowAI
```

#### Opcja B: Pobierz kod jako ZIP
1. Odwiedź https://github.com/dilitS/LinkFlowAI
2. Kliknij zielony przycisk **Code**
3. Wybierz **Download ZIP**
4. Rozpakuj folder w wybrane miejsce

### Krok 2: Zainstaluj zależności (jeśli chcesz budować z kodu)

```bash
npm install
npm run build        # Bundluje JavaScript
npm run build:css    # Kompiluje CSS z Tailwind
```

> **Uwaga:** Jeśli nie chcesz budować z kodu, pomiń ten krok. Pliki mogą być już gotowe.

### Krok 3: Otwórz Chrome Extensions

1. Otwórz przeglądarkę **Google Chrome** (lub Chromium-based jak Edge, Brave)
2. Wpisz w pasek adresu: `chrome://extensions`
3. Naciśnij **Enter**

### Krok 4: Włącz Developer Mode

W prawym górnym rogu strony z rozszerzeniami:
- Włącz toggle **Developer mode** (będzie na niebiesko)

![Developer Mode Toggle](https://imgur.com/TBxKJaJ.png)

### Krok 5: Załaduj rozpakowane rozszerzenie

1. Kliknij przycisk **Load unpacked** (pojawił się po włączeniu Developer Mode)
2. Nawiguj do folderu z LinkFlowAI
3. Wybierz główny folder projektu i kliknij **Select Folder**

![Load Unpacked](https://imgur.com/LMzKJaJ.png)

### Krok 6: Zweryfikuj instalację

Po załadowaniu powinieneś zobaczyć:
- ✅ Rozszerzenie **LingFlow AI** na liście
- ✅ Niebieska ikona w toolbarze Chrome
- ✅ ID rozszerzenia (np. `mfdbcmklhgkgikmkflnkjcjnfcfbfbcf`)

Jeśli widzisz czerwone błędy, sprawdź sekcję "Rozwiązywanie problemów" poniżej.

### Krok 7: Przypnij rozszerzenie

Aby mieć szybki dostęp:
1. Kliknij ikonę puzzla 🧩 obok paska adresu
2. Kliknij 📌 przy LingFlow AI
3. Rozszerzenie pojawi się w toolbarze

![Pin Extension](https://imgur.com/k7nKJaJ.png)

---

## Pierwsze uruchomienie

### 1. Otwórz ustawienia
- Kliknij ikonę LingFlow AI w toolbarze
- Przejdź do **Settings ⚙️** (lub ikona koła zębatego)

### 2. Wybierz model AI

Masz 2 opcje:

#### 🆓 Chrome AI (Bezpłatnie, bez klucza)
- Najlepsza do szybkich tłumaczeń
- Brak klucza API wymagany
- Działa całkowicie offline
- Wymaga Chrome 126+
- Funkcje: Translate, Correct, Prompt (bez OCR)

**Jak włączyć:**
1. W Settings wybierz **AI Provider: Chrome AI**
2. Zatwierdź
3. Model się załaduje automatycznie

#### 🔑 OpenAI lub Google Gemini (Twój klucz)
- Pełna funkcjonalność (w tym OCR)
- Wymagany własny klucz API
- Bezpłatne opcje: Google Gemini (1,000,000 tokens/miesiąc), OpenAI (trial credits)

**Jak dodać klucz:**
1. W Settings wybierz **AI Provider: OpenAI** lub **Gemini**
2. Wklej swój klucz API
3. Kliknij **Save**

**Gdzie pobrać klucze:**
- 🔗 OpenAI: https://platform.openai.com/api-keys
- 🔗 Google Gemini: https://aistudio.google.com/app/apikey

### 3. Przetestuj rozszerzenie

1. W popup, przejdź na **Translate** tab
2. Napisz: `Hello world`
3. Wybierz języki (np. English → Polish)
4. Kliknij **Translate**
5. Powinieneś zobaczyć: "Cześć świecie"

---

## Funkcje i jak ich używać

### 📝 Tłumaczenie tekstu

1. Otwórz popup (kliknij ikonę)
2. Wpisz tekst w pole tekstowe
3. Wybierz języki źródłowy i docelowy
4. Opcjonalnie: zmień ton (Casual, Formal, Business, Friendly)
5. Kliknij **Translate**

### ✏️ Korekcja gramatyczna

1. Wybierz **Translate**
2. Ustaw **ten sam język** dla źródła i celu (np. Polish → Polish)
3. Wpisz tekst z błędami
4. Kliknij **Translate**
5. Otrzymasz poprawiony tekst

### 🎨 Generowanie promptów do obrazów

1. Przejdź na tab **Prompt**
2. Wybierz tryb:
   - **Photo** — scenki fotorealistyczne
   - **Graphic** — ilustracje, grafiki
   - **Expand** — poszerzanie istniejących promptów
3. Opisz, co chcesz
4. Kliknij **Generate Prompt**
5. Otrzymasz gotowy prompt do DALL-E, Midjourney itp.

### 📷 OCR (czytanie tekstu z obrazów)

1. Przejdź na tab **Translate**
2. Kliknij ikonę 📷 aparatu
3. Zaznacz obszar ekranu myszką
4. Tekst zostanie rozpoznany i automatycznie przetłumaczony
5. Skopiuj wynik lub posłuchaj (🔊)

### 🌐 Tłumaczenie tekstu bezpośrednio na stronach

1. Zaznacz tekst na dowolnej stronie
2. Pojawi się niebieska ikonka LingFlow AI
3. Kliknij, aby przetłumaczyć
4. Możesz:
   - 📋 Skopiować wynik
   - 🔄 Zastąpić tekst na stronie
   - 🔊 Posłuchać tłumaczenia

---

## Aktualizacje rozszerzenia

### Aktualizacja z kodu źródłowego

Jeśli zmienisz kod:

```bash
# Jeśli modyfikujesz pliki JavaScript/CSS
npm run watch        # Automatycznie buduje zmiany
npm run watch:css    # Automatycznie kompiluje CSS

# Po zmianach, odśwież rozszerzenie:
# 1. Idź na chrome://extensions
# 2. Kliknij przycisk ⟳ przy LinkFlowAI
# 3. Zmiany załadują się natychmiast
```

### Śledzenie nowych wersji

1. Obserwuj repozytorium na GitHubie (Watch → Releases)
2. Pobierz nową wersję
3. Powtórz kroki 3-5 z instrukcji instalacji

---

## Rozwiązywanie problemów

### ❌ Rozszerzenie się nie ładuje

**Problem:** Błędy typu "Manifest error"

**Rozwiązanie:**
```bash
# Upewnij się, że zbudowałeś kod
npm install
npm run build
npm run build:css

# Następnie załaduj ponownie na chrome://extensions
```

### ❌ Chrome AI nie jest dostępne

**Problem:** Nie widzisz opcji "Chrome AI" w Settings

**Rozwiązanie:**
- Wymagany **Chrome 126+**
- Sprawdź wersję: Menu → About Google Chrome (zautomatyzuje się do najnowszej)
- Warunek: Model musi być pobrany (może trwać kilka minut)

### ❌ Tłumaczenie nie działa

**Problem:** Pojawia się błąd przy kliknięciu "Translate"

**Rozwiązanie:**

1. **Jeśli używasz Chrome AI:**
   - Sprawdź Settings — czy model się załadował
   - Poczekaj kilka minut, model się pobiera

2. **Jeśli używasz klucza API:**
   - Sprawdź, czy klucz jest prawidłowy
   - Sprawdź w Settings, czy dostawca jest wybrany
   - Sprawdź, czy masz dostęp do API

3. **Otwórz DevTools rozszerzenia:**
   - Idź na `chrome://extensions`
   - Kliknij **Details** przy LingFlow AI
   - Kliknij **Inspect views → service worker**
   - W konsoli powinieneś zobaczyć szczegóły błędu

### ❌ Rozszerzenie znika z toolbara

**Rozwiązanie:**
1. Idź na `chrome://extensions`
2. Sprawdź, czy jest na liście
3. Jeśli jest wyłączone (toggle szary), kliknij toggle
4. Przypnij rozszerzenie (kliknij 📌)

### ❌ OCR nie działa

**Problem:** Przy kliknięciu 📷 nic się nie dzieje

**Rozwiązanie:**
- OCR wymaga **własnego klucza API** (OpenAI lub Google Gemini)
- Chrome AI nie obsługuje OCR
- Dodaj klucz w Settings i spróbuj ponownie

---

## Wymagania systemowe

| Wymaganie | Wersja |
|-----------|--------|
| **Przeglądarka** | Chrome, Edge, Brave 90+ |
| **Node.js** (do budowania) | 18+ |
| **System** | Windows, macOS, Linux |

---

## Wsparcie i feedback

- 🐛 **Zgłoś błąd:** https://github.com/dilitS/LinkFlowAI/issues
- 💬 **Sugestie:** Otwórz Issue z labelem `enhancement`
- 🌟 **Podobało się?** Daj gwiazdkę na GitHubie!

---

## Czym się różni od Chrome Web Store?

Instalacja z kodu źródłowego ma kilka różnic:

| Cecha | Developer Mode | Chrome Web Store |
|-------|----------------|------------------|
| Instalacja | Ręczna (5 minut) | Jedno kliknięcie |
| Aktualizacje | Ręczne | Automatyczne |
| Przesyłanie danych | Nie | Dane weryfikacji |
| Bezpieczeństwo | Full control | Weryfikacja Google |

Gdy rozszerzenie trafi na Web Store, będzie dostępne dla wszystkich z jednym kliknięciem! 🎉

---

<div align="center">
<sub>Instrukcja dla LinkFlowAI v1.6.0 • MIT License • Zbudowane z ❤️</sub>
</div>
