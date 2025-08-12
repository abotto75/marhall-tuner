# Marshall Tuner v7.0
- Base stabile (v6.2) + **Ricerca genere (consulente)** con tool calling OpenAI.
- Quick: Generi/Sottogeneri dai preset locali (`data/presets.json`).
- AI Pro: refine ±0.3h con Responses API (JSON Schema).
- Barra selezione con badge Preset/AI Tune Pro e timestamp.
- LED rounding 5↓ / 6↑.
- Nuovo endpoint: `api/classify.js` (Chat Completions + tools).

## Setup
1) Imposta `OPENAI_API_KEY` su Vercel.
2) Carica/controlla `data/presets.json` (non sovrascritto dallo zip).
3) Deploy.

## Note
- La sezione consulente **non applica automaticamente**: mostra il genere e ti fa confermare.
- L'enum dei generi per la tool-call viene letta dal tuo `presets.json` se presente; altrimenti usa una lista di base + "Sconosciuto".