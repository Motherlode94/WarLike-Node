import {test,expect} from '@playwright/test';
const graph={
 schema:'warlike-node-v2',fps:25,length:2,
 nodes:[
  {id:'a',type:'source',x:80,y:160,params:{},keyframes:{}},
  {id:'b',type:'source',x:80,y:330,params:{},keyframes:{}},
  {id:'m',type:'merge',x:380,y:160,params:{opacity:50,mode:'screen'},keyframes:{opacity:[{t:0,value:0},{t:2,value:100}]}},
  {id:'o',type:'output',x:710,y:160,params:{},keyframes:{}}
 ],
 edges:[{from:'a',to:'m',input:'background'},{from:'b',to:'m',input:'foreground'},{from:'m',to:'o',input:'image'}]
};
test('multi-layer graph imports, animates and exports a real PNG',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await expect(page.locator('#renderInfo')).toContainText('rendu local');
 await page.locator('#loadGraph').setInputFiles({name:'graph.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(graph))});
 await expect(page.locator('#graphInfo')).toContainText('4 nœuds · 3 connexions');
 await page.locator('#timelineTime').fill('1');await page.locator('#timelineTime').dispatchEvent('input');
 await expect(page.locator('#timeReadout')).toContainText('1.00');
 const promise=page.waitForEvent('download');await page.locator('#exportPNG').click();const download=await promise;
 expect(download.suggestedFilename()).toMatch(/\.png$/);
 expect(errors).toEqual([]);
});
test('invalid cyclic graph is blocked without destroying current state',async({page})=>{
 await page.goto('/');
 const old=await page.locator('#graphInfo').textContent();
 const invalid={...graph,edges:[...graph.edges,{from:'m',to:'a',input:'image'}]};
 await page.locator('#loadGraph').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});
 await expect(page.locator('#status')).toContainText('Import refusé');
 await expect(page.locator('#graphInfo')).toHaveText(old);
});
