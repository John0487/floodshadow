"""GEOS topology, STRtree overlays and geodesic area; source geometries remain preserved."""
import json
import sqlite3
from collections import defaultdict, Counter
from pathlib import Path
import shapely
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from shapely.ops import unary_union
from shapely.strtree import STRtree
from pyproj import Geod

folder = Path(__file__).resolve().parents[1] / 'data-cache' / 'city'
read = lambda name: json.loads((folder / name).read_text(encoding='utf-8-sig'))
write = lambda name, value: (folder / name).write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
geod = Geod(ellps='WGS84')
def area(g):
    if g.is_empty: return 0.0
    return abs(geod.geometry_area_perimeter(shapely.orient_polygons(g))[0])
def polygonal(g):
    if isinstance(g, (Polygon, MultiPolygon)): return g
    return unary_union([x for x in shapely.get_parts(g) if isinstance(x, (Polygon, MultiPolygon))])

census = read('census-full.geojson')['features']
footprints = read('historical-footprints.geojson')['features']
repairs = []
def checked(feature, kind, identifier):
    g = shape(feature['geometry'])
    if not g.is_valid:
        before = area(g)
        reason = shapely.is_valid_reason(g)
        g = polygonal(shapely.make_valid(g))
        after = area(g)
        repairs.append({'kind':kind, 'id':identifier, 'reason':reason, 'beforeAreaM2':before, 'afterAreaM2':after, 'relativeAreaChange':abs(after-before)/max(1,before)})
    if g.is_empty or not g.is_valid: raise ValueError(f'Unusable {kind} {identifier}')
    return g

fg = [checked(f,'historicalFootprint',f['properties']['FID']) for f in footprints]
tree = STRtree(fg)
cg = [checked(f,'sector',f['properties']['sec']) for f in census]
original_cg=list(cg)
source_tree=STRtree(original_cg)
source_overlaps=[]
harmonizations=[]
for i,g in enumerate(original_cg):
    earlier=[]
    for j in source_tree.query(g,predicate='intersects'):
        j=int(j)
        if j==i or g.touches(original_cg[j]): continue
        shared=area(polygonal(g.intersection(original_cg[j])))
        if shared>1 and j>i: source_overlaps.append({'a':census[i]['properties']['sec'],'b':census[j]['properties']['sec'],'areaM2':shared})
        if shared>0 and census[j]['properties']['sec']<census[i]['properties']['sec']: earlier.append(original_cg[j])
    if earlier:
        adjusted=polygonal(g.difference(unary_union(earlier)))
        if adjusted.is_empty or not adjusted.is_valid: raise ValueError('Unusable harmonized sector')
        change=area(g)-area(adjusted)
        harmonizations.append({'id':census[i]['properties']['sec'],'removedOverlapM2':change,'relativeAreaChange':change/area(g)})
        cg[i]=adjusted
print('Source overlap pairs',len(source_overlaps),'harmonized sectors',len(harmonizations),flush=True)
names = {'090150':'Guayaquil, cabecera cantonal','090152':'Juan Gómez Rendón','090153':'El Morro','090156':'Posorja','090157':'Puná','090158':'Tenguel'}
sectors, maps, problems = [], [], []
groups = defaultdict(list)
unusable_repairs = {r['id'] for r in repairs if r['kind']=='historicalFootprint' and r['relativeAreaChange']>0.01}
for i,(feature,g) in enumerate(zip(census,cg)):
    code = feature['properties']['sec']
    indices = tree.query(g,predicate='intersects')
    uncertain = any(footprints[int(j)]['properties']['FID'] in unusable_repairs for j in indices)
    intersection = unary_union([g.intersection(fg[int(j)]) for j in indices]) if len(indices) else Polygon()
    overlap = min(1.0, max(0.0,area(intersection)/area(g))) if not uncertain else None
    if uncertain: problems.append({'kind':'historicalRepairUncertainty','id':code})
    point = g.representative_point()
    s = {'id':code,'officialObjectId':feature['properties']['objectid'],'name':f'Sector INEC {code[-3:]}','code':code,'parishCode':code[:6],'parishName':names.get(code[:6],code[:6]),'urban':code.startswith('090150'),'zoneId':code[:9],'center':[point.x,point.y],'bbox':list(g.bounds),'areaKm2':area(g)/1e6,'historyOverlap':overlap,'historySource':'municipal-footprint','infrastructure':dict.fromkeys(['drainage','runoff','rivers','riskProperties','elevation','tide']),'historyQuality':'repair_uncertainty' if uncertain else 'documented_footprint','geometrySource':'INEC 2022'}
    sectors.append(s)
    simple = g.simplify(.000012,preserve_topology=True)
    if not simple.is_valid or simple.is_empty:
        problems.append({'kind':'sectorSimplificationFallback','id':code})
        simple = g
    maps.append({'type':'Feature','id':code,'geometry':mapping(simple),'properties':{k:s[k] for k in ['id','zoneId','parishCode','urban','areaKm2','historyOverlap']}})
    groups[code[:9]].append(g)
    if i%500==0: print('GEOS sectors',i,flush=True)

