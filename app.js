import {DEFINITIONS,initial,migrate,interpolate,incoming,effectEnvelope,clamp} from './graph-core.js';
import {gpuColor} from './gpu.js';
const $=id=>document.getElementById(id);
const TYPES=Object.fromEntries(Object.entries(DEFINITIONS).map(([k,v])=>[k,{name:v.name,group:['source','video'].includes(k)?'Entrée':['output'].includes(k)?'Sortie':['merge','mask','chroma','gpu'].includes(k)?'Compositing':'Effet',defaults:v.params}]));
const WIDTH=640,HEIGHT=360,STORE='warlike-node-graph-v1';
let nodes=[],edges=[],selected=null,armed=null,renderTimer=null;const images=new Map(),videos=new Map();let time=0,playing=false,lastTick=0,graphLength=10,graphFPS=25,recording=false,seekGeneration=0;let gpuBackend='non utilisé';
const status=s=>$('status').textContent=s;
const uid=()=>crypto.randomUUID();
const bound=(value,low,high,defaultValue)=>{const n=Number(value);return Number.isFinite(n)?Math.max(low,Math.min(high,n)):defaultValue;};
const nodeBy=id=>nodes.find(n=>n.id===id);
function newNode(type,x=100,y=100){return initial(type,uid(),x,y);}
function defaultGraph(){nodes=[newNode('source',85,190),newNode('contrast',405,190),newNode('output',755,190)];edges=[{from:nodes[0].id,to:nodes[1].id,input:'image'},{from:nodes[1].id,to:nodes[2].id,input:'image'}];selected=nodes[1].id;armed=null;}
function graph(){return{schema:'warlike-node-v2',nodes,edges,length:graphLength,fps:graphFPS};}function write(){try{localStorage.setItem(STORE,JSON.stringify(graph()));}catch{}}
function pathFor(e){const a=nodeBy(e.from),b=nodeBy(e.to);if(!a||!b)return'';const x1=a.x+193,y1=a.y+68,x2=b.x+11,y2=b.y+(e.input==='foreground'?91:68),m=Math.max(65,Math.abs(x2-x1)*.5);return'M '+x1+' '+y1+' C '+(x1+m)+' '+y1+', '+(x2-m)+' '+y2+', '+x2+' '+y2;}
function drawWires(){const svg=$('wires');svg.replaceChildren();for(const e of edges){const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',pathFor(e));path.setAttribute('role','button');path.setAttribute('aria-label','Retirer cette connexion');path.style.pointerEvents='stroke';path.addEventListener('dblclick',()=>{edges=edges.filter(x=>x!==e);commit('Connexion supprimée.');});svg.append(path);} }
function nodeView(n){const article=document.createElement('article');article.className='node'+(n.id===selected?' selected':'');article.style.left=n.x+'px';article.style.top=n.y+'px';article.dataset.id=n.id;
 const header=document.createElement('div');header.className='node-head';const title=document.createElement('span');title.textContent=TYPES[n.type].name;const small=document.createElement('small');small.textContent=n.type.toUpperCase();header.append(title,small);
 header.addEventListener('pointerdown',e=>{if(e.button!==0)return;selected=n.id;renderProperties();document.querySelectorAll('.node').forEach(x=>x.classList.toggle('selected',x.dataset.id===selected));const sx=e.clientX,sy=e.clientY,ox=n.x,oy=n.y;header.setPointerCapture(e.pointerId);function move(ev){n.x=bound(ox+ev.clientX-sx,0,1560,ox);n.y=bound(oy+ev.clientY-sy,0,990,oy);article.style.left=n.x+'px';article.style.top=n.y+'px';drawWires();}function finish(){header.removeEventListener('pointermove',move);header.removeEventListener('pointerup',finish);header.removeEventListener('pointercancel',finish);write();}header.addEventListener('pointermove',move);header.addEventListener('pointerup',finish);header.addEventListener('pointercancel',finish);});
 const body=document.createElement('div');body.className='node-body';const input=document.createElement('div');input.className='port-group',output=document.createElement('div');output.className='port-group';
 for(const port of DEFINITIONS[n.type].inputs){const lane=document.createElement('div');lane.className='input-lane';const b=document.createElement('button');b.className='port input';b.type='button';b.title=port;b.setAttribute('aria-label','Brancher '+port+' vers '+TYPES[n.type].name);b.onclick=()=>connectTo(n.id,port);lane.append(b,document.createTextNode(port));input.append(lane);}
 if(n.type!=='output'){const b=document.createElement('button');b.className='port'+(armed===n.id?' armed':'');b.type='button';b.title='Sortie';b.setAttribute('aria-label','Connecter depuis '+TYPES[n.type].name);b.onclick=()=>{armed=armed===n.id?null:n.id;status(armed?'Sélectionne le port d’entrée à connecter.':'Connexion annulée.');renderGraph();};output.append(document.createTextNode('Sortie'),b);}
 body.append(input,output);const info=document.createElement('div');info.className='node-sub';info.textContent=n.type==='source'?(images.has(n.id)?'Image importée':'Démo intégrée'):n.type==='video'?(videos.has(n.id)?'Vidéo chargée':'Vidéo à importer'):n.type==='output'?'Rendu final':Object.keys(n.params).map(k=>k+' '+n.params[k]).join(' · ')||'Traitement actif';article.append(header,body,info);article.onclick=e=>{if(e.target.closest('.port'))return;selected=n.id;renderProperties();document.querySelectorAll('.node').forEach(x=>x.classList.toggle('selected',x.dataset.id===selected));};return article;}
function renderGraph(){const root=$('nodes');root.replaceChildren(...nodes.map(nodeView));drawWires();$('graphInfo').textContent=nodes.length+' nœuds · '+edges.length+' connexions';}
function dependsOn(from,target,visited=new Set()){if(from===target)return true;if(visited.has(from))return false;visited.add(from);return edges.some(e=>e.to===from&&dependsOn(e.from,target,visited));}
function connectTo(to,input){if(!armed){status('Sélectionne d’abord un port de sortie.');return;}if(armed===to||dependsOn(armed,to)){status('Connexion refusée : boucle détectée.');return;}edges=edges.filter(e=>!(e.to===to&&e.input===input));edges.push({from:armed,to,input});armed=null;commit('Connexion créée vers '+input+'.');}
function syncTimelineUI(){$('timelineLength').value=String(graphLength);$('fps').value=String(graphFPS);$('timelineTime').max=String(graphLength);$('timelineTime').value=String(time);$('timeReadout').textContent=time.toFixed(2)+' s';}
async function seekVideo(t,generation=++seekGeneration){
 const pending=[];
 for(const media of videos.values()){
  const v=media.element;
  if(!Number.isFinite(v.duration)||v.readyState<1)continue;
  const target=Math.max(0,Math.min(v.duration-.001,t));
  if(Math.abs(v.currentTime-target)<.045)continue;
  pending.push(new Promise((resolve,reject)=>{
   let done=false;
   function finish(error){if(done)return;done=true;clearTimeout(timer);v.removeEventListener('seeked',onSeek);v.removeEventListener('error',onError);if(error)reject(error);else resolve();}
   const onSeek=()=>finish(),onError=()=>finish(Error('Lecture vidéo impossible : '+media.name));
   const timer=setTimeout(()=>finish(Error('Synchronisation vidéo expirée : '+media.name)),3000);
   v.addEventListener('seeked',onSeek);v.addEventListener('error',onError);
   try{v.currentTime=target;}catch(e){finish(e);}
  }));
 }
 await Promise.all(pending);
 return generation===seekGeneration;
}
async function positionAt(t){const generation=++seekGeneration;time=Math.max(0,Math.min(graphLength,t));syncTimelineUI();try{if(await seekVideo(time,generation))render();}catch(e){status(e.message);}}
$('timelineTime').addEventListener('input',e=>{playing=false;$('playTimeline').textContent='▶ Lecture';positionAt(Number(e.target.value));});
$('timelineLength').addEventListener('change',e=>{graphLength=clamp(e.target.value,.5,120,10);time=Math.min(time,graphLength);syncTimelineUI();write();});
$('fps').addEventListener('change',e=>{graphFPS=clamp(e.target.value,1,60,25);write();});
$('playTimeline').onclick=()=>{playing=!playing;lastTick=performance.now();$('playTimeline').textContent=playing?'❚❚ Pause':'▶ Lecture';};
function tick(now){if(playing&&!recording){time=Math.min(graphLength,time+Math.min(.1,(now-lastTick)/1000));if(time>=graphLength){playing=false;$('playTimeline').textContent='▶ Lecture';}syncTimelineUI();for(const media of videos.values()){const v=media.element;if(v.readyState>=1&&Math.abs(v.currentTime-time)>.1)try{v.currentTime=Math.min(Math.max(0,v.duration-.001),time);}catch{}}render();}lastTick=now;requestAnimationFrame(tick);}
requestAnimationFrame(tick);
$('addKeyframe').onclick=()=>{const n=nodeBy(selected);if(!n)return status('Sélectionne un nœud.');const numeric=Object.keys(n.params).filter(key=>typeof n.params[key]==='number');if(!numeric.length)return status('Ce nœud n’a pas de paramètre numérique animable.');for(const key of numeric){const seq=n.keyframes[key]||[];const idx=seq.findIndex(f=>Math.abs(f.t-time)<.001);const item={t:time,value:interpolate(n,key,time),easing:$('keyframeEasing').value};if(idx>=0)seq[idx]=item;else seq.push(item);seq.sort((a,b)=>a.t-b.t);n.keyframes[key]=seq;}write();renderProperties();status('◆ '+numeric.length+' images clés ajoutées à '+time.toFixed(2)+' s.');};
function textParam(root,label,key,value,min,max,step=1){
 const wrap=document.createElement('label'),n=nodeBy(selected);
 wrap.textContent=label;
 const field=document.createElement('input');field.type='range';field.min=min;field.max=max;field.step=step;
 const animated=n?.keyframes?.[key]?.length>0;
 const shown=animated?interpolate(n,key,time):value;
 field.value=String(bound(shown,min,max,value));
 const out=document.createElement('output');out.textContent=field.value;
 field.oninput=()=>{
  const item=nodeBy(selected);if(!item)return;
  const number=Number(field.value),sequence=item.keyframes?.[key];
  if(sequence?.length){
   let frame=sequence.find(f=>Math.abs(f.t-time)<.05);
   if(!frame){frame={t:time,value:number,easing:$('keyframeEasing').value};sequence.push(frame);sequence.sort((a,b)=>a.t-b.t);}
   frame.value=number;
  }else item.params[key]=number;
  out.textContent=field.value;scheduleRender();
 };
 field.onchange=()=>{write();renderGraph();};
 wrap.append(field,out);
 const count=document.createElement('small');
 count.textContent=animated?' ◆ '+n.keyframes[key].length+' clés':'';
 wrap.append(count);root.append(wrap);
}
function renderProperties(){const root=$('properties');root.replaceChildren();const n=nodeBy(selected);$('selectionHelp').textContent=n?TYPES[n.type].name:'Sélectionne un nœud pour modifier ses paramètres.';if(!n)return;
 if(n.type==='source'){const label=document.createElement('label');label.textContent='Importer une image PNG / JPG / WebP';const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{if(file.size>20*1048576)throw Error('Image limitée à 20 Mo.');const url=URL.createObjectURL(file);const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Image incompatible.'));img.src=url;});if(!img.naturalWidth||!img.naturalHeight)throw Error('Image vide.');const previous=images.get(n.id);if(previous)URL.revokeObjectURL(previous.url);images.set(n.id,{url,img});commit('Image chargée pour ce nœud Source.');}catch(err){status(err.message);}};label.append(input);root.append(label);}
 if(n.type==='video'){const label=document.createElement('label');label.textContent='Vidéo locale propre à ce nœud (sans audio)';const input=document.createElement('input');input.type='file';input.accept='video/*,.webm,.mp4';input.onchange=async()=>{const file=input.files?.[0];if(!file)return;const url=URL.createObjectURL(file),v=document.createElement('video');v.preload='auto';v.muted=true;v.playsInline=true;try{if(file.size>350*1048576)throw Error('Vidéo trop volumineuse (350 Mo).');v.src=url;v.load();await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Chargement vidéo expiré')),15000);v.onloadedmetadata=()=>{clearTimeout(timeout);resolve();};v.onerror=()=>{clearTimeout(timeout);reject(Error('Vidéo non décodable.'));};});if(!Number.isFinite(v.duration)||v.duration<=0)throw Error('Durée vidéo invalide.');const prev=videos.get(n.id);if(prev){prev.element.pause();prev.element.removeAttribute('src');prev.element.load();URL.revokeObjectURL(prev.url);}videos.set(n.id,{url,element:v,name:file.name});graphLength=Math.min(120,Math.max(graphLength,v.duration));syncTimelineUI();await seekVideo(time);commit('Vidéo chargée dans '+TYPES[n.type].name+' ('+videos.size+' source(s) vidéo).');}catch(err){v.pause();v.removeAttribute('src');v.load();URL.revokeObjectURL(url);status(err.message);}};label.append(input);root.append(label);}
 if(n.type==='merge'){textParam(root,'Opacité avant-plan (%)','opacity',n.params.opacity,0,100);const label=document.createElement('label');label.textContent='Mode de fusion';const select=document.createElement('select');for(const mode of ['source-over','multiply','screen','overlay','lighter']){const o=document.createElement('option');o.value=mode;o.textContent=mode;select.append(o);}select.value=n.params.mode;select.onchange=()=>{n.params.mode=select.value;write();scheduleRender();};label.append(select);root.append(label);}
 if(n.type==='mask'){for(const [key,name] of [['x','Centre X (%)'],['y','Centre Y (%)'],['rx','Rayon horizontal (%)'],['ry','Rayon vertical (%)'],['feather','Contour doux (%)'],['invert','Inverser (%)']])textParam(root,name,key,n.params[key],0,100);}
 if(n.type==='chroma'){const label=document.createElement('label');label.textContent='Couleur à supprimer';const picker=document.createElement('input');picker.type='color';picker.value=n.params.color;picker.oninput=()=>{n.params.color=picker.value;scheduleRender();};picker.onchange=write;label.append(picker);root.append(label);textParam(root,'Tolérance','threshold',n.params.threshold,0,255);textParam(root,'Progressivité','softness',n.params.softness,0,150);}
 if(n.type==='gpu'){for(const key of ['red','green','blue'])textParam(root,'Canal '+key+' (%)',key,n.params[key],0,200);}
 if(n.type==='brightness')textParam(root,'Luminosité (%)','amount',n.params.amount,0,250);
 if(n.type==='contrast')textParam(root,'Contraste (%)','amount',n.params.amount,0,250);
 if(n.type==='saturation')textParam(root,'Saturation (%)','amount',n.params.amount,0,300);
 if(n.type==='blur')textParam(root,'Rayon de flou (px)','radius',n.params.radius,0,30);
 if(n.type==='tint'){const label=document.createElement('label');label.textContent='Couleur de teinte';const picker=document.createElement('input');picker.type='color';picker.value=n.params.color;picker.oninput=()=>{n.params.color=picker.value;scheduleRender();};picker.onchange=()=>write();label.append(picker);root.append(label);textParam(root,'Intensité (%)','strength',n.params.strength,0,100);}
 const actions=document.createElement('div');actions.className='row-actions';
 if(n.type!=='output'){const del=document.createElement('button');del.textContent='Supprimer nœud';del.onclick=()=>{if(images.has(n.id)){URL.revokeObjectURL(images.get(n.id).url);images.delete(n.id);}if(videos.has(n.id)){const media=videos.get(n.id);media.element.pause();media.element.removeAttribute('src');media.element.load();URL.revokeObjectURL(media.url);videos.delete(n.id);}nodes=nodes.filter(x=>x.id!==n.id);edges=edges.filter(e=>e.to!==n.id&&e.from!==n.id);selected=nodes.find(x=>x.type==='output')?.id||nodes[0]?.id||null;commit('Nœud supprimé.');};actions.append(del);}
 if(DEFINITIONS[n.type].inputs.length){const unlink=document.createElement('button');unlink.textContent='Déconnecter';unlink.onclick=()=>{edges=edges.filter(e=>e.to!==n.id);commit('Entrée déconnectée.');};actions.append(unlink);}root.append(actions);
}
function canvas(){const c=document.createElement('canvas');c.width=WIDTH;c.height=HEIGHT;return c;}
function drawSample(ctx){const grad=ctx.createLinearGradient(0,0,WIDTH,HEIGHT);grad.addColorStop(0,'#16497b');grad.addColorStop(.5,'#c88964');grad.addColorStop(1,'#e8c5a0');ctx.fillStyle=grad;ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.fillStyle='#152f46';ctx.fillRect(0,260,WIDTH,100);ctx.fillStyle='#f8dfa9';ctx.beginPath();ctx.arc(470,100,50,0,Math.PI*2);ctx.fill();ctx.font='bold 43px system-ui';ctx.fillStyle='white';ctx.fillText('WARLIKE',48,147);ctx.font='24px system-ui';ctx.fillText('NODE · IMAGE DE DÉMO',48,187);}
function sourceCanvas(n){const c=canvas(),ctx=c.getContext('2d'),media=images.get(n.id),img=media?.img;if(img){const fit=Math.min(WIDTH/img.naturalWidth,HEIGHT/img.naturalHeight);const w=img.naturalWidth*fit,h=img.naturalHeight*fit;ctx.drawImage(img,(WIDTH-w)/2,(HEIGHT-h)/2,w,h);}else drawSample(ctx);return c;}
function videoCanvas(n){const c=canvas(),ctx=c.getContext('2d');const v=videos.get(n.id)?.element;if(!v)return c;if(v.readyState>=2&&v.videoWidth&&v.videoHeight){const fit=Math.min(WIDTH/v.videoWidth,HEIGHT/v.videoHeight),w=v.videoWidth*fit,h=v.videoHeight*fit;ctx.drawImage(v,(WIDTH-w)/2,(HEIGHT-h)/2,w,h);}return c;}
function mergeCanvas(background,foreground,n){const c=canvas(),ctx=c.getContext('2d');ctx.drawImage(background,0,0);ctx.globalAlpha=bound(interpolate(n,'opacity',time),0,100,100)/100;ctx.globalCompositeOperation=n.params.mode||'source-over';ctx.drawImage(foreground,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';return c;}
function applyNode(n,upstream){
 const p=n.params||{},v=k=>interpolate(n,k,time),c=canvas(),ctx=c.getContext('2d',{willReadFrequently:true});
 if(['brightness','contrast','saturation','grayscale','blur'].includes(n.type)){
  if(n.type==='brightness')ctx.filter='brightness('+bound(v('amount'),0,250,100)+'%)';
  if(n.type==='contrast')ctx.filter='contrast('+bound(v('amount'),0,250,100)+'%)';
  if(n.type==='saturation')ctx.filter='saturate('+bound(v('amount'),0,300,100)+'%)';
  if(n.type==='grayscale')ctx.filter='grayscale(100%)';
  if(n.type==='blur')ctx.filter='blur('+bound(v('radius'),0,30,0)+'px)';
  ctx.drawImage(upstream,0,0);ctx.filter='none';return c;
 }
 if(n.type==='gpu'){try{gpuBackend='WebGL2';return gpuColor(upstream,bound(v('red'),0,200,100)/100,bound(v('green'),0,200,100)/100,bound(v('blue'),0,200,100)/100);}catch(err){gpuBackend='Canvas2D (repli CPU)';ctx.drawImage(upstream,0,0);const data=ctx.getImageData(0,0,WIDTH,HEIGHT);for(let i=0;i<data.data.length;i+=4){data.data[i]*=v('red')/100;data.data[i+1]*=v('green')/100;data.data[i+2]*=v('blue')/100;}ctx.putImageData(data,0,0);return c;}}
 ctx.drawImage(upstream,0,0);
 if(n.type==='tint'){ctx.fillStyle=/^#[0-9a-f]{6}$/i.test(p.color)?p.color:'#48b5fa';ctx.globalAlpha=bound(v('strength'),0,100,30)/100;ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.globalAlpha=1;}
 if(n.type==='mask'){const x=WIDTH*v('x')/100,y=HEIGHT*v('y')/100,rx=Math.max(1,WIDTH*v('rx')/100),ry=Math.max(1,HEIGHT*v('ry')/100),soft=bound(v('feather'),0,100,0)/100;const m=canvas(),mctx=m.getContext('2d');mctx.fillStyle='#fff';mctx.beginPath();mctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);mctx.fill();const md=mctx.getImageData(0,0,WIDTH,HEIGHT),pixels=ctx.getImageData(0,0,WIDTH,HEIGHT);for(let py=0;py<HEIGHT;py++)for(let px=0;px<WIDTH;px++){const i=(py*WIDTH+px)*4,d=Math.sqrt(((px-x)/rx)**2+((py-y)/ry)**2),alpha=soft?Math.min(1,Math.max(0,(1-d)/soft)):d<=1?1:0;pixels.data[i+3]*=v('invert')>=50?1-alpha:alpha;}ctx.putImageData(pixels,0,0);}
 if(n.type==='chroma'){const hex=/^#[0-9a-f]{6}$/i.test(p.color)?p.color:'#00ff00',r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16),pixels=ctx.getImageData(0,0,WIDTH,HEIGHT),threshold=bound(v('threshold'),0,255,75),soft=Math.max(.001,bound(v('softness'),0,150,25));for(let i=0;i<pixels.data.length;i+=4){const distance=Math.hypot(pixels.data[i]-r,pixels.data[i+1]-g,pixels.data[i+2]-b);pixels.data[i+3]*=Math.max(0,Math.min(1,(distance-threshold)/soft));}ctx.putImageData(pixels,0,0);}
 return c;
}
function evaluate(id,stack=new Set(),memo=new Map()){if(stack.has(id))throw Error('Cycle dans le graphe.');if(memo.has(id))return memo.get(id);const n=nodeBy(id);if(!n)throw Error('Nœud absent.');stack.add(id);let result;if(n.type==='source')result=sourceCanvas(n);else{if(n.type==='video')result=videoCanvas(n);else if(n.type==='merge'){const bg=incoming(edges,id,'background'),fg=incoming(edges,id,'foreground');if(!bg||!fg)throw Error('Fusion : relie fond et avant-plan');result=mergeCanvas(evaluate(bg,stack,memo),evaluate(fg,stack,memo),n);}else{const input=incoming(edges,id,'image');if(!input)throw Error('Entrée non connectée : '+TYPES[n.type].name);const upstream=evaluate(input,stack,memo);result=n.type==='output'?upstream:applyNode(n,upstream);}}stack.delete(id);memo.set(id,result);return result;}
function render(){try{gpuBackend='non utilisé';const out=nodes.find(n=>n.type==='output');if(!out)throw Error('Ajoute un nœud Sortie PNG.');const final=evaluate(out.id);const ctx=$('preview').getContext('2d');ctx.clearRect(0,0,WIDTH,HEIGHT);ctx.drawImage(final,0,0);$('renderInfo').textContent=WIDTH+' × '+HEIGHT+' · rendu local'+(images.size?' · sources locales':' · sources de démonstration')+(gpuBackend!=='non utilisé'?' · GPU : '+gpuBackend:'');status('Graphe évalué : '+nodes.length+' nœuds.');return true;}catch(e){$('renderInfo').textContent='Rendu indisponible : '+e.message;status(e.message);return false;}}
function scheduleRender(){clearTimeout(renderTimer);renderTimer=setTimeout(render,90);}
function commit(message){write();renderGraph();renderProperties();scheduleRender();status(message);}
for(const [type,def] of Object.entries(TYPES)){const b=document.createElement('button');b.type='button';const name=document.createElement('span');name.textContent='＋ '+def.name;const category=document.createElement('small');category.textContent=def.group;b.append(name,category);b.onclick=()=>{if(nodes.length>=40)return status('Limite de 40 nœuds.');const offset=nodes.length*27;const n=newNode(type,120+offset%1050,110+offset%580);nodes.push(n);selected=n.id;commit('Nœud '+def.name+' ajouté.');};$('palette').append(b);}
$('render').onclick=render;
$('exportEffect').onclick=()=>{try{const data=JSON.stringify(effectEnvelope(graph()),null,2);downloadFile(new Blob([data],{type:'application/json'}),'warlike-node-effect.json');status('Effet exporté : contrat lisible par d’autres applications WarLike, sans médias.');}catch(e){status(e.message);}};
const MONTEUR_ORIGIN='https://warlike-monteur.pages.dev';
$('sendToMonteur').onclick=()=>{
 let payload;
 try{payload=effectEnvelope(graph());}catch(e){status('Transfert impossible : '+e.message);return;}
 const channel=Array.from(crypto.getRandomValues(new Uint8Array(20)),b=>b.toString(16).padStart(2,'0')).join('');
 const receiver=window.open(MONTEUR_ORIGIN+'/?nodeTransfer='+channel,'_blank');
 if(!receiver){status('Fenêtre Monteur bloquée. Autorise les fenêtres ou utilise Exporter effet.');return;}
 let finished=false,sent=false;
 const cleanup=()=>{finished=true;window.removeEventListener('message',onMessage);};
 const onMessage=event=>{
  if(finished||event.origin!==MONTEUR_ORIGIN||event.source!==receiver||event.data?.channel!==channel)return;
  if(event.data.type==='warlike-monteur-ready-v1'){
   if(sent)return;sent=true;
   receiver.postMessage({type:'warlike-node-transfer-v1',channel,effect:payload},MONTEUR_ORIGIN);
   status('Graphe transmis à Monteur, en attente de confirmation…');
  }else if(event.data.type==='warlike-monteur-imported-v1'){
   status(event.data.ok?'Graphe reçu par Monteur. '+(event.data.detail||''):('Monteur : '+(event.data.error||'transfert refusé')));
   cleanup();
  }
 };
 window.addEventListener('message',onMessage);
 // The receiving page also sends a ready message on load, avoiding races.
 receiver.postMessage({type:'warlike-node-ping-v1',channel},MONTEUR_ORIGIN);
};
function downloadFile(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function connectedVideoNodes(){
 const output=nodes.find(n=>n.type==='output');if(!output)return[];
 const visited=new Set(),sources=[];
 function visit(id){if(visited.has(id))return;visited.add(id);const n=nodeBy(id);if(n?.type==='video')sources.push(n);for(const e of edges)if(e.to===id)visit(e.from);}
 visit(output.id);return sources;
}
async function validateExportedVideo(blob){
 if(blob.size<1024)throw Error('Export WebM vide ou trop petit.');
 const url=URL.createObjectURL(blob),probe=document.createElement('video');
 probe.muted=true;probe.preload='metadata';
 try{
  await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>finish(Error('Vérification WebM expirée.')),12000);
   function finish(error){clearTimeout(timeout);probe.removeEventListener('loadedmetadata',ready);probe.removeEventListener('error',failed);error?reject(error):resolve();}
   const ready=()=>finish(),failed=()=>finish(Error('Fichier WebM illisible.'));
   probe.addEventListener('loadedmetadata',ready);probe.addEventListener('error',failed);probe.src=url;probe.load();
  });
  if(!probe.videoWidth||!probe.videoHeight)throw Error('Piste vidéo WebM absente.');
  return{width:probe.videoWidth,height:probe.videoHeight};
 }finally{probe.pause();probe.removeAttribute('src');probe.load();URL.revokeObjectURL(url);}
}
$('exportWebM').onclick=async()=>{
 if(recording)return;const required=connectedVideoNodes();if(!required.length)return status('Connecte au moins un nœud Source vidéo à la sortie.');if(required.some(n=>!videos.has(n.id)))return status('Importe les fichiers de toutes les sources vidéo connectées avant l’export.');if(document.hidden)return status('Garde l’onglet visible pendant l’export en temps réel.');
 if(!window.MediaRecorder||!$('preview').captureStream)return status('WebM/MediaRecorder indisponible.');
 const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));if(!mime)return status('Encodeur WebM non disponible.');
 recording=true;playing=false;$('playTimeline').textContent='▶ Lecture';$('exportWebM').disabled=true;$('playTimeline').disabled=true;$('timelineTime').disabled=true;$('loadGraph').disabled=true;let recorder,stream;
 try{time=0;await seekVideo(0);render();stream=$('preview').captureStream(graphFPS);const chunks=[];recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2500000});const done=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=e=>reject(e.error||Error('Encodeur en erreur'));recorder.onstop=()=>resolve(new Blob(chunks,{type:mime}));});recorder.start(500);
 const began=performance.now();while(time<graphLength){if(document.hidden)throw Error('Onglet masqué : export en temps réel interrompu.');const elapsed=(performance.now()-began)/1000;time=Math.min(graphLength,elapsed);await seekVideo(time);render();syncTimelineUI();await new Promise(resolve=>setTimeout(resolve,Math.max(8,1000/graphFPS)));}recorder.stop();const blob=await done;status('Vérification du WebM exporté…');await validateExportedVideo(blob);downloadFile(blob,'warlike-node-composite.webm');status('Export WebM vidéo seule terminé ('+(blob.size/1048576).toFixed(1)+' Mo). Vérifie le fichier sur ton appareil.');
 }catch(err){status('Export interrompu : '+err.message);if(recorder?.state==='recording')recorder.stop();}
 finally{for(const track of stream?.getTracks()||[])track.stop();recording=false;$('exportWebM').disabled=false;$('playTimeline').disabled=false;$('timelineTime').disabled=false;$('loadGraph').disabled=false;}
};
$('exportPNG').onclick=()=>{if(!render())return;$('preview').toBlob(blob=>{if(!blob)return status('Export PNG indisponible.');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='warlike-node-'+new Date().toISOString().slice(0,10)+'.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);},'image/png');};
$('saveGraph').onclick=()=>{const data=JSON.stringify(graph(),null,2);const url=URL.createObjectURL(new Blob([data],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='warlike-node-graph.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);status('Graphe exporté. Les images locales ne sont pas incluses.');};
function validateGraph(data){return migrate(data);}
function installedNodePresets(){try{const installed=JSON.parse(localStorage.getItem('warlike.extensions.v1')||'{}');const kit=installed['node-compositing-kit'];return kit?.enabled&&kit.schema==='warlike.node.presets.v1'&&Array.isArray(kit.data?.presets)?kit.data.presets.filter(p=>p&&typeof p.id==='string'&&p.graph):[]}catch{return []}}
function refreshNodePresets(){const select=$('extensionPreset'),current=select.value;select.replaceChildren(new Option('Presets installés…',''));for(const preset of installedNodePresets()){select.append(new Option(preset.name||preset.id,preset.id))}if([...select.options].some(o=>o.value===current))select.value=current}
$('applyExtensionPreset').onclick=()=>{const preset=installedNodePresets().find(p=>p.id===$('extensionPreset').value);if(!preset)return status('Installe et active un preset depuis Extensions.');try{const validated=validateGraph(preset.graph);if(!confirm('Remplacer le graphe en cours par '+(preset.name||preset.id)+' ?'))return;applyGraph(validated);selected=nodes[0]?.id||null;armed=null;commit('✓ Preset installé appliqué : '+(preset.name||preset.id)+'. Réimporte les sources médias.')}catch(error){status('Preset incompatible : '+error.message)}};
window.addEventListener('storage',e=>{if(e.key==='warlike.extensions.v1')refreshNodePresets()});refreshNodePresets();

function resetLocalMedia(){for(const media of images.values())URL.revokeObjectURL(media.url);images.clear();for(const media of videos.values()){media.element.pause();media.element.removeAttribute('src');media.element.load();URL.revokeObjectURL(media.url);}videos.clear();}
function applyGraph(valid){resetLocalMedia();nodes=valid.nodes;edges=valid.edges;graphLength=valid.length;graphFPS=valid.fps;time=0;syncTimelineUI();}
$('loadGraph').onchange=async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>300000)throw Error('Graphe trop volumineux.');const data=JSON.parse(await file.text());const valid=validateGraph(data);applyGraph(valid);selected=nodes[0]?.id||null;armed=null;commit('Graphe restauré. Réimporte tes médias dans les sources.');}catch(err){status('Import refusé : '+err.message);}};
$('newGraph').onclick=()=>{if(!confirm('Remplacer le graphe actuel ? Exporte-le avant si nécessaire.'))return;resetLocalMedia();defaultGraph();commit('Nouveau graphe.');};
$('fitGraph').onclick=()=>{const v=$('viewport');v.scrollTo({left:0,top:0,behavior:'smooth'});};
window.addEventListener('beforeunload',()=>{for(const media of images.values())URL.revokeObjectURL(media.url);for(const media of videos.values())URL.revokeObjectURL(media.url);});
try{const data=JSON.parse(localStorage.getItem(STORE)||'null');if(data){const valid=validateGraph(data);applyGraph(valid);selected=nodes[0]?.id||null;}else defaultGraph();}catch{defaultGraph();}
syncTimelineUI();renderGraph();renderProperties();render();
