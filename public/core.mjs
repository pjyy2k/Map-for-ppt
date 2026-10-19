export const CONTINENTS = {'Asia':'아시아','Europe':'유럽','Africa':'아프리카','North America':'북아메리카','South America':'남아메리카','Oceania':'오세아니아','Antarctica':'남극','Seven seas (open ocean)':'기타 도서'};
export const MODES = {fill:'색칠',flag:'깃발',border:'테두리'};
export const COLORS = ['#176b58','#4788bd','#e2a84b','#d57464','#9b82bd','#343f4b'];
export const SIZE = {wide:[1280,720],standard:[1200,900],square:[1000,1000]};
export const DEFAULTS = {unit:'country',scope:'world',country:'KOR',mode:'fill',accent:'#176b58',baseColor:'#e3e9e7',lineColor:'#ffffff',lineWidth:1,markerSize:16,mapTitle:'',showLabels:false,legend:false,alaska:true,hawaii:true,greenland:true,antarctica:false,mainland:false,usInset:true,ratio:'wide',background:'#ffffff',transparent:true,resolution:3840};
export const initialSelections = () => ({country:Object.fromEntries(['KOR','JPN','USA','DEU'].map(id=>[id,{color:'#176b58',mode:'fill'}])),continent:{},admin1:{}});
export const collection = features => ({type:'FeatureCollection',features});
export const nameOf = f => f.properties.ko || f.properties.name;
export const isColor = c => typeof c==='string' && /^#[a-f\d]{6}$/i.test(c);
export function validateProject(data) {
 if (!data || data.version!==1 || !data.settings || !data.selections) throw Error('Map for PPT 작업 파일이 아닙니다.');
 const settings={...DEFAULTS};
 for(const k of Object.keys(DEFAULTS)) {
  const v=data.settings[k], def=DEFAULTS[k];
  if(v===undefined) continue;
  if(typeof v!==typeof def) throw Error('작업 파일의 설정 형식이 잘못되었습니다.');
  if(k.toLowerCase().includes('color') || ['accent','background'].includes(k)) {if(!isColor(v)) throw Error('잘못된 색상입니다.');}
  if(typeof v==='number'&&!Number.isFinite(v)) throw Error('잘못된 숫자입니다.');
  settings[k]=v;
 }
 if(!['country','continent','admin1'].includes(settings.unit)||!['world','country',...Object.keys(CONTINENTS)].includes(settings.scope)||!Object.hasOwn(SIZE,settings.ratio)||!Object.hasOwn(MODES,settings.mode)||!/^\w{3}$/.test(settings.country)) throw Error('지원하지 않는 지도 설정입니다.');
 if(settings.mapTitle.length>100 || settings.lineWidth<.25 || settings.lineWidth>3 || settings.markerSize<8 || settings.markerSize>32 || ![1920,3840,7680].includes(settings.resolution)) throw Error('지도 설정이 허용 범위를 벗어났습니다.');
 if(settings.unit==='admin1') settings.scope='country';
 const selections={country:{},continent:{},admin1:{}};
 for(const unit of Object.keys(selections)) {
  const items=data.selections[unit] || {};
  if(typeof items!=='object'||Array.isArray(items)||Object.keys(items).length>10000) throw Error('잘못된 지역 목록입니다.');
  for(const [id,s] of Object.entries(items)) {
   if(!/^[\w .()\-]{1,90}$/.test(id)||!s||!isColor(s.color)||!Object.hasOwn(MODES,s.mode)) throw Error('잘못된 지역 스타일입니다.');
   Object.defineProperty(selections[unit],id,{value:{color:s.color,mode:s.mode},enumerable:true,writable:true,configurable:true});
  }
 }
 return {settings,selections};
}
export function polygonCenter(poly) {
 const ring=poly[0];
 let x=0,y=0;
 for (const p of ring) {x+=p[0]; y+=p[1];}
 return [x/ring.length,y/ring.length];
}
function area(poly) {const r=poly[0];let a=0;for(let i=1;i<r.length;i++)a+=r[i-1][0]*r[i][1]-r[i][0]*r[i-1][1];return Math.abs(a);}
export function visibleFeature(feature, settings) {
 const p=feature.properties, id=p.id;
 if((id==='GRL'&&!settings.greenland)||(id==='ATA'&&!settings.antarctica)) return null;
 if(p.country==='USA'&&((p.code==='US-AK'&&!settings.alaska)||(p.code==='US-HI'&&!settings.hawaii))) return null;
 let polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
 if(id==='USA') polygons=polygons.filter(poly=>{
  const [x,y]=polygonCenter(poly);
  if(!settings.alaska&&y>50&&(x<-130||x>170))return false;
  if(!settings.hawaii&&y<30&&x<-150)return false;
  return true;
 });
 if(!polygons.length)return null;
 if(settings.mainland&&polygons.length>1)polygons=[polygons.reduce((a,b)=>area(a)>=area(b)?a:b)];
 return {...feature,geometry:{type:'MultiPolygon',coordinates:polygons}};
}
export function filteredCountries(countries, settings) {
 return countries.filter(f=>settings.scope==='world'||(settings.scope==='country'?f.properties.id===settings.country:f.properties.continent===settings.scope));
}
