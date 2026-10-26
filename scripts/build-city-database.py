"""Portable evidence cache. Actual operator records remain local to their browser."""
import json, sqlite3
from pathlib import Path
root=Path(__file__).resolve().parents[1]
folder=root/'public'/'data'/'city'
read=lambda name: json.loads((folder/name).read_text(encoding='utf-8'))
original=json.loads((root/'data-cache'/'city'/'census-full.geojson').read_text(encoding='utf-8'))
geometries={f['properties']['sec']:f['geometry'] for f in original['features']}
db=sqlite3.connect(folder/'floodshadow-city.sqlite')
db.execute('PRAGMA foreign_keys=ON')
with db:
    db.executescript('''
    CREATE TABLE IF NOT EXISTS storm_event (id TEXT PRIMARY KEY, name TEXT NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL, data_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS geographic_sector (id TEXT PRIMARY KEY, parish_code TEXT NOT NULL, analysis_area_km2 REAL NOT NULL, source_geometry_json TEXT NOT NULL, data_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS weather_observation (id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES storm_event(id), kind TEXT NOT NULL, value_mm REAL, data_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS weather_series (id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES storm_event(id), kind TEXT NOT NULL, coordinates_json TEXT NOT NULL, initialized_at TEXT, data_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS impact_observation (id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES storm_event(id), sector_id TEXT REFERENCES geographic_sector(id), type TEXT NOT NULL, data_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS assessment_snapshot (id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES storm_event(id), kind TEXT NOT NULL, issued_at TEXT NOT NULL, sha256 TEXT NOT NULL, data_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS verification (id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES storm_event(id), sector_id TEXT NOT NULL REFERENCES geographic_sector(id), validation TEXT NOT NULL, data_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS source_manifest (id INTEGER PRIMARY KEY, data_json TEXT NOT NULL);
    ''')
    for table in ['verification','impact_observation','assessment_snapshot','weather_series','weather_observation','geographic_sector','storm_event','source_manifest']:
        db.execute('DELETE FROM '+table)
    dumps=lambda v:json.dumps(v,ensure_ascii=False,separators=(',',':'))
    for e in read('events.json'):
        db.execute('INSERT INTO storm_event VALUES (?,?,?,?,?)',(e['id'],e['name'],e['start'],e['end'],dumps(e)))
        for o in e['observations']:db.execute('INSERT INTO weather_observation VALUES (?,?,?,?,?)',(o['id'],e['id'],o['kind'],o['mm'],dumps(o)))
        for kind in ['forecast','modelRain']:
            for cell in e[kind]['grid']:db.execute('INSERT INTO weather_series VALUES (?,?,?,?,?,?)',(cell['id'],e['id'],cell['kind'],dumps(cell['coordinates']),e[kind].get('initializedAt'),dumps(cell)))
    for s in read('sectors.json'):db.execute('INSERT INTO geographic_sector VALUES (?,?,?,?,?)',(s['id'],s['parishCode'],s['areaKm2'],dumps(geometries[s['id']]),dumps(s)))
    for i in read('impacts.json'):db.execute('INSERT INTO impact_observation VALUES (?,?,?,?,?)',(i['id'],i['eventId'],i['sectorId'],i['type'],dumps(i)))
    for s in read('assessments.json'):db.execute('INSERT INTO assessment_snapshot VALUES (?,?,?,?,?,?)',(s['id'],s['eventId'],s['kind'],s['issuedAt'],s['sha256'],dumps(s)))
    db.execute('INSERT INTO source_manifest VALUES (1,?)',(dumps(read('manifest.json')),))
counts={name:db.execute('SELECT count(*) FROM '+name).fetchone()[0] for name in ['storm_event','geographic_sector','weather_observation','weather_series','impact_observation','assessment_snapshot','verification']}
assert counts['geographic_sector']==6652
assert counts['impact_observation']==78
assert not db.execute('PRAGMA foreign_key_check').fetchall()
assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
db.close()
print(json.dumps(counts))
