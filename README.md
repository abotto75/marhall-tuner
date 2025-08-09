# Marshall Tuner — Acton III (Complete + AI)

App per suggerire i settaggi **Bass/Treble** della Marshall **Acton III** in base a **genere/artista**.
Include:
- **Editor preset** (salvataggio locale + export/import JSON)
- **Integrazione AI** via OpenAI (endpoint serverless `/api/tune`)

## Uso offline (senza AI)
1. Apri `index.html` in un browser moderno.
2. Funzioni attive: selezione preset, ambiente/volume, editor custom, export/import.
3. Il tasto **“Chiedi all’AI”** richiede il backend, quindi offline non risponde.

## Deploy (Vercel) — Consigliato
1. Crea un account su https://vercel.com/
2. Importa questo progetto come **New Project**.
3. In **Settings → Environment Variables**, aggiungi:
   - `OPENAI_API_KEY` = la tua chiave OpenAI
   - `OPENAI_MODEL` = (opzionale) es. `gpt-4.1-mini`
4. Premi **Deploy**.
5. Apri l'app e usa **“Chiedi all’AI”** per generare settaggi automatici.

## Sicurezza
- La chiave OpenAI resta **sul server** (mai nel client).
- I preset personalizzati vengono salvati **nel browser** (localStorage).

## Note
- Non affiliato a Marshall Amplification.
- Preset curati per uso consumer su Acton III.
