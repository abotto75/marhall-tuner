Marshall Tuner v7.0.4 — Ricerca Genere via Responses API JSON Schema; Quick + AI Pro; Presets inclusi.


## Rigenerazione automatica di presets.json su Vercel
- Mantieni/aggiorna `data/presets.csv` nel repository.
- Ad ogni push su GitHub, Vercel esegue automaticamente `npm run vercel-build`, che rigenera `data/presets.json`.
- Se vuoi rigenerare in locale: `npm install` e poi `npm run build:presets`.

## Aggiornamento automatico dei preset su Vercel

- Modifica o sostituisci `data/presets.csv` nella repo.
- Vercel esegue automaticamente `npm run vercel-build` durante il deploy, che genera `data/presets.json` da CSV.
- Se il CSV ha errori (colonne mancanti, numeri fuori 0–10, ecc.), **il deploy fallisce** con messaggi chiari in log.
- Se esiste `data/genres_order.json` (array di nomi o slug dei generi), l'ordine dei generi sarà **manuale**; gli altri vengono aggiunti in coda per popolarità.
- Prima di sovrascrivere `data/presets.json`, viene creato un **backup** con suffisso `backup-YYYYMMDDHHMMSS`.

### Esecuzione locale (opzionale)
```bash
npm install
npm run build:presets
```

## Pipeline preset automatica (Vercel)

- Aggiorna `data/presets.csv` nel repo (schema: `Genere;Sottogenere;Bass (0-10);Treble (0-10)`).
- In fase di deploy Vercel esegue automaticamente:
  ```
  npm run vercel-build
  ```
  che richiama lo script:
  ```
  npm run build:presets
  ```
- Lo script:
  - **valida** il CSV (colonne, numeri 0–10, righe non vuote). Se trova errori, **interrompe la build** con messaggio chiaro.
  - converte LED→clock con `clock = 0.5 + 0.3 * led`.
  - usa la riga **Generico/Generica** come preset base del genere (se assente, prende il primo sottogenere).
  - ordina i generi per **popolarità** (conteggio righe); se esiste `data/genres_order.json` usa **ordine manuale** e poi i restanti per popolarità.
  - crea un **backup** del `presets.json` corrente in `data/presets.backup-YYYYMMDD-HHMMSS.json` prima di sovrascrivere.

### Ordine manuale (opzionale)
Crea `data/genres_order.json` con un array di nomi o slugs:
```json
["Rock", "Pop", "Metal", "classica"]
```
Nomi e slugs vengono normalizzati automaticamente.
