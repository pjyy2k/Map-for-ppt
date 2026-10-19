const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),mapshaper=require('mapshaper');
const input=process.argv[2];if(!input)throw Error('Usage: node scripts/prepare-korea.cjs input.geojson');
const out=path.resolve(__dirname,'../public/data/korea');fs.mkdirSync(path.join(out,'dong'),{recursive:true});
const raw=fs.readFileSync(input,'utf8');
async function run(commands,data){const r=await mapshaper.applyCommands('-i input.geojson '+commands+' -o output.geojson precision=0.0001',{'input.geojson':typeof data==='string'?data:JSON.stringify(data)});return JSON.parse(r['output.geojson']);}
function rewind(data){for(const f of data.features){const ps=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;for(const p of ps)for(const r of p)r.reverse();}return data;}
function write(file,data){fs.writeFileSync(path.join(out,file),JSON.stringify(rewind(data)));}
(async()=>{
 const detail=await run('-simplify 12% keep-shapes',raw);
 const cities=await run('-dissolve sgg copy-fields=sido,sidonm,sggnm',detail);
 const provinces=await run('-dissolve sido copy-fields=sidonm',detail);
 const ne=JSON.parse(fs.readFileSync(path.resolve(out,'../admin1/KOR.geojson'))).features;
 const aliases={'강원특별자치도':'KOR-2496','전북특별자치도':'KOR-2499'};
 const provinceIndex=provinces.features.map(f=>({code:f.properties.sido,name:f.properties.sidonm,id:aliases[f.properties.sidonm]||ne.find(x=>x.properties.ko===f.properties.sidonm)?.properties.id}));
 if(provinceIndex.some(x=>!x.id))throw Error('Unmatched Korean province');
 const cityIndex=cities.features.map(f=>({code:f.properties.sgg,province:f.properties.sido,name:f.properties.sggnm}));
 const transform=(f,level)=>{const p=f.properties;let id,name;if(level===1){id=provinceIndex.find(x=>x.code===p.sido).id;name=p.sidonm;}else if(level===2){id='KR2-'+p.sgg;name=p.sggnm;}else{id='KR3-'+p.adm_cd2;name=p.adm_nm.split(' ').slice(2).join(' ')||p.adm_nm;}
 f.properties={id,country:'KOR',name,ko:name,province:p.sido,city:p.sgg||null,fullName:p.adm_nm||[p.sidonm,p.sggnm].filter(Boolean).join(' '),code:level===1?'KR-'+p.sido:id};return f;};
 provinces.features.forEach(f=>transform(f,1));cities.features.forEach(f=>transform(f,2));detail.features.forEach(f=>transform(f,3));
 write('provinces.geojson',provinces);write('municipalities.geojson',cities);
 const grouped={};for(const f of detail.features)(grouped[f.properties.city]??=[]).push(f);
 for(const [code,features] of Object.entries(grouped))write('dong/'+code+'.geojson',{type:'FeatureCollection',features});
 fs.writeFileSync(path.join(out,'index.json'),JSON.stringify({date:'2025-01-01',source:'Statistics Korea SGIS / vuski/admdongkor',sourceUrl:'https://github.com/vuski/admdongkor/tree/master/ver20250101',license:'CC-BY-4.0 / KOGL Type 1',sha256:crypto.createHash('sha256').update(raw).digest('hex'),provinces:provinceIndex,cities:cityIndex,dongCount:detail.features.length,dongCounts:Object.fromEntries(Object.entries(grouped).map(([k,v])=>[k,v.length]))},null,2));
 console.log({provinces:provinces.features.length,cities:cities.features.length,dongs:detail.features.length});
})().catch(e=>{console.error(e);process.exit(1)});
