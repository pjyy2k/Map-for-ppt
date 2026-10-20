export const CONTINENTS = {'Asia':'아시아','Europe':'유럽','Africa':'아프리카','North America':'북아메리카','South America':'남아메리카','Oceania':'오세아니아','Antarctica':'남극','Seven seas (open ocean)':'기타 도서'};
export const MODES = {fill:'색칠',flag:'깃발',border:'테두리'};
export const COLORS = ['#176b58','#4788bd','#e2a84b','#d57464','#9b82bd','#343f4b'];
export const SIZE = {wide:[1280,720],standard:[1200,900],square:[1000,1000]};
export const DEFAULTS = {unit:'continent',scope:'world',country:'KOR',mode:'fill',accent:'#176b58',routeColor:'#b74820',baseColor:'#e3e9e7',lineColor:'#ffffff',lineWidth:1,markerSize:16,simplification:0,corners:'round',rounding:60,islandArea:0,province:'11',municipality:'11110',mapTitle:'',showLabels:false,legend:false,alaska:true,hawaii:true,greenland:true,antarctica:false,mainland:false,usInset:true,ratio:'wide',background:'#ffffff',transparent:true,resolution:3840};
export const initialSelections = () => ({country:{},continent:{},admin1:{},municipality:{},dong:{}});
export const collection = features => ({type:'FeatureCollection',features});
export const nameOf = f => {
 const p=f?.properties||{},lang=globalThis.document?.documentElement?.lang||'ko';
 if(p.iso2&&p.iso2.length===2&&!['IOA','ATC'].includes(p.id)){try{return new Intl.DisplayNames([lang],{type:'region'}).of(p.iso2);}catch{}}
 return lang==='ko'?(p.ko||p.name):(p.name||p.ko);
};
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
 if(!['country','continent','admin1','municipality','dong'].includes(settings.unit)||!['world','country',...Object.keys(CONTINENTS)].includes(settings.scope)||!Object.hasOwn(SIZE,settings.ratio)||!Object.hasOwn(MODES,settings.mode)||!/^\w{3}$/.test(settings.country)) throw Error('지원하지 않는 지도 설정입니다.');
 if(settings.mapTitle.length>100 || settings.lineWidth<.25 || settings.lineWidth>3 || settings.markerSize<8 || settings.markerSize>32 || ![1920,3840,7680].includes(settings.resolution)) throw Error('지도 설정이 허용 범위를 벗어났습니다.');
 if(['admin1','municipality','dong'].includes(settings.unit)) settings.scope='country';
 if(['municipality','dong'].includes(settings.unit))settings.country='KOR';
 if(!['round','angular'].includes(settings.corners)||settings.simplification<0||settings.simplification>100||settings.rounding<0||settings.rounding>100||settings.islandArea<0||settings.islandArea>100)throw Error('잘못된 지도 모양 설정입니다.');
 const selections={country:{},continent:{},admin1:{},municipality:{},dong:{}};
 for(const unit of Object.keys(selections)) {
  const items=data.selections[unit] || {};
  if(typeof items!=='object'||Array.isArray(items)||Object.keys(items).length>10000) throw Error('잘못된 지역 목록입니다.');
  for(const [id,s] of Object.entries(items)) {
   if(!/^[\w .()\-]{1,90}$/.test(id)||!s||!isColor(s.color)||!Object.hasOwn(MODES,s.mode)) throw Error('잘못된 지역 스타일입니다.');
   Object.defineProperty(selections[unit],id,{value:{color:s.color,mode:s.mode},enumerable:true,writable:true,configurable:true});
  }
 }
 const pins=(data.pins||[]).map(p=>{
  if(!p||typeof p.id!=='string'||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1||!Number.isFinite(p.size)||p.size<8||p.size>64||!isColor(p.color)||!['pin','flag','circle'].includes(p.shape)||typeof p.outline!=='boolean')throw Error('잘못된 핀 데이터입니다.');
  if(p.origin&&(!Number.isFinite(p.origin.x)||!Number.isFinite(p.origin.y)||p.origin.x<0||p.origin.x>1||p.origin.y<0||p.origin.y>1))throw Error('잘못된 경로 데이터입니다.');
  return {...(p.origin?{origin:{x:p.origin.x,y:p.origin.y}}:{}),id:p.id.slice(0,80),x:p.x,y:p.y,size:p.size,color:p.color,shape:p.shape,outline:p.outline};
 });
 if(pins.length>200||new Set(pins.map(p=>p.id)).size!==pins.length)throw Error('핀 개수 또는 ID가 잘못되었습니다.');
 return {settings,selections,pins};
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
 if(settings.islandArea>0&&polygons.length>1){const max=Math.max(...polygons.map(area)),cutoff=max*Math.pow(settings.islandArea/100,3)*0.08;polygons=polygons.filter(poly=>area(poly)>=cutoff);}
 if(settings.mainland&&polygons.length>1)polygons=[polygons.reduce((a,b)=>area(a)>=area(b)?a:b)];
 return {...feature,geometry:{type:'MultiPolygon',coordinates:polygons}};
}
export function filteredCountries(countries, settings) {
 return countries.filter(f=>settings.scope==='world'||(settings.scope==='country'?f.properties.id===settings.country:f.properties.continent===settings.scope));
}
