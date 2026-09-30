// WebGPU-first renderer with a WebGL2 fallback, after the kumiki joinery viewer
// (github.com/tim003/JointMCP, Tim/webgpu-kumiki-tim). Every CAD part is drawn
// separately so it can carry its own offset, pop-in scale, highlight tint and
// edge colour while the assembly timeline plays.

const PART_STRIDE = 256; // WebGPU dynamic uniform offset alignment
const VERTEX_STRIDE = 28; // position f32x3, normal f32x3, colour unorm8x4

const WGSL = /* wgsl */ `
struct Global { viewProj: mat4x4f, eye: vec4f, light: vec4f, style: vec4f }
struct Part { offset: vec4f, pivot: vec4f, tint: vec4f, edge: vec4f }
@group(0) @binding(0) var<uniform> g: Global;
@group(1) @binding(0) var<uniform> p: Part;

fn place(pos: vec3f) -> vec3f {
  return p.pivot.xyz + (pos - p.pivot.xyz) * p.offset.w + p.offset.xyz;
}

struct VOut {
  @builtin(position) clip: vec4f,
  @location(0) world: vec3f,
  @location(1) normal: vec3f,
  @location(2) color: vec3f,
}

@vertex fn vsBody(@location(0) pos: vec3f, @location(1) normal: vec3f, @location(2) color: vec4f) -> VOut {
  var o: VOut;
  let world = place(pos);
  o.clip = g.viewProj * vec4f(world, 1.0);
  o.world = world;
  o.normal = normal;
  o.color = color.rgb;
  return o;
}

fn shade(i: VOut) -> vec3f {
  var n = normalize(i.normal);
  let v = normalize(g.eye.xyz - i.world);
  if (dot(n, v) < 0.0) { n = -n; }
  let l = normalize(g.light.xyz);
  let line = g.style.x;
  let base = mix(mix(i.color, vec3f(0.965, 0.96, 0.95), line), p.tint.rgb, p.tint.a);
  let key = max(dot(n, l), 0.0);
  let fill = max(dot(n, normalize(vec3f(-0.4, -0.7, 0.35))), 0.0) * 0.25;
  let sky = 0.5 + 0.5 * n.z;
  let spec = pow(max(dot(n, normalize(l + v)), 0.0), 48.0) * 0.18 * (1.0 - line);
  let shaded = base * (0.34 + 0.16 * sky + key * 0.58 + fill) + vec3f(spec);
  let flat = base * (0.86 + 0.14 * key);
  return mix(shaded, flat, line);
}

@fragment fn fsBody(i: VOut) -> @location(0) vec4f {
  return vec4f(shade(i), 1.0);
}

// Translucent parts (manifest alpha < 1, e.g. the clear polycarbonate case): alpha rides in pivot.w.
@fragment fn fsGlass(i: VOut) -> @location(0) vec4f {
  return vec4f(shade(i), p.pivot.w);
}

@vertex fn vsEdge(@location(0) pos: vec3f) -> @builtin(position) vec4f {
  return g.viewProj * vec4f(place(pos), 1.0);
}

@fragment fn fsEdge() -> @location(0) vec4f {
  return p.edge;
}
`;

const GLSL_PLACE = `
uniform mat4 viewProj;
uniform vec4 offset;
uniform vec4 pivot;
vec3 place(vec3 pos) { return pivot.xyz + (pos - pivot.xyz) * offset.w + offset.xyz; }
`;

const GL_BODY_VS = `#version 300 es
precision highp float;
${GLSL_PLACE}
in vec3 position; in vec3 normal; in vec4 color;
out vec3 vWorld; out vec3 vNormal; out vec3 vColor;
void main() {
  vec3 world = place(position);
  gl_Position = viewProj * vec4(world, 1.0);
  vWorld = world; vNormal = normal; vColor = color.rgb;
}`;

