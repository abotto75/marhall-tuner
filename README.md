# Marshall Tuner — v5.1 (Preset-first + AI Pro opzionale)
- **Preset locali** per 10 generi + sottogeneri (data/presets.json). Nessuna chiamata AI per applicarli.
- **AI Pro**: approfondimento opzionale, parte dal preset scelto e lo modifica max ±0.3 ore.
- UI mobile-first, manopole (img/knob.svg), LED 0–10, Quick/Pro input.
- Riconoscimento genere tramite `data/keywords.json` + ricerca per nome.

## Deploy
1) Carica cartelle `api/`, `data/`, `img/` e file `index.html`, `style.css`, `app.js`, `package.json` nella root del repo.
2) In Vercel: `OPENAI_API_KEY` (e opz. `OPENAI_MODEL`).
3) Redeploy. Usa **Applica preset** per i preset locali; **AI Pro** per l’affinamento professionale.

## Prompt professionale (server)
Il server costruisce un prompt strutturato con contesto (ambiente, volume), preset base e vincoli (±0.3h). Restituisce JSON conforme.
