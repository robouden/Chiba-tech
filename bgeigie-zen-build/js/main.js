import { createRenderer } from './renderer.js';
import { STEPS, CHAPTERS, UNITS, TOOLS, address } from './steps.js';
import { LOCALES, loadLocales, detectLocale, setLocale, locale, localeMeta, onLocaleChange, lookup, t } from './i18n.js';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#scene');
const params = new URLSearchParams(location.search);

const PAPER = [0.965, 0.957, 0.937];
const ACCENT = [0.93, 0.36, 0.12];
const INK = [0.09, 0.09, 0.1];
const FOV = 26 * Math.PI / 180;
const N = STEPS.length;

const state = {
  t: 0,
  style: params.get('style') === 'line' ? 1 : 0,
  camera: { yaw: -58, pitch: 30, dist: 160, target: [35, 25, 8] },
  cameraTween: null,
  timeTween: null,
  playing: false,
  hover: null,
  spin: false,
  dirty: true,
  step: 0,
};

// ---------------------------------------------------------------- geometry

async function fetchAssembly(base) {
  const [manifest, binary] = await Promise.all([
    fetch(`${base}assembly.json`, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
    fetch(`${base}assembly.bin`, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(r.statusText); return r.arrayBuffer(); }),
  ]);
  const view = (name, Type) => new Type(binary, manifest.buffers[name].byteOffset, manifest.buffers[name].length);
  const q = manifest.quantum_mm;
  const positions = Float32Array.from(view('positions', Int16Array), (v) => v * q);
  const edges = Float32Array.from(view('edges', Int16Array), (v) => v * q);
  const localIndices = view('indices', Uint16Array);
  const colors = view('colors', Uint8Array);
  const indices = new Uint32Array(localIndices.length);
  const normals = new Float32Array(positions.length);

  const parts = manifest.parts.map((p) => {
    const [vStart] = p.vertices;
    const [iStart, iCount] = p.indices;
    for (let i = iStart; i < iStart + iCount; i++) indices[i] = localIndices[i] + vStart;
    for (let i = iStart; i < iStart + iCount; i += 3) {
      const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
      const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
      const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const k of [a, b, c]) { normals[k] += nx; normals[k + 1] += ny; normals[k + 2] += nz; }
    }
    const [lo, hi] = p.bbox;
    return {
      ...p,
      center: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2],
      render: { indexStart: iStart, indexCount: iCount, edgeStart: p.edges[0], edgeCount: p.edges[1] },
    };
  });
  for (let i = 0; i < normals.length; i += 3) {
    const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= l; normals[i + 1] /= l; normals[i + 2] /= l;
  }
  return { manifest, parts, mesh: { positions, normals, colors, indices, edges, parts: parts.map((p) => p.render) } };
}

// ---------------------------------------------------------------- timeline

