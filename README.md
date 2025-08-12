# Marshall Tuner v7.0.3 (full)
- Base v6.2 stabile + sezione **Ricerca genere (consulente)** con OpenAI tool-calling.
- Badge in barra selezione: **Preset**, **AI Consiglio** (quando applichi il suggerimento), **AI Tune Pro** (con timestamp).
- LED rounding 5↓ / 6↑.
- Backend:
  - `pages/api/classify.js` (Chat Completions + tools; enum dai preset)
  - `pages/api/tune.js` (Responses API con JSON Schema, ±0.3h).
- Dati: `data/presets.json` incluso (modifica liberamente).

## Setup
1) Imposta `OPENAI_API_KEY` su Vercel (Production).
2) (Opzionale) `OPENAI_MODEL`: `gpt-4o-mini-2024-07-18` o `gpt-4.1-mini`.
3) Deploy → hard refresh.

## Note UX
- La ricerca **non applica automaticamente**: mostra Genere + note; premi **Applica preset**.
- Puoi sempre affinare poi con **AI Tune Pro**.
