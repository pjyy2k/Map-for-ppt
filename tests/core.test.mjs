import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {DEFAULTS,initialSelections,validateProject,visibleFeature,filteredCountries} from '../public/core.js';
const read=file=>JSON.parse(fs.readFileSync(new URL('../public/data/'+file,import.meta.url)));
const countries=read('countries.geojson').features,manifest=read('manifest.json');
const context={};vm.runInNewContext(fs.readFileSync(new URL('../public/vendor/d3.min.js',import.meta.url),'utf8'),context);const d3=context.d3;
test('all map files have unique ids, valid D3 winding and nonempty geometry',()=>{
 assert.equal(countries.length,242);
 const ids=new Set();
 for(const f of countries){assert(!ids.has(f.properties.id));ids.add(f.properties.id);assert(d3.geoArea(f)>0&&d3.geoArea(f)<2*Math.PI,`country winding: ${f.properties.id}`);}
 let count=0;
 for(const [code,total] of Object.entries(manifest.admin1)){
  const regions=read(`admin1/${code}.geojson`).features;assert.equal(regions.length,total);
  for(const f of regions){count++;assert.equal(f.properties.country,code);assert(f.geometry.coordinates.length>0);assert(d3.geoArea(f)>0&&d3.geoArea(f)<2*Math.PI,`admin winding: ${f.properties.id}`);}
 }
 assert.equal(count,4596);
});
test('Korea provides 17 regions including Sejong and updated special provinces',()=>{
 const regions=read('admin1/KOR.geojson').features;assert.equal(regions.length,17);const names=regions.map(f=>f.properties.ko);for(const name of ['서울특별시','세종특별자치시','강원특별자치도','전북특별자치도','제주특별자치도'])assert(names.includes(name));
});
test('Alaska/Hawaii visibility removes polygons and states without mutating source',()=>{
 const usa=countries.find(f=>f.properties.id==='USA'),original=JSON.stringify(usa);
 const full=visibleFeature(usa,DEFAULTS),lower=visibleFeature(usa,{...DEFAULTS,alaska:false,hawaii:false});
 assert(lower.geometry.coordinates.length<full.geometry.coordinates.length);
 assert.equal(JSON.stringify(usa),original);
 const states=read('admin1/USA.geojson').features;
 assert.equal(states.map(f=>visibleFeature(f,{...DEFAULTS,alaska:false,hawaii:false})).filter(Boolean).length,49);
 const alaska=states.find(f=>f.properties.code==='US-AK');assert.equal(visibleFeature(alaska,{...DEFAULTS,alaska:false}),null);
 assert.equal(visibleFeature(countries.find(f=>f.properties.id==='GRL'),{...DEFAULTS,greenland:false}),null);
 assert.equal(visibleFeature(countries.find(f=>f.properties.id==='ATA'),DEFAULTS),null);
 assert.equal(visibleFeature(usa,{...DEFAULTS,mainland:true}).geometry.coordinates.length,1);
});
test('scope filters and project persistence retain individual colors and styles',()=>{
 const selected=initialSelections();selected.country.KOR={mode:'flag',color:'#ff1122'};
 const p=validateProject(JSON.parse(JSON.stringify({version:1,settings:DEFAULTS,selections:selected})));
 assert.deepEqual(p.selections.country.KOR,selected.country.KOR);
 assert.equal(filteredCountries(countries,{...DEFAULTS,scope:'country'}).length,1);
 assert(filteredCountries(countries,{...DEFAULTS,scope:'Asia'}).every(f=>f.properties.continent==='Asia'));
 assert.throws(()=>validateProject({version:3}));
 assert.throws(()=>validateProject({version:1,settings:{...DEFAULTS,resolution:1e9},selections:selected}));
 assert.throws(()=>validateProject({version:1,settings:{...DEFAULTS,accent:'url(https://example.com)'},selections:selected}));
 assert.equal(validateProject({version:1,settings:{...DEFAULTS,unit:'admin1'},selections:selected}).settings.scope,'country');
});
