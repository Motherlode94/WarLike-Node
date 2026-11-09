export const NODE_EXTENSION_IDS=Object.freeze(['node-compositing-kit','node-cinema-pack']);
export function installedNodePresets(storage){
 try{const records=JSON.parse(storage.getItem('warlike.extensions.v1')||'{}');return NODE_EXTENSION_IDS.flatMap(id=>{const pack=records[id];if(!pack?.enabled||pack.schema!=='warlike.node.presets.v1'||!Array.isArray(pack.data?.presets))return [];return pack.data.presets.filter(p=>p&&typeof p.id==='string'&&p.graph).map(p=>({...p,id:id+':'+p.id}))})}catch{return []}
}
