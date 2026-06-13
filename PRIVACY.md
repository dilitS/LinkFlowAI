# Privacy Policy — LingFlow AI

_Last updated: June 13, 2026_

LingFlow AI ("the extension", "we", "us") is a browser extension that translates,
corrects, and rewrites text and generates AI prompts. This policy explains exactly
what data the extension handles, where it goes, and what it never does.

**Short version:** LingFlow AI has no servers that store your content, no analytics,
no trackers, and no ads. Your API keys and history stay on your device. The only time
your text leaves your browser is when you trigger an AI action — and then it goes
directly to the AI provider you chose.

---

## 1. What data the extension processes

The extension only processes data when **you** actively trigger an action
(translate, correct, generate a prompt, or run OCR). It processes:

- **Text you select or type** — sent to your chosen AI provider to produce a result.
- **Screenshot regions you capture for OCR** — the selected area of the visible tab is
  captured and sent to the AI provider to extract and translate the text in it.
- **Target/source language and tone** — sent alongside the request so the model knows
  what to produce.

The extension does **not** read, collect, or transmit page content in the background.
Nothing is sent unless you explicitly start an action.

## 2. Where your data goes (third-party AI providers)

Depending on the provider you select in Settings, your text/image is sent **directly
from your browser** to one of:

| Provider | Endpoint | When it is used |
| --- | --- | --- |
| OpenAI | `https://api.openai.com` | When you select OpenAI and provide your own API key |
| Google Gemini | `https://generativelanguage.googleapis.com` | When you select Gemini and provide your own API key |
| LingFlow Free Proxy | `https://link-flow-proxy.vercel.app` | When you use the built-in **Free** tier (no key required) |

When you use your **own API key**, your request is governed by that provider's privacy
policy and you are their direct customer:

- OpenAI: https://openai.com/policies/privacy-policy
- Google: https://policies.google.com/privacy

When you use the **Free** tier, the request is relayed through the LingFlow proxy to a
model provider (OpenRouter). The proxy forwards the request and returns the result; it
is not used to build a profile of you and is not tied to your identity.

We do **not** sell, rent, or share your data with anyone for advertising or marketing.

## 3. What is stored, and where

All of the following is stored **locally on your device** using the browser's
`chrome.storage.local` and `localStorage`. None of it is transmitted to LingFlow:

- **API keys** you enter (OpenAI / Gemini). They are stored locally so the extension can
  authenticate your requests. They are sent only to the matching AI provider, and only
  when you run an action.
- **History** of your translations/corrections/prompts (kept on-device, capped to the
  most recent entries; you can clear it at any time).
- **Preferences**: selected provider/model, default languages, tone, and per-site
  settings (e.g. a site you paused or a target language you set for a site).

Because this data lives on your device, uninstalling the extension or clearing your
browser data removes it.

> **Note on key storage:** API keys are stored in your browser's local extension storage
> in plain form (not encrypted). They never leave your device except as the
> `Authorization` header sent to the provider you selected. Treat your browser profile as
> you would any place that holds credentials.

## 4. What we never do

- No analytics, telemetry, or usage tracking.
- No advertising or ad networks.
- No selling or sharing of personal data.
- No background collection of browsing history or page content.
- No remote storage of your text, results, keys, or history on LingFlow servers.

## 5. Permissions and why they are needed

| Permission | Why the extension needs it |
| --- | --- |
| `storage` | Save your settings, API keys, history, and per-site preferences locally. |
| `activeTab` / `tabs` | Know the current tab so OCR can capture the visible area and the workspace can target the right window. |
| `clipboardWrite` | Copy a result to your clipboard when you press the Copy button. |
| `sidePanel` | Open the LingFlow workspace in the browser side panel. |
| Host access to the AI endpoints above | Send your request to the AI provider you selected. |
| Content script on pages (`<all_urls>`) | Show the quick-translate button and inline result tooltip on the page where you select text. It runs only to render that UI in response to your selection. |

## 6. Data retention

LingFlow itself retains nothing server-side. Local data persists on your device until
you clear history, change preferences, or uninstall. Any retention by OpenAI, Google, or
OpenRouter is governed by their respective policies linked above.

## 7. Children

LingFlow AI is a general-purpose productivity tool and is not directed at children under
13. It does not knowingly collect data from children.

## 8. Changes to this policy

If this policy changes, the "Last updated" date above will change and the updated policy
will be published at the same URL. Material changes will be reflected in the extension's
store listing.

## 9. Contact

Questions or requests about privacy: **privacy@lingflow.ai**

> Maintainer note: replace the address above with a real, monitored inbox before
> publishing, and host this file at a stable public URL (for example a GitHub raw link or
> GitHub Pages) to use as the "Privacy policy" URL in the Chrome Web Store dashboard.

---

## 🇵🇱 Polityka prywatności (skrót po polsku)

LingFlow AI nie ma serwerów przechowujących Twoje treści, nie zbiera analityki, nie
śledzi Cię i nie wyświetla reklam. Klucze API oraz historia pozostają na Twoim
urządzeniu.

- **Co jest przetwarzane:** wyłącznie tekst, który zaznaczysz lub wpiszesz, oraz
  fragment ekranu wybrany do OCR — i tylko gdy sam uruchomisz akcję.
- **Dokąd trafia:** bezpośrednio z Twojej przeglądarki do wybranego dostawcy AI
  (OpenAI lub Google Gemini z Twoim kluczem) albo — w trybie darmowym — przez proxy
  LingFlow do dostawcy modelu. Nic nie jest wykorzystywane do profilowania.
- **Co jest zapisywane lokalnie:** klucze API, historia oraz preferencje (w tym
  ustawienia per‑strona). Dane te nigdy nie są wysyłane do LingFlow.
- **Czego nie robimy:** brak analityki, reklam, sprzedaży danych i zbierania historii
  przeglądania w tle.

Pełna, wiążąca treść polityki znajduje się w wersji angielskiej powyżej. Kontakt:
**privacy@lingflow.ai**.
