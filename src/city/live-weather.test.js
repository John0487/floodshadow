import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {normalizeWeather,normalizeStation,stationCondition,liveRows,archivedForecastAt,sourceFresh,WEATHER_MAX_AGE} from './live-weather.js';
import {createLiveWeatherService} from '../../scripts/live-weather-service.mjs';
const time=Date.parse('2026-10-26T20:15:00Z');
const model=(value=1.8)=>[{latitude:-2.15,longitude:-79.9,current:{time:time/1000,interval:900,precipitation:value},current_units:{precipitation:'mm'},hourly_units:{precipitation:'mm'},hourly:{time:[time/1000],precipitation:[7]}}];
const station=(wx='+TSRA')=>[{icaoId:'SEGU',obsTime:time/1000,lon:-79.884,lat:-2.158,wxString:wx,rawOb:'METAR SEGU fixture '+wx}];
test('current model amount becomes an explicit equivalent rate; duplicate cells and missing values retain their meaning',()=>{
 const m=normalizeWeather([...model(),...model()],new Date(time).toISOString());
 assert.equal(m.cells.length,1);assert.equal(m.cells[0].currentMm,1.8);assert.equal(m.cells[0].rateMmH,7.2);
 assert.equal(normalizeWeather(model(null),'test').cells[0].rateMmH,null);
 assert.equal(normalizeWeather(model(-1),'test').cells[0].rateMmH,null);
 assert.equal(normalizeWeather(model(0),'test').cells[0].rateMmH,0);
 const bad=model();bad[0].current_units.precipitation='inch';assert.throws(()=>normalizeWeather(bad,'test'),/invalid/);
 const dup=model();dup[0].hourly.time.push(time/1000);assert.throws(()=>normalizeWeather(dup,'test'),/duplicate/);
});
test('airport rain, heavy rain, vicinity and absent reports do not become citywide observations',()=>{
 assert.equal(stationCondition(normalizeStation(station(),'test'),time).label,'Heavy rain reported at the airport');
 assert.equal(stationCondition(normalizeStation(station('VCRA'),'test'),time).label,'Rain reported near the airport');
 assert.equal(stationCondition(normalizeStation(station(''),'test'),time).rain,false);
 assert.equal(stationCondition(null,time).rain,null);
 assert.equal(stationCondition(normalizeStation(station(),'test'),time+91*60000).rain,null);
 assert.throws(()=>normalizeStation([], 'test'),/No valid/);
});
test('old, future-dated and distant weather never becomes fresh dry weather on the map',()=>{
 const p={weather:normalizeWeather(model(0),'test')};
 const sectors=[{id:'near',center:[-79.9,-2.15]},{id:'far',center:[-81,-3]}];
 const fresh=liveRows(sectors,p,time);assert.equal(fresh[0].assessment.modelMm,0);assert.equal(fresh[1].assessment.modelMm,null);
 assert.equal(liveRows(sectors,p,time+46*60000)[0].assessment.modelMm,null);
 assert.equal(sourceFresh(new Date(time+10*60000).toISOString(),time,WEATHER_MAX_AGE),false);
});
test('earlier forecast comparison uses the nearest covered cell and preserves receipt time and local hour ending',()=>{
 const st=normalizeStation(station(),'test');
 const event={id:'saved',status:'captured_forecast',forecast:{retrievedAt:'2026-10-25T23:34:20Z',grid:[{coordinates:st.coordinates,series:[{time:'2026-10-26T16:00',mm:1.2}]}]}};
 const result=archivedForecastAt([event],st);assert.equal(result.mm,1.2);assert.equal(result.hourEnding,'2026-10-26T21:00:00.000Z');
 const late=structuredClone(event);late.forecast.retrievedAt='2026-10-27T00:00:00Z';assert.equal(archivedForecastAt([late],st),null);
});
test('weather service coalesces callers, caches, archives and survives an independent source failure without changing its timestamp',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'floodshadow-live-')),directory=pathToFileURL(folder+'/');let now=time,calls=0,fail=false;
 const fetcher=async url=>{calls++;if(fail&&url.includes('open-meteo'))throw Error('fixture offline');return {ok:true,json:async()=>url.includes('open-meteo')?model():station()};};
 try{const service=createLiveWeatherService({directory,fetcher,clock:()=>now});
 const [a,b]=await Promise.all([service.get(),service.get()]);assert.deepEqual(a,b);assert.equal(calls,2);await service.get();assert.equal(calls,2);
 fail=true;now+=301000;const c=await service.get();assert.equal(c.errors.length,1);assert.equal(c.weather.retrievedAt,a.weather.retrievedAt);assert.equal(c.station.retrievedAt,new Date(now).toISOString());
 assert.equal((await readdir(folder)).filter(n=>n.startsWith('capture-')).length,2);
 const disk=JSON.parse(await readFile(join(folder,'latest.json'),'utf8'));assert.equal(disk.errors[0].source,'weather');
 // A new server can recover retained data even if both external sources fail.
 now+=301000;const offline=createLiveWeatherService({directory,clock:()=>now,fetcher:async()=>{throw Error('all offline');}});const d=await offline.get();assert.equal(d.errors.length,2);assert.equal(d.weather.retrievedAt,a.weather.retrievedAt);
 }finally{await rm(folder,{recursive:true,force:true});}
});
