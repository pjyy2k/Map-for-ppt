let locale='ko',pack={},languages=[],bindings=[],attributeBindings=[];
const packs=new Map();
export const language=()=>locale;
export const t=key=>pack[key]||key;
const SOURCES={
 '↓ PNG 다운로드':'png','＋ 지도에 핀 찍기':'addPin','← 이전':'previous','선택 지역별 SVG 묶음 (ZIP)':'zip','지도를 준비하고 있어요…':'loading',
 '브라우저에서 안전하게 작업':'local','전하고 싶은 이야기를, 지도 위에.':'hero','설치 없이, 브라우저에서':'local',
 '강조 색상':'color','핀 색상':'color','배경색':'background','제목 선택':'title','제목  선택':'title','선택 지역 이름 표시':'labels',
 '지역 깃발 크기':'size','핀 크기':'size','핀 모양':'shape','원':'shape','핀 테두리 표시':'outline',
 '분리 지역 · 표시 옵션':'islands','지역별 가장 큰 육지만 표시':'mainland','미국 지도: 알래스카·하와이 삽입':'inset',
 '작은 섬 생략':'smallIslands','값이 커질수록 작은 섬을 더 많이 생략합니다.':'help',
 '편집 가능한 파일과 개별 지도':'more','PPTX · 지역과 핀을 개별 도형으로':'pptx','PowerPoint에서 각 지역과 핀의 색상·위치를 편집할 수 있어요.':'pptxHint',
 '선택 지역별 색상·스타일':'individual','지도 위 지역을 클릭해도 선택할 수 있어요.':'canvasHint',
 '체크해서 강조하거나, 지역 옆 › 버튼으로 더 자세히 살펴보세요.':'help','버튼을 누른 뒤 지도를 클릭하세요. 핀을 드래그해 옮길 수 있어요.':'canvasHint',
 '선택한 핀은 Ctrl/Cmd+C, V로 복사·붙여넣기할 수 있어요.':'help',
 '지역을 클릭해 강조하고, 드래그로 지도를 옮길 수 있어요.':'canvasHint','지역을 선택하거나 기본 지도로 계속하세요.':'help',
 '발표용 개략 지도입니다. 경계·지명은 데이터 기준일에 따르며 일부 섬을 생략할 수 있습니다. 한국 시군구·읍면동은 2025-01-01 기준 행정동 경계이며 법정리 경계는 포함하지 않습니다.':'notice',
 '지도 제작 단계':'regions','단계별 설정':'regions','지도 미리보기':'world','지역 체크리스트':'regions','지역 검색':'search','지도 종류':'unit','강조 방식':'highlight','추천 색상':'color','지도 탐색 경로':'scope',
 '어떤 지도가 필요한가요?':'mapQuestion','어떻게 표현할까요?':'styleQuestion','슬라이드에 담아 보세요.':'exportQuestion',
 '예: 글로벌 사업 현황':'title','예: 글로벌 사업 현황':'title','여기':'help',
 '선택 지역이 강조된 지도':'world','지도 크기 맞추기':'fit','선택 지역 지도':'world',
 '와이드 · 16:9':'wide','스탠다드 · 4:3':'standard','정사각형 · 1:1':'square',
 '전 세계':'world','국가 한 곳':'country','시도 / 주 / 1차 행정구역':'states','위치 핀':'pin','지역을 클릭해 강조하고, 드래그로 지도를 옮길 수 있어요.':'canvasHint'
};
const CUSTOM={
 '지역을 고르고, 스타일을 더하고, 슬라이드에 담으세요.':'subtitle',
 'Ctrl/Cmd+C → Ctrl/Cmd+V':'keyboard'
};
function lookup(value){return SOURCES[value]||CUSTOM[value]||Object.keys(packs.get('ko')||{}).find(k=>packs.get('ko')[k]===value);}
const continentCodes={'Asia':'142','Europe':'150','Africa':'002','North America':'003','South America':'005','Oceania':'009','Antarctica':'010'};
const continentLabels={"ko": ["아시아", "유럽", "아프리카", "북아메리카", "남아메리카", "오세아니아", "남극"], "en": ["Asia", "Europe", "Africa", "North America", "South America", "Oceania", "Antarctica"], "zh": ["亚洲", "欧洲", "非洲", "北美洲", "南美洲", "大洋洲", "南极洲"], "es": ["Asia", "Europa", "África", "América del Norte", "América del Sur", "Oceanía", "Antártida"], "hi": ["एशिया", "यूरोप", "अफ्रीका", "उत्तरी अमेरिका", "दक्षिण अमेरिका", "ओशिनिया", "अंटार्कटिका"], "ar": ["آسيا", "أوروبا", "أفريقيا", "أمريكا الشمالية", "أمريكا الجنوبية", "أوقيانوسيا", "القارة القطبية الجنوبية"], "pt": ["Ásia", "Europa", "África", "América do Norte", "América do Sul", "Oceania", "Antártida"], "bn": ["এশিয়া", "ইউরোপ", "আফ্রিকা", "উত্তর আমেরিকা", "দক্ষিণ আমেরিকা", "ওশেনিয়া", "অ্যান্টার্কটিকা"], "ru": ["Азия", "Европа", "Африка", "Северная Америка", "Южная Америка", "Океания", "Антарктида"], "fr": ["Asie", "Europe", "Afrique", "Amérique du Nord", "Amérique du Sud", "Océanie", "Antarctique"], "ur": ["ایشیا", "یورپ", "افریقہ", "شمالی امریکہ", "جنوبی امریکہ", "اوقیانوسیہ", "انٹارکٹیکا"], "id": ["Asia", "Eropa", "Afrika", "Amerika Utara", "Amerika Selatan", "Oseania", "Antarktika"], "de": ["Asien", "Europa", "Afrika", "Nordamerika", "Südamerika", "Ozeanien", "Antarktis"], "ja": ["アジア", "ヨーロッパ", "アフリカ", "北アメリカ", "南アメリカ", "オセアニア", "南極"], "tr": ["Asya", "Avrupa", "Afrika", "Kuzey Amerika", "Güney Amerika", "Okyanusya", "Antarktika"], "vi": ["Châu Á", "Châu Âu", "Châu Phi", "Bắc Mỹ", "Nam Mỹ", "Châu Đại Dương", "Nam Cực"], "fa": ["آسیا", "اروپا", "آفریقا", "آمریکای شمالی", "آمریکای جنوبی", "اقیانوسیه", "جنوبگان"], "it": ["Asia", "Europa", "Africa", "America del Nord", "America del Sud", "Oceania", "Antartide"], "th": ["เอเชีย", "ยุโรป", "แอฟริกา", "อเมริกาเหนือ", "อเมริกาใต้", "โอเชียเนีย", "แอนตาร์กติกา"], "pl": ["Azja", "Europa", "Afryka", "Ameryka Północna", "Ameryka Południowa", "Oceania", "Antarktyda"], "uk": ["Азія", "Європа", "Африка", "Північна Америка", "Південна Америка", "Океанія", "Антарктида"], "nl": ["Azië", "Europa", "Afrika", "Noord-Amerika", "Zuid-Amerika", "Oceanië", "Antarctica"], "ro": ["Asia", "Europa", "Africa", "America de Nord", "America de Sud", "Oceania", "Antarctica"], "el": ["Ασία", "Ευρώπη", "Αφρική", "Βόρεια Αμερική", "Νότια Αμερική", "Ωκεανία", "Ανταρκτική"], "hu": ["Ázsia", "Európa", "Afrika", "Észak-Amerika", "Dél-Amerika", "Óceánia", "Antarktisz"], "ms": ["Asia", "Eropah", "Afrika", "Amerika Utara", "Amerika Selatan", "Oceania", "Antartika"], "sv": ["Asien", "Europa", "Afrika", "Nordamerika", "Sydamerika", "Oceanien", "Antarktis"], "da": ["Asien", "Europa", "Afrika", "Nordamerika", "Sydamerika", "Oceanien", "Antarktis"], "fi": ["Aasia", "Eurooppa", "Afrikka", "Pohjois-Amerikka", "Etelä-Amerikka", "Oseania", "Etelämanner"], "cs": ["Asie", "Evropa", "Afrika", "Severní Amerika", "Jižní Amerika", "Oceánie", "Antarktida"]};
export function continentName(name){const index=Object.keys(continentCodes).indexOf(name);return index<0?t('islands'):(continentLabels[locale]||continentLabels.en)[index];}

