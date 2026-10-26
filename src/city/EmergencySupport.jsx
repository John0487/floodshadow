import React from 'react';
import {nearbyLocations} from './map-model.js';
import {localDate,TYPE_LABELS} from './format.js';
export default function EmergencySupport({data,area,active,impacts,onLocation}){
 const center=active?.sector.center??area?.center;
 const places=nearbyLocations(data.support,center);
 const ids=new Set(active?[active.sector.id]:area?.sectorIds??[]);
 const local=impacts.filter(i=>!ids.size||ids.has(i.sectorId));
 return <aside className="sector-passport support-panel">
  <div className="support-badge">Informational · experimental</div><h2>Emergency Support</h2>
  <p>Documented places for planning. Availability and access need a current official check.</p>
  <h3>Area Situation</h3><p>{area?.name??active?.sector.areaName??'Guayaquil'} · {local.length} published or reviewed records in this selection. A record does not establish whole-area flooding.</p>
  <h3>Nearby Official Locations</h3><p>{center?'Within 8 km in a straight line from the selection’s reference point. This is not travel distance or a recommended destination.':'Choose an area to see nearby places. Showing the prepared municipal inventory.'}</p>
  {!places.length&&<p>No official locations in this prepared search. This does not mean none exist.</p>}
  {places.map(f=><article className="support-place" key={f.properties.id}>
   <button onClick={()=>onLocation(f)}><strong>{f.properties.type==='meeting'?'◇ ':'▣ '}{f.properties.name}</strong></button>
   <p>{f.properties.status}</p><p>{f.properties.operationalStatus}</p>
   <small>{f.properties.address} · {f.geometry.coordinates.map(x=>x.toFixed(5)).join(', ')}{f.distance!=null?` · ${f.distance.toFixed(1)} km straight line`:''}</small>
   <small>Source updated: {localDate(f.properties.sourceUpdatedAt)}. Retrieved: {localDate(f.properties.retrievedAt)}. Last operational verification: not available.</small>
   <a href={f.properties.source} target="_blank" rel="noreferrer">Municipal source ↗</a>
  </article>)}
  <h3>Infrastructure Context</h3><p>{data.context?.features?.length?'Prepared streets and waterways provide orientation only. A road drawn on the map is not evidence that it can be used.':'Local road and waterway data could not be prepared. The municipal facilities and area boundaries remain available.'}</p>
  <h3>Information Gaps</h3><p>Current destination activation, health-facility availability, emergency-service capacity and event-specific road closures have not been verified. The shelter inventory was last edited in 2020; it is not a current activation list.</p>
  <strong>Safe travel routes have not been verified for this event.</strong><p>Follow current instructions from responsible emergency agencies. This view supplies no evacuation directions.</p>
  <h3>Official Sources</h3>{data.support?.sources?.map(s=><p key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.id==='Zonas_Seguras'?'Municipal meeting points':'Municipal potential shelter inventory'} ↗</a></p>)}
 </aside>;
}
