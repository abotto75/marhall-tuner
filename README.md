# Marshall Tuner — v4 (Mobile-first + AI Live)

- Omnibox intelligente (Artista/Brano/Opera/Colonna Sonora/Genere)
- Chip dei generi comuni
- UI mobile-first con bottombar
- Visualizzazione **ore** + **LED 0–10** (conversione lineare)
- AI live via `/api/tune` (OpenAI). Aggiungi su Vercel `OPENAI_API_KEY` (e opz. `OPENAI_MODEL`).

## Deploy
1) Carica TUTTI i file nella root del repo (inclusa cartella `api/`).
2) In Vercel → Settings → Environment Variables: `OPENAI_API_KEY`.
3) Deploy o Redeploy: l’endpoint `/api/tune` sarà disponibile.