function buildPlan(parts) {
  const unitState = Object.fromEntries(Object.keys(UNITS).map((name) => [name, { ...UNITS[name], seatStep: Infinity }]));
  for (const unit of Object.values(unitState)) unit.activeSteps = new Set();
  STEPS.forEach((step, index) => {
    const k = index + 1;
    for (const name of step.seat || []) { unitState[name].seatStep = k; unitState[name].activeSteps.add(k); }
    for (const name of step.isolate || []) unitState[name].activeSteps.add(k);
    for (const action of step.add || []) {
      for (const part of parts) {
        if (!part.intro && action.sel(part)) part.intro = { step: k, ...action };
      }
    }
    for (const action of step.remove || []) {
      for (const part of parts) {
        if (!part.exit && action.sel(part)) part.exit = { step: k, ...action };
      }
    }
  });
  for (const part of parts) {
    part.unit = Object.keys(UNITS).find((name) => UNITS[name].select(part)) || null;
    if (!part.intro) {
      console.warn('Part not introduced by any step:', part.id);
      part.intro = { step: N, mode: 'appear' };
    }
    if (part.unit) unitState[part.unit].activeSteps.add(part.intro.step);
  }
  return unitState;
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => x * x * (3 - 2 * x);
const easeOutBack = (x) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2;

function currentStep(t) {
  return Math.min(N, Math.max(1, Math.ceil(t - 1e-6)));
}

// `k` is the step being shown. Sub-builds hide everything else, and detached
// modules are set aside while they are neither being built nor seated.
function pose(part, t, units, k = currentStep(t)) {
  const u = t - (part.intro.step - 1);
  if (u <= 1e-6) return null;
  const isolate = STEPS[k - 1].isolate;
  if (isolate && !isolate.includes(part.unit)) return null;
  const offset = [0, 0, 0];
  let scale = 1;
  if (part.exit) {
    const ue = t - (part.exit.step - 1);
    if (ue > 1 + 1e-6) return null;
    const e = ue <= 0 ? 0 : ease(clamp01((ue - 0.1) / 0.6));
    for (let i = 0; i < 3; i++) offset[i] += part.exit.to[i] * e;
  }
  if (part.unit) {
    const unit = units[part.unit];
    if (k < unit.seatStep && !unit.activeSteps.has(k)) return null;
    const us = t - (unit.seatStep - 1);
    const f = us <= 0 ? 1 : 1 - ease(clamp01((us - 0.08) / 0.7));
    for (let i = 0; i < 3; i++) offset[i] += unit.stage[i] * f;
  }
  if (part.intro.mode === 'enter') {
    const delay = part.intro.delay || 0;
    const e = ease(clamp01((u - 0.05 - delay * 0.55) / 0.6));
    for (let i = 0; i < 3; i++) offset[i] += part.intro.from[i] * (1 - e);
  } else {
    const s = clamp01((u - 0.45) / 0.35);
    if (s <= 0) return null;
    scale = Math.max(0.001, easeOutBack(s));
  }
  return { offset, scale };
}

function boundsAt(parts, t, units, select, k = currentStep(t)) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const part of parts) {
    if (select && !select(part)) continue;
    const p = pose(part, t, units, k);
    if (!p) continue;
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], part.bbox[0][i] + p.offset[i]);
      hi[i] = Math.max(hi[i], part.bbox[1][i] + p.offset[i]);
    }
  }
  return Number.isFinite(lo[0]) ? [lo, hi] : null;
}

// ---------------------------------------------------------------- camera math

function perspective(fovy, aspect, near, far, zeroToOne) {
  const f = 1 / Math.tan(fovy / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f; m[11] = -1;
  if (zeroToOne) { m[10] = far / (near - far); m[14] = near * far / (near - far); }
  else { m[10] = (far + near) / (near - far); m[14] = 2 * far * near / (near - far); }
  return m;
}

function lookAt(eye, target, up) {
  const z = normalize(sub(eye, target));
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}

function multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    out[c * 4 + r] = s;
  }
  return out;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

function eyePosition(camera) {
  const yaw = camera.yaw * Math.PI / 180;
  const pitch = camera.pitch * Math.PI / 180;
  const d = camera.dist;
  return [
    camera.target[0] + d * Math.cos(pitch) * Math.cos(yaw),
    camera.target[1] + d * Math.cos(pitch) * Math.sin(yaw),
    camera.target[2] + d * Math.sin(pitch),
  ];
}

// ---------------------------------------------------------------- app

let app;

async function main() {
  await loadLocales();
  setLocale(detectLocale());
  buildLanguageToggle();
  const { manifest, parts, mesh } = await fetchAssembly('assets/');
  const units = buildPlan(parts);
  const renderer = await createRenderer(canvas, mesh, { prefer: params.get('renderer') === 'webgl' ? 'webgl' : 'webgpu' });
  app = { manifest, parts, units, renderer, byId: groupById(parts), matrices: null };

  buildTimelineUi();
  wireControls();
  canvas.dataset.backend = renderer.backend;
  console.info(`bGeigie Zen build viewer: ${renderer.backend}`);
  $('#coverSteps').textContent = N;
  $('#coverChapters').textContent = CHAPTERS.length;
  $('#coverTools').textContent = TOOLS.length;
  onLocaleChange(renderLocale);
  $('#loader').hidden = true;

  const requested = Number(params.get('step'));
  if (Number.isInteger(requested) && requested >= 1 && requested <= N) {
    closeCover();
    goToStep(requested, { animate: false });
  } else {
    state.t = N;
    state.spin = true;
    showStep(N, { camera: false });
    fitCamera({ yaw: -58, pitch: 30 }, N, false);
  }
  renderLocale();
  requestAnimationFrame(frame);
}

