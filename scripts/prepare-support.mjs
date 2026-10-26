import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const out=new URL('../public/data/support/',import.meta.url), cache=new URL('../data-cache/support/',import.meta.url);
await mkdir(out,{recursive:true});await mkdir(cache,{recursive:true});
const retrievedAt=new Date().toISOString();
async function json(url){const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(`HTTP ${r.status}: ${url}`);const d=await r.json();if(d.error)throw Error(JSON.stringify(d.error));return d;}
const sources=[],features=[];
for(const [service,type,nameField] of [['Zonas_Seguras','meeting','N_LUGAR'],['Albergues','shelter','ALBERGUES']]){
  const url=`https://services7.arcgis.com/NWWHhu45fOJtCgG3/ArcGIS/rest/services/${service}/FeatureServer/0`;
  const meta=await json(url+'?f=pjson'), raw=await json(url+'/query?where=1%3D1&outFields=*&outSR=4326&f=geojson');
  if(raw.exceededTransferLimit)throw Error('Incomplete official extract');
  await writeFile(new URL(service+'.json',cache),JSON.stringify({meta,raw}));
  const sourceUpdatedAt=meta.editingInfo?.dataLastEditDate?new Date(meta.editingInfo.dataLastEditDate).toISOString():null;
  sources.push({id:service,url,authority:'GAD Municipal de Guayaquil · Risk Management',retrievedAt,sourceUpdatedAt,sha256:createHash('sha256').update(JSON.stringify(raw)).digest('hex')});
  for(const f of raw.features){if(f.geometry?.type!=='Point'||f.geometry.coordinates.some(x=>!Number.isFinite(x)))throw Error('Invalid official geometry');
    features.push({...f,properties:{id:service+'-'+f.properties.OBJECTID,name:f.properties[nameField],address:f.properties['UBICACIÓN'],type,source:url,sourceUpdatedAt,retrievedAt,lastVerifiedAt:null,status:type==='shelter'?'Potential temporary shelter — Activation not confirmed':'Officially identified meeting point',operationalStatus:'Operational status unknown',raw:f.properties}});
  }
}
await writeFile(new URL('locations.geojson',out),JSON.stringify({type:'FeatureCollection',features,sources,retrievedAt}));
// General orientation only: these streets/waterways never establish passability.
const query='[out:json][timeout:35];(way[highway~"^(motorway|trunk|primary|secondary)$"](-2.32,-80.10,-1.99,-79.84);way[waterway~"^(river|canal|tidal_channel)$"](-2.32,-80.10,-1.99,-79.84);way[natural=water](-2.32,-80.10,-1.99,-79.84););out geom;';
let context={type:'FeatureCollection',features:[],retrievedAt,source:'https://www.openstreetmap.org/copyright',status:'unavailable'};
try{
 const response=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'FLOODSHADOW-local-beta/2.0'},body:'data='+encodeURIComponent(query),signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error('Overpass HTTP '+response.status);
 const raw=await response.json();
 if(raw.remark)throw Error(raw.remark);
 await writeFile(new URL('osm-context.json',cache),JSON.stringify(raw));
 context={...context,status:'prepared',sourceDate:raw.osm3s?.timestamp_osm_base,attribution:'© OpenStreetMap contributors · ODbL',features:raw.elements.filter(e=>e.geometry?.length>1).map(e=>{const c=e.geometry.map(p=>[p.lon,p.lat]),water=!e.tags?.highway,closed=c.length>=4&&c[0][0]===c.at(-1)[0]&&c[0][1]===c.at(-1)[1];return {type:'Feature',geometry:{type:water&&e.tags?.natural==='water'&&closed?'Polygon':'LineString',coordinates:water&&e.tags?.natural==='water'&&closed?[c]:c},properties:{id:'osm-way-'+e.id,name:e.tags?.name??'',kind:water?'water':'road',source:'https://www.openstreetmap.org/way/'+e.id}};})};
}catch(e){context.error=e.message;console.error('Context unavailable:',e.message);}
await writeFile(new URL('context.geojson',out),JSON.stringify(context));
console.log(JSON.stringify({locations:features.length,context:context.features.length,sources}));