function translated(key,source){
  if(key==='keyboard')return 'Ctrl/Cmd+C → Ctrl/Cmd+V';
  if(source==='원')return '●';
  return t(key);
}
function capture(node){
  if(node.nodeType===3){const source=node.textContent.trim(),key=lookup(source);if(key)bindings.push({node,key,source});return;}
  if(node.nodeType!==1||['SCRIPT','STYLE','SVG'].includes(node.tagName))return;
  for(const attr of ['placeholder','aria-label','title']){const source=node.getAttribute(attr);const key=source&&lookup(source);if(key)attributeBindings.push({node,attr,key,source});}
  for(const child of node.childNodes)capture(child);
}
function apply(){
  document.documentElement.lang=locale;document.documentElement.dir=['ar','fa','ur'].includes(locale)?'rtl':'ltr';
  for(const {node,key,source}of bindings)if(node.isConnected)node.textContent=translated(key,source);
  for(const {node,attr,key,source}of attributeBindings)if(node.isConnected)node.setAttribute(attr,translated(key,source));
  for(const [id,key,suffix]of [['ratio','wide','16:9'],['ratio','standard','4:3'],['ratio','square','1:1']]){const option=document.querySelector(`#${id} option[value="${key==='wide'?'wide':key==='standard'?'standard':'square'}"]`);if(option)option.textContent=t(key)+' · '+suffix;}
  const resolutions=[['1920','basic'],['3840','high'],['7680','ultra']];for(const [value,key]of resolutions){const option=document.querySelector(`#resolution option[value="${value}"]`);if(option)option.textContent=value+' px · '+t(key);}
  for(const [id,name]of [['alaska','Alaska'],['hawaii','Hawaii'],['greenland','Greenland'],['antarctica',continentName('Antarctica')]]){const el=document.getElementById(id),label=el?.parentElement;if(!label)continue;for(const child of [...label.childNodes])if(child.nodeType===3)child.remove();label.append(document.createTextNode(t('show')+' '+(locale==='ko'?{alaska:'알래스카',hawaii:'하와이',greenland:'그린란드',antarctica:'남극'}[id]:name)));}
  for(const option of document.querySelectorAll('#scope option')){if(option.value==='world')option.textContent=t('world');else if(option.value==='country')option.textContent=t('country');else option.textContent=continentName(option.value);}
  const copyHelp=document.querySelector('#duplicatePin')?.closest('#pinEditor')?.querySelector('.help');if(copyHelp)copyHelp.textContent='Ctrl/Cmd+C → Ctrl/Cmd+V';
  const data=document.querySelector('.data-note p:last-child');if(data&&locale!=='ko')data.textContent='Statistics Korea SGIS (KOGL Type 1) / vuski/admdongkor (CC BY 4.0) · 2025-01-01. Natural Earth.';
  const footer=document.querySelector('footer span');if(footer)footer.textContent='Map for PPT · '+t('operator')+' JinYoungPark';
  document.querySelector('.brand').setAttribute('aria-label','Map for PPT');
  document.getElementById('zoomIn').setAttribute('aria-label','+');document.getElementById('zoomOut').setAttribute('aria-label','−');
  document.title='Map for PPT — '+t('hero');
}
async function load(code){if(!packs.has(code)){const r=await fetch(`locales/${code}.json`);if(!r.ok)throw Error('Language file unavailable');packs.set(code,await r.json());}return packs.get(code);}
export async function setLanguage(code){
  if(!languages.some(l=>l.code===code))code='ko';
  const next=await load(code);locale=code;pack=next;document.getElementById('language').value=code;apply();
  try{localStorage.setItem('map-for-ppt:language',code);}catch{}
  document.dispatchEvent(new window.Event('languagechange'));
}
export async function initLanguage(){
  const response=await fetch('locales/languages.json');languages=await response.json();await load('ko');
  const select=document.getElementById('language');for(const lang of languages){const option=document.createElement('option');option.value=lang.code;option.textContent=lang.name;option.lang=lang.code;select.append(option);}
  capture(document.body);
  let initial='ko';try{initial=localStorage.getItem('map-for-ppt:language')||'ko';}catch{}
  await setLanguage(initial);select.addEventListener('change',()=>setLanguage(select.value).catch(()=>{select.value=locale;}));
}
