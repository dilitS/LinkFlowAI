# Chrome Web Store assets

Drop-in promotional graphics for the store listing. Use the exact-size files for upload;
the `-source` files are full-resolution originals you can re-edit.

| File | Size | Where it's used |
| --- | --- | --- |
| `promo-small-440x280.png` | 440×280 | **Small promo tile** (required to be eligible for featuring) |
| `promo-marquee-1400x560.png` | 1400×560 | **Marquee promo tile** (optional, for the marquee carousel) |
| `promo-small-source.png` | 1536×1024 | Editable source for the small tile |
| `promo-marquee-source.png` | 1536×1024 | Editable source for the marquee |
| `../icons/icon128.png` | 128×128 | Store icon (already referenced by `manifest.json`) |

## Still needed before submitting

- **At least one screenshot**, 1280×800 or 640×400 (1–5 allowed). Capture the real UI:
  load the unpacked extension (`chrome://extensions` → Developer mode → Load unpacked),
  open the popup and the side panel, and screenshot them. Place them here as
  `screenshot-1.png`, etc.
- A public **privacy policy URL** — host `/PRIVACY.md` (e.g. GitHub Pages or a raw link).

Listing copy, the single-purpose statement, and per-permission justifications live in
`docs/CHROME_STORE_DESCRIPTION.md`.
