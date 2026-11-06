// A reusable WebGL2 color pass. Browser-specific context loss falls back to Canvas2D in app.js.
let pipeline=null;
function compile(gl,type,source){
 const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
 if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw Error('Shader : '+error);}
 return shader;
}
function createPipeline(width,height){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const gl=canvas.getContext('webgl2',{preserveDrawingBuffer:true,premultipliedAlpha:false});
 if(!gl)throw Error('WebGL2 indisponible');
 const vertex=compile(gl,gl.VERTEX_SHADER,`#version 300 es
 in vec2 position;out vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.0,1.0);}`);
 const fragment=compile(gl,gl.FRAGMENT_SHADER,`#version 300 es
 precision mediump float;
 in vec2 uv;uniform sampler2D img;uniform vec3 gains;out vec4 frag;
 void main(){vec4 p=texture(img,vec2(uv.x,1.0-uv.y));frag=vec4(clamp(p.rgb*gains,0.0,1.0),p.a);}`);
 const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('WebGL2 : lien du programme impossible');
 gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);
 gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
 const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 gl.uniform1i(gl.getUniformLocation(program,'img'),0);
 const gains=gl.getUniformLocation(program,'gains');
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(pipeline?.canvas===canvas)pipeline=null;});
 return {canvas,gl,program,texture,gains,width,height};
}
export function resetGPU(){if(pipeline){pipeline.gl.getExtension('WEBGL_lose_context')?.loseContext();pipeline=null;}}
export function gpuColor(source,red=1,green=1,blue=1){
 if(!source?.width||!source?.height)throw Error('Source GPU vide.');
 if(!pipeline||pipeline.width!==source.width||pipeline.height!==source.height||pipeline.gl.isContextLost()){
  if(pipeline)resetGPU();
  pipeline=createPipeline(source.width,source.height);
 }
 const p=pipeline,{gl}=p;
 gl.viewport(0,0,p.width,p.height);gl.useProgram(p.program);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,p.texture);
 gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
 gl.uniform3f(p.gains,red,green,blue);
 gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
 if(gl.getError()!==gl.NO_ERROR)throw Error('Erreur du rendu WebGL2.');
 return p.canvas;
}
