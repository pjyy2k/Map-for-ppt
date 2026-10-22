import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {createCanvas,loadImage} from '@napi-rs/canvas';
const root=path.resolve(import.meta.dirname,'..'),pub=path.join(root,'public');
const origin=new URL(process.env.SITE_URL||'https://5kiqiunhwfihz6lfdi0qrpkk.hellojyp.com').origin;
if(!origin.startsWith('https://'))throw Error('SITE_URL must use HTTPS');
const read=async p=>JSON.parse(await fs.readFile(path.join(pub,p),'utf8'));
const languages=await read('locales/languages.json'),ko=await read('locales/ko.json');
const template=await fs.readFile(path.join(root,'scripts/seo/editor.html'),'utf8');
const source=await fs.readFile(path.join(pub,'i18n.js'),'utf8');
const aliases=vm.runInNewContext('('+source.match(/const SOURCES=(\{[\s\S]*?\n\});/)[1]+')');
const custom=vm.runInNewContext('('+source.match(/const CUSTOM=(\{[\s\S]*?\n\});/)[1]+')');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const safeJSON=o=>JSON.stringify(o).replaceAll('<','\\u003c');
const write=async(file,text)=>{await fs.mkdir(path.dirname(path.join(pub,file)),{recursive:true});await fs.writeFile(path.join(pub,file),text);};
const alternates=languages.map(l=>`<link rel="alternate" hreflang="${l.code}" href="${origin}/${l.code}/">`).join('\n')+`\n<link rel="alternate" hreflang="x-default" href="${origin}/ko/">`;
const pages=[];
for(const lang of languages){
 const pack=await read(`locales/${lang.code}.json`),{document}=parseHTML(template);
 const keyFor=text=>aliases[text]||custom[text]||Object.keys(ko).find(k=>ko[k]===text);
 function walk(node){
  if(node.nodeType===3){const text=node.textContent.trim(),key=keyFor(text);if(key&&pack[key])node.textContent=node.textContent.replace(text,pack[key]);return;}
  if(node.nodeType!==1||['SCRIPT','STYLE','SVG'].includes(node.tagName))return;
  for(const a of ['placeholder','aria-label','title']){const key=keyFor(node.getAttribute(a));if(key&&pack[key])node.setAttribute(a,pack[key]);}
  for(const child of [...node.childNodes])walk(child);
 }
 walk(document.body);
 document.documentElement.lang=lang.code;document.documentElement.dir=lang.dir;
 const title=`Map for PPT — ${pack.world} · ${pack.korea} · PNG / SVG / PPTX`;
 const description=`${pack.subtitle} ${pack.world} · ${pack.korea} · ${pack.cities}. ${pack.png} · ${pack.svg} · ${pack.pptx}.`;
 document.title=title;document.querySelector('meta[name=description]').content=description;
 document.querySelector('.intro > p:last-child').textContent=`${pack.world} · ${pack.korea} · PNG / SVG / PPTX`;
 const option=document.getElementById('language');
 for(const l of languages){const el=document.createElement('option');el.value=l.code;el.textContent=l.name;el.lang=l.code;if(l.code===lang.code)el.setAttribute('selected','');option.append(el);}
 const url=`${origin}/${lang.code}/`;
 document.head.insertAdjacentHTML('beforeend',`<link rel="canonical" href="${url}">\n${alternates}\n<meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${origin}/images/world-map.png"><meta name="twitter:card" content="summary"><script type="application/ld+json">${safeJSON({'@context':'https://schema.org','@type':'WebApplication',name:'Map for PPT',url,description,inLanguage:lang.code,applicationCategory:'DesignApplication',operatingSystem:'Web browser',featureList:[pack.world,pack.korea,pack.fill,pack.flag,pack.border,pack.route,'PNG','SVG','PPTX'],author:{'@type':'Person',name:'JinYoungPark',url:'https://github.com/pjyy2k'}})}</script>`);
 const html='<!doctype html>\n'+document.documentElement.outerHTML;
 await write(`${lang.code}/index.html`,html);pages.push(`/${lang.code}/`);
 if(lang.code==='ko')await write('index.html',html);
}

