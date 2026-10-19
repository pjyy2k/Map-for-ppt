import {CONTINENTS,MODES,COLORS,SIZE,DEFAULTS,initialSelections,collection,nameOf,validateProject,visibleFeature,filteredCountries} from './core.js?v=3';
import {createEditablePptx} from './export.js?v=3';
import {initLanguage,language,t,continentName} from './i18n.js?v=3';
const $=id=>document.getElementById(id),d3=window.d3,STORAGE='map-for-ppt:v1';
const EXPORTS=['downloadPng','downloadSvg','downloadPptx','downloadRegions','downloadSingle'];
const CREDIT='통계청 SGIS · vuski/admdongkor (CC BY 4.0) · 2025-01-01 · 경계 간소화';
let settings={...DEFAULTS},selections=initialSelections(),pins=[],countries=[],manifest={},korea={},provinceData=[],cityData=[],current=[],rawCurrent=[],items=[],allItems=[],adminCache={},dongCache={};
let step=1,loadToken=0,ready=false,zoom={k:1,x:0,y:0},drawn=[],path,projection,toastTimer,saveTimer,focusIds=null,weightedTopology=null,geometryKey='',pinMode=false,selectedPinId=null,copiedPin=null;
let dragging=false,dragDistance=0,dragStart=null,dragPinId=null;
const busy=new Set(),svg=d3.select('#map');
const selection=()=>selections[settings.unit];
const styleFor=id=>selection()[id];
const keyFor=f=>settings.unit==='continent'?f.properties.continent:f.properties.id;
const dimensions=()=>SIZE[settings.ratio];
const currentSelections=()=>allItems.filter(i=>styleFor(i.id));
const isKorea=()=>settings.scope==='country'&&settings.country==='KOR'&&['admin1','municipality','dong'].includes(settings.unit);
function notify(message){if(language()!=='ko'&&/[가-힣]/.test(message))message=t('error');$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function project(){return {version:1,settings,selections,pins};}
function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(STORAGE,JSON.stringify(project()));}catch{/* Private browsing can disable storage. */}},200);}
async function getJSON(url){const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(`지도 파일을 읽을 수 없습니다 (${response.status}).`);return response.json();}
function setStep(value,focus=false){
  step=Math.max(1,Math.min(3,value));document.querySelector('.workspace').dataset.currentStep=String(step);
  document.querySelectorAll('[data-step-panel]').forEach(el=>{el.hidden=Number(el.dataset.stepPanel)!==step;});
  document.querySelectorAll('[data-step-to]').forEach(el=>{const n=Number(el.dataset.stepTo);if(n===step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');el.classList.toggle('completed',n<step);});
  $('previousStep').hidden=step===1;$('nextStep').hidden=step===3;$('nextStep').textContent=(step===1?t('style'):t('download'))+' →';
  $('stepHint').textContent=step===3?t('exportQuestion'):t('help');
  $('selectionDetails').hidden=step!==2;pinMode=false;svg.classed('pin-mode',false);$('addPin').classList.remove('active');
  if(focus)$('step'+step).querySelector('h2').focus({preventScroll:true});
  if(ready)renderPins();
}
function syncEnabled(){
  for(const id of EXPORTS)$(id).disabled=!ready||busy.has(id);
  $('nextStep').disabled=!ready;
  $('koreaMap').disabled=!ready;$('worldMap').disabled=!ready;
}
function syncControls(){
  for(const key of Object.keys(DEFAULTS)){const el=$(key);if(!el)continue;if(el.type==='checkbox')el.checked=settings[key];else el.value=settings[key];}
  for(const key of ['lineWidth','markerSize','simplification','islandArea'])$(key+'Value').textContent=settings[key];
  document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===settings.mode);b.setAttribute('aria-pressed',String(b.dataset.mode===settings.mode));});
  document.querySelectorAll('[data-color]').forEach(b=>{b.classList.toggle('active',b.dataset.color===settings.accent);b.setAttribute('aria-label',t('color')+' '+b.dataset.color);});
  $('koreaMap').classList.toggle('active',isKorea());$('worldMap').classList.toggle('active',!isKorea());
  $('scopeField').hidden=isKorea()||settings.unit==='admin1';$('countryField').hidden=settings.scope!=='country'||isKorea();
  $('provinceField').hidden=!['municipality','dong'].includes(settings.unit);$('municipalityField').hidden=settings.unit!=='dong';
  $('scope').disabled=['admin1','municipality','dong'].includes(settings.unit);
  $('backgroundField').hidden=settings.transparent;
  $('mapStage').style.aspectRatio=dimensions().join('/');$('aspectTag').textContent={wide:'16:9',standard:'4:3',square:'1:1'}[settings.ratio];
  $('mapStage').style.backgroundColor=settings.transparent?'#ffffff':settings.background;$('mapStage').style.backgroundImage=settings.transparent?'':'none';
  const cityOptions=korea.cities?.filter(c=>c.province===settings.province)||[];
  if(!cityOptions.some(c=>c.code===settings.municipality)&&cityOptions.length)settings.municipality=cityOptions[0].code;
  const old=$('municipality').value;$('municipality').replaceChildren();
  for(const city of cityOptions){const option=document.createElement('option');option.value=city.code;option.textContent=city.name;$('municipality').append(option);}
  $('municipality').value=settings.municipality;
  syncEnabled();
}
function addCrumb(label,action){const b=document.createElement('button');b.textContent=label;b.addEventListener('click',action);if($('breadcrumbs').children.length){const s=document.createElement('span');s.textContent='›';$('breadcrumbs').append(s);}$('breadcrumbs').append(b);}
function renderBreadcrumbs(){
  $('breadcrumbs').replaceChildren();
  if(isKorea()){
    addCrumb(t('korea'),()=>goKorea('admin1'));
    if(['municipality','dong'].includes(settings.unit))addCrumb(korea.provinces.find(p=>p.code===settings.province)?.name||'시도',()=>goKorea('municipality'));
    if(settings.unit==='dong')addCrumb(korea.cities.find(c=>c.code===settings.municipality)?.name||'시군구',()=>goKorea('dong'));
  }else{
    addCrumb(t('world'),goWorld);
    if(settings.scope!=='world'&&settings.scope!=='country')addCrumb(continentName(settings.scope),()=>{});
    if(settings.scope==='country')addCrumb(nameOf(countries.find(f=>f.properties.id===settings.country)),()=>{});
  }
}
async function changeView(){
  const token=++loadToken;ready=false;syncEnabled();$('loading').hidden=false;$('loading').textContent=t('loading');$('regionList').setAttribute('aria-busy','true');
  try{
    if(isKorea()){
      if(settings.unit==='admin1')rawCurrent=provinceData;
      else if(settings.unit==='municipality')rawCurrent=cityData.filter(f=>f.properties.province===settings.province);
      else{if(!dongCache[settings.municipality])dongCache[settings.municipality]=(await getJSON(`data/korea/dong/${settings.municipality}.geojson`)).features;if(token!==loadToken)return false;rawCurrent=dongCache[settings.municipality];}
    }else if(settings.unit==='admin1'){
      if(!manifest.admin1[settings.country])throw Error('이 국가에는 시도 데이터가 없습니다. 다른 국가를 선택해 주세요.');
      if(!adminCache[settings.country])adminCache[settings.country]=(await getJSON(`data/admin1/${settings.country}.geojson`)).features;
      if(token!==loadToken)return false;rawCurrent=adminCache[settings.country];
    }else rawCurrent=filteredCountries(countries,settings);
    if(token!==loadToken)return false;
    rawCurrent=rawCurrent.map(f=>visibleFeature(f,settings)).filter(Boolean);focusIds=null;geometryKey='';
    weightedTopology=rawCurrent.length?window.topojson.presimplify(window.topojson.topology({regions:collection(rawCurrent)})):null;
    if(settings.unit==='continent')items=[...new Set(rawCurrent.map(f=>f.properties.continent))].map(c=>({id:c,name:continentName(c),en:c}));
    else items=rawCurrent.map(f=>({id:f.properties.id,name:nameOf(f),en:f.properties.name,fullName:f.properties.fullName}));
    items.sort((a,b)=>a.name.localeCompare(b.name,'ko'));
    allItems=settings.unit==='continent'?Object.entries(CONTINENTS).map(([id])=>({id,name:continentName(id),en:id})):settings.unit==='country'?countries.map(f=>({id:f.properties.id,name:nameOf(f),en:f.properties.name})):items;
    $('viewName').textContent=isKorea()?({admin1:t('states'),municipality:t('cities'),dong:t('dongs')}[settings.unit]):settings.scope==='world'?t('world'):settings.scope==='country'?nameOf(countries.find(f=>f.properties.id===settings.country)):continentName(settings.scope);
    ready=true;syncControls();resetZoom();renderBreadcrumbs();renderList();renderSelected();renderMap();renderExportRegions();persist();$('loading').hidden=true;return true;
  }catch(e){if(token!==loadToken)return false;ready=false;$('loading').textContent=e.name==='TimeoutError'?'로딩 시간이 길어지고 있어요. 연결을 확인한 뒤 다시 선택해 주세요.':e.message;$('regionList').replaceChildren();$('listCount').textContent='지역 없음';notify(e.message);return false;}
  finally{if(token===loadToken){$('regionList').setAttribute('aria-busy','false');syncEnabled();}}
}
function queryItems(){const q=$('search').value.trim().toLocaleLowerCase();return items.filter(i=>!q||`${i.name} ${i.en} ${i.id} ${i.fullName||''}`.toLocaleLowerCase().includes(q));}
function canDrill(item){return settings.unit==='continent'||(settings.unit==='country'&&!!manifest.admin1[item.id])||(isKorea()&&['admin1','municipality'].includes(settings.unit));}
function drill(id){
  if(settings.unit==='continent'){settings.scope=id;settings.unit='country';}
  else if(settings.unit==='country'){settings.country=id;settings.scope='country';settings.unit='admin1';}
  else if(settings.unit==='admin1'&&isKorea()){settings.province=provinceData.find(f=>f.properties.id===id).properties.province;settings.unit='municipality';}
  else if(settings.unit==='municipality'){settings.municipality=cityData.find(f=>f.properties.id===id).properties.city;settings.unit='dong';}
  $('search').value='';syncControls();changeView();
}
function renderList(){
  const list=$('regionList');list.replaceChildren();const filtered=queryItems();$('listCount').textContent=`${filtered.length} ${t('count')}`;
  if(!filtered.length){const p=document.createElement('p');p.className='empty';p.textContent=t('noResults');list.append(p);return;}
  for(const item of filtered){const row=document.createElement('div');row.className='region-row'+(styleFor(item.id)?' is-selected':'');const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=!!styleFor(item.id);input.addEventListener('change',()=>toggleRegion(item.id));const span=document.createElement('span');span.textContent=item.name;label.append(input,span);row.append(label);
    if(canDrill(item)){const b=document.createElement('button');b.className='drill-button';b.textContent='›';b.setAttribute('aria-label',item.name+' ›');b.addEventListener('click',()=>drill(item.id));row.append(b);}list.append(row);
  }
}
function toggleRegion(id){if(styleFor(id))delete selection()[id];else selection()[id]={color:settings.accent,mode:settings.mode};renderList();renderSelected();renderMap();renderExportRegions();persist();}
function renderSelected(){
  const selected=currentSelections(),visibleIds=new Set(items.map(i=>i.id));$('selectedCount').textContent=selected.length;$('selectionSummary').textContent=`${t('selected')} ${selected.filter(i=>visibleIds.has(i.id)).length}`;
  const parent=$('selectedRegions');parent.replaceChildren();
  if(!selected.length){const p=document.createElement('p');p.className='empty';p.textContent=t('noSelection');parent.append(p);return;}
  for(const item of selected){const s=styleFor(item.id),row=document.createElement('div');row.className='selected-item';const color=document.createElement('input');color.type='color';color.value=s.color;color.setAttribute('aria-label',item.name+' '+t('color'));color.addEventListener('input',()=>{s.color=color.value;renderMap();persist();});const name=document.createElement('span');name.textContent=item.name+(visibleIds.has(item.id)?'':' · '+t('hidden'));const mode=document.createElement('select');mode.setAttribute('aria-label',item.name+' '+t('style'));for(const [value,label]of Object.entries(MODES)){const option=document.createElement('option');option.value=value;option.textContent=t(value);mode.append(option);}mode.value=s.mode;mode.addEventListener('change',()=>{s.mode=mode.value;renderMap();persist();});const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label',item.name+' '+t('clear'));remove.addEventListener('click',()=>toggleRegion(item.id));row.append(color,name,mode,remove);parent.append(row);}
}
function smoothTopology(topo){
  return {...topo,arcs:topo.arcs.map(arc=>{
    if(arc.length<3)return arc;
    const result=[arc[0]];
    for(let i=0;i<arc.length-1;i++){const a=arc[i],b=arc[i+1];result.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75]);}
    result.push(arc.at(-1));return result;
  })};
}
function updateGeometry(){
  const key=`${settings.simplification}:${settings.corners}`;if(geometryKey===key)return;
  if(!weightedTopology){current=[];return;}
  let topo=window.topojson.simplify(weightedTopology,settings.simplification?window.topojson.quantile(weightedTopology,1-settings.simplification*.009):0);
  if(settings.corners==='round')topo=smoothTopology(topo);
  current=window.topojson.feature(topo,topo.objects.regions).features;
  // Preserve tiny regions if simplification removes every usable polygon.
  current=current.map((f,i)=>d3.geoArea(f)>1e-12?f:rawCurrent[i]);geometryKey=key;
}
function makeProjection(features){
  const [w,h]=dimensions(),data=collection(features),top=settings.mapTitle?95:38,bottom=(settings.legend?96:35)+(isKorea()?18:0);
  let proj;if(settings.scope==='world')proj=d3.geoEqualEarth();else if(settings.scope==='country'&&settings.country==='USA'&&settings.usInset)proj=d3.geoAlbersUsa();else{const center=d3.geoCentroid(data);proj=d3.geoMercator().rotate([-center[0],0]);}
  return proj.fitExtent([[35,top],[w-35,h-bottom]],data);
}
function text(group,x,y,value,size=15,fill='#314f43',anchor='middle'){return group.append('text').attr('x',x).attr('y',y).attr('text-anchor',anchor).attr('font-size',size).attr('fill',fill).text(value);}
function featurePoint(f){const p=f.properties.point;if(p&&p.every(Number.isFinite)){const xy=projection(p);if(xy&&xy.every(Number.isFinite)&&d3.geoContains(f,p))return xy;}return path.centroid(f);}
function labelPoint(features,id){
  const centers={'Asia':[85,35],'Europe':[16,52],'Africa':[20,3],'North America':[-100,45],'South America':[-60,-15],'Oceania':[135,-25],'Antarctica':[0,-80]};
  if(settings.unit==='continent'&&centers[id])return projection(centers[id]);
  return featurePoint(features.reduce((a,b)=>path.area(a)>path.area(b)?a:b));
}
function renderMap(){
  if(!ready)return;updateGeometry();const [w,h]=dimensions();svg.attr('viewBox',`0 0 ${w} ${h}`).attr('aria-label',settings.mapTitle||$('viewName').textContent);svg.selectAll('*').remove();svg.append('title').text(settings.mapTitle||$('viewName').textContent);
  if(isKorea())svg.append('metadata').text('Derived from Statistics Korea SGIS (KOGL Type 1), modified by vuski/admdongkor (CC BY 4.0), 2025-01-01. Simplified by Map for PPT. https://github.com/vuski/admdongkor');
  const titleHeight=settings.mapTitle?72:0,footerHeight=(settings.legend?86:0)+(isKorea()?20:0);
  svg.append('defs').append('clipPath').attr('id','mapClip').append('rect').attr('width',w).attr('y',titleHeight).attr('height',h-titleHeight-footerHeight);
  svg.append('rect').attr('width',w).attr('height',h).attr('fill',settings.transparent?'none':settings.background).attr('data-background','true');
  if(!current.length){text(svg,w/2,h/2,t('noResults'),20);return;}
  const fit=focusIds?current.filter(f=>focusIds.has(keyFor(f))):current;projection=makeProjection(fit.length?fit:current);path=d3.geoPath(projection);
  const g=svg.append('g').attr('clip-path','url(#mapClip)').append('g').attr('data-map-layer','true');drawn=[];
  const regions=g.append('g');
  for(const f of current){const id=keyFor(f),s=styleFor(id),d=path(f);if(!d)continue;drawn.push(f);
    const shape=regions.append('path').attr('d',d).attr('class','region').attr('fill',s?.mode==='fill'?s.color:settings.baseColor).attr('stroke',settings.lineColor).attr('stroke-width',settings.lineWidth).attr('stroke-linejoin',settings.corners==='round'?'round':'miter').attr('data-id',id).attr('tabindex',0).attr('role','checkbox').attr('aria-label',settings.unit==='continent'?(continentName(id)):nameOf(f)).attr('aria-checked',String(!!s));
    shape.append('title').text(settings.unit==='continent'?(continentName(id)):nameOf(f));
    shape.on('click',()=>{if(!pinMode&&dragDistance<5){toggleRegion(id);$('tooltip').hidden=true;}}).on('dblclick',()=>{if(!pinMode&&canDrill({id}))drill(id);}).on('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleRegion(id);}}).on('pointermove',e=>{if(dragging||pinMode)return;$('tooltip').textContent=(settings.unit==='continent'?(continentName(id)):nameOf(f))+(s?' · '+t('selected'):'');$('tooltip').hidden=false;$('tooltip').style.left=Math.max(5,Math.min(e.clientX+12,window.innerWidth-210))+'px';$('tooltip').style.top=Math.min(e.clientY+14,window.innerHeight-45)+'px';}).on('pointerleave',()=>{$('tooltip').hidden=true;});
  }
  const borders=g.append('g').attr('pointer-events','none');for(const f of drawn){const s=styleFor(keyFor(f));if(s?.mode==='border')borders.append('path').attr('d',path(f)).attr('fill','none').attr('stroke',s.color).attr('stroke-width',Math.max(2.5,settings.lineWidth*3)).attr('stroke-linejoin',settings.corners==='round'?'round':'miter');}
  const markers=g.append('g').attr('pointer-events','none'),grouped=d3.group(drawn,keyFor);
  for(const [id,features]of grouped){const s=styleFor(id);if(!s)continue;const xy=labelPoint(features,id);if(!xy||!xy.every(Number.isFinite))continue;const [x,y]=xy,size=settings.markerSize;
    if(s.mode==='flag'){const marker=markers.append('g').attr('transform',`translate(${x},${y})`).attr('data-marker',id);marker.append('path').attr('d',`M0 2 V${-size*1.7} L${size*1.4} ${-size*1.45} L0 ${-size*.85}`).attr('stroke',s.color).attr('stroke-width',2.5).attr('fill',s.color).attr('stroke-linejoin','round');marker.append('circle').attr('r',3).attr('fill',s.color).attr('stroke','#fff').attr('stroke-width',1);}
    if(settings.showLabels)text(markers,x,y+(s.mode==='flag'?18:4),settings.unit==='continent'?(continentName(id)):nameOf(features[0]),14).attr('paint-order','stroke').attr('stroke','#fff').attr('stroke-width',3).attr('stroke-linejoin','round');
  }
  applyZoom();if(settings.mapTitle)text(svg,36,43,settings.mapTitle,26,'#233c35','start').attr('font-weight',650);if(settings.legend)renderLegend(grouped,w,h-(isKorea()?20:0));
  renderPins();if(isKorea())text(svg,20,h-9,CREDIT,9,'#718077','start');
}
function renderLegend(grouped,w,h){
  const entries=currentSelections().filter(i=>grouped.has(i.id)),maxChars=Math.max(...entries.map(i=>i.name.length),5),colWidth=Math.min(270,Math.max(140,maxChars*12+28)),cols=Math.max(1,Math.floor((w-72)/colWidth)),max=cols*2;
  entries.slice(0,max).forEach((i,n)=>{const x=36+n%cols*colWidth,y=h-58+Math.floor(n/cols)*24,s=styleFor(i.id);svg.append('rect').attr('x',x).attr('y',y-10).attr('width',10).attr('height',10).attr('fill',s.mode==='border'?'none':s.color).attr('stroke',s.color);text(svg,x+17,y,i.name.length>18?i.name.slice(0,17)+'…':i.name,12,'#53685e','start');});
  if(entries.length>max)text(svg,w-30,h-10,`외 ${entries.length-max}개 지역`,10,'#788c7e','end');
}
function applyZoom(){svg.select('[data-map-layer]').attr('transform',`translate(${zoom.x},${zoom.y}) scale(${zoom.k})`);$('zoomValue').textContent=Math.round(zoom.k*100)+'%';}
function resetZoom(){zoom={k:1,x:0,y:0};applyZoom();}
function zoomBy(factor){if(!ready)return;const [w,h]=dimensions(),next=Math.max(.5,Math.min(10,zoom.k*factor)),ratio=next/zoom.k;zoom.x=w/2-(w/2-zoom.x)*ratio;zoom.y=h/2-(h/2-zoom.y)*ratio;zoom.k=next;applyZoom();}
function pointFromEvent(e){const rect=$('map').getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height))};}
function renderPins(){
  svg.select('[data-pins-layer]').remove();const layer=svg.append('g').attr('data-pins-layer','true'),[w,h]=dimensions();
  for(const pin of pins){const g=layer.append('g').attr('data-pin',pin.id).attr('transform',`translate(${pin.x*w},${pin.y*h})`).attr('role','button').attr('tabindex',0).attr('aria-label',t('pin')).classed('pin-selected',pin.id===selectedPinId),s=pin.size,stroke=pin.outline?'#ffffff':'none';
    if(pin.shape==='pin'){g.append('path').attr('d',`M0 0 C${-s*.35} ${-s*.55} ${-s*.7} ${-s*.8} ${-s*.7} ${-s*1.22} C${-s*.7} ${-s*2.18} ${s*.7} ${-s*2.18} ${s*.7} ${-s*1.22} C${s*.7} ${-s*.8} ${s*.35} ${-s*.55} 0 0 Z`).attr('fill',pin.color).attr('stroke',stroke).attr('stroke-width',1.8);g.append('circle').attr('cy',-s*1.25).attr('r',s*.24).attr('fill','#fff');}
    else if(pin.shape==='flag')g.append('path').attr('d',`M0 0 V${-s*1.8} L${s*1.4} ${-s*1.55} L0 ${-s*.9} Z M0 ${-s*.9} V0`).attr('fill',pin.color).attr('stroke',pin.outline?'#fff':pin.color).attr('stroke-width',2);
    else g.append('circle').attr('r',s*.65).attr('fill',pin.color).attr('stroke',stroke).attr('stroke-width',2);
    g.on('click',e=>{e.stopPropagation();selectPin(pin.id);}).on('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectPin(pin.id);}});
    if(pin.id===selectedPinId&&step===2)g.append('circle').attr('r',s*.85).attr('cy',pin.shape==='pin'?-s:0).attr('fill','none').attr('stroke','#176b58').attr('stroke-width',1.3).attr('stroke-dasharray','4 3').attr('pointer-events','none').attr('data-editor','true');
  }
}
function selectPin(id){selectedPinId=id;const p=pins.find(p=>p.id===id);$('pinEditor').hidden=!p;$('pinCount').textContent=`${t('pins')} · ${pins.length}`;if(p){for(const [id,key]of [['pinShape','shape'],['pinColor','color'],['pinSize','size']])$(id).value=p[key];$('pinOutline').checked=p.outline;$('pinSizeValue').textContent=p.size;if(step!==2)setStep(2);$('pinEditor').closest('details').open=true;}renderPins();}
function addPin(position,source=null){if(pins.length>=200){notify('핀은 최대 200개까지 추가할 수 있어요.');return;}const pin={id:'pin-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),x:position.x,y:position.y,size:source?.size||24,color:source?.color||'#d57464',shape:source?.shape||'pin',outline:source?.outline??true};pins.push(pin);selectPin(pin.id);persist();}
function duplicatePin(){const p=pins.find(p=>p.id===selectedPinId);if(p)addPin({x:Math.min(.98,p.x+.025),y:Math.min(.98,p.y+.025)},p);}
$('map').addEventListener('pointerdown',e=>{
  if(!ready||e.button!==0)return;const pin=e.target.closest('[data-pin]');dragDistance=0;dragPinId=pin?.getAttribute('data-pin')||null;
  if(dragPinId){selectPin(dragPinId);dragging=true;}else if(!pinMode)dragging=true;else return;
  dragStart={x:e.clientX,y:e.clientY,zx:zoom.x,zy:zoom.y};
});
window.addEventListener('pointermove',e=>{
  if(!dragging)return;const dx=e.clientX-dragStart.x,dy=e.clientY-dragStart.y;dragDistance=Math.hypot(dx,dy);if(dragDistance<5)return;
  if(dragPinId){const p=pins.find(p=>p.id===dragPinId);if(p){Object.assign(p,pointFromEvent(e));renderPins();}}
  else{const rect=$('map').getBoundingClientRect();$('map').classList.add('dragging');zoom.x=dragStart.zx+dx*dimensions()[0]/rect.width;zoom.y=dragStart.zy+dy*dimensions()[1]/rect.height;applyZoom();}$('tooltip').hidden=true;
});
window.addEventListener('pointerup',()=>{if(dragPinId)persist();dragging=false;dragPinId=null;$('map').classList.remove('dragging');});
window.addEventListener('pointercancel',()=>{dragging=false;dragPinId=null;});
$('map').addEventListener('click',e=>{if(pinMode&&dragDistance<5){addPin(pointFromEvent(e));pinMode=false;svg.classed('pin-mode',false);$('addPin').classList.remove('active');$('canvasHelp').textContent=t('canvasHint');}});
window.addEventListener('keydown',e=>{
  if(e.target.matches?.('input,textarea,select,[contenteditable=true]'))return;
  const p=pins.find(p=>p.id===selectedPinId);
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='c'&&p){copiedPin={...p};e.preventDefault();notify(t('done')+' Ctrl/Cmd+V');}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='v'&&copiedPin){e.preventDefault();setStep(2);addPin({x:Math.min(.98,copiedPin.x+.03),y:Math.min(.98,copiedPin.y+.03)},copiedPin);}
  if((e.key==='Delete'||e.key==='Backspace')&&p){e.preventDefault();pins=pins.filter(pin=>pin.id!==p.id);selectPin(null);persist();}
  if(e.key==='Escape'){pinMode=false;selectedPinId=null;svg.classed('pin-mode',false);renderPins();}
});
function applyStyle(key,value){settings[key]=value;for(const s of Object.values(selection()))s[key==='accent'?'color':'mode']=value;syncControls();renderSelected();renderMap();persist();}
function download(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function cleanSvg(){const node=$('map').cloneNode(true),[w,h]=dimensions();node.setAttribute('xmlns','http://www.w3.org/2000/svg');node.setAttribute('width',w);node.setAttribute('height',h);node.querySelectorAll('[data-editor]').forEach(el=>el.remove());node.querySelectorAll('[tabindex]').forEach(el=>{el.removeAttribute('tabindex');el.removeAttribute('role');el.removeAttribute('aria-checked');el.removeAttribute('class');});node.querySelectorAll('text').forEach(el=>el.setAttribute('font-family','Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif'));return node;}
function svgBlob(node=cleanSvg()){return new Blob([new XMLSerializer().serializeToString(node)],{type:'image/svg+xml;charset=utf-8'});}
async function exportAction(id,label,fn){if(!ready||busy.has(id))return;busy.add(id);const b=$(id),old=b.textContent;b.textContent=label;syncEnabled();try{await fn();}catch(e){notify(e.message);}finally{busy.delete(id);b.textContent=old;syncEnabled();}}
$('downloadSvg').addEventListener('click',()=>{if(ready){download(svgBlob(),'map-for-ppt.svg');notify(t('done'));}});
$('downloadPng').addEventListener('click',()=>exportAction('downloadPng',t('busy'),async()=>{
  const [w,h]=dimensions(),resolution=settings.resolution,url=URL.createObjectURL(svgBlob());
  try{await document.fonts?.ready;const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('이미지 변환에 실패했습니다. SVG를 이용해 주세요.'));img.src=url;});const canvas=document.createElement('canvas');canvas.width=resolution;canvas.height=Math.round(resolution*h/w);const ctx=canvas.getContext('2d');if(!ctx)throw Error('PNG 변환을 지원하지 않는 브라우저입니다.');ctx.drawImage(img,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('메모리가 부족합니다. 해상도를 낮춰주세요.');download(blob,`map-for-ppt-${canvas.width}x${canvas.height}.png`);notify(`${t('done')} ${canvas.width} × ${canvas.height} PNG`);}finally{URL.revokeObjectURL(url);}
}));
$('downloadPptx').addEventListener('click',()=>exportAction('downloadPptx',t('busy'),async()=>{const [w,h]=dimensions();download(await createEditablePptx(cleanSvg(),w,h),'map-for-ppt-editable.pptx');notify(t('done'));}));
function renderExportRegions(){const select=$('singleRegion'),previous=select.value;select.replaceChildren();for(const item of items){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;select.append(option);}if(items.length)select.value=items.some(i=>i.id===previous)?previous:items[0].id;}
function regionSvg(id){
  const features=current.filter(f=>keyFor(f)===id);if(!features.length)throw Error('지역을 먼저 선택해 주세요.');
  const node=document.createElementNS('http://www.w3.org/2000/svg','svg');node.setAttribute('xmlns','http://www.w3.org/2000/svg');
  let [[x0,y0],[x1,y1]]=path.bounds(collection(features));const regionStyle=styleFor(id);if(regionStyle?.mode==='flag'){const [x,y]=labelPoint(features,id),s=settings.markerSize;x0=Math.min(x0,x-4);x1=Math.max(x1,x+s*1.4+4);y0=Math.min(y0,y-s*1.7-4);y1=Math.max(y1,y+4);}const w=Math.max(20,x1-x0)+30,h=Math.max(20,y1-y0)+30+(isKorea()?20:0);node.setAttribute('viewBox',`${x0-15} ${y0-15} ${w} ${h}`);node.setAttribute('width',1280);node.setAttribute('height',Math.round(1280*h/w));
  const g=d3.select(node),s=styleFor(id);for(const f of features)g.append('path').attr('d',path(f)).attr('fill',s?.mode==='fill'?s.color:settings.baseColor).attr('stroke',s?.mode==='border'?s.color:settings.lineColor).attr('stroke-width',s?.mode==='border'?Math.max(2.5,settings.lineWidth*3):settings.lineWidth).attr('stroke-linejoin',settings.corners==='round'?'round':'miter');
  if(s?.mode==='flag'){const [x,y]=labelPoint(features,id),size=settings.markerSize;g.append('path').attr('d',`M${x} ${y} V${y-size*1.7} L${x+size*1.4} ${y-size*1.45} L${x} ${y-size*.85}`).attr('stroke',s.color).attr('stroke-width',2).attr('fill',s.color);}
  if(isKorea())text(g,x0,y0+h-20,CREDIT,Math.min(9,w/65),'#718077','start').attr('font-family','sans-serif');
  return svgBlob(node);
}
const filename=i=>(i.name||i.id).replace(/[^\p{L}\p{N}._-]/gu,'_')+'-'+i.id+'.svg';
$('downloadSingle').addEventListener('click',()=>{if(ready){const item=items.find(i=>i.id===$('singleRegion').value);if(item)download(regionSvg(item.id),filename(item));}});
$('downloadRegions').addEventListener('click',()=>exportAction('downloadRegions',t('busy'),async()=>{
  const chosen=items.filter(i=>styleFor(i.id)),targets=chosen.length?chosen:items,zip=new window.JSZip();if(!targets.length)throw Error('다운로드할 지역이 없습니다.');
  for(const item of targets)zip.file(filename(item),await regionSvg(item.id).arrayBuffer());zip.file('README.txt',`Map for PPT\n${isKorea()?CREDIT+'\nhttps://github.com/vuski/admdongkor\n':'Natural Earth world boundaries\n'}SVG files are independent editable vector maps. Free-position pins are included in the full SVG/PPTX, not these region files.`);download(new Blob([await zip.generateAsync({type:'uint8array',compression:'DEFLATE'})],{type:'application/zip'}),'map-for-ppt-regions.zip');notify(`${t('done')} ${targets.length} SVG`);
}));
function goWorld(){if(!ready)return;settings.unit='country';settings.scope='world';$('search').value='';syncControls();changeView();}
function goKorea(unit='admin1'){if(!ready)return;settings.country='KOR';settings.scope='country';settings.unit=unit;$('search').value='';syncControls();changeView();}
$('worldMap').addEventListener('click',goWorld);$('koreaMap').addEventListener('click',()=>goKorea());
for(const key of ['unit','scope','country','province','municipality','alaska','hawaii','greenland','antarctica','mainland','usInset','islandArea'])$(key).addEventListener('change',()=>{
  if(!ready)return;const el=$(key);settings[key]=el.type==='checkbox'?el.checked:typeof DEFAULTS[key]==='number'?Number(el.value):el.value;
  if(['municipality','dong'].includes(settings.unit)){settings.country='KOR';settings.scope='country';}
  if(settings.unit==='admin1'){settings.scope='country';if(!manifest.admin1[settings.country])settings.country='KOR';}
  if(settings.scope==='Antarctica')settings.antarctica=true;
  $('search').value='';syncControls();changeView();
});
for(const key of ['baseColor','lineColor','lineWidth','markerSize','mapTitle','showLabels','legend','ratio','background','transparent','resolution','simplification','corners'])$(key).addEventListener(['color','range','text'].includes($(key).type)?'input':'change',()=>{const el=$(key);settings[key]=el.type==='checkbox'?el.checked:typeof DEFAULTS[key]==='number'?Number(el.value):el.value;syncControls();if(key==='ratio')resetZoom();renderMap();persist();});
$('accent').addEventListener('input',()=>applyStyle('accent',$('accent').value));document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>applyStyle('mode',b.dataset.mode)));
for(const color of COLORS){const b=document.createElement('button');b.style.background=color;b.dataset.color=color;b.setAttribute('aria-label',`강조 색상 ${color}`);b.addEventListener('click',()=>applyStyle('accent',color));$('swatches').append(b);}
$('search').addEventListener('input',renderList);
for(const [id,selected]of [['selectAll',true],['clearAll',false]])$(id).addEventListener('click',()=>{if(!ready)return;for(const i of queryItems()){if(selected)selection()[i.id]={color:settings.accent,mode:settings.mode};else delete selection()[i.id];}renderList();renderSelected();renderMap();persist();});
$('zoomIn').addEventListener('click',()=>zoomBy(1.25));$('zoomOut').addEventListener('click',()=>zoomBy(.8));$('fit').addEventListener('click',()=>{focusIds=null;resetZoom();renderMap();});
$('fitSelection').addEventListener('click',()=>{const selected=items.filter(i=>styleFor(i.id));if(!selected.length){notify('강조할 지역을 먼저 선택해 주세요.');return;}focusIds=new Set(selected.map(i=>i.id));resetZoom();renderMap();});
$('nextStep').addEventListener('click',()=>{if(ready)setStep(step+1,true);});$('previousStep').addEventListener('click',()=>setStep(step-1,true));document.querySelectorAll('[data-step-to]').forEach(b=>b.addEventListener('click',()=>{if(ready){setStep(Number(b.dataset.stepTo),true);renderPins();}}));
$('addPin').addEventListener('click',()=>{pinMode=!pinMode;svg.classed('pin-mode',pinMode);$('addPin').classList.toggle('active',pinMode);$('canvasHelp').textContent=pinMode?t('canvasHint'):t('canvasHint');});
$('duplicatePin').addEventListener('click',duplicatePin);$('deletePin').addEventListener('click',()=>{pins=pins.filter(p=>p.id!==selectedPinId);selectPin(null);persist();});
for(const [id,key]of [['pinShape','shape'],['pinColor','color'],['pinSize','size'],['pinOutline','outline']])$(id).addEventListener(id==='pinColor'||id==='pinSize'?'input':'change',()=>{const p=pins.find(p=>p.id===selectedPinId);if(!p)return;p[key]=id==='pinOutline'?$(id).checked:id==='pinSize'?Number($(id).value):$(id).value;$('pinSizeValue').textContent=p.size;renderPins();persist();});
$('reset').addEventListener('click',()=>{settings={...DEFAULTS};selections=initialSelections();pins=[];selectedPinId=null;copiedPin=null;$('search').value='';setStep(1);syncControls();selectPin(null);changeView();$('reset').closest('details').open=false;notify(t('done'));});
$('saveProject').addEventListener('click',()=>download(new Blob([JSON.stringify(project(),null,2)],{type:'application/json'}),'map-for-ppt-project.json'));
$('loadProject').addEventListener('click',()=>$('projectFile').click());
$('projectFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2*1024*1024)throw Error('작업 파일은 2 MB 이하만 불러올 수 있습니다.');const p=validateProject(JSON.parse(await file.text()));if(!countries.some(f=>f.properties.id===p.settings.country))throw Error('지원하지 않는 국가입니다.');if(['municipality','dong'].includes(p.settings.unit)&&(!korea.provinces.some(x=>x.code===p.settings.province)||!korea.cities.some(x=>x.code===p.settings.municipality&&x.province===p.settings.province)))throw Error('한국 행정구역 코드가 잘못되었습니다.');settings=p.settings;selections=p.selections;pins=p.pins;selectedPinId=null;$('search').value='';syncControls();if(await changeView())notify(t('done'));}catch(err){notify(err instanceof SyntaxError?'올바른 JSON 파일이 아닙니다.':err.message);}finally{e.target.value='';}});
async function init(){
  syncEnabled();
  try{
    await initLanguage();setStep(1);
    [countries,manifest,korea,provinceData,cityData]=await Promise.all([getJSON('data/countries.geojson').then(d=>d.features),getJSON('data/manifest.json'),getJSON('data/korea/index.json'),getJSON('data/korea/provinces.geojson').then(d=>d.features),getJSON('data/korea/municipalities.geojson').then(d=>d.features)]);
    try{const saved=localStorage.getItem(STORAGE);if(saved){const p=validateProject(JSON.parse(saved));if(countries.some(f=>f.properties.id===p.settings.country)){settings=p.settings;selections=p.selections;pins=p.pins;}}}catch{/* Ignore incompatible or unavailable local storage. */}
    for(const f of [...countries].sort((a,b)=>nameOf(a).localeCompare(nameOf(b),'ko'))){const option=document.createElement('option');option.value=f.properties.id;option.textContent=nameOf(f)+(manifest.admin1[f.properties.id]?'':' · '+t('states')+' —');$('country').append(option);}
    for(const p of [...korea.provinces].sort((a,b)=>a.name.localeCompare(b.name,'ko'))){const option=document.createElement('option');option.value=p.code;option.textContent=p.name;$('province').append(option);}
    syncControls();await changeView();selectPin(null);
  }catch(e){$('loading').textContent='지도를 불러오지 못했습니다. 연결을 확인하고 새로고침해 주세요.';notify(e.message);}
}
document.addEventListener('languagechange',()=>{
 if(!ready)return;
 if(settings.unit==='continent')items=items.map(i=>({...i,name:continentName(i.id)}));
 else items=items.map(i=>({...i,name:nameOf(rawCurrent.find(f=>f.properties.id===i.id))}));
 if(settings.unit==='country')allItems=countries.map(f=>({id:f.properties.id,name:nameOf(f),en:f.properties.name}));else allItems=settings.unit==='continent'?Object.keys(CONTINENTS).map(id=>({id,name:continentName(id),en:id})):items;
 for(const option of $('country').options){const f=countries.find(f=>f.properties.id===option.value);if(f)option.textContent=nameOf(f);}
 $('viewName').textContent=isKorea()?t(settings.unit==='admin1'?'states':settings.unit==='municipality'?'cities':'dongs'):settings.scope==='world'?t('world'):settings.scope==='country'?nameOf(countries.find(f=>f.properties.id===settings.country)):continentName(settings.scope);
 $('pinCount').textContent=`${t('pins')} · ${pins.length}`;$('canvasHelp').textContent=t('canvasHint');syncControls();
 setStep(step);renderBreadcrumbs();renderList();renderSelected();renderMap();renderExportRegions();
});
init();
