#!/usr/bin/env python3
import pandas as pd, json, re, unicodedata, sys

def slugify(s):
    s = s.strip().lower()
    s = ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c))
    s = re.sub(r'[^a-z0-9]+','_', s).strip('_')
    return s or "x"

def led_to_clock(x):
    x = max(0.0, min(10.0, float(x)))
    return round(0.5 + 0.3*x, 2)

def main(csv_path, out_path):
    df = pd.read_csv(csv_path, sep=";", encoding="utf-8")
    df['Genere'] = df['Genere'].astype(str).str.strip()
    df['Sottogenere'] = df['Sottogenere'].astype(str).str.strip()
    df['Bass (0-10)'] = pd.to_numeric(df['Bass (0-10)'], errors='coerce').fillna(0.0)
    df['Treble (0-10)'] = pd.to_numeric(df['Treble (0-10)'], errors='coerce').fillna(0.0)

    famous_order = ["pop", "rock", "metal", "classica", "country", "ost"]
    top_genres_order, genres, subgenres = [], {}, {}

    for _, row in df.iterrows():
        g = row['Genere']
        s = row['Sottogenere']
        bass_clock = led_to_clock(row['Bass (0-10)'])
        treble_clock = led_to_clock(row['Treble (0-10)'])
        gid = slugify(g)
        if gid not in top_genres_order:
            top_genres_order.append(gid)
        if s.lower() in ('generico', 'generica'):
            genres[gid] = {"name": g, "bass_clock": bass_clock, "treble_clock": treble_clock, "notes": ""}
        else:
            subgenres.setdefault(gid, []).append({"id": slugify(s), "name": s, "bass_clock": bass_clock, "treble_clock": treble_clock})

    for gid in top_genres_order:
        if gid not in genres:
            lst = subgenres.get(gid, [])
            if lst:
                genres[gid] = {"name": lst[0]['name'], "bass_clock": lst[0]['bass_clock'], "treble_clock": lst[0]['treble_clock'], "notes": ""}
            else:
                genres[gid] = {"name": gid, "bass_clock": 2.0, "treble_clock": 2.0, "notes": ""}

    others = [g for g in top_genres_order if g not in famous_order]
    ordered_genres = famous_order + sorted(others, key=lambda x: genres[x]['name'].lower())
    top_genres_order = [g for g in ordered_genres if g in genres]

    presets = {"top_genres_order": top_genres_order, "genres": genres, "subgenres": subgenres}
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(presets, f, ensure_ascii=False, indent=2)

    print(f"Presets salvati in {out_path} ({len(genres)} generi, {sum(len(v) for v in subgenres.values())} sottogeneri)")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Uso: python update_presets.py input.csv output.json")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
