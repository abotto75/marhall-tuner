# Marshall Tuner v7.0.1
- Fix consulente: prompt più permissivo (meno 'Sconosciuto'), tool call forzata, fallback euristico e fallback opzionale via env `DEFAULT_FALLBACK_GENRE_NAME`.
- Base v7.0 invariata (Quick + AI Pro, barra selezione con timestamp, LED rounding).

## Env richieste
- `OPENAI_API_KEY`
- opzionale: `OPENAI_MODEL` (es. gpt-4o-mini-2024-07-18)
- opzionale: `DEFAULT_FALLBACK_GENRE_NAME` (nome genere come appare nei preset, es. "Rock")