function groupById(parts) {
  const map = new Map();
  for (const part of parts) {
    if (!map.has(part.id)) map.set(part.id, []);
    map.get(part.id).push(part);
  }
  return map;
}

function fitCamera(view, k, animate = true) {
  const step = STEPS[k - 1];
  const select = view.focus || null;
  const a = boundsAt(app.parts, k, app.units, select) || boundsAt(app.parts, k, app.units);
  const b = boundsAt(app.parts, k - 0.9, app.units, (p) => p.intro.step === k || (p.unit && app.units[p.unit].seatStep === k), k);
  const lo = a[0].slice(), hi = a[1].slice();
  if (b && !step.finale) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], b[0][i]); hi[i] = Math.max(hi[i], b[1][i]); }
  const target = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const radius = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2;
  const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  const fit = radius / Math.sin(FOV / 2) * (aspect < 1 ? 1 / Math.max(aspect, 0.5) : 1);
  const goal = { yaw: view.yaw, pitch: view.pitch, dist: Math.max(40, fit * (view.zoom || 1) * 0.92), target };
  if (!animate) {
    state.camera = goal;
    state.cameraTween = null;
  } else {
    const from = { ...state.camera, target: state.camera.target.slice() };
    let dyaw = ((goal.yaw - from.yaw) % 360 + 540) % 360 - 180;
    state.cameraTween = { from, goal: { ...goal, yaw: from.yaw + dyaw }, start: performance.now(), duration: 900 };
  }
  state.dirty = true;
}

function goToStep(k, { animate = true } = {}) {
  k = Math.min(N, Math.max(1, k));
  state.spin = false;
  if (animate) {
    state.t = k - 1;
    state.timeTween = { from: k - 1, to: k, start: performance.now(), duration: 1900 };
  } else {
    state.t = k;
    state.timeTween = null;
  }
  showStep(k);
  if (STEPS[k - 1].finale) state.spin = true;
}

function showStep(k, { camera = true } = {}) {
  const step = STEPS[k - 1];
  if (state.step === k) return;
  state.step = k;
  renderStepText();
  $('.stage').classList.toggle('subassembly', !!step.isolate);
  buildLabels(step);
  buildArrows(k);
  document.querySelectorAll('.tick').forEach((tick, i) => tick.classList.toggle('active', i === k - 1));
  document.querySelectorAll('.tick').forEach((tick, i) => tick.classList.toggle('done', i < k - 1));
  $('#prev').disabled = k <= 1;
  $('#next').disabled = k >= N;
  const url = new URL(location.href);
  url.searchParams.set('step', k);
  history.replaceState(null, '', url);
  if (camera) fitCamera(step.view, k);
}