const GL_BODY_FS = `#version 300 es
precision highp float;
uniform vec4 eye; uniform vec4 light; uniform vec4 style; uniform vec4 tint; uniform float alpha;
in vec3 vWorld; in vec3 vNormal; in vec3 vColor;
out vec4 outColor;
void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(eye.xyz - vWorld);
  if (dot(n, v) < 0.0) n = -n;
  vec3 l = normalize(light.xyz);
  float line = style.x;
  vec3 base = mix(mix(vColor, vec3(0.965, 0.96, 0.95), line), tint.rgb, tint.a);
  float key = max(dot(n, l), 0.0);
  float fill = max(dot(n, normalize(vec3(-0.4, -0.7, 0.35))), 0.0) * 0.25;
  float sky = 0.5 + 0.5 * n.z;
  float spec = pow(max(dot(n, normalize(l + v)), 0.0), 48.0) * 0.18 * (1.0 - line);
  vec3 shaded = base * (0.34 + 0.16 * sky + key * 0.58 + fill) + vec3(spec);
  vec3 flatc = base * (0.86 + 0.14 * key);
  outColor = vec4(mix(shaded, flatc, line), alpha);
}`;

const GL_EDGE_VS = `#version 300 es
precision highp float;
${GLSL_PLACE}
in vec3 position;
void main() { gl_Position = viewProj * vec4(place(position), 1.0); }`;

const GL_EDGE_FS = `#version 300 es
precision highp float;
uniform vec4 edge;
out vec4 outColor;
void main() { outColor = edge; }`;

function interleave(mesh) {
  const count = mesh.positions.length / 3;
  const buffer = new ArrayBuffer(count * VERTEX_STRIDE);
  const f32 = new Float32Array(buffer);
  const u8 = new Uint8Array(buffer);
  for (let i = 0; i < count; i++) {
    const f = i * 7;
    f32[f] = mesh.positions[i * 3];
    f32[f + 1] = mesh.positions[i * 3 + 1];
    f32[f + 2] = mesh.positions[i * 3 + 2];
    f32[f + 3] = mesh.normals[i * 3];
    f32[f + 4] = mesh.normals[i * 3 + 1];
    f32[f + 5] = mesh.normals[i * 3 + 2];
    const b = i * VERTEX_STRIDE + 24;
    u8[b] = mesh.colors[i * 3];
    u8[b + 1] = mesh.colors[i * 3 + 1];
    u8[b + 2] = mesh.colors[i * 3 + 2];
    u8[b + 3] = 255;
  }
  return buffer;
}

export async function createRenderer(canvas, mesh, { prefer = 'webgpu' } = {}) {
  if (prefer !== 'webgl' && 'gpu' in navigator) {
    try {
      return await createWebGpuRenderer(canvas, mesh);
    } catch (error) {
      console.warn('WebGPU unavailable, falling back to WebGL2:', error);
    }
  }
  return createWebGlRenderer(canvas, mesh);
}

function canvasSize(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height };
}

