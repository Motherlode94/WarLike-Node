import {migrate} from './graph-core.js';

export const NODE_EXTENSION_IDS=Object.freeze(['node-compositing-kit','node-cinema-pack']);
const presetId=/^[a-z0-9][a-z0-9-]{1,49}$/;
export function validateNodePresetPack(value){
 if(!value||!Array.isArray(value.presets)||value.presets.length>30)throw Error('Pack de nœuds invalide.');
 const seen=new Set();
 const presets=[];
 for(const preset of value.presets){
  if(!preset||typeof preset.id!=='string'||!presetId.test(preset.id)
   ||seen.has(preset.id)||typeof preset.name!=='string'
   ||!preset.name.trim()||preset.name.length>80)throw Error('Preset Node invalide ou dupliqué.');
  seen.add(preset.id);
  // Every graph is validated with the exact editor schema and rejects invalid
  // ports, cycles and unknown nodes before entering the application.
  const graph=migrate(preset.graph);
  if(graph.nodes.length===0||!graph.nodes.some(n=>n.type==='output'))
   throw Error('Preset Node sans sortie.');
  presets.push({id:preset.id,name:preset.name.trim(),graph});
 }
 return presets;
}
export function installedNodePresets(storage){
 let records;
 try{records=JSON.parse(storage?.getItem('warlike.extensions.v1')||'{}')}catch{return []}
 if(!records||typeof records!=='object'||Array.isArray(records))return [];
 return NODE_EXTENSION_IDS.flatMap(id=>{
  const pack=records[id];
  if(!pack?.enabled||pack.schema!=='warlike.node.presets.v1')return [];
  try{return validateNodePresetPack(pack.data).map(p=>({...p,id:id+':'+p.id}))}
  catch(error){console.warn('[WarLike Node] Extension invalide :',id,error.message);return []}
 });
}