// Everything the reader sees for the current step, in the current locale.
function renderStepText() {
  const k = state.step;
  const step = STEPS[k - 1];
  const text = (key) => t(`steps.${step.id}.${key}`);
  $('#chapter').textContent = t(`chapters.${step.chapter}`);
  $('#stepCount').textContent = t('ui.stepCount', { n: k, total: N });
  $('#stepNumber').textContent = k;
  $('#stepTitle').textContent = text('title');
  $('#stepText').textContent = text('text');

  const partsBox = $('#partsBox');
  partsBox.hidden = !step.parts?.length;
  $('#partsList').replaceChildren(...(step.parts || []).map((item) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="swatch" style="background:${item.swatch}"></span><span class="qty">${item.qty}×</span><span class="name"></span>`;
    li.querySelector('.name').textContent = t(`parts.${item.key}`);
    if (item.ref && item.url) {
      const a = document.createElement('a');
      a.href = item.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.className = 'ref';
      a.textContent = item.ref;
      li.append(a);
    }
    li.addEventListener('pointerenter', () => { state.hover = item.sel; state.dirty = true; });
    li.addEventListener('pointerleave', () => { state.hover = null; state.dirty = true; });
    return li;
  }));

  const tools = $('#tools');
  tools.hidden = !step.tools?.length;
  tools.replaceChildren(...(step.tools || []).map((tool) => {
    const span = document.createElement('span');
    span.className = `tool tool-${tool}`;
    span.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-${tool}"/></svg>`;
    span.append(t(`tools.${tool}`));
    return span;
  }));

  const checkTexts = lookupOptional(`steps.${step.id}.checks`) || [];
  const checks = $('#checks');
  checks.hidden = !checkTexts.length;
  checks.replaceChildren(...checkTexts.map((label, i) => {
    const li = document.createElement('li');
    const id = `check-${step.id}-${i}`;
    li.innerHTML = `<input type="checkbox" id="${id}"><label for="${id}"></label>`;
    li.querySelector('label').textContent = label;
    const box = li.querySelector('input');
    box.checked = localStorage.getItem(`bgeigie-zen-build:${id}`) === '1';
    box.addEventListener('change', () => localStorage.setItem(`bgeigie-zen-build:${id}`, box.checked ? '1' : '0'));
    return li;
  }));

  $('#notes').replaceChildren(...(step.notes || []).map((note) => {
    const li = document.createElement('li');
    li.className = `note note-${note.kind}`;
    li.textContent = text(`notes.${note.kind}`);
    return li;
  }));

  $('#evidence').replaceChildren(...(step.evidence || []).map((kind) => {
    const span = document.createElement('span');
    span.className = `chip chip-${kind}`;
    span.textContent = t(`evidence.${kind}.short`);
    span.title = t(`evidence.${kind}.long`);
    return span;
  }));
}

function lookupOptional(key) {
  const [steps, id, field] = key.split('.');
  return steps === 'steps' && lookup(`steps.${id}`)?.[field];
}

// ---------------------------------------------------------------- overlays

function anchorFor(label) {
  if (label.addr) {
    const [x, y] = address(label.addr);
    return () => [x, y, label.z ?? 1.6];
  }
  const chunks = app.byId.get(label.part) || [];
  const part = chunks[0];
  if (!part) return () => null;
  return (t) => {
    const p = pose(part, t, app.units, state.step);
    if (!p) return null;
    const z = label.anchor === 'bottom' ? part.bbox[0][2] : part.bbox[1][2];
    return [part.center[0] + p.offset[0], part.center[1] + p.offset[1], z + p.offset[2]];
  };
}

function buildLabels(step) {
  const layer = $('#labels');
  layer.replaceChildren();
  app.labels = (step.labels || []).map((label) => {
    const el = document.createElement('div');
    el.className = 'label';
    el.dataset.tag = label.tag || '';
    el.dataset.key = label.key || '';
    el.textContent = labelText(el);
    if (label.color) el.style.setProperty('--dot', label.color);
    layer.append(el);
    return { el, anchor: anchorFor(label) };
  });
}

function labelText(el) {
  return [el.dataset.tag, el.dataset.key && t(`labels.${el.dataset.key}`)].filter(Boolean).join(' ');
}

function buildArrows(k) {
  const step = STEPS[k - 1];
  const arrows = [];
  for (const action of step.add || []) {
    if (action.mode !== 'enter') continue;
    const bounds = boundsAt(app.parts, k, app.units, (p) => p.intro.step === k && action.sel(p));
    if (!bounds) continue;
    const end = bounds[0].map((v, i) => (v + bounds[1][i]) / 2);
    arrows.push({ start: end.map((v, i) => v + action.from[i]), end });
  }
  for (const action of step.remove || []) {
    const bounds = boundsAt(app.parts, k - 0.999, app.units, (p) => p.exit?.step === k && action.sel(p), k);
    if (!bounds) continue;
    const start = bounds[0].map((v, i) => (v + bounds[1][i]) / 2);
    arrows.push({ start, end: start.map((v, i) => v + action.to[i] * 1.6) });
  }
  for (const name of step.seat || []) {
    const unit = app.units[name];
    const bounds = boundsAt(app.parts, k, app.units, (p) => p.unit === name);
    if (!bounds) continue;
    const end = bounds[0].map((v, i) => (v + bounds[1][i]) / 2);
    arrows.push({ start: end.map((v, i) => v + unit.stage[i]), end });
  }
  app.arrows = arrows;
}