async function createWebGpuRenderer(canvas, mesh) {
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
    || await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('No WebGPU adapter');
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  if (!context) throw new Error('No WebGPU canvas context');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });

  const makeBuffer = (data, usage) => {
    const size = Math.max(4, Math.ceil(data.byteLength / 4) * 4);
    const buffer = device.createBuffer({ size, usage, mappedAtCreation: true });
    new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(data.buffer ?? data, data.byteOffset ?? 0, data.byteLength));
    buffer.unmap();
    return buffer;
  };
  const vertexBuffer = makeBuffer(new Uint8Array(interleave(mesh)), GPUBufferUsage.VERTEX);
  const indexBuffer = makeBuffer(mesh.indices, GPUBufferUsage.INDEX);
  const edgeBuffer = makeBuffer(mesh.edges, GPUBufferUsage.VERTEX);
  const globalBuffer = device.createBuffer({ size: 112, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const partCount = mesh.parts.length;
  const partBuffer = device.createBuffer({ size: PART_STRIDE * partCount, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const partData = new Float32Array(PART_STRIDE / 4 * partCount);

  const globalLayout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} }] });
  const partLayout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { hasDynamicOffset: true } }] });
  const layout = device.createPipelineLayout({ bindGroupLayouts: [globalLayout, partLayout] });
  const globalGroup = device.createBindGroup({ layout: globalLayout, entries: [{ binding: 0, resource: { buffer: globalBuffer } }] });
  const partGroup = device.createBindGroup({ layout: partLayout, entries: [{ binding: 0, resource: { buffer: partBuffer, size: 64 } }] });
  const module = device.createShaderModule({ code: WGSL });
  const sampleCount = 4;
  const bodyPipeline = device.createRenderPipeline({
    layout,
    vertex: {
      module, entryPoint: 'vsBody',
      buffers: [{ arrayStride: VERTEX_STRIDE, attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },
        { shaderLocation: 1, offset: 12, format: 'float32x3' },
        { shaderLocation: 2, offset: 24, format: 'unorm8x4' },
      ] }],
    },
    fragment: { module, entryPoint: 'fsBody', targets: [{ format }] },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less', depthBias: 2, depthBiasSlopeScale: 1.5 },
    multisample: { count: sampleCount },
  });
  const glassBlend = { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } };
  const glassPipeline = device.createRenderPipeline({
    layout,
    vertex: {
      module, entryPoint: 'vsBody',
      buffers: [{ arrayStride: VERTEX_STRIDE, attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },
        { shaderLocation: 1, offset: 12, format: 'float32x3' },
        { shaderLocation: 2, offset: 24, format: 'unorm8x4' },
      ] }],
    },
    fragment: { module, entryPoint: 'fsGlass', targets: [{ format, blend: glassBlend }] },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less' },
    multisample: { count: sampleCount },
  });
  const isGlass = (part) => (part.alpha ?? 1) < 0.99;
  const blend = { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } };
  const edgePipeline = device.createRenderPipeline({
    layout,
    vertex: { module, entryPoint: 'vsEdge', buffers: [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }] },
    fragment: { module, entryPoint: 'fsEdge', targets: [{ format, blend }] },
    primitive: { topology: 'line-list' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less-equal' },
    multisample: { count: sampleCount },
  });

  let targets = { width: 0, height: 0, msaa: null, depth: null };
  const globalData = new Float32Array(28);

  return {
    backend: 'WebGPU',
    render(frame) {
      const { width, height } = canvasSize(canvas);
      if (targets.width !== width || targets.height !== height) {
        targets.msaa?.destroy();
        targets.depth?.destroy();
        targets = {
          width, height,
          msaa: device.createTexture({ size: [width, height], format, sampleCount, usage: GPUTextureUsage.RENDER_ATTACHMENT }),
          depth: device.createTexture({ size: [width, height], format: 'depth24plus', sampleCount, usage: GPUTextureUsage.RENDER_ATTACHMENT }),
        };
      }
      globalData.set(frame.viewProj, 0);
      globalData.set([...frame.eye, 1], 16);
      globalData.set([...frame.light, 0], 20);
      globalData.set([frame.style, 0, 0, 0], 24);
      device.queue.writeBuffer(globalBuffer, 0, globalData);
      for (let i = 0; i < partCount; i++) {
        const s = frame.parts[i];
        if (!s.visible) continue;
        const o = i * PART_STRIDE / 4;
        partData.set(s.offset, o); partData[o + 3] = s.scale;
        partData.set(s.pivot, o + 4);
        partData[o + 7] = mesh.parts[i].alpha ?? 1;
        partData.set(s.tint, o + 8);
        partData.set(s.edge, o + 12);
      }
      device.queue.writeBuffer(partBuffer, 0, partData);

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: targets.msaa.createView(), resolveTarget: context.getCurrentTexture().createView(),
          clearValue: { r: frame.clear[0], g: frame.clear[1], b: frame.clear[2], a: 1 }, loadOp: 'clear', storeOp: 'discard',
        }],
        depthStencilAttachment: { view: targets.depth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'discard' },
      });
      pass.setBindGroup(0, globalGroup);
      pass.setPipeline(bodyPipeline);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setIndexBuffer(indexBuffer, 'uint32');
      mesh.parts.forEach((part, i) => {
        if (!frame.parts[i].visible || !part.indexCount || isGlass(part)) return;
        pass.setBindGroup(1, partGroup, [i * PART_STRIDE]);
        pass.drawIndexed(part.indexCount, 1, part.indexStart, 0);
      });
      pass.setPipeline(edgePipeline);
      pass.setVertexBuffer(0, edgeBuffer);
      mesh.parts.forEach((part, i) => {
        const s = frame.parts[i];
        if (!s.visible || !part.edgeCount || s.edge[3] <= 0) return;
        pass.setBindGroup(1, partGroup, [i * PART_STRIDE]);
        pass.draw(part.edgeCount, 1, part.edgeStart, 0);
      });
      pass.setPipeline(glassPipeline);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setIndexBuffer(indexBuffer, 'uint32');
      mesh.parts.forEach((part, i) => {
        if (!frame.parts[i].visible || !part.indexCount || !isGlass(part)) return;
        pass.setBindGroup(1, partGroup, [i * PART_STRIDE]);
        pass.drawIndexed(part.indexCount, 1, part.indexStart, 0);
      });
      pass.end();
      device.queue.submit([encoder.finish()]);
    },
  };
}

