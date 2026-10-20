// Native DrawingML freeforms keep every map region editable in PowerPoint.
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const color = s => /^#[\da-f]{6}$/i.test(s || '') ? s.slice(1).toUpperCase() : /^#[\da-f]{3}$/i.test(s || '') ? s.slice(1).split('').map(c=>c+c).join('').toUpperCase() : '233C35';
const number = n => Math.round(Number.isFinite(n) ? n : 0);
const solid = c => c && c !== 'none' ? `<a:solidFill><a:srgbClr val="${color(c)}"/></a:solidFill>` : '<a:noFill/>';
const points = (x,y) => `<a:pt x="${number(x)}" y="${number(y)}"/>`;
export function pathCommands(d) {
  const tokens = d.match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || [];
  const commands=[]; let i=0,command='',x=0,y=0,start=[0,0];
  const args={M:2,L:2,H:1,V:1,C:6,Q:4,Z:0};
  while(i<tokens.length) {
    if(/^[A-Za-z]$/.test(tokens[i]))command=tokens[i++];
    const upper=command.toUpperCase(),relative=command!==upper;
    if(!(upper in args))throw Error('지원하지 않는 SVG 경로입니다: '+command);
    if(upper==='Z'){commands.push({type:'Z',values:[]});[x,y]=start;command='';continue;}
    const values=tokens.slice(i,i+args[upper]).map(Number);if(values.length!==args[upper]||values.some(v=>!Number.isFinite(v)))throw Error('잘못된 SVG 경로입니다.');i+=args[upper];
    if(upper==='H'){x=values[0]+(relative?x:0);commands.push({type:'L',values:[x,y]});}
    else if(upper==='V'){y=values[0]+(relative?y:0);commands.push({type:'L',values:[x,y]});}
    else {
      if(relative)for(let j=0;j<values.length;j+=2){values[j]+=x;values[j+1]+=y;}
      commands.push({type:upper,values});[x,y]=values.slice(-2);if(upper==='M'){start=[x,y];command=relative?'l':'L';}
    }
  }
  return commands;
}
function matrix(transform,parent) {
  let [s,x,y]=parent;
  for(const part of (transform||'').matchAll(/(translate|scale)\(([^)]+)\)/g)) {
    const a=part[2].trim().split(/[ ,]+/).map(Number);
    if(part[1]==='translate'){x+=a[0]*s;y+=(a[1]||0)*s;}else s*=a[0];
  }
  return [s,x,y];
}
export function svgToSlideXml(svg,width,height) {
  const emuWidth=12192000,scale=emuWidth/width,emuHeight=number(height*scale);
  let id=1;const collected=[];
  const transformPoint=(x,y,m)=>[(x*m[0]+m[1])*scale,(y*m[0]+m[2])*scale];
  function shape(name,commands,fill,stroke,lineWidth,dashed=false) {
    if(!commands.length)return '';
    const coords=commands.flatMap(c=>c.values),xs=coords.filter((_,i)=>i%2===0),ys=coords.filter((_,i)=>i%2);
    if(!xs.length)return '';
    const minx=Math.min(...xs),miny=Math.min(...ys),w=Math.max(1,Math.max(...xs)-minx),h=Math.max(1,Math.max(...ys)-miny);
    collected.push([minx,miny,minx+w,miny+h]);
    const geometry=commands.map(c=>{
      if(c.type==='Z')return '<a:close/>';
      const pts=[];for(let j=0;j<c.values.length;j+=2)pts.push(points(c.values[j]-minx,c.values[j+1]-miny));
      const tag={M:'moveTo',L:'lnTo',C:'cubicBezTo',Q:'quadBezTo'}[c.type];return `<a:${tag}>${pts.join('')}</a:${tag}>`;
    }).join('');
    const line=stroke&&stroke!=='none'?`<a:ln w="${number(lineWidth)}">${solid(stroke)}<a:prstDash val="${dashed?'sysDot':'solid'}"/><a:round/></a:ln>`:'<a:ln><a:noFill/></a:ln>';
    return `<p:sp><p:nvSpPr><p:cNvPr id="${++id}" name="${esc(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${number(minx)}" y="${number(miny)}"/><a:ext cx="${number(w)}" cy="${number(h)}"/></a:xfrm><a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst><a:path w="${number(w)}" h="${number(h)}">${geometry}</a:path></a:pathLst></a:custGeom>${solid(fill)}${line}</p:spPr></p:sp>`;
  }
  function walk(node,parent=[1,0,0],inherited={fill:'#233c35',stroke:'none',lineWidth:1}) {
    if(node.nodeType!==1||['defs','title','metadata','clipPath'].includes(node.localName)||node.hasAttribute('data-editor'))return '';
    const m=matrix(node.getAttribute('transform'),parent),style={fill:node.getAttribute('fill')||inherited.fill,stroke:node.getAttribute('stroke')||inherited.stroke,lineWidth:Number(node.getAttribute('stroke-width')||inherited.lineWidth)};
    const tag=node.localName,name=node.getAttribute('aria-label')||node.getAttribute('data-id')||node.getAttribute('data-pin')||tag;
    if(tag==='path'){
      const commands=pathCommands(node.getAttribute('d')||'').map(c=>({type:c.type,values:c.values.flatMap((_,i,a)=>i%2?[]:transformPoint(a[i],a[i+1],m))}));
      return shape(name,commands,style.fill,style.stroke,style.lineWidth*m[0]*scale,!!node.getAttribute('stroke-dasharray'));
    }
    if(tag==='circle') {
      const cx=Number(node.getAttribute('cx')||0),cy=Number(node.getAttribute('cy')||0),r=Number(node.getAttribute('r')||0);
      const coordinates=Array.from({length:33},(_,i)=>transformPoint(cx+Math.cos(i/32*Math.PI*2)*r,cy+Math.sin(i/32*Math.PI*2)*r,m));
      return shape(name,[...coordinates.map((p,i)=>({type:i?'L':'M',values:p})),{type:'Z',values:[]}],style.fill,style.stroke,style.lineWidth*m[0]*scale);
    }
    if(tag==='rect') {
      const x=Number(node.getAttribute('x')||0),y=Number(node.getAttribute('y')||0),w=Number(node.getAttribute('width')||0),h=Number(node.getAttribute('height')||0);
      if(style.fill==='none'&&style.stroke==='none')return '';
      return shape(name,[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map((p,i)=>({type:i?'L':'M',values:transformPoint(...p,m)})).concat({type:'Z',values:[]}),style.fill,style.stroke,style.lineWidth*m[0]*scale);
    }
    if(tag==='text') {
      const [x,y]=transformPoint(Number(node.getAttribute('x')||0),Number(node.getAttribute('y')||0),m),size=Number(node.getAttribute('font-size')||14)*m[0]*scale;
      const content=node.textContent||'',width=Math.min(emuWidth,Math.max(size*2,content.length*size)),anchor=node.getAttribute('text-anchor')||'start',left=anchor==='middle'?x-width/2:anchor==='end'?x-width:x;
      return `<p:sp><p:nvSpPr><p:cNvPr id="${++id}" name="${esc(content)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${number(left)}" y="${number(y-size)}"/><a:ext cx="${number(width)}" cy="${number(size*1.5)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0"/><a:lstStyle/><a:p><a:pPr algn="${anchor==='middle'?'ctr':anchor==='end'?'r':'l'}"/><a:r><a:rPr lang="ko-KR" sz="${number(size/127)}">${solid(style.fill)}<a:latin typeface="Malgun Gothic"/><a:ea typeface="맑은 고딕"/></a:rPr><a:t>${esc(content)}</a:t></a:r><a:endParaRPr lang="ko-KR"/></a:p></p:txBody></p:sp>`;
    }
    if(node.hasAttribute('data-pin')) {
      const before=collected.length,children=Array.from(node.children).map(child=>walk(child,m,style)).join(''),bounds=collected.slice(before);
      if(!bounds.length)return children;
      const x=Math.min(...bounds.map(b=>b[0])),y=Math.min(...bounds.map(b=>b[1])),w=Math.max(...bounds.map(b=>b[2]))-x,h=Math.max(...bounds.map(b=>b[3]))-y;
      return `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${++id}" name="Pin ${esc(node.getAttribute('data-pin'))}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="${number(x)}" y="${number(y)}"/><a:ext cx="${number(w)}" cy="${number(h)}"/><a:chOff x="${number(x)}" y="${number(y)}"/><a:chExt cx="${number(w)}" cy="${number(h)}"/></a:xfrm></p:grpSpPr>${children}</p:grpSp>`;
    }
    return Array.from(node.children).map(child=>walk(child,m,style)).join('');
  }
  const body=walk(svg);
  return {width:emuWidth,height:emuHeight,xml:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${body}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`};
}
export async function createEditablePptx(svg,width,height) {
  const response=await fetch('vendor/blank.pptx');if(!response.ok)throw Error('PPT 템플릿을 불러오지 못했습니다.');
  const zip=await window.JSZip.loadAsync(await response.arrayBuffer());
  const slide=svgToSlideXml(svg,width,height);zip.file('ppt/slides/slide1.xml',slide.xml);
  const presentation=await zip.file('ppt/presentation.xml').async('string');zip.file('ppt/presentation.xml',presentation.replace(/<p:sldSz[^>]*\/>/,`<p:sldSz cx="${slide.width}" cy="${slide.height}"/>`));
  return new Blob([await zip.generateAsync({type:'uint8array',compression:'DEFLATE'})],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'});
}