function project(point) {
  const m = app.matrices.viewProj;
  const x = m[0] * point[0] + m[4] * point[1] + m[8] * point[2] + m[12];
  const y = m[1] * point[0] + m[5] * point[1] + m[9] * point[2] + m[13];
  const w = m[3] * point[0] + m[7] * point[1] + m[11] * point[2] + m[15];
  if (w <= 0) return null;
  return [(x / w * 0.5 + 0.5) * canvas.clientWidth, (0.5 - y / w * 0.5) * canvas.clientHeight];
}

function updateOverlays() {
  const u = state.t - (state.step - 1);
  const svg = $('#arrows');
  const paths = [];
  for (const arrow of app.arrows) {
    const a = project(arrow.start);
    const b = project(arrow.end);
    if (!a || !b) continue;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 24) continue;
    const ux = dx / len, uy = dy / len;
    const s = [a[0] + ux * len * 0.05, a[1] + uy * len * 0.05];
    const e = [b[0] - ux * len * 0.35, b[1] - uy * len * 0.35];
    const h = 18, w = 11;
    const base = [e[0] - ux * h, e[1] - uy * h];
    const head = `${e[0]},${e[1]} ${base[0] - uy * w},${base[1] + ux * w} ${base[0] + uy * w},${base[1] - ux * w}`;
    const opacity = u < 1 ? 1 : 0.55;
    paths.push(`<g opacity="${opacity}"><line x1="${s[0]}" y1="${s[1]}" x2="${base[0]}" y2="${base[1]}" class="arrow-halo"/><polygon points="${head}" class="arrow-head-halo"/><line x1="${s[0]}" y1="${s[1]}" x2="${base[0]}" y2="${base[1]}" class="arrow-line"/><polygon points="${head}" class="arrow-head"/></g>`);
  }
  const labelsOn = u > 0.6;
  const leaders = [];
  for (const label of app.labels) {
    const world = labelsOn ? label.anchor(state.t) : null;
    const screen = world && project(world);
    if (!screen) { label.el.hidden = true; continue; }
    label.el.hidden = false;
    const lx = screen[0], ly = screen[1] - 30;
    label.el.style.transform = `translate(${lx}px, ${ly}px) translate(-50%, -100%)`;
    leaders.push(`<line x1="${screen[0]}" y1="${screen[1]}" x2="${lx}" y2="${ly}" class="leader"/><circle cx="${screen[0]}" cy="${screen[1]}" r="3" class="leader-dot"/>`);
  }
  svg.innerHTML = `${paths.join('')}${leaders.join('')}`;
}

// ---------------------------------------------------------------- frame

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (state.timeTween) {
    const tw = state.timeTween;
    const x = clamp01((now - tw.start) / tw.duration);
    state.t = tw.from + (tw.to - tw.from) * x;
    if (x >= 1) {
      state.timeTween = null;
      if (state.playing) {
        if (Math.round(state.t) >= N) setPlaying(false);
        else state.playTimer = setTimeout(() => { if (state.playing) goToStep(currentStep(state.t) + 1); }, 1400);
      }
    }
    state.dirty = true;
  }
  if (state.cameraTween) {
    const tw = state.cameraTween;
    const x = ease(clamp01((now - tw.start) / tw.duration));
    const lerp = (a, b) => a + (b - a) * x;
    state.camera = {
      yaw: lerp(tw.from.yaw, tw.goal.yaw), pitch: lerp(tw.from.pitch, tw.goal.pitch), dist: lerp(tw.from.dist, tw.goal.dist),
      target: tw.from.target.map((v, i) => lerp(v, tw.goal.target[i])),
    };
    if (x >= 1) state.cameraTween = null;
    state.dirty = true;
  }
  if (state.spin && !state.dragging) {
    state.camera.yaw += dt * 9;
    state.dirty = true;
  }

  if (state.dirty) {
    state.dirty = false;
    const k = state.timeTween ? state.timeTween.to : currentStep(state.t);
    if (k !== state.step) showStep(k);
    $('#scrub').value = state.t;
    render();
  }
  requestAnimationFrame(frame);
}

