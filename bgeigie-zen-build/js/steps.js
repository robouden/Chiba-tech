// Assembly sequence for the bGeigie Zen: geometry, motion and camera only.
// Reader-facing text lives in ../locales/<code>.json, keyed by step id, part
// key, note kind and label key (checked by scripts/check_i18n.py).
// Part selectors match ids in assets/assembly.json (see scripts/build_assembly.py).

// Grid on the main PCB (2.54 mm pitch) for `addr` labels; A1 at the PCB corner.
export function address(name) {
  const column = 'ABCDEFGHIJKLMNOPQRSTUVWX'.indexOf(name[0]);
  const row = Number(name.slice(1));
  return [6 + column * 2.54, 6 + (row - 1) * 2.54];
}

const starts = (...prefixes) => (p) => prefixes.some((x) => p.id === x || p.id.startsWith(`${x}.`));
const any = (...selectors) => (p) => selectors.some((s) => s(p));

const S = {
  case: starts('case'),
  battery: starts('battery'),
  tube: starts('tube'),
  standoffs: starts('standoffs'),
  pcb: starts('pcb'),
  esp32: starts('esp32'),
  esp32Body: (p) => p.id === 'esp32.module',
  esp32Pins: (p) => p.id === 'esp32.pins',
  esp32Solder: (p) => p.id === 'esp32.solder',
  gps: starts('gps'),
  gpsBody: any(starts('gps.module'), starts('gps.patch')),
  gpsSolder: (p) => p.id === 'gps.solder',
  hv: starts('hv'),
  oled: starts('oled'),
  usb: starts('usb'),
  battWire: starts('wire'),
  lid: starts('lid'),
};
export const SELECTORS = S;

// Sub-assemblies are built lifted above the board ("staged") and lowered on their `seat` step.
export const UNITS = {
  esp32: { select: S.esp32, stage: [0, 0, 30] },
  gps: { select: S.gps, stage: [0, 0, 30] },
};

export const EVIDENCE = ['instructor', 'measured', 'photo', 'model'];
export const TOOLS = ['iron', 'pliers', 'cutters', 'tape', 'stripper', 'screwdriver'];
export const CHAPTERS = ['case', 'power', 'electronics', 'close'];

const ISO = { yaw: -62, pitch: 36 };
const UNDER = { yaw: -118, pitch: -42 };
const enter = (sel, z, delay) => ({ sel, mode: 'enter', from: [0, 0, z], ...(delay ? { delay } : {}) });

