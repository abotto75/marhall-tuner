
# Marshall Tuner v7.0.5 — Essential
- Carica dataset da `data/presets.json` (Genere, Sottogenere, Bass 0–10, Treble 0–10, Guida/Song/Emotion).
- Quick: chip Genere/Sottogenere → applica Bass/Treble (senza altri calcoli).
- Ricerca Genere (consulente): `/api/classify` (OpenAI Responses + JSON Schema) tra i generi presenti nel dataset.
- AI Tune Pro: `/api/tune` (Responses + JSON Schema) affina in ore (±0.3h) con LED rounding (≤.5↓ / ≥.6↑).

## Deploy
1) Vercel (Production): `OPENAI_API_KEY`, opzionale `OPENAI_MODEL=gpt-4.1-mini`.
2) Carica la cartella `marshall_tuner/` nel root del repo.
3) Deploy e hard refresh.