function render() {
  const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  const eye = eyePosition(state.camera);
  const near = Math.max(0.5, state.camera.dist / 60);
  const proj = perspective(FOV, aspect, near, state.camera.dist * 8, app.renderer.backend === 'WebGPU');
  const up = Math.abs(state.camera.pitch) > 89 ? [0, 1, 0] : [0, 0, 1];
  const viewProj = multiply(proj, lookAt(eye, state.camera.target, up));
  app.matrices = { viewProj };

  const k = state.step;
  const step = STEPS[k - 1];
  const line = state.style;
  const light = normalize([0.35, -0.55, 0.9]);
  const partStates = app.parts.map((part) => {
    const p = pose(part, state.t, app.units, k);
    if (!p) return { visible: false };
    const hovered = state.hover && state.hover(part);
    const current = part.intro.step === k || part.exit?.step === k || (part.unit && app.units[part.unit].seatStep === k) || (step.highlight && step.highlight(part));
    const carrierDetail = part.chain.length === 1 && part.id !== 'carrier.display';
    let tint = [0, 0, 0, 0];
    let edge = [...INK, line ? (carrierDetail ? 0.22 : 0.8) : (carrierDetail ? 0.05 : 0.22)];
    if (current && !step.finale) {
      tint = [...ACCENT, line ? 0.28 : 0.14];
      edge = [...ACCENT, 0.95];
    }
    if (hovered) {
      tint = [...ACCENT, 0.6];
      edge = [...ACCENT, 1];
    }
    return { visible: true, offset: p.offset, scale: p.scale, pivot: part.center, tint, edge };
  });
  app.renderer.render({ viewProj, eye, light, style: line, clear: PAPER, parts: partStates });
  updateOverlays();
}

// ---------------------------------------------------------------- UI

function buildTimelineUi() {
  const scrub = $('#scrub');
  scrub.max = N;
  const ticks = $('#ticks');
  const chapters = $('#chapters');
  STEPS.forEach((step, i) => {
    const tick = document.createElement('button');
    tick.className = `tick ch-${step.chapter}`;
    tick.textContent = i + 1;
    tick.addEventListener('click', () => { closeCover(); setPlaying(false); goToStep(i + 1); });
    ticks.append(tick);
  });
  for (const chapter of CHAPTERS) {
    const span = document.createElement('span');
    span.className = `chapter-band ch-${chapter}`;
    span.dataset.chapter = chapter;
    span.style.flexGrow = STEPS.filter((s) => s.chapter === chapter).length;
    chapters.append(span);
  }
  renderTimelineText();
}

function renderTimelineText() {
  document.querySelectorAll('.tick').forEach((tick, i) => { tick.title = t(`steps.${STEPS[i].id}.title`); });
  document.querySelectorAll('.chapter-band').forEach((band) => { band.textContent = t(`chapters.${band.dataset.chapter}`); });
}

function buildLanguageToggle() {
  const group = $('#language');
  group.replaceChildren(...LOCALES.map((code) => {
    const button = document.createElement('button');
    const meta = localeMeta(code);
    button.textContent = meta.short;
    button.lang = meta.lang;
    button.title = meta.name;
    button.dataset.locale = code;
    button.addEventListener('click', () => setLocale(code, { remember: true }));
    return button;
  }));
  markLanguage();
  onLocaleChange(markLanguage);
}

function markLanguage() {
  document.querySelectorAll('#language button').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.locale === locale()));
  });
}

// Re-render every locale-dependent piece of the running viewer.
function renderLocale() {
  renderCredit();
  renderStepText();
  renderTimelineText();
  document.querySelectorAll('#labels .label').forEach((el) => { el.textContent = labelText(el); });
  $('.stage').dataset.badge = t('ui.subassembly');
  $('#play').setAttribute('aria-label', t(state.playing ? 'ui.pause' : 'ui.play'));
}

// The creator's name is a link placed wherever each locale puts {creator}.
function renderCredit() {
  const creator = document.createElement('a');
  creator.href = 'https://safecast.org/';
  creator.target = '_blank';
  creator.rel = 'noopener';
  creator.textContent = 'Safecast';
  const [before, after = ''] = t('ui.credit').split('{creator}');
  $('#creditText').replaceChildren(before, creator, after);
}

