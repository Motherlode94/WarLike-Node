import test from 'node:test';import assert from 'node:assert/strict';
import {installedNodePresets,validateNodePresetPack} from '../node-extension-packs.js';import {migrate} from '../graph-core.js';
const graph={schema:'warlike-node-v2',nodes:[{id:'a',type:'source'},{id:'b',type:'contrast',params:{amount:120}},{id:'c',type:'output'}],edges:[{from:'a',to:'b',input:'image'},{from:'b',to:'c',input:'image'}]};
const entry=(enabled=true)=>({enabled,schema:'warlike.node.presets.v1',data:{presets:[{id:'grade',name:'Grade',graph}]}});
test('enabled packs remain distinct even with the same preset id',()=>{const store={getItem:()=>JSON.stringify({'node-compositing-kit':entry(),'node-cinema-pack':entry()})};const presets=installedNodePresets(store);assert.equal(presets.length,2);assert.notEqual(presets[0].id,presets[1].id);assert.equal(migrate(presets[1].graph).nodes.length,3)});
test('disabled, malformed and unknown packs are ignored',()=>{const store={getItem:()=>JSON.stringify({'node-compositing-kit':entry(false),'node-cinema-pack':{enabled:true,schema:'bad'},unknown:entry()})};assert.deepEqual(installedNodePresets(store),[]);assert.deepEqual(installedNodePresets({getItem:()=>'{'}),[])});

test('plugin packs reject duplicate IDs, invalid node links and missing outputs',()=>{
 const valid={id:'grade',name:'Grade',graph};
 assert.equal(validateNodePresetPack({presets:[valid]}).length,1);
 assert.throws(()=>validateNodePresetPack({presets:[valid,valid]}),/dupliqué/);
 assert.throws(()=>validateNodePresetPack({presets:[{...valid,graph:{...graph,edges:[{from:'missing',to:'c',input:'image'}]}}]}),/Lien invalide/);
 assert.throws(()=>validateNodePresetPack({presets:[{...valid,graph:{...graph,nodes:graph.nodes.filter(n=>n.type!=='output'),edges:[]}}]}),/sans sortie/);
 assert.throws(()=>validateNodePresetPack({presets:Array.from({length:31},(_,i)=>({...valid,id:'id-'+i}))}),/invalide/);
});
test('corrupt enabled extension cannot poison unrelated valid pack',()=>{
 const corrupt=entry();
 corrupt.data.presets=[{id:'bad',name:'Invalid',graph:{...graph,edges:[{from:'a',to:'missing',input:'image'}]}}];
 const store={getItem:()=>JSON.stringify({'node-compositing-kit':corrupt,'node-cinema-pack':entry()})};
 const presets=installedNodePresets(store);
 assert.equal(presets.length,1);
 assert.equal(presets[0].id,'node-cinema-pack:grade');
 assert.equal(presets[0].graph.schema,'warlike-node-v2');
});
