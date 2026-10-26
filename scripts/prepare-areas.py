"""Official named areas, whole-polygon membership, and separate Samborondon context."""
import io, json, hashlib, urllib.request
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile
from collections import defaultdict
import shapefile, shapely
from shapely.geometry import shape, mapping
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree
from pyproj import Transformer, Geod

ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'data-cache'/'areas'; CACHE.mkdir(parents=True,exist_ok=True)
OUT=ROOT/'public'/'data'/'city'
now=datetime.now(timezone.utc).isoformat()
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,d): p.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
source='https://sil.guayaquil.gob.ec/wp-content/uploads/SECTORES_DE_NOMENCLATURA-1.zip'
with ZipFile(CACHE/'nomenclature.zip') as z:
    base=next(n for n in z.namelist() if n.endswith('.shp'))[:-4]
    encoding=z.read(base+'.cpg').decode().strip()
    r=shapefile.Reader(shp=io.BytesIO(z.read(base+'.shp')),shx=io.BytesIO(z.read(base+'.shx')),dbf=io.BytesIO(z.read(base+'.dbf')),encoding=encoding)
    project=Transformer.from_crs(32717,4326,always_xy=True).transform
    municipal=[]
    for i,sr in enumerate(r.iterShapeRecords()):
        g=transform(project,shape(sr.shape.__geo_interface__))
        if not g.is_valid: g=shapely.make_valid(g)
        record=sr.record.as_dict()
        region={'NOR-OESTE':'Northwest Guayaquil','NOR-ESTE':'Northeast Guayaquil','SUR-OESTE':'Southwest Guayaquil','SUR-ESTE':'Southeast Guayaquil'}.get(record['Cuadrante'],'Guayaquil')
        municipal.append({'id':'municipal-'+str(i+1),'name':record['SECT_NOMEN'].strip().title(),'geometry':g,'generalArea':region})
geod=Geod(ellps='WGS84')
def area(g): return abs(geod.geometry_area_perimeter(shapely.orient_polygons(g))[0]) if not g.is_empty else 0
tree=STRtree([a['geometry'] for a in municipal])
sectors=read(OUT/'sectors.json'); render=read(OUT/'sectors.map.geojson')
geometry={f['properties']['id']:shape(f['geometry']) for f in render['features']}
# Membership uses the preserved original INEC polygons, never a name inferred from an incident.
original={f['properties']['sec']:shape(f['geometry']) for f in read(ROOT/'data-cache'/'city'/'census-full.geojson')['features']}
members=defaultdict(list); labels={}; assignments={}; boundary_review=[]
for s in sectors:
    g=original[s['id']]; total=area(g)
    candidates=sorted([(area(g.intersection(municipal[int(j)]['geometry']))/total,int(j)) for j in tree.query(g,predicate='intersects')],reverse=True)
    if candidates and candidates[0][0]>.5 and not (len(candidates)>1 and candidates[1][0]>.5):
        share,j=candidates[0]; a=municipal[j]; aid=a['id']; name=a['name']; kind='municipal_majority'
    else:
        share=candidates[0][0] if candidates else None
        aid='parish-'+s['parishCode']; name='Guayaquil peripheral areas' if s['urban'] else s['parishName']; kind='parish_fallback'
        if candidates: boundary_review.append(s['id'])
    region=a['generalArea'] if kind=='municipal_majority' else 'Peripheral Guayaquil' if s['urban'] else 'Rural parishes'
    assignments[s['id']]={'areaId':aid,'areaName':name,'assignmentShare':share,'assignmentMethod':kind,'generalArea':region}
    members[aid].append(s['id']); labels[aid]=name
areas=[]
for aid,ids in members.items():
    g=unary_union([geometry[i] for i in ids]); simple=g.simplify(.00002,preserve_topology=True)
    if not simple.is_valid: simple=g
    if not simple.is_valid: simple=shapely.make_valid(simple)
    areas.append({'id':aid,'name':labels[aid],'sectorIds':ids,'count':len(ids),'bbox':list(g.bounds),'center':list(g.representative_point().coords)[0], 'generalArea':assignments[ids[0]]['generalArea'],'kind':'municipal_group' if aid.startswith('municipal') else 'parish_group','geometry':mapping(simple)})
base='https://idgn.ecuadorencifras.gob.ec/server/rest/services/Hosted/Marco_Geoestadistico_2022/FeatureServer/7/query'
url=base+'?f=geojson&where=sec%20LIKE%20%270916%25%27&outFields=objectid,sec&outSR=4326&returnGeometry=true&resultRecordCount=1000&orderByFields=objectid'
cache=CACHE/'samborondon.geojson'
if not cache.exists():
    raise RuntimeError('Run node scripts/fetch-areas.mjs before this builder')
external=read(cache); assert len(external['features'])==246
for f in external['features']:
    g=shape(f['geometry'])
    if not g.is_valid: g=shapely.make_valid(g)
    assert g.is_valid
    simple=g.simplify(.000012,preserve_topology=True)
    f['geometry']=mapping(simple if simple.is_valid else g)
    f['properties']={'id':f['properties']['sec'],'areaName':'Samborondón','contextOnly':True}
eg=unary_union([shape(f['geometry']) for f in external['features']])
externalArea={'id':'external-samborondon','name':'Samborondón','aliases':['San Borondón','Samborondon','Sanborondon'],'count':246,'sectorIds':[],'bbox':list(eg.bounds),'kind':'external_context','center':list(eg.representative_point().coords)[0]}
assert sum(a['count'] for a in areas)==len(sectors)
result={'version':'named-areas-1','generatedAt':now,'source':source,'sourcePage':'https://sil.guayaquil.gob.ec/territorial/sectores-de-nomenclatura/','municipalSourceCount':len(municipal),'sourceSha256':hashlib.sha256((CACHE/'nomenclature.zip').read_bytes()).hexdigest(),'areas':areas+[externalArea],'assignments':assignments,'external':external,'externalSource':url,'boundaryReviewSectorIds':boundary_review,'definition':'Whole INEC polygons grouped by the municipal nomenclature area covering more than half of their original area; otherwise parish fallback. Group outlines are analytical, not legal neighborhood boundaries. Samborondon is separate context without inherited weather or impacts.'}
write(OUT/'areas.json',result)
print(json.dumps({'namedGroups':len(areas),'municipalSourceCount':len(municipal),'assigned':len(assignments),'boundaryReview':len(boundary_review),'externalSectors':len(external['features'])}))