function glProgram(gl, vs, fs) {
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  const uniforms = {};
  const n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(program, i).name;
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { program, uniforms };
}

function createWebGlRenderer(canvas, mesh) {
  const gl = canvas.getContext('webgl2', { antialias: true });
  if (!gl) throw new Error('Neither WebGPU nor WebGL2 is available. Enable hardware acceleration in your browser settings and reload.');
  const body = glProgram(gl, GL_BODY_VS, GL_BODY_FS);
  const edge = glProgram(gl, GL_EDGE_VS, GL_EDGE_FS);

  const bodyVao = gl.createVertexArray();
  gl.bindVertexArray(bodyVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, interleave(mesh), gl.STATIC_DRAW);
  const attrib = (program, name, size, type, normalized, offset) => {
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, type, normalized, VERTEX_STRIDE, offset);
  };
  attrib(body.program, 'position', 3, gl.FLOAT, false, 0);
  attrib(body.program, 'normal', 3, gl.FLOAT, false, 12);
  attrib(body.program, 'color', 4, gl.UNSIGNED_BYTE, true, 24);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

  const edgeVao = gl.createVertexArray();
  gl.bindVertexArray(edgeVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, mesh.edges, gl.STATIC_DRAW);
  const edgeLocation = gl.getAttribLocation(edge.program, 'position');
  gl.enableVertexAttribArray(edgeLocation);
  gl.vertexAttribPointer(edgeLocation, 3, gl.FLOAT, false, 12, 0);
  gl.bindVertexArray(null);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);   // keep the canvas opaque

  return {
    backend: 'WebGL2',
    render(frame) {
      const { width, height } = canvasSize(canvas);
      gl.viewport(0, 0, width, height);
      gl.clearColor(frame.clear[0], frame.clear[1], frame.clear[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.useProgram(body.program);
      gl.bindVertexArray(bodyVao);
      gl.uniformMatrix4fv(body.uniforms.viewProj, false, frame.viewProj);
      gl.uniform4f(body.uniforms.eye, ...frame.eye, 1);
      gl.uniform4f(body.uniforms.light, ...frame.light, 0);
      gl.uniform4f(body.uniforms.style, frame.style, 0, 0, 0);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1, 2);
      const drawBodies = (glass) => mesh.parts.forEach((part, i) => {
        const s = frame.parts[i];
        if (!s.visible || !part.indexCount || ((part.alpha ?? 1) < 0.99) !== glass) return;
        gl.uniform4f(body.uniforms.offset, ...s.offset, s.scale);
        gl.uniform4f(body.uniforms.pivot, ...s.pivot, 0);
        gl.uniform4fv(body.uniforms.tint, s.tint);
        gl.uniform1f(body.uniforms.alpha, part.alpha ?? 1);
        gl.drawElements(gl.TRIANGLES, part.indexCount, gl.UNSIGNED_INT, part.indexStart * 4);
      });
      drawBodies(false);
      gl.disable(gl.POLYGON_OFFSET_FILL);

      gl.useProgram(edge.program);
      gl.bindVertexArray(edgeVao);
      gl.uniformMatrix4fv(edge.uniforms.viewProj, false, frame.viewProj);
      gl.depthMask(false);
      gl.depthFunc(gl.LEQUAL);
      mesh.parts.forEach((part, i) => {
        const s = frame.parts[i];
        if (!s.visible || !part.edgeCount || s.edge[3] <= 0) return;
        gl.uniform4f(edge.uniforms.offset, ...s.offset, s.scale);
        gl.uniform4f(edge.uniforms.pivot, ...s.pivot, 0);
        gl.uniform4fv(edge.uniforms.edge, s.edge);
        gl.drawArrays(gl.LINES, part.edgeStart, part.edgeCount);
      });
      gl.depthFunc(gl.LESS);
      gl.useProgram(body.program);
      gl.bindVertexArray(bodyVao);
      drawBodies(true);          // translucent parts last, without writing depth
      gl.depthMask(true);
      gl.bindVertexArray(null);
    },
  };
}
