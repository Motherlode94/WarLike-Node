export const DEFINITIONS={
 source:{name:'Source image',inputs:[],params:{}},
 video:{name:'Source vidéo',inputs:[],params:{}},
 brightness:{name:'Luminosité',inputs:['image'],params:{amount:110}},
 contrast:{name:'Contraste',inputs:['image'],params:{amount:120}},
 saturation:{name:'Saturation',inputs:['image'],params:{amount:140}},
 grayscale:{name:'Noir et blanc',inputs:['image'],params:{}},
 blur:{name:'Flou',inputs:['image'],params:{radius:3}},
 tint:{name:'Teinte',inputs:['image'],params:{color:'#48b5fa',strength:30}},
 merge:{name:'Fusion couches',inputs:['background','foreground'],params:{opacity:100,mode:'source-over'}},
 mask:{name:'Masque elliptique',inputs:['image'],params:{x:50,y:50,rx:30,ry:30,feather:0,invert:0}},
 chroma:{name:'Détourage couleur',inputs:['image'],params:{color:'#00ff00',threshold:75,softness:25}},
 gpu:{name:'Shader GPU couleurs',inputs:['image'],params:{red:100,green:100,blue:100}},
 output:{name:'Sortie',inputs:['image'],params:{}}
};
export const clamp=(v,min,max,def=min)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):def;
export function initial(type,id,x=120,y=140){if(!DEFINITIONS[type])throw Error('Type de nœud inconnu');return{id,type,x,y,params:{...DEFINITIONS[type].params},keyframes:{}};}
export function migrate(data){
 if(!data||!['warlike-node-v1','warlike-node-v2'].includes(data.schema)||!Array.isArray(data.nodes)||!Array.isArray(data.edges)||data.nodes.length>60||data.edges.length>120)throw Error('Format de graphe invalide');
 const nodes=data.nodes.map(n=>{
  if(!DEFINITIONS[n.type]||typeof n.id!=='string'||n.id.length>80||!n.id)throw Error('Nœud invalide');
  const obj=initial(n.type,n.id,clamp(n.x,0,1700,100),clamp(n.y,0,1100,100));
  for(const [k,d] of Object.entries(obj.params)){
   const raw=n.params?.[k];
   if(k==='color')obj.params[k]=/^#[0-9a-f]{6}$/i.test(raw)?raw:d;
   else if(k==='mode')obj.params[k]=['source-over','multiply','screen','overlay','lighter'].includes(raw)?raw:d;
   else obj.params[k]=clamp(raw,-500,500,d);
  }
  if(n.keyframes&&typeof n.keyframes==='object'){
   for(const key of Object.keys(obj.params)){
    const seq=n.keyframes[key];
    if(!Array.isArray(seq)||typeof obj.params[key]!=='number')continue;
    obj.keyframes[key]=seq.slice(0,100).filter(k=>k&&Number.isFinite(k.t)&&Number.isFinite(k.value)&&k.t>=0&&k.t<=3600).map(k=>({t:k.t,value:clamp(k.value,-500,500)})).sort((a,b)=>a.t-b.t);
   }
  }
  return obj;
 });
 const ids=new Set(nodes.map(n=>n.id));if(ids.size!==nodes.length)throw Error('Identifiants en double');
 const index=new Map(nodes.map(n=>[n.id,n]));
 const edges=data.edges.map(e=>{const from=index.get(e.from),to=index.get(e.to);if(!from||!to||from.id===to.id||DEFINITIONS[from.type].inputs.length===0&&from.type==='output')throw Error('Lien invalide');const input=e.input||(DEFINITIONS[to.type].inputs.length===1?DEFINITIONS[to.type].inputs[0]:'background');if(!DEFINITIONS[to.type].inputs.includes(input)||from.type==='output')throw Error('Port invalide');return{from:e.from,to:e.to,input};});
 const inputs=new Set();for(const e of edges){const key=e.to+':'+e.input;if(inputs.has(key))throw Error('Entrée déjà connectée');inputs.add(key);}
 const state=new Map();
 function visit(id){if(state.get(id)===1)throw Error('Cycle interdit');if(state.get(id)===2)return;state.set(id,1);for(const e of edges)if(e.to===id)visit(e.from);state.set(id,2);}
 for(const n of nodes)visit(n.id);
 return{schema:'warlike-node-v2',nodes,edges,fps:clamp(data.fps,1,60,25),length:clamp(data.length,0.5,120,10)};
}
export function interpolate(node,key,time){
 const seq=node.keyframes?.[key];
 if(!Array.isArray(seq)||!seq.length)return node.params[key];
 if(time<=seq[0].t)return seq[0].value;
 for(let i=1;i<seq.length;i++){const left=seq[i-1],right=seq[i];if(time<=right.t){const t=(time-left.t)/Math.max(0.0001,right.t-left.t);return left.value+(right.value-left.value)*t;}}
 return seq[seq.length-1].value;
}
export function incoming(edges,id,input){return edges.find(e=>e.to===id&&e.input===input)?.from||null;}
export function effectEnvelope(data){const validated=migrate(data);return{format:'warlike-node-effect',version:1,graph:validated,requiresLocalMedia:validated.nodes.some(n=>['source','video'].includes(n.type))};}
