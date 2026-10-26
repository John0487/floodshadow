import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeChance,normalizeInamhi,normalizeHistory,normalizeBulletins,intensity,forecastRows,strongestAreas,evaluateRainReports,recentReports} from './rain-journey.js';
test('rain chance is source supplied, bounded and correctly labeled as a daily peak',()=>{
 const raw={hourly_units:{precipitation_probability:'%'},hourly:{time:[1793048400,1793052000],precipitation_probability:[96,null]},daily:{time:[1792990800],precipitation_probability_max:[100]}};
 const p=normalizeChance(raw,'2026-10-26T20:00:00Z');assert.equal(p.hours[0].chance,96);assert.equal(p.hours[1].chance,null);assert.equal(p.days[0].date,'2026-10-26');assert.equal(p.days[0].maxHourlyChance,100);
 const bad=structuredClone(raw);bad.hourly.precipitation_probability[0]=101;assert.equal(normalizeChance(bad,'time').hours[0].chance,null);
 bad.hourly.time.push(1793048400);assert.throws(()=>normalizeChance(bad,'time'),/Invalid/);
});
test('INAMHI remains an official daily forecast with unknown issue time and bounded validity',()=>{
 const d=normalizeInamhi([{fk_locality_id:901,locality_name:'Guayaquil',date:'2026-10-26',forecast:[{status:true,period_start:'2026-10-26T12:00:00-05:00',period_end:'2026-10-26T18:00:00-05:00',condition_name:'Parcial nublado dia'}]}],'2026-10-26T20:00:00Z');
 assert.equal(d.issuedAt,null);assert.equal(d.periods[0].description,'Partly cloudy');assert.equal(d.periods[0].original,'Parcial nublado dia');assert.throws(()=>normalizeInamhi([],'time'));
});
test('rain intensity preserves zero and unknown and uses explicit rate thresholds',()=>{
 assert.equal(intensity(null).label,'Not enough information');assert.equal(intensity(-1).label,'Not enough information');assert.equal(intensity(0).label,'No rain estimated');assert.equal(intensity(2.5).label,'Light rain estimated');assert.equal(intensity(7.6).label,'Moderate rain estimated');assert.equal(intensity(7.61).label,'Heavy rain estimated');
});
test('incomplete forecasts remain unknown and local rain rankings retain coverage and ties',()=>{
 const now=Date.parse('2026-10-26T20:00:00Z');const row=(id,rate)=>({sector:{id},fresh:true,assessment:{modelMm:rate},liveCell:{id:'shared',series:Array.from({length:6},(_,i)=>({time:new Date(now+(i+1)*3600000).toISOString(),mm:1}))}});
 const a=row('a',9),b=row('b',null);assert.equal(forecastRows([a],now)[0].assessment.forecastMm,6);a.liveCell.series[2].mm=null;assert.equal(forecastRows([a],now)[0].assessment.forecastMm,null);
 const r=strongestAreas([{id:'one',name:'One',sectorIds:['a','b']}],[a,b])[0];assert.equal(r.rate,9);assert.equal(r.known,1);assert.equal(r.total,2);assert.equal(r.heavy,1);
});
test('forecast comparisons reject receipt during the target hour and use later station evidence only as a report comparison',()=>{
 const st={id:'SEGU',observedAt:'2026-10-26T20:30:00Z',coordinates:[-79.9,-2.15],weather:'+TSRA'};
 const capture=at=>({checkedAt:at,weather:{retrievedAt:at,cells:[{coordinates:st.coordinates,series:[{time:'2026-10-26T21:00:00Z',mm:0}]}]}});
 assert.equal(evaluateRainReports([],{reports:[st]},[capture('2026-10-26T20:15:00Z')]).comparable,0);
 const result=evaluateRainReports([],{reports:[st]},[capture('2026-10-26T19:59:00Z')]);assert.equal(result.missed,1);assert.equal(result.rows[0].rain,true);
 const vicinity={...st,weather:'VCRA'};assert.equal(evaluateRainReports([],{reports:[vicinity]},[capture('2026-10-26T19:59:00Z')]).comparable,0);
});
test('station reports deduplicate and bulletins never become automatic incident confirmations',()=>{
 const r={icaoId:'SEGU',obsTime:1793044800,lon:-79.9,lat:-2.15,rawOb:'METAR fixture',wxString:'RA'};assert.equal(normalizeHistory([r,r],'time').reports.length,1);
 const n=normalizeBulletins([{id:1,date_gmt:'2026-10-22T20:00:00',link:'https://guayaquil.gob.ec/test/',title:{rendered:'Drainage works'}}],'time');assert.equal(n.items[0].impactVerified,false);
 assert.equal(normalizeBulletins([{id:2,date_gmt:'2026-10-22T20:00:00',link:'https://other.invalid/test/'}],'time').items.length,0);
});
test('recent impact mentions expire instead of following every future storm',()=>{
 const r={publishedAt:'2026-10-26T19:55:00Z',windowEnd:'2026-10-27T05:00:00Z'};assert.equal(recentReports([r],Date.parse('2026-10-26T20:00:00Z')).length,1);assert.equal(recentReports([r],Date.parse('2026-11-02T20:00:00Z')).length,0);assert.equal(recentReports([r],Date.parse('2026-10-25T20:00:00Z')).length,0);
});
