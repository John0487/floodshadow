"""Build a portable SQLite source cache; manual browser records are not included."""
import json
import sqlite3
from pathlib import Path

folder = Path(__file__).resolve().parents[1] / 'public' / 'data'
read = lambda name: json.loads((folder / name).read_text(encoding='utf-8-sig'))
db = sqlite3.connect(folder / 'floodshadow.sqlite')
with db:
    db.executescript('''
    CREATE TABLE IF NOT EXISTS sectors (id INTEGER PRIMARY KEY, census_code TEXT NOT NULL, display_name TEXT NOT NULL, area_km2 REAL, historical_overlap REAL, neighbors_json TEXT, geometry_json TEXT);
    CREATE TABLE IF NOT EXISTS historical_footprints (id INTEGER PRIMARY KEY, geometry_json TEXT);
    CREATE TABLE IF NOT EXISTS historical_events (id INTEGER PRIMARY KEY, event_date TEXT, canton TEXT, parish TEXT, sector TEXT, event_type TEXT, geometry_json TEXT);
    CREATE TABLE IF NOT EXISTS weather_hourly (local_time TEXT PRIMARY KEY, precipitation_mm REAL, timezone TEXT, model TEXT);
    CREATE TABLE IF NOT EXISTS source_metadata (name TEXT PRIMARY KEY, metadata_json TEXT);
    ''')
    for table in ['sectors', 'historical_footprints', 'historical_events', 'weather_hourly', 'source_metadata']:
        db.execute(f'DELETE FROM {table}')
    for feature in read('sectors.geojson')['features']:
        p = feature['properties']
        db.execute('INSERT INTO sectors VALUES (?,?,?,?,?,?,?)', (p['id'], p['code'], p['name'], p['areaKm2'], p['susceptibility'], json.dumps(p['neighbors']), json.dumps(feature['geometry'])))
    for i, feature in enumerate(read('susceptibility.geojson')['features']):
        db.execute('INSERT INTO historical_footprints VALUES (?,?)', (i, json.dumps(feature['geometry'])))
    if (folder / 'events.geojson').exists():
        for feature in read('events.geojson')['features']:
            p = feature['properties']
            db.execute('INSERT INTO historical_events VALUES (?,?,?,?,?,?,?)', (p['objectid'], p.get('fechadelevento'), p.get('canton'), p.get('parroquia'), p.get('sector'), p.get('evento'), json.dumps(feature['geometry'])))
    if (folder / 'weather.json').exists():
        weather = read('weather.json')
        db.executemany('INSERT INTO weather_hourly VALUES (?,?,?,?)', [(time, rain, weather['timezone'], 'ECMWF IFS') for time, rain in zip(weather['hourly']['time'], weather['hourly']['precipitation'])])
        db.execute('INSERT INTO source_metadata VALUES (?,?)', ('weather', json.dumps({k:v for k,v in weather.items() if k != 'hourly'})))
    db.execute('INSERT INTO source_metadata VALUES (?,?)', ('geography', json.dumps(read('sources.json'))))
assert db.execute('SELECT COUNT(*) FROM sectors').fetchone()[0] == 36
assert db.execute('SELECT COUNT(*) FROM sectors WHERE historical_overlap < 0 OR historical_overlap > 1').fetchone()[0] == 0
print(json.dumps({table: db.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0] for table in ['sectors','historical_footprints','historical_events','weather_hourly']}, indent=2))
db.close()
