import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {parseHTML} from 'linkedom';
const root=new URL('../public/',import.meta.url);
test('static sitemap pages, reciprocal language links, structured data and local assets',async()=>{
 const sitemap=await fs.readFile(new URL('sitemap.xml',root),'utf8');
 const urls=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>new URL(m[1]));assert.equal(urls.length,42);
 const languages=JSON.parse(await fs.readFile(new URL('locales/languages.json',root),'utf8'));
 for(const url of urls){
  const {document}=parseHTML(await fs.readFile(new URL('.'+url.pathname+'index.html',root),'utf8'));
  assert.equal(document.querySelector('link[rel=canonical]').href,url.href);
  assert(document.title.length>10);assert(document.querySelector('meta[name=description]').content.length>30);
  assert.equal(document.querySelector('h1')?.textContent.length>0,true);
  assert(!document.querySelector('meta[name=robots]').content.includes('noindex'));
  const schema=JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);assert.equal(schema.url,url.href);assert.equal(schema.inLanguage,document.documentElement.lang);
  for(const el of document.querySelectorAll('a[href],img[src],link[rel=stylesheet],script[src]')){
   const href=el.getAttribute('href')||el.getAttribute('src');if(/^(https?:|data:|#)/.test(href))continue;
   const resolved=new URL(href,document.querySelector('base')?url.origin+'/':url.href);
   if(resolved.pathname==='/')continue;
   const file=resolved.pathname.endsWith('/')?resolved.pathname+'index.html':resolved.pathname;
   await fs.access(new URL('.'+file,root));
  }
  if(!url.pathname.startsWith('/guides/')){
   assert.equal(document.querySelector('base').getAttribute('href'),'/');
   assert.equal(document.querySelectorAll('link[hreflang]').length,31);
   const lang=languages.find(l=>url.pathname===`/${l.code}/`),pack=JSON.parse(await fs.readFile(new URL(`locales/${lang.code}.json`,root),'utf8'));
   assert.equal(document.querySelector('h1').textContent,pack.hero);
   assert.equal(document.querySelector('#downloadPng').textContent,pack.png);
   assert.equal(document.querySelectorAll('#language option').length,30);
   assert.equal(document.documentElement.dir,lang.dir);
  }
 }
 const robots=await fs.readFile(new URL('robots.txt',root),'utf8');assert.match(robots,/User-agent: OAI-SearchBot\nAllow: \//);assert(robots.includes('Sitemap: '+urls[0].origin+'/sitemap.xml'));
});
test('localized HTML honors URL over saved language and can switch languages without duplicate options',async()=>{
 const {window,document}=parseHTML(await fs.readFile(new URL('en/index.html',root),'utf8'));
 const values=new WeakMap(),descriptor=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value');
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return values.get(this)??descriptor.get.call(this);},set(v){values.set(this,String(v));},configurable:true});
 const visits=[];window.location={pathname:'/en/',protocol:'https:',search:'',hash:''};window.history={replaceState:(a,b,url)=>visits.push(url)};
 Object.assign(globalThis,{window,document,localStorage:{getItem:()=> 'ko',setItem:()=>{}},fetch:async file=>({ok:true,json:async()=>JSON.parse(await fs.readFile(new URL(file,root),'utf8'))})});
 const i18n=await import('../public/i18n.js?seo-test');await i18n.initLanguage();
 assert.equal(document.documentElement.lang,'en');assert.equal(document.querySelectorAll('#language option').length,30);
 await i18n.setLanguage('ja');const ja=JSON.parse(await fs.readFile(new URL('locales/ja.json',root),'utf8'));
 assert.equal(document.querySelector('h1').textContent,ja.hero);assert.equal(document.querySelector('#downloadPng').textContent,ja.png);
 assert.equal(new URL(document.querySelector('link[rel=canonical]').href).pathname,'/ja/');
 assert.equal(JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent).inLanguage,'ja');assert.equal(visits.at(-1),'/ja/');
 await i18n.setLanguage('ko');assert.equal(document.querySelector('#downloadPng').textContent,JSON.parse(await fs.readFile(new URL('locales/ko.json',root),'utf8')).png);
});
