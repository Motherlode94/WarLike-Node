// A small WebGL2-backed color-pass. It explicitly throws on unavailable GPU;
 // the caller may choose a Canvas2D fallback and report that fact.
export function gpuColor(source,red=1,green=1,blue=1){
 const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
 const gl=canvas.getContext('webgl2',{preserveDrawingBuffer:true,premultipliedAlpha:false});
 if(!gl)throw Error('WebGL2 indisponible');
 const shader=(type,code)=>{const obj=gl.createShader(type);gl.shaderSource(obj,code);gl.compileShader(obj);if(!gl.getShaderParameter(obj,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(obj));return obj;};
 const vs=shader(gl.VERTEX_SHADER,`#version 300 es
 in vec2 position;out vec2 uv;
 void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`);
 const fs=shader(gl.FRAGMENT_SHADER,`#version 300 es
 precision mediump float;in vec2 uv;uniform sampler2D img;uniform vec3 gains;out vec4 frag;
 void main(){vec4 p=texture(img,vec2(uv.x,1.-uv.y));frag=vec4(clamp(p.rgb*gains,0.,1.),p.a);}`);
 const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Compilation GPU impossible');
 gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 const loc=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
 gl.uniform1i(gl.getUniformLocation(program,'img'),0);
 gl.uniform3f(gl.getUniformLocation(program,'gains'),red,green,blue);
 gl.viewport(0,0,canvas.width,canvas.height);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.finish();
 gl.deleteTexture(tex);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
 return canvas;
}