// Real boundary examples; no remote image dependency.
const d3context={};vm.runInNewContext(await fs.readFile(path.join(pub,'vendor/d3.min.js'),'utf8'),d3context);
const d3=d3context.d3;
for(const [name,file,kind]of [['world-map','data/countries.geojson','world'],['korea-map','data/korea/municipalities.geojson','korea']]){
 const data=await read(file);if(kind==='world')data.features=data.features.filter(f=>f.properties.id!=='ATA');
 const projection=(kind==='world'?d3.geoNaturalEarth1():d3.geoMercator()).fitExtent([[24,24],[936,516]],data),geo=d3.geoPath(projection).digits(1);
 const paths=data.features.map((f,i)=>`<path d="${geo(f)}" fill="${i%17===0?'#267b67':i%29===0?'#aa93cb':'#dce9e3'}" stroke="white" stroke-width=".65"/>`).join('');
 await write(`images/${name}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" role="img" aria-labelledby="title"><title id="title">${kind==='world'?'World':'Korea'} map example — Map for PPT</title><rect width="960" height="540" fill="#fff"/>${paths}<path d="M 290 310 Q 470 40 730 215" fill="none" stroke="white" stroke-width="9"/><path d="M 290 310 Q 470 40 730 215" fill="none" stroke="#b74820" stroke-width="4" stroke-dasharray="1 12" stroke-linecap="round"/><circle cx="290" cy="310" r="8" fill="white" stroke="#b74820" stroke-width="4"/><path d="M730 215 Q704 185 714 174 Q730 155 746 174 Q756 185 730 215Z" fill="#b74820" stroke="white" stroke-width="3"/><circle cx="730" cy="180" r="5" fill="white"/></svg>`);
 const svg=await fs.readFile(path.join(pub,`images/${name}.svg`));const canvas=createCanvas(960,540);canvas.getContext('2d').drawImage(await loadImage(svg),0,0);await fs.writeFile(path.join(pub,`images/${name}.png`),await canvas.encode('png'));
}

const guides=JSON.parse(await fs.readFile(path.join(root,'scripts/seo/guides.json'),'utf8'));
for(const [lang,g]of Object.entries(guides)){
 const base=lang==='ko'?'/guides/':'/guides/en/';
 const links=g.pages.map(p=>`<article><h2><a href="${base}${p.slug}/">${esc(p.title)}</a></h2><p>${esc(p.description)}</p></article>`).join('');
 const credits=`<aside><h2>${lang==='ko'?'출처와 운영자':'Sources and operator'}</h2><p>Natural Earth · Statistics Korea SGIS (KOGL Type 1) · vuski/admdongkor (CC BY 4.0). 2025-01-01 (${lang==='ko'?'한국 경계 기준일':'Korean boundary date'}).</p><p><a href="https://www.naturalearthdata.com/about/terms-of-use/">Natural Earth</a> · <a href="https://github.com/vuski/admdongkor">Korean boundary source</a> · <a href="https://github.com/pjyy2k/Map-for-ppt">JinYoungPark · GitHub</a></p></aside>`;
 for(const p of [null,...g.pages]){
  const route=base+(p?p.slug+'/':''),title=p?.title||g.title,description=p?.description||g.description;
  const image=p?.slug==='korea-municipalities'?'korea-map':'world-map';
  const article=p?`<p>${esc(p.description)}</p><ol>${p.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><h2>${esc(g.faq)}</h2><h3>${esc(p.question)}</h3><p>${esc(p.answer)}</p>`:`<p>${esc(g.intro)}</p><h2>${esc(g.examples)}</h2><figure><img src="/images/world-map.svg" width="960" height="540" alt="${lang==='ko'?'국가별 색상과 곡선 경로를 표시한 세계지도 예시':'World map with highlighted countries and a curved route'}"><figcaption>${lang==='ko'?'지도 데이터로 만든 활용 예시':'Example generated from map data'}</figcaption></figure>${links}`;
  const other=lang==='ko'?'/guides/en/':'/guides/';
  const schema={'@context':'https://schema.org','@type':p?'TechArticle':'CollectionPage',headline:title,description,url:origin+route,inLanguage:lang,author:{'@type':'Person',name:'JinYoungPark',url:'https://github.com/pjyy2k'},isPartOf:{'@type':'WebSite',name:'Map for PPT',url:origin+'/ko/'}};
  await write(route.slice(1)+'index.html',`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Map for PPT</title><meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${origin+route}"><link rel="alternate" hreflang="ko" href="${origin+'/guides/'+(p?p.slug+'/':'')}"><link rel="alternate" hreflang="en" href="${origin+'/guides/en/'+(p?p.slug+'/':'')}"><meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${origin+route}"><meta property="og:image" content="${origin}/images/${image}.png"><link rel="stylesheet" href="/guide.css"><script type="application/ld+json">${safeJSON(schema)}</script></head><body><header><a href="/${lang}/">Map for PPT</a><nav><a href="${base}">${esc(g.home)}</a><a href="${other+(p?p.slug+'/':'')}" lang="${lang==='ko'?'en':'ko'}">${lang==='ko'?'English':'한국어'}</a></nav></header><main><a class="back" href="${base}">${esc(g.home)}</a><h1>${esc(title)}</h1>${article}<p><a class="cta" href="/${lang}/">${esc(g.start)} →</a></p>${p?`<nav aria-label="${esc(g.home)}">${links}</nav>`:''}${credits}</main><footer>Map for PPT · JinYoungPark <small data-visitor-counter aria-live="polite">—</small></footer><script defer src="https://vc.hellojyp.com/counter.js" data-site="site-cf7f30c0-9157-4ba8-a781-38bf70509b63"></script></body></html>`);pages.push(route);
 }
}
await write('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map(p=>`<url><loc>${origin+p}</loc></url>`).join('\n')}</urlset>\n`);
await write('robots.txt',`User-agent: *\nAllow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
console.log(`Generated ${pages.length} indexable pages for ${origin}`);