export const STEPS = [
  {
    chapter: 'case', id: 'orient-the-case',
    parts: [{ key: 'enclosure-base', qty: 1, sel: S.case, swatch: '#2b2f36' }],
    add: [enter(S.case, -12)],
    labels: [{ part: 'case.base', key: 'front', anchor: 'top' }],
    view: { ...ISO, yaw: -90, pitch: 55 },
    evidence: ['model'],
  },
  {
    chapter: 'power', id: 'fit-the-battery',
    parts: [{ key: 'lipo-battery', qty: 1, sel: S.battery, swatch: '#c9ccd1' }],
    add: [enter(S.battery, 24)],
    labels: [{ part: 'battery.label', key: 'battery' }],
    notes: [{ kind: 'model' }],
    view: { ...ISO, pitch: 50 },
    evidence: ['model'],
  },
  {
    chapter: 'power', id: 'fit-the-tube',
    parts: [{ key: 'gm-tube', qty: 1, sel: S.tube, swatch: '#b8bcc4' }],
    add: [enter(S.tube, 24)],
    labels: [{ part: 'tube.window', key: 'window' }],
    notes: [{ kind: 'model' }],
    view: { ...ISO, pitch: 50 },
    evidence: ['model'],
  },
  {
    chapter: 'electronics', id: 'mount-the-standoffs',
    tools: ['screwdriver'],
    parts: [{ key: 'm3-standoff', qty: 4, sel: S.standoffs, swatch: '#c2c4c9' }],
    add: [enter(S.standoffs, 16)],
    view: { ...ISO, pitch: 48 },
    evidence: ['model'],
  },
  {
    chapter: 'electronics', id: 'seat-the-mainboard',
    tools: ['screwdriver'],
    parts: [{ key: 'main-pcb', qty: 1, sel: S.pcb, swatch: '#14612f' }],
    add: [enter(S.pcb, 34)],
    view: ISO,
    evidence: ['model'],
  },
  {
    chapter: 'electronics', id: 'esp32-headers',
    isolate: ['esp32'],
    parts: [
      { key: 'esp32-module', qty: 1, sel: S.esp32Body, swatch: '#1a1a1a' },
      { key: 'male-header-9-pin', qty: 2, sel: S.esp32Pins, swatch: '#c2c4c9' },
    ],
    add: [enter(S.esp32Body, 14), enter(S.esp32Pins, -14, 0.25)],
    view: { yaw: -60, pitch: 24, focus: S.esp32, zoom: 0.9 },
    evidence: ['model'],
  },
  {
    chapter: 'electronics', id: 'solder-the-esp32',
    isolate: ['esp32'],
    tools: ['iron'],
    add: [{ sel: S.esp32Solder, mode: 'appear' }],
    highlight: S.esp32Pins,
    view: { yaw: -70, pitch: -10, focus: S.esp32, zoom: 0.9 },
    evidence: ['model'],
  },
  {
    chapter: 'electronics', id: 'seat-the-esp32',
    seat: ['esp32'],
    labels: [{ part: 'esp32.module', key: 'antenna', anchor: 'top' }],
    view: ISO,
    evidence: ['model'],
  },
  {
    chapter: 'electronics', id: 'build-the-gps',
    isolate: ['gps'],
    tools: ['iron'],
    parts: [
      { key: 'gps-module', qty: 1, sel: S.gpsBody, swatch: '#1d3a6e' },
    ],
    add: [enter(S.gpsBody, 14), { sel: S.gpsSolder, mode: 'appear' }],
    view: { yaw: -55, pitch: 30, focus: S.gps, zoom: 0.9 },
    evidence: ['model'],
  },
  {
    chapter: 'electronics', id: 'seat-the-gps',
    seat: ['gps'],
    view: ISO,
    evidence: ['model'],
  },
  {
    chapter: 'electronics', id: 'hv-module',
    parts: [{ key: 'hv-module', qty: 1, sel: S.hv, swatch: '#8a2d2d' }],
    add: [enter(S.hv, 22), enter((p) => p.id === 'hv.leads', 22, 0.4)],
    labels: [{ part: 'hv.leads', key: 'hvLead' }],
    tools: ['iron'],
    notes: [{ kind: 'info' }],
    view: { yaw: -50, pitch: 42, focus: S.hv, zoom: 0.8 },
    evidence: ['model'],
  },
  {
    chapter: 'electronics', id: 'display-and-usb',
    parts: [
      { key: 'oled-display', qty: 1, sel: S.oled, swatch: '#0a0a0a' },
      { key: 'usb-c-connector', qty: 1, sel: S.usb, swatch: '#9a9ea6' },
    ],
    add: [enter(S.oled, 20), enter(S.usb, 20, 0.3)],
    view: { yaw: -35, pitch: 42 },
    evidence: ['model'],
  },
  {
    chapter: 'power', id: 'connect-the-battery',
    tools: ['iron'],
    add: [{ sel: S.battWire, mode: 'appear' }],
    labels: [{ part: 'wire.batt', key: 'batteryPlus', anchor: 'bottom' }],
    notes: [{ kind: 'info' }],
    view: UNDER,
    evidence: ['model'],
  },
  {
    chapter: 'close', id: 'close-the-case',
    tools: ['screwdriver'],
    parts: [{ key: 'lid', qty: 1, sel: S.lid, swatch: '#3a404a' }],
    add: [enter(S.lid, 40)],
    view: { ...ISO, pitch: 30 },
    evidence: ['model'],
  },
  {
    chapter: 'close', id: 'assembly-complete',
    view: { yaw: -58, pitch: 30 },
    finale: true,
    evidence: ['model'],
  },
];