zones = []
for code,geometries in groups.items():
    merged = unary_union(geometries)
    g = merged.simplify(.00004,preserve_topology=True)
    if not g.is_valid:
        problems.append({'kind':'zoneSimplificationFallback','id':code})
        g=merged if merged.is_valid else polygonal(shapely.make_valid(merged))
    if not g.is_valid: raise ValueError('Invalid zone '+code)
    zones.append({'type':'Feature','id':code,'geometry':mapping(g),'properties':{'id':code,'zoneId':code,'parishCode':code[:6],'urban':code.startswith('090150'),'count':len(geometries)}})

ctree = STRtree(cg)
overlaps = []
for i,g in enumerate(cg):
    for j in ctree.query(g,predicate='intersects'):
        if int(j)<=i: continue
        other=cg[int(j)]
        if g.touches(other): continue
        shared=area(polygonal(g.intersection(other)))
        if shared>1: overlaps.append({'a':sectors[i]['id'],'b':sectors[int(j)]['id'],'areaM2':shared})

impacts = json.loads((Path(__file__).resolve().parents[1]/'public'/'data'/'city'/'impacts.json').read_text(encoding='utf-8'))
from shapely.geometry import Point
for impact in impacts:
    impact['sectorId']=None
    if not impact.get('coordinates'): continue
    p = Point(impact['coordinates'])
    # Never make an ambiguous source point look certain through technical boundary ownership.
    matches=source_tree.query(p,predicate='within')
    if len(matches)==1: impact['sectorId']=sectors[int(matches[0])]['id']
    impact['geocoding']['sectorAssignment']='candidate_point_in_polygon' if len(matches)==1 else 'boundary_ambiguous' if len(matches) else 'outside_coverage'

audit={'engine':'Shapely '+shapely.__version__+' / GEOS '+shapely.geos_version_string,'area':'pyproj.Geod WGS84, orient_polygons','sourceSectors':len(census),'uniqueSectorIds':len(set(s['id'] for s in sectors)),'validAnalyticalSectors':sum(g.is_valid for g in cg),'validRenderSectors':sum(shape(f['geometry']).is_valid for f in maps),'validZones':len(zones),'repairs':repairs,'sourceOverlapPairsOver1m2':source_overlaps,'harmonization':{'method':'Technical partition: overlap assigned to lexicographically smallest official sector code. Original source geometries preserved; not a legal boundary correction. Point assignment checks original source ambiguity.','changes':harmonizations,'maxRelativeAreaChange':max((h['relativeAreaChange'] for h in harmonizations),default=0)},'overlapsOver1m2':overlaps,'problems':problems,'noNewBoundaryClaim':True}
write('geometry-geos-cache.json',{'sectors':sectors,'maps':maps,'zones':zones,'impacts':impacts,'audit':audit})
write('geometry-audit.json',audit)
print(json.dumps({'sectors':len(sectors),'zones':len(zones),'repairs':len(repairs),'overlaps':len(overlaps),'uncertainHistory':len(problems)}),flush=True)
