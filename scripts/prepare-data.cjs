/* Rebuild from downloaded Natural Earth GeoJSON; see README for source URLs. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const mapshaper = require('mapshaper');
const [countriesFile, adminFile] = process.argv.slice(2);
if (!countriesFile || !adminFile) throw Error('Usage: node scripts/prepare-data.cjs countries.geojson admin1.geojson');
const out = path.resolve(__dirname, '../public/data');
fs.mkdirSync(path.join(out, 'admin1'), {recursive:true});
const load = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const collection = features => ({type:'FeatureCollection', features});
async function simplify(data, percentage) {
 const result = await mapshaper.applyCommands(`-i input.geojson -simplify ${percentage}% keep-shapes -o output.geojson precision=0.001`, {'input.geojson': JSON.stringify(data)});
 const output = JSON.parse(result['output.geojson']);
 // Mapshaper exports RFC 7946 counterclockwise outer rings; D3 uses clockwise.
 for (const f of output.features) {
  const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
  for (const polygon of polygons) for (const ring of polygon) ring.reverse();
 }
 return output;
}
(async () => {
 const sourceCountries = load(countriesFile);
 const countries = sourceCountries.features.map(f => {
  const p=f.properties;
  return {...f, properties:{id:p.ADM0_A3,name:p.NAME_EN||p.NAME,ko:p.NAME_KO||p.NAME,continent:p.CONTINENT,iso2:p.ISO_A2_EH,point:[p.LABEL_X,p.LABEL_Y]}};
 });
 fs.writeFileSync(path.join(out,'countries.geojson'),JSON.stringify(await simplify(collection(countries),35)));
 const admins = load(adminFile).features.map(f => {
  const p=f.properties;
  const ko = {'KOR-2496':'강원특별자치도','KOR-2499':'전북특별자치도'}[p.adm1_code] || p.name_ko;
  return {...f,properties:{id:p.adm1_code,country:p.adm0_a3,name:p.name_en||p.name||p.adm1_code,ko:ko||p.name,point:[p.longitude,p.latitude],code:p.iso_3166_2}};
 });
 // Simplify all regions together so neighbouring administrative boundaries share arcs.
 const simplified=await simplify(collection(admins),12);
 const grouped={};
 for(const f of simplified.features) (grouped[f.properties.country]??=[]).push(f);
 for(const [code,features] of Object.entries(grouped)) fs.writeFileSync(path.join(out,'admin1',`${code}.geojson`),JSON.stringify(collection(features)));
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({source:'Natural Earth',prepared:'2026-10-19',countryCount:countries.length,admin1Count:admins.length,admin1:Object.fromEntries(Object.entries(grouped).map(([k,v])=>[k,v.length])),sha256:{countries:crypto.createHash('sha256').update(fs.readFileSync(countriesFile)).digest('hex'),admin1:crypto.createHash('sha256').update(fs.readFileSync(adminFile)).digest('hex')}},null,2));
 console.log(`Prepared ${countries.length} countries/territories, ${admins.length} regions across ${Object.keys(grouped).length} countries/territories.`);
})().catch(e=>{console.error(e);process.exit(1)});
