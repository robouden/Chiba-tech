// Assembly sequence for the bGeigieZen V4.x kit: geometry, motion and camera only.
// Reader-facing text lives in ../locales/<code>.json, keyed by step id, part key,
// note kind and label key. Step order follows "bGeigieZen Kit Assembly for V4.x
// boards" (2026-04-06). Part ids come from assets/assembly.json (scripts/export_zen.py).

// Grid on the PCB (2.54 mm pitch) for `addr` labels; centre of the board is (0, 0).
export function address(name) {
  const column = 'ABCDEFGHIJKLMNOPQRSTUVWX'.indexOf(name[0]);
  const row = Number(name.slice(1));
  return [-64 + column * 2.54, -32 + (row - 1) * 2.54];
}

const is = (...ids) => (p) => ids.includes(p.id);
const any = (...selectors) => (p) => selectors.some((s) => s(p));

const S = {
  pcb: is('pcb'),
  header: is('j1'),
  m5Fit: is('m5.fit'),
  m5: is('m5'),
  screwsFit: is('screws.fit'),
  screws: is('screws'),
  solderHeader: is('solder.j1'),
  clips: is('clip.a', 'clip.b'),
  solderClips: is('solder.clips'),
  diode: is('diode'),
  solderDiode: is('solder.diode'),
  fuse: is('fuse'),
  solderFuse: is('solder.fuse'),
  qiCable: is('qi.cable'),
  solderQi: is('solder.qi'),
  spPins: is('safepulse.pins'),
  gpsWires: is('gps.wires'),
  solderGps: is('solder.gps'),
  safepulse: is('safepulse'),
  solderSp: is('solder.safepulse'),
  gps: is('gps'),
  tube: is('tube', 'tube.cover'),
  anode: is('tube.anode'),
  cathode: is('tube.cathode'),
  qi: is('qi.coil', 'qi.module'),
  sd: is('sdcard'),
  battery: is('battery'),
  case: is('case'),
};
S.clipsAndSolder = any(S.clips, S.solderClips);
export const SELECTORS = S;

// No detachable sub-assemblies in this build: every part is added directly to the board.
export const UNITS = {};

export const EVIDENCE = ['manual', 'cad', 'model'];
export const TOOLS = ['iron', 'cutters', 'pliers', 'screwdriver', 'heatgun', 'stripper'];
export const CHAPTERS = ['header', 'power', 'hv', 'controller', 'sensor', 'charger', 'finish'];

const ISO = { yaw: -62, pitch: 36 };
const TOPV = { yaw: -90, pitch: 62 };
const UNDER = { yaw: -118, pitch: -42 };
const enter = (sel, from, delay) => ({ sel, mode: 'enter', from, ...(delay ? { delay } : {}) });
const up = (z) => [0, 0, z];