function setPlaying(playing) {
  state.playing = playing;
  clearTimeout(state.playTimer);
  $('#play').classList.toggle('playing', playing);
  $('#play').setAttribute('aria-label', t(playing ? 'ui.pause' : 'ui.play'));
  if (playing) {
    const k = currentStep(state.t);
    goToStep(state.t >= N - 1e-6 ? 1 : (Math.abs(state.t - Math.round(state.t)) < 1e-6 ? k + 1 : k));
  }
}

function closeCover() {
  $('#cover').hidden = true;
  document.body.classList.remove('cover-open');
}

function setStyle(line) {
  state.style = line ? 1 : 0;
  $('#styleColour').setAttribute('aria-pressed', String(!line));
  $('#styleLine').setAttribute('aria-pressed', String(!!line));
  state.dirty = true;
}

function wireControls() {
  $('#start').addEventListener('click', () => { closeCover(); goToStep(1); });
  $('#prev').addEventListener('click', () => { setPlaying(false); goToStep(state.step - 1); });
  $('#next').addEventListener('click', () => { setPlaying(false); goToStep(state.step + 1); });
  $('#replay').addEventListener('click', () => { setPlaying(false); goToStep(state.step); });
  $('#play').addEventListener('click', () => { closeCover(); setPlaying(!state.playing); });
  $('#fit').addEventListener('click', () => fitCamera(STEPS[state.step - 1].view, state.step));
  $('#flip').addEventListener('click', () => {
    state.cameraTween = { from: { ...state.camera }, goal: { ...state.camera, pitch: -state.camera.pitch || -35 }, start: performance.now(), duration: 700 };
  });
  $('#styleColour').addEventListener('click', () => setStyle(false));
  $('#styleLine').addEventListener('click', () => setStyle(true));
  setStyle(state.style);

  const scrub = $('#scrub');
  scrub.addEventListener('input', () => {
    closeCover();
    setPlaying(false);
    state.timeTween = null;
    state.spin = false;
    state.t = Number(scrub.value);
    state.dirty = true;
  });

  const pointers = new Map();
  let pinch = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    state.dragging = true;
    state.spin = false;
    state.cameraTween = null;
    state.pan = e.shiftKey || e.button === 2;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const [px, py] = pointers.get(e.pointerId);
    const dx = e.clientX - px, dy = e.clientY - py;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) state.camera.dist = Math.min(600, Math.max(15, state.camera.dist * pinch / d));
      pinch = d;
    } else if (state.pan) {
      const yaw = state.camera.yaw * Math.PI / 180;
      const pitch = state.camera.pitch * Math.PI / 180;
      const scale = state.camera.dist * 2 * Math.tan(FOV / 2) / canvas.clientHeight;
      const right = [-Math.sin(yaw), Math.cos(yaw), 0];
      const up = [-Math.sin(pitch) * Math.cos(yaw), -Math.sin(pitch) * Math.sin(yaw), Math.cos(pitch)];
      state.camera.target = state.camera.target.map((v, i) => v - right[i] * dx * scale + up[i] * dy * scale);
    } else {
      state.camera.yaw -= dx * 0.4;
      state.camera.pitch = Math.max(-89, Math.min(89, state.camera.pitch + dy * 0.3));
    }
    state.dirty = true;
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) state.dragging = false;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    state.cameraTween = null;
    state.camera.dist = Math.min(600, Math.max(15, state.camera.dist * Math.exp(e.deltaY * 0.0012)));
    state.dirty = true;
  }, { passive: false });

  window.addEventListener('resize', () => { state.dirty = true; });
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
    if (e.key === 'ArrowRight') { closeCover(); setPlaying(false); goToStep(state.step + 1); }
    else if (e.key === 'ArrowLeft') { closeCover(); setPlaying(false); goToStep(state.step - 1); }
    else if (e.key === ' ') { e.preventDefault(); closeCover(); setPlaying(!state.playing); }
    else if (e.key === 'Home') { closeCover(); goToStep(1); }
    else if (e.key === 'End') { closeCover(); goToStep(N); }
    else if (e.key === 'l') setStyle(!state.style);
    else return;
    e.preventDefault();
  });
}

main().catch((error) => {
  console.error(error);
  $('#loader').textContent = locale() ? t('ui.loadError', { message: error.message }) : error.message;
  $('#loader').classList.add('error');
});
