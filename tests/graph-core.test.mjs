import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,migrate,interpolate,effectEnvelope} from '../graph-core.js';
function graph(){const nodes=[initial('source','a'),initial('contrast','b'),initial('merge','c'),initial('output','d')];return{schema:'warlike-node-v2',nodes,edges:[{from:'a',to:'b',input:'image'},{from:'a',to:'c',input:'background'},{from:'b',to:'c',input:'foreground'},{from:'c',to:'d',input:'image'}],length:6,fps:25};}
test('two independent inputs feed the merge compositor',()=>{assert.equal(migrate(graph()).edges.length,4);});
test('cycles and duplicated inputs are rejected',()=>{
 const g=graph();g.edges.push({from:'c',to:'b',input:'image'});assert.throws(()=>migrate(g));
 const h=graph();h.edges=h.edges.filter(e=>e.to!=='b');h.edges.push({from:'c',to:'b',input:'image'});assert.throws(()=>migrate(h),/Cycle/);
});
test('legacy v1 graphs migrate to input named image',()=>{
 const g={schema:'warlike-node-v1',nodes:[initial('source','a'),initial('contrast','b'),initial('output','d')],edges:[{from:'a',to:'b'},{from:'b',to:'d'}]};
 assert.equal(migrate(g).edges[0].input,'image');
});
test('linear keyframe values interpolate deterministically',()=>{
 const node=initial('brightness','a');node.keyframes={amount:[{t:0,value:100},{t:4,value:200}]};
 assert.equal(interpolate(node,'amount',2),150);assert.equal(interpolate(node,'amount',10),200);
});
test('effect contract contains only graph data, no local media',()=>{
 const effect=effectEnvelope(graph());assert.equal(effect.format,'warlike-node-effect');assert.equal(effect.requiresLocalMedia,true);assert.equal(JSON.stringify(effect).includes('blob:'),false);
});
