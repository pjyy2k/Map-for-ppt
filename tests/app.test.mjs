import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {createCanvas,Image as CanvasImage,loadImage} from '@napi-rs/canvas';
const root=new URL('../public/',import.meta.url);
test('editor selects regions, changes styles, switches levels, handles hidden states and exports PNG/SVG',async()=>{
 const {window,document}=parseHTML(await fs.readFile(new URL('index.html',root),'utf8'));
 const values=new WeakMap();const descriptor=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value');
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return values.get(this)??descriptor.get.call(this);},set(v){values.set(this,String(v));},configurable:true});
 const storage=new Map(),blobs=new Map(),downloads=[];let nextBlob=0;
 const realURL=globalThis.URL;const oldCreate=realURL.createObjectURL,oldRevoke=realURL.revokeObjectURL;
 realURL.createObjectURL=blob=>{const url='blob:test-'+(++nextBlob);blobs.set(url,blob);return url;};realURL.revokeObjectURL=url=>blobs.delete(url);
 Object.assign(globalThis,{window,document,localStorage:{getItem:key=>storage.get(key),setItem:(key,v)=>storage.set(key,v)},fetch:async url=>({ok:true,json:async()=>JSON.parse(await fs.readFile(new URL(url,root),'utf8'))}),XMLSerializer:class{serializeToString(node){return node.toString();}}});
 const originalCreate=document.createElement.bind(document);
 document.createElement=(tag,...args)=>{
  const el=originalCreate(tag,...args);
  if(tag==='a')el.click=()=>downloads.push({filename:el.download,blob:blobs.get(el.href)});
  if(tag==='canvas'){
   const canvas=createCanvas(1,1);Object.defineProperty(el,'width',{set:v=>canvas.width=v,get:()=>canvas.width});Object.defineProperty(el,'height',{set:v=>canvas.height=v,get:()=>canvas.height});el.getContext=()=>canvas.getContext('2d');el.toBlob=async cb=>cb(new Blob([await canvas.encode('png')],{type:'image/png'}));
  }
  return el;
 };
 globalThis.Image=class extends CanvasImage{set src(url){blobs.get(url).arrayBuffer().then(data=>{super.src=Buffer.from(data);}).catch(e=>this.onerror?.(e));}};
 const context={window,document};vm.runInNewContext(await fs.readFile(new URL('vendor/d3.min.js',root),'utf8'),context);window.d3=context.d3;
 const $=id=>document.getElementById(id);
 const event=(el,type)=>el.dispatchEvent(new window.Event(type,{bubbles:true}));
 const change=(id,value)=>{const el=$(id);if(el.type==='checkbox')el.checked=value;else el.value=value;event(el,'change');};
 const click=id=>event($(id),'click');
 const waitFor=async predicate=>{for(let i=0;i<200;i++){if(predicate())return;await new Promise(r=>setTimeout(r,5));}throw Error('Timed out waiting for editor state: '+$('loading').textContent);};
 try{
  await import('../public/app.js');await waitFor(()=>$('loading').hidden);
  assert.equal(document.querySelectorAll('#map .region').length,241); // Antarctica off by default.
  assert.equal($('selectedCount').textContent,'4');
  event(document.querySelector('[data-mode="flag"]'),'click');assert.equal(document.querySelectorAll('[data-marker]').length,4);
  $('accent').value='#ff1122';event($('accent'),'input');assert.equal(document.querySelector('[data-marker="KOR"] path').getAttribute('fill'),'#ff1122');
  const korea=document.querySelector('#map [data-id="KOR"]');event(korea,'click');assert.equal($('selectedCount').textContent,'3');event(document.querySelector('#map [data-id="KOR"]'),'click');assert.equal($('selectedCount').textContent,'4');
  change('scope','country');change('unit','admin1');await waitFor(()=>$('loading').hidden);assert.equal(document.querySelectorAll('#map .region').length,17);
  click('selectAll');assert.equal($('selectedCount').textContent,'17');
  const firstColor=document.querySelector('#selectedRegions input');firstColor.value='#123456';event(firstColor,'input');assert.equal(document.querySelector('[data-marker] path').getAttribute('fill')!==null,true);
  change('country','USA');await waitFor(()=>$('loading').hidden);assert.equal(document.querySelectorAll('#map .region').length,51);
  change('alaska',false);change('hawaii',false);await waitFor(()=>$('loading').hidden);assert.equal(document.querySelectorAll('#map .region').length,49);
  assert(!document.querySelector('#map [data-id="USA-3563"]'));
  change('country','KOR');await waitFor(()=>$('loading').hidden);assert.equal($('selectedCount').textContent,'17');
  change('unit','continent');change('scope','Asia');await waitFor(()=>$('loading').hidden);click('selectAll');assert.equal($('selectedCount').textContent,'1');
  change('unit','country');change('scope','country');await waitFor(()=>$('loading').hidden);
  $('mapTitle').value='<script>alert(1)</script>';event($('mapTitle'),'input');assert.equal(document.querySelectorAll('#map script').length,0);
  $('mapTitle').value='Global presence';event($('mapTitle'),'input');
  click('downloadSvg');const exported=downloads.at(-1);assert.equal(exported.filename,'map-for-ppt.svg');const xml=await exported.blob.text();assert(xml.includes('Global presence'));assert(xml.includes('xmlns="http://www.w3.org/2000/svg"'));assert(!xml.includes('NaN'));
  change('resolution','1920');click('downloadPng');await waitFor(()=>downloads.some(d=>d.filename.endsWith('.png')));let png=downloads.at(-1);let data=Buffer.from(await png.blob.arrayBuffer());assert.equal(data.readUInt32BE(16),1920);assert.equal(data.readUInt32BE(20),1080);
  const image=await loadImage(data),canvas=createCanvas(1920,1080),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);assert.equal(ctx.getImageData(0,0,1,1).data[3],0,'transparent background');
  await fs.mkdir(new URL('../.qa/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../.qa/export.png',import.meta.url),data);
  change('transparent',false);change('ratio','square');click('downloadPng');await waitFor(()=>downloads.filter(d=>d.filename.endsWith('.png')).length===2);data=Buffer.from(await downloads.at(-1).blob.arrayBuffer());assert.equal(data.readUInt32BE(20),1920);const opaque=await loadImage(data),opaqueCanvas=createCanvas(1920,1920),opaqueCtx=opaqueCanvas.getContext('2d');opaqueCtx.drawImage(opaque,0,0);assert.equal(opaqueCtx.getImageData(0,0,1,1).data[3],255,'opaque background');
  click('saveProject');assert.equal(downloads.at(-1).filename,'map-for-ppt-project.json');const saved=JSON.parse(await downloads.at(-1).blob.text());assert.equal(saved.selections.admin1['KOR-2497'].mode,'flag');
  change('country','JPN');await waitFor(()=>$('loading').hidden);click('fitSelection');const before=document.querySelector('#map .region').getAttribute('d');$('accent').value='#4788bd';event($('accent'),'input');assert.equal(document.querySelector('#map .region').getAttribute('d'),before,'selection frame remains stable while styling');
 }finally{realURL.createObjectURL=oldCreate;realURL.revokeObjectURL=oldRevoke;}
});
