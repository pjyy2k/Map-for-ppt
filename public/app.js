import {CONTINENTS, MODES, COLORS, SIZE, DEFAULTS, initialSelections, collection, nameOf, validateProject, visibleFeature, filteredCountries} from './core.mjs';
const $=id=>document.getElementById(id), d3=window.d3, STORAGE='map-for-ppt:v1';
let settings={...DEFAULTS},selections=initialSelections(),countries=[],manifest={},current=[],items=[],allItems=[],adminCache={},loadToken=0,ready=false,zoom={k:1,x:0,y:0},drawn=[],path,projection,toastTimer,saveTimer,focusFeatures=null;
const svg=d3.select('#map');
const notify=message=>{$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);};
const selection=()=>selections[settings.unit];
const styleFor=id=>selection()[id];
const keyFor=f=>settings.unit==='continent'?f.properties.continent:f.properties.id;
const dimensions=()=>SIZE[settings.ratio];
const currentSelections=()=>allItems.filter(f=>styleFor(f.id));
function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(STORAGE,JSON.stringify({version:1,settings,selections}));}catch{/* Storage may be unavailable in private browsing. */}},200);}
async function getJSON(url) {const response=await fetch(url);if(!response.ok)throw Error(`지도 파일을 읽을 수 없습니다 (${response.status}).`);return response.json();}
function syncControls(){
 for(const key of Object.keys(DEFAULTS)){const el=$(key);if(!el)continue;if(el.type==='checkbox')el.checked=settings[key];else el.value=settings[key];}
 $('lineWidthValue').textContent=settings.lineWidth;$('markerSizeValue').textContent=settings.markerSize;
 document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===settings.mode);b.setAttribute('aria-pressed',String(b.dataset.mode===settings.mode));});
 document.querySelectorAll('[data-color]').forEach(b=>b.classList.toggle('active',b.dataset.color===settings.accent));
 $('countryField').hidden=settings.scope!=='country';$('scope').disabled=settings.unit==='admin1';
 $('mapStage').style.aspectRatio=dimensions().join('/');$('aspectTag').textContent={wide:'16:9',standard:'4:3',square:'1:1'}[settings.ratio];
 $('mapStage').style.backgroundColor=settings.transparent?'#ffffff':settings.background;
 $('mapStage').style.backgroundImage=settings.transparent?'':'none';
}
async function changeView(){
 const token=++loadToken;ready=false;$('loading').hidden=false;$('loading').textContent='지도를 준비하고 있어요…';$('regionList').setAttribute('aria-busy','true');
 $('downloadPng').disabled=true;$('downloadSvg').disabled=true;
 try{
  if(settings.unit==='admin1'){
   if(!manifest.admin1[settings.country])throw Error('이 국가에는 시도 단위 데이터가 없습니다. 다른 국가나 선택 단위를 골라주세요.');
   if(!adminCache[settings.country])adminCache[settings.country]=(await getJSON(`data/admin1/${settings.country}.geojson`)).features;
   if(token!==loadToken)return;
   current=adminCache[settings.country];
  }else current=filteredCountries(countries,settings);
  if(token!==loadToken)return;
  current=current.map(f=>visibleFeature(f,settings)).filter(Boolean);focusFeatures=null;
  if(settings.unit==='continent'){
   const groups=[...new Set(current.map(f=>f.properties.continent))];
   items=groups.map(c=>({id:c,name:CONTINENTS[c]||c,en:c}));
  }else items=current.map(f=>({id:f.properties.id,name:nameOf(f),en:f.properties.name}));
  items.sort((a,b)=>a.name.localeCompare(b.name,'ko'));
  allItems=settings.unit==='continent'?Object.entries(CONTINENTS).map(([id,name])=>({id,name,en:id})):
   settings.unit==='country'?countries.map(f=>({id:f.properties.id,name:nameOf(f),en:f.properties.name})):
   adminCache[settings.country].map(f=>({id:f.properties.id,name:nameOf(f),en:f.properties.name}));
  $('viewName').textContent=settings.scope==='world'?'세계 지도':settings.scope==='country'?(nameOf(countries.find(f=>f.properties.id===settings.country))+' 지도'):(CONTINENTS[settings.scope]+' 지도');
  syncControls();ready=true;resetZoom();renderList();renderSelected();renderMap();persist();
  $('loading').hidden=true;$('downloadPng').disabled=false;$('downloadSvg').disabled=false;
 }catch(e){if(token!==loadToken)return;$('loading').textContent=e.message;$('regionList').replaceChildren();$('listCount').textContent='지역 없음';notify(e.message);}
 finally{if(token===loadToken)$('regionList').setAttribute('aria-busy','false');}
}
function queryItems(){const q=$('search').value.trim().toLocaleLowerCase();return items.filter(i=>!q||`${i.name} ${i.en} ${i.id}`.toLocaleLowerCase().includes(q));}
function renderList(){
 const list=$('regionList');list.replaceChildren();const filtered=queryItems();$('listCount').textContent=`${filtered.length}개 지역`;
 if(!filtered.length){const p=document.createElement('p');p.className='empty';p.textContent='검색 결과가 없습니다.';list.append(p);return;}
 for(const item of filtered){const label=document.createElement('label');label.className='region-row'+(styleFor(item.id)?' is-selected':'');const input=document.createElement('input');input.type='checkbox';input.checked=!!styleFor(item.id);input.addEventListener('change',()=>toggleRegion(item.id));const text=document.createElement('span');text.textContent=item.name;const code=document.createElement('small');code.textContent=settings.unit==='country'?item.id:'';label.append(input,text,code);list.append(label);}
}
function toggleRegion(id){if(styleFor(id))delete selection()[id];else selection()[id]={color:settings.accent,mode:settings.mode};renderList();renderSelected();renderMap();persist();}
function renderSelected(){
 const selected=currentSelections();$('selectedCount').textContent=selected.length;const parent=$('selectedRegions');parent.replaceChildren();
 const visibleIds=new Set(items.map(f=>f.id));
 if(!selected.length){const p=document.createElement('p');p.className='empty';p.textContent='왼쪽 목록이나 지도에서 강조할 지역을 선택하세요.';parent.append(p);return;}
 for(const item of selected){const s=styleFor(item.id),row=document.createElement('div');row.className='selected-item';const color=document.createElement('input');color.type='color';color.value=s.color;color.setAttribute('aria-label',item.name+' 색상');color.addEventListener('input',()=>{s.color=color.value;renderMap();persist();});const name=document.createElement('span');name.textContent=item.name+(visibleIds.has(item.id)?'':' · 숨김');name.title=visibleIds.has(item.id)?item.name:'현재 범위나 표시 옵션에서 숨겨져 있습니다.';const mode=document.createElement('select');mode.setAttribute('aria-label',item.name+' 강조 방식');for(const [v,t]of Object.entries(MODES)){const option=document.createElement('option');option.value=v;option.textContent=t;mode.append(option);}mode.value=s.mode;mode.addEventListener('change',()=>{s.mode=mode.value;renderMap();persist();});const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label',item.name+' 선택 해제');remove.addEventListener('click',()=>toggleRegion(item.id));row.append(color,name,mode,remove);parent.append(row);}
}
function makeProjection(features){
 const [w,h]=dimensions(),top=settings.mapTitle?95:42,bottom=settings.legend?100:40;
 const data=collection(features);
 let proj;
 if(settings.scope==='world')proj=d3.geoEqualEarth();
 else if(settings.scope==='country'&&settings.country==='USA'&&settings.usInset)proj=d3.geoAlbersUsa();
 else{
  const center=d3.geoCentroid(data);
  proj=d3.geoMercator().rotate([-center[0],0]);
 }
 proj.fitExtent([[35,top],[w-35,h-bottom]],data);
 return proj;
}
function text(group,x,y,value,size=15,fill='#314f43',anchor='middle') {return group.append('text').attr('x',x).attr('y',y).attr('text-anchor',anchor).attr('font-size',size).attr('fill',fill).text(value);}
function featurePoint(f){
 const p=f.properties.point;
 if(p&&p.every(Number.isFinite)){
  const projected=projection(p);
  if(projected&&projected.every(Number.isFinite)&&d3.geoContains(f,p))return projected;
 }
 return path.centroid(f);
}
function labelForGroup(features){
 // Largest projected polygon gives a useful marker when labels lie outside a simplified boundary.
 const f=features.reduce((a,b)=>path.area(a)>path.area(b)?a:b);
 return featurePoint(f);
}
function renderMap(){
 if(!ready)return;
 const [w,h]=dimensions();svg.attr('viewBox',`0 0 ${w} ${h}`);svg.selectAll('*').remove();svg.append('title').text(settings.mapTitle||$('viewName').textContent);
 const defs=svg.append('defs');defs.append('clipPath').attr('id','mapClip').append('rect').attr('x',0).attr('y',settings.mapTitle?72:0).attr('width',w).attr('height',h-(settings.mapTitle?72:0)-(settings.legend?86:0));
 svg.append('rect').attr('width',w).attr('height',h).attr('fill',settings.transparent?'none':settings.background).attr('data-background','true');
 if(!current.length){text(svg,w/2,h/2,'현재 범위에 표시할 지역이 없습니다.',20);return;}
 projection=makeProjection(focusFeatures||current);path=d3.geoPath(projection);
 const clipGroup=svg.append('g').attr('clip-path','url(#mapClip)');const g=clipGroup.append('g').attr('data-map-layer','true');drawn=[];
 const regions=g.append('g');
 for(const f of current){const id=keyFor(f),s=styleFor(id),d=path(f);if(!d)continue;drawn.push(f);
  const shape=regions.append('path').attr('d',d).attr('class','region').attr('fill',s?.mode==='fill'?s.color:settings.baseColor).attr('stroke',settings.lineColor).attr('stroke-width',settings.lineWidth).attr('stroke-linejoin','round').attr('data-id',id).attr('tabindex',0).attr('role','checkbox').attr('aria-label',settings.unit==='continent'?(CONTINENTS[id]||id):nameOf(f)).attr('aria-checked',String(!!s));
  shape.append('title').text(settings.unit==='continent'?(CONTINENTS[id]||id):nameOf(f));
  shape.on('click',e=>{if(dragDistance<5){toggleRegion(id);$('tooltip').hidden=true;}}).on('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleRegion(id);}}).on('pointermove',e=>{if(dragging)return;$('tooltip').textContent=(settings.unit==='continent'?(CONTINENTS[id]||id):nameOf(f))+(s?' · 선택됨':'');$('tooltip').hidden=false;$('tooltip').style.left=Math.min(e.clientX+12,window.innerWidth-210)+'px';$('tooltip').style.top=Math.min(e.clientY+14,window.innerHeight-45)+'px';}).on('pointerleave',()=>{$('tooltip').hidden=true;});
 }
 // Separate outline layer keeps selected borders above neighbouring region fills.
 const borders=g.append('g').attr('pointer-events','none');
 for(const f of drawn){const s=styleFor(keyFor(f));if(s?.mode==='border')borders.append('path').attr('d',path(f)).attr('fill','none').attr('stroke',s.color).attr('stroke-width',Math.max(2.5,settings.lineWidth*3)).attr('stroke-linejoin','round');}
 const markers=g.append('g').attr('pointer-events','none'),grouped=d3.group(drawn,keyFor);
 for(const [id,features]of grouped){const s=styleFor(id);if(!s)continue;
  const xy=labelForGroup(features);if(!xy||!xy.every(Number.isFinite))continue;const [x,y]=xy,size=settings.markerSize;
  if(s.mode==='flag'){const marker=markers.append('g').attr('transform',`translate(${x},${y})`).attr('data-marker',id);marker.append('path').attr('d',`M 0 2 V ${-size*1.7} L ${size*1.4} ${-size*1.45} L 0 ${-size*.85}`).attr('stroke',s.color).attr('stroke-width',2.5).attr('fill',s.color).attr('stroke-linejoin','round');marker.append('circle').attr('r',3).attr('fill',s.color).attr('stroke','#fff').attr('stroke-width',1);}
  if(settings.showLabels){const label=settings.unit==='continent'?(CONTINENTS[id]||id):nameOf(features[0]);text(markers,x,y+(s.mode==='flag'?18:4),label,14).attr('paint-order','stroke').attr('stroke','#fff').attr('stroke-width',3).attr('stroke-linejoin','round');}
 }
 applyZoom();
 if(settings.mapTitle)text(svg,36,43,settings.mapTitle,26,'#233c35','start').attr('font-weight',650);
 if(settings.legend)renderLegend(svg,w,h,grouped);
}
function renderLegend(group,w,h,grouped){
 const entries=currentSelections().filter(i=>grouped.has(i.id));
 const maxChars=Math.max(...entries.map(i=>i.name.length),5),colWidth=Math.min(270,Math.max(140,maxChars*12+28)),cols=Math.max(1,Math.floor((w-72)/colWidth)),max=cols*2;
 const visible=entries.slice(0,max),start=h-58;
 visible.forEach((i,n)=>{const x=36+(n%cols)*colWidth,y=start+Math.floor(n/cols)*24,s=styleFor(i.id);group.append('rect').attr('x',x).attr('y',y-10).attr('width',10).attr('height',10).attr('fill',s.mode==='border'?'none':s.color).attr('stroke',s.color);text(group,x+17,y,i.name.length>18?i.name.slice(0,17)+'…':i.name,12,'#53685e','start');});
 if(entries.length>max)text(group,w-30,h-10,`외 ${entries.length-max}개 지역`,10,'#788c7e','end');
}
function applyZoom(){svg.select('[data-map-layer]').attr('transform',`translate(${zoom.x},${zoom.y}) scale(${zoom.k})`);$('zoomValue').textContent=Math.round(zoom.k*100)+'%';}
function resetZoom(){zoom={k:1,x:0,y:0};applyZoom();}
function zoomBy(factor){if(!ready)return;const [w,h]=dimensions(),next=Math.max(.5,Math.min(10,zoom.k*factor)),ratio=next/zoom.k;zoom.x=w/2-(w/2-zoom.x)*ratio;zoom.y=h/2-(h/2-zoom.y)*ratio;zoom.k=next;applyZoom();}
let dragging=false,dragDistance=0,dragStart=null;
$('map').addEventListener('pointerdown',e=>{if(!ready||e.button!==0)return;dragging=true;dragDistance=0;dragStart={x:e.clientX,y:e.clientY,zx:zoom.x,zy:zoom.y};});
window.addEventListener('pointermove',e=>{if(!dragging)return;const rect=$('map').getBoundingClientRect(),dx=e.clientX-dragStart.x,dy=e.clientY-dragStart.y;dragDistance=Math.hypot(dx,dy);if(dragDistance>=5){$('map').classList.add('dragging');zoom.x=dragStart.zx+dx*dimensions()[0]/rect.width;zoom.y=dragStart.zy+dy*dimensions()[1]/rect.height;applyZoom();$('tooltip').hidden=true;}});
window.addEventListener('pointerup',()=>{dragging=false;$('map').classList.remove('dragging');});window.addEventListener('pointercancel',()=>{dragging=false;});
function applyStyle(key,value){settings[key]=value;for(const s of Object.values(selection()))s[key==='accent'?'color':'mode']=value;syncControls();renderSelected();renderMap();persist();}
function download(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function exportSvg(){const node=$('map').cloneNode(true),[w,h]=dimensions();node.setAttribute('xmlns','http://www.w3.org/2000/svg');node.setAttribute('width',w);node.setAttribute('height',h);node.querySelectorAll('[tabindex]').forEach(el=>{el.removeAttribute('tabindex');el.removeAttribute('role');el.removeAttribute('aria-checked');el.classList.remove('region');});node.querySelectorAll('text').forEach(el=>el.setAttribute('font-family','Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif'));return new Blob([new XMLSerializer().serializeToString(node)],{type:'image/svg+xml;charset=utf-8'});}
$('downloadSvg').addEventListener('click',()=>{if(!ready)return;download(exportSvg(),'map-for-ppt.svg');notify('SVG를 다운로드했습니다.');});
$('downloadPng').addEventListener('click',async()=>{
 if(!ready)return;const button=$('downloadPng');button.disabled=true;button.textContent='PNG 만드는 중…';
 const url=URL.createObjectURL(exportSvg()),[exportWidth,exportHeight]=dimensions(),exportResolution=settings.resolution;
 try{
  await document.fonts?.ready;
  const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('지도를 이미지로 변환하지 못했습니다. SVG 다운로드를 이용해 주세요.'));img.src=url;});
  const canvas=document.createElement('canvas');canvas.width=exportResolution;canvas.height=Math.round(exportResolution*exportHeight/exportWidth);const ctx=canvas.getContext('2d');if(!ctx)throw Error('이 브라우저에서 PNG 변환을 지원하지 않습니다.');ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('메모리가 부족합니다. PNG 크기를 낮춰 다시 시도해 주세요.');download(blob,`map-for-ppt-${canvas.width}x${canvas.height}.png`);notify(`${canvas.width} × ${canvas.height} PNG를 다운로드했습니다.`);
 }catch(e){notify(e.message);}finally{URL.revokeObjectURL(url);button.disabled=!ready;button.textContent='↓  PNG 다운로드';}
});
for(const key of ['unit','scope','country','alaska','hawaii','greenland','antarctica','mainland','usInset'])$(key).addEventListener('change',()=>{
 const el=$(key);settings[key]=el.type==='checkbox'?el.checked:el.value;
 if(settings.unit==='admin1'){settings.scope='country';if(!manifest.admin1[settings.country])settings.country='KOR';}
 if(settings.scope==='Antarctica')settings.antarctica=true;
 $('search').value='';syncControls();changeView();
});
for(const key of ['baseColor','lineColor','lineWidth','markerSize','mapTitle','showLabels','legend','ratio','background','transparent','resolution'])$(key).addEventListener(['color','range','text'].includes($(key).type)?'input':'change',()=>{const el=$(key);settings[key]=el.type==='checkbox'?el.checked:typeof DEFAULTS[key]==='number'?Number(el.value):el.value;syncControls();if(key==='ratio')resetZoom();renderMap();persist();});
$('accent').addEventListener('input',()=>applyStyle('accent',$('accent').value));
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>applyStyle('mode',b.dataset.mode)));
for(const color of COLORS){const b=document.createElement('button');b.style.background=color;b.dataset.color=color;b.setAttribute('aria-label',`강조 색상 ${color}`);b.addEventListener('click',()=>applyStyle('accent',color));$('swatches').append(b);}
$('search').addEventListener('input',renderList);
$('selectAll').addEventListener('click',()=>{if(!ready)return;for(const i of queryItems())selection()[i.id]={color:settings.accent,mode:settings.mode};renderList();renderSelected();renderMap();persist();});
$('clearAll').addEventListener('click',()=>{if(!ready)return;for(const i of queryItems())delete selection()[i.id];renderList();renderSelected();renderMap();persist();});
$('zoomIn').addEventListener('click',()=>zoomBy(1.25));$('zoomOut').addEventListener('click',()=>zoomBy(.8));$('fit').addEventListener('click',()=>{focusFeatures=null;resetZoom();renderMap();});
$('fitSelection').addEventListener('click',()=>{const features=current.filter(f=>styleFor(keyFor(f)));if(!features.length){notify('현재 지도에서 강조할 지역을 먼저 선택하세요.');return;}focusFeatures=features;resetZoom();renderMap();});
$('reset').addEventListener('click',()=>{settings={...DEFAULTS};selections={country:{},continent:{},admin1:{}};$('search').value='';syncControls();changeView();notify('지도 설정과 선택을 초기화했습니다.');});
$('saveProject').addEventListener('click',()=>download(new Blob([JSON.stringify({version:1,settings,selections},null,2)],{type:'application/json'}),'map-for-ppt-project.json'));
$('loadProject').addEventListener('click',()=>$('projectFile').click());
$('projectFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2*1024*1024)throw Error('작업 파일은 2 MB 이하만 불러올 수 있습니다.');const result=validateProject(JSON.parse(await file.text()));if(!countries.some(f=>f.properties.id===result.settings.country))throw Error('지원하지 않는 국가입니다.');settings=result.settings;selections=result.selections;$('search').value='';syncControls();await changeView();notify('작업 파일을 불러왔습니다.');}catch(err){notify(err instanceof SyntaxError?'올바른 JSON 파일이 아닙니다.':err.message);}finally{e.target.value='';}});
async function init(){
 try{
  [countries,manifest]=await Promise.all([getJSON('data/countries.geojson').then(d=>d.features),getJSON('data/manifest.json')]);
  try{const saved=localStorage.getItem(STORAGE);if(saved){const restored=validateProject(JSON.parse(saved));if(countries.some(f=>f.properties.id===restored.settings.country)){settings=restored.settings;selections=restored.selections;}}}catch{/* Ignore incompatible or unavailable local storage. */}
  const sorted=[...countries].sort((a,b)=>nameOf(a).localeCompare(nameOf(b),'ko'));
  for(const f of sorted){const option=document.createElement('option');option.value=f.properties.id;option.textContent=nameOf(f)+(manifest.admin1[f.properties.id]?'':' (시도 데이터 없음)');$('country').append(option);}
  syncControls();await changeView();
 }catch(e){$('loading').textContent='지도 데이터를 불러오지 못했습니다. 연결을 확인하고 새로고침해 주세요.';notify(e.message);}
}
init();