export const STEPS = [
  {
    chapter: 'header', id: 'orient-the-pcb',
    parts: [{ key: 'pcb', qty: 1, sel: S.pcb, swatch: '#141414' }],
    add: [enter(S.pcb, up(-14))],
    view: TOPV,
    evidence: ['manual', 'cad'],
  },
  {
    chapter: 'header', id: 'place-the-header',
    parts: [{ key: 'header-2x15', qty: 1, sel: S.header, swatch: '#2b2b2b' }],
    add: [enter(S.header, up(20))],
    notes: [{ kind: 'info' }],
    view: { yaw: -70, pitch: 40, focus: S.pcb },
    evidence: ['manual', 'cad'],
  },
  {
    chapter: 'header', id: 'dry-fit-the-controller',
    parts: [{ key: 'm5-cores3', qty: 1, sel: S.m5Fit, swatch: '#d9d9d9' }],
    add: [enter(S.m5Fit, up(34))],
    notes: [{ kind: 'info' }],
    view: { yaw: -70, pitch: 30 },
    evidence: ['manual', 'cad'],
  },
  {
    chapter: 'header', id: 'fasten-with-screws',
    tools: ['screwdriver'],
    parts: [{ key: 'm3-screw', qty: 2, sel: S.screwsFit, swatch: '#cfd2d6' }],
    add: [enter(S.screwsFit, up(-18))],
    view: { ...UNDER, yaw: -100 },
    evidence: ['manual', 'model'],
  },
  {
    chapter: 'header', id: 'solder-the-header',
    tools: ['iron'],
    add: [{ sel: S.solderHeader, mode: 'appear' }],
    highlight: S.solderHeader,
    notes: [{ kind: 'info' }],
    view: { ...UNDER, yaw: -100, pitch: -50 },
    evidence: ['manual', 'model'],
  },
  {
    chapter: 'header', id: 'remove-the-controller',
    tools: ['screwdriver'],
    remove: [{ sel: S.m5Fit, to: up(34) }, { sel: S.screwsFit, to: up(-18) }],
    view: { yaw: -70, pitch: 30 },
    evidence: ['manual', 'cad'],
  },
  {
    chapter: 'power', id: 'battery-clips',
    parts: [{ key: 'battery-clip', qty: 2, sel: S.clips, swatch: '#c9cbd0' }],
    add: [enter(S.clips, up(-18))],
    notes: [{ kind: 'info' }],
    view: { ...UNDER, yaw: -90 },
    evidence: ['manual', 'cad'],
  },
  {
    chapter: 'power', id: 'solder-the-clips',
    tools: ['iron'],
    add: [{ sel: S.solderClips, mode: 'appear' }],
    notes: [{ kind: 'info' }],
    view: { ...ISO, pitch: 44 },
    evidence: ['manual', 'model'],
  },
  {
    chapter: 'power', id: 'protection-diode',
    tools: ['iron', 'cutters'],
    parts: [{ key: 'diode', qty: 1, sel: S.diode, swatch: '#1a1a1a' }],
    add: [enter(S.diode, up(-16)), { sel: S.solderDiode, mode: 'appear' }],
    notes: [{ kind: 'info' }],
    view: { yaw: -70, pitch: -22, focus: S.diode, zoom: 1.5 },
    evidence: ['manual', 'cad'],
  },
  {
    chapter: 'power', id: 'fuse-holder',
    tools: ['iron'],
    parts: [{ key: 'fuse-holder', qty: 1, sel: S.fuse, swatch: '#d8d8d8' }],
    add: [enter(S.fuse, up(-16)), { sel: S.solderFuse, mode: 'appear' }],
    view: { yaw: -70, pitch: -22, focus: S.fuse, zoom: 1.5 },
    evidence: ['manual', 'cad'],
  },
  {
    chapter: 'power', id: 'charger-cable',
    tools: ['iron'],
    parts: [{ key: 'qi-connector', qty: 1, sel: S.qiCable, swatch: '#f0f0e8' }],
    add: [enter(S.qiCable, up(-16)), { sel: S.solderQi, mode: 'appear' }],
    notes: [{ kind: 'info' }],
    view: { yaw: -70, pitch: -22, focus: S.qiCable, zoom: 1.5 },
    evidence: ['manual', 'cad'],
  },
  {
    chapter: 'power', id: 'insulate-the-clips',
    tools: ['heatgun'],
    highlight: S.clips,
    notes: [{ kind: 'info' }],
    view: { ...UNDER, yaw: -90 },
    evidence: ['manual'],
  },
  {
    chapter: 'hv', id: 'safepulse-pins',
    parts: [{ key: 'pin-header', qty: 5, sel: S.spPins, swatch: '#d9b23a' }],
    add: [enter(S.spPins, up(-16))],
    notes: [{ kind: 'info' }, { kind: 'model' }],
    view: { ...UNDER, yaw: -100 },
    evidence: ['manual', 'model'],
  },
  {
    chapter: 'hv', id: 'gps-wires',
    tools: ['iron'],
    parts: [{ key: 'gps-wire', qty: 4, sel: S.gpsWires, swatch: '#d64040' }],
    add: [enter(S.gpsWires, up(10)), { sel: S.solderGps, mode: 'appear' }],
    notes: [{ kind: 'info' }, { kind: 'model' }],
    view: { yaw: -70, pitch: 44, focus: any(S.gpsWires, S.solderGps), zoom: 1.5 },
    evidence: ['manual', 'model'],
  },
  {
    chapter: 'hv', id: 'solder-the-safepulse',
    tools: ['iron'],
    parts: [{ key: 'safepulse', qty: 1, sel: S.safepulse, swatch: '#1c1fa0' }],
    add: [enter(S.safepulse, up(-26)), { sel: S.solderSp, mode: 'appear' }],
    notes: [{ kind: 'info' }],
    view: { ...UNDER, yaw: -100 },
    evidence: ['manual', 'cad'],
  },
  {
    chapter: 'hv', id: 'mount-the-gps',
    parts: [{ key: 'gps-module', qty: 1, sel: S.gps, swatch: '#3040a0' }],
    add: [enter(S.gps, up(22))],
    notes: [{ kind: 'info' }],
    view: { yaw: -70, pitch: 40, focus: any(S.gps, S.pcb), zoom: 1.0 },
    evidence: ['manual', 'cad'],
  },
  {
    chapter: 'controller', id: 'mount-the-controller',
    tools: ['screwdriver'],
    parts: [{ key: 'm5-cores3', qty: 1, sel: S.m5, swatch: '#d9d9d9' }],
    add: [enter(S.m5, up(34)), enter(S.screws, up(-18), 0.4)],
    notes: [{ kind: 'warning' }],
    view: { yaw: -70, pitch: 30 },
    evidence: ['manual', 'cad'],
  },
  {
    chapter: 'sensor', id: 'place-the-sensor',
    parts: [
      { key: 'lnd-7317', qty: 1, sel: S.tube, swatch: '#b0b0b0' },
    ],
    add: [enter(S.tube, up(-34))],
    notes: [{ kind: 'warning' }, { kind: 'model' }],
    view: { ...UNDER, yaw: -80 },
    evidence: ['manual', 'cad'],
  },
  {
    chapter: 'sensor', id: 'wire-the-anode',
    tools: ['iron', 'heatgun'],
    parts: [{ key: 'anode-wire', qty: 1, sel: S.anode, swatch: '#d92b1f' }],
    add: [enter(S.anode, up(-8))],
    notes: [{ kind: 'info' }, { kind: 'model' }],
    view: { ...UNDER, yaw: -95, focus: any(S.anode, S.safepulse), zoom: 1.2 },
    evidence: ['manual', 'model'],
  },
  {
    chapter: 'sensor', id: 'wire-the-cathode',
    tools: ['iron', 'heatgun'],
    parts: [{ key: 'cathode-wire', qty: 1, sel: S.cathode, swatch: '#1a1a1a' }],
    add: [enter(S.cathode, up(-8))],
    notes: [{ kind: 'info' }, { kind: 'model' }],
    view: { ...UNDER, yaw: -95, focus: any(S.cathode, S.safepulse), zoom: 1.2 },
    evidence: ['manual', 'model'],
  },
  {
    chapter: 'sensor', id: 'preliminary-test',
    notes: [{ kind: 'info' }],
    view: ISO,
    evidence: ['manual'],
  },
  {
    chapter: 'charger', id: 'wireless-charger',
    tools: ['iron'],
    parts: [{ key: 'qi-receiver', qty: 1, sel: S.qi, swatch: '#b8732f' }],
    add: [enter(S.qi, up(-20))],
    notes: [{ kind: 'info' }, { kind: 'model' }],
    view: { ...UNDER, yaw: -90 },
    evidence: ['manual', 'model'],
  },
  {
    chapter: 'finish', id: 'card-and-battery',
    parts: [
      { key: 'microsd-card', qty: 1, sel: S.sd, swatch: '#262633' },
      { key: 'battery-18650', qty: 1, sel: S.battery, swatch: '#2f9b4a' },
    ],
    add: [enter(S.sd, [0, 14, 0]), enter(S.battery, up(-9), 0.3)],
    notes: [{ kind: 'warning' }, { kind: 'model' }],
    view: { yaw: -75, pitch: -10 },
    evidence: ['manual', 'cad'],
  },
  {
    chapter: 'finish', id: 'place-in-the-case',
    parts: [{ key: 'pelican-1015', qty: 1, sel: S.case, swatch: '#c7d3e0' }],
    add: [enter(S.case, up(-46))],
    notes: [{ kind: 'model' }],
    view: { yaw: -58, pitch: 34 },
    evidence: ['manual', 'cad'],
  },
  {
    chapter: 'finish', id: 'assembly-complete',
    view: { yaw: -58, pitch: 30 },
    finale: true,
    evidence: ['manual'],
  },
];
