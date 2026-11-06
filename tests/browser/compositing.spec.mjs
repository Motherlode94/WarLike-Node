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
 await page.locator('#timelineTime').evaluate(el=>{el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}));});
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

test('video source produces a decodable WebM export',async({page})=>{
 const {spawnSync}=await import('node:child_process');
 const {mkdtempSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const dir=mkdtempSync(join(tmpdir(),'wl-node-video-'));
 try{
  const input=join(dir,'fixture.webm'),output=join(dir,'export.webm');
  const gen=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','testsrc2=size=320x180:rate=25:duration=1.2','-an','-c:v','libvpx-vp9',input],{encoding:'utf8',timeout:30000});
  expect(gen.status,'FFmpeg test video generation: '+gen.stderr).toBe(0);
  const g={schema:'warlike-node-v2',fps:25,length:1,nodes:[{id:'v',type:'video',x:50,y:100,params:{}},{id:'o',type:'output',x:370,y:100,params:{}}],edges:[{from:'v',to:'o',input:'image'}]};
  await page.goto('/');
  await page.locator('#loadGraph').setInputFiles({name:'video-graph.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(g))});
  await page.locator('#properties input[type=file]').setInputFiles(input);
  await expect(page.locator('#status')).toContainText('Vidéo chargée');
  const finished=page.waitForEvent('download',{timeout:45000});
  await page.locator('#exportWebM').click();
  const download=await finished;await download.saveAs(output);
  const probe=spawnSync('ffprobe',['-v','error','-show_entries','stream=codec_type,width,height','-of','json',output],{encoding:'utf8',timeout:20000});
  expect(probe.status,probe.stderr).toBe(0);
  const details=JSON.parse(probe.stdout);
  expect(details.streams.some(s=>s.codec_type==='video'&&s.width>0&&s.height>0)).toBeTruthy();
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('two independent video sources blend actual red and blue frames',async({page})=>{
 const {spawnSync}=await import('node:child_process');
 const {mkdtempSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const dir=mkdtempSync(join(tmpdir(),'wl-node-layers-'));
 try{
  const red=join(dir,'red.webm'),blue=join(dir,'blue.webm');
  for(const [color,output] of [['red',red],['blue',blue]]){
   const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c='+color+':s=320x180:r=25:d=1.5','-an','-c:v','libvpx-vp9',output],{encoding:'utf8',timeout:30000});
   expect(result.status,result.stderr).toBe(0);
  }
  const layered={
   schema:'warlike-node-v2',fps:25,length:1.5,
   nodes:[
    {id:'v1',type:'video',x:50,y:100,params:{}},
    {id:'v2',type:'video',x:50,y:330,params:{}},
    {id:'blend',type:'merge',x:350,y:150,params:{opacity:50,mode:'source-over'}},
    {id:'out',type:'output',x:650,y:150,params:{}}
   ],
   edges:[{from:'v1',to:'blend',input:'background'},{from:'v2',to:'blend',input:'foreground'},{from:'blend',to:'out',input:'image'}]
  };
  await page.goto('/');
  await page.locator('#loadGraph').setInputFiles({name:'layers.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(layered))});
  await page.locator('.node[data-id="v1"]').click();
  await page.locator('#properties input[type="file"]').setInputFiles(red);
  await expect(page.locator('#status')).toContainText('Vidéo chargée');
  await page.locator('.node[data-id="v2"]').click();
  await page.locator('#properties input[type="file"]').setInputFiles(blue);
  await expect(page.locator('#status')).toContainText('2 source(s) vidéo');
  await page.locator('#timelineTime').evaluate(el=>{el.value='0.4';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await expect(page.locator('#timeReadout')).toContainText('0.40');
  await expect.poll(async()=>page.locator('#preview').evaluate(canvas=>{
   const d=canvas.getContext('2d').getImageData(320,180,1,1).data;
   return d[0]>35&&d[2]>35&&d[1]<30;
  })).toBe(true);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
