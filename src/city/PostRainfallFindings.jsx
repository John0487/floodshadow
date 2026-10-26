import React,{useState} from 'react';
import {localDate,TYPE_LABELS} from './format.js';
export default function PostRainfallFindings({impacts,event,onIncident,onSupport}){
 const [expanded,setExpanded]=useState(false);const located=impacts.filter(i=>i.coordinates);
 return <section className="post-rainfall-findings"><header><div><h2>Post-Rainfall Findings</h2><p>Which places had documented problems? Published locations remain distinct from reviewed whole-area checks.</p></div><button onClick={onSupport}>Emergency Support</button></header>
 <p><strong>{located.length}</strong> mapped candidate locations · <strong>{impacts.length-located.length}</strong> reports without an exact location. The map cannot establish the extent of flooding.</p>
 <div className="post-finding-grid">{(expanded?impacts:impacts.slice(0,6)).map(i=><article key={i.id}><strong>{TYPE_LABELS[i.type]??'Reviewed operator record'}</strong><h3>{i.locationText??'Location not specified'}</h3><p>{i.sectorId?'Candidate sector association':'Sector association not verified'} · {i.coordinates?'Approximate source location':'No exact map location'}</p><small>Storm window begins {localDate(event.start??event.windowStart)}. Individual incident time: not published.</small><p>{i.confirmation==='operator_accepted'?'Reviewed operator evidence':'Published report · location needs review'}</p>{i.coordinates&&<button onClick={()=>onIncident(i)}>Show on map</button>} <a href={i.source} target="_blank" rel="noreferrer">Evidence ↗</a></article>)}</div>
 <button onClick={()=>setExpanded(x=>!x)}>{expanded?'Show fewer records':'See all records'}</button></section>;
}
