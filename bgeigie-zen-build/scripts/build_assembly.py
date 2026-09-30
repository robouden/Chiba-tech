#!/usr/bin/env python3
"""Generate assets/assembly.json + assembly.bin (schema sesame-build/1) for the
bGeigie Zen viewer from simple primitives (boxes, cylinders).

PLACEHOLDER GEOMETRY: replace `build()` with an exporter for the real CAD
(FreeCAD/STEP -> triangles) and keep the same output format:
  positions/edges: Int16 xyz * quantum_mm   indices: Uint16, local to part
  colors: Uint8 rgb per vertex              edges: line list (2 verts/segment)
Units mm, Z up, enclosure underside at Z=0. Run: python3 scripts/build_assembly.py
"""
import json, math, struct, pathlib

Q = 0.005
OUT = pathlib.Path(__file__).resolve().parent.parent / 'assets'


class Mesh:
    def __init__(self):
        self.v, self.i, self.e = [], [], []

    def quad(self, a, b, c, d):
        n = len(self.v)
        self.v += [a, b, c, d]
        self.i += [n, n + 1, n + 2, n, n + 2, n + 3]

    def box(self, x0, y0, z0, x1, y1, z1):
        p = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
             (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
        for f in [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]:
            self.quad(*[p[k] for k in f])
        for a, b in [(0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (6, 7), (7, 4), (0, 4), (1, 5), (2, 6), (3, 7)]:
            self.e += [p[a], p[b]]

    def cyl(self, cx, cy, z0, r, h, seg=32):
        ring = [(cx + r * math.cos(2 * math.pi * k / seg), cy + r * math.sin(2 * math.pi * k / seg)) for k in range(seg)]
        for k in range(seg):
            a, b = ring[k], ring[(k + 1) % seg]
            self.quad((a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z0 + h), (a[0], a[1], z0 + h))
            self.e += [(a[0], a[1], z0), (b[0], b[1], z0), (a[0], a[1], z0 + h), (b[0], b[1], z0 + h)]
        for z, flip in ((z0, True), (z0 + h, False)):
            c = len(self.v)
            self.v.append((cx, cy, z))
            self.v += [(x, y, z) for x, y in ring]
            for k in range(seg):
                a, b = c + 1 + k, c + 1 + (k + 1) % seg
                self.i += [c, b, a] if flip else [c, a, b]
        for k in range(0, seg, seg // 4):
            a = ring[k]
            self.e += [(a[0], a[1], z0), (a[0], a[1], z0 + h)]


def part(pid, label, chain, color, fn, alpha=1.0):
    m = Mesh()
    fn(m)
    return dict(id=pid, label=label, chain=chain, color=color, alpha=alpha, mesh=m)


def rgb(h):
    return [int(h[k:k + 2], 16) / 255 for k in (1, 3, 5)]


# Layout (mm). Case 120 x 80 x 26, PCB on standoffs above battery + tube.
PCB_Z = 12.0
PCB_T = 1.6
TOP = PCB_Z + PCB_T
STANDOFFS = [(8, 8), (112, 8), (8, 72), (112, 72)]


def build():
    P = []
    A = 'bGeigieZen'

    def case(m):
        m.box(0, 0, 0, 120, 80, 2)
        m.box(0, 0, 2, 120, 2, 26); m.box(0, 78, 2, 120, 80, 26)
        m.box(0, 2, 2, 2, 78, 26); m.box(118, 2, 2, 120, 78, 26)
    P.append(part('case.base', 'Enclosure base', ['Case', A], rgb('#2b2f36'), case))
    P.append(part('battery', 'LiPo battery 60x40x8', ['Battery', A], rgb('#c9ccd1'), lambda m: m.box(6, 6, 2, 66, 46, 10)))
    P.append(part('battery.label', 'Battery label', ['Battery', A], rgb('#d94a3a'), lambda m: m.box(10, 10, 10, 62, 42, 10.15)))
    P.append(part('tube', 'GM pancake tube (placeholder)', ['Tube', A], rgb('#b8bcc4'), lambda m: m.cyl(92, 40, 2, 22, 6, 48)))
    P.append(part('tube.window', 'Tube mica window', ['Tube', A], rgb('#c7a15a'), lambda m: m.cyl(92, 40, 8, 17, 0.3, 48)))
    P.append(part('standoffs', 'M3 standoffs', ['Standoffs', A], rgb('#c2c4c9'),
                  lambda m: [m.cyl(x, y, 2, 2.5, PCB_Z - 2, 16) for x, y in STANDOFFS]))
    P.append(part('pcb', 'Main PCB', ['Mainboard', A], rgb('#14612f'), lambda m: m.box(4, 4, PCB_Z, 116, 76, PCB_Z + PCB_T)))
    # ESP32 module (unit: esp32) -- module + header pins + solder
    P.append(part('esp32.module', 'ESP32 module', ['ESP32', A], rgb('#1a1a1a'), lambda m: (m.box(14, 52, TOP + 2, 39, 70, TOP + 5), m.box(14, 52, TOP + 5, 39, 58, TOP + 5.2))))
    P.append(part('esp32.pins', 'ESP32 header pins', ['ESP32', A], rgb('#c2c4c9'),
                  lambda m: [m.box(15 + k * 2.54, 52.5, TOP, 15.6 + k * 2.54, 53.1, TOP + 2) for k in range(9)] + [m.box(15 + k * 2.54, 69, TOP, 15.6 + k * 2.54, 69.6, TOP + 2) for k in range(9)]))
    P.append(part('esp32.solder', 'ESP32 solder joints', ['ESP32', A], rgb('#dfe3e8'),
                  lambda m: [m.cyl(15.3 + k * 2.54, y, PCB_Z - 0.6, 0.8, 0.7, 8) for k in range(9) for y in (52.8, 69.3)]))
    P.append(part('gps.module', 'GPS module', ['GPS', A], rgb('#1d3a6e'), lambda m: m.box(48, 52, TOP, 66, 70, TOP + 3)))
    P.append(part('gps.patch', 'GPS ceramic patch antenna', ['GPS', A], rgb('#d8c9a0'), lambda m: m.box(50, 54, TOP + 3, 64, 68, TOP + 7)))
    P.append(part('gps.solder', 'GPS solder joints', ['GPS', A], rgb('#dfe3e8'),
                  lambda m: [m.cyl(50 + k * 2.54, 53, PCB_Z - 0.6, 0.8, 0.7, 8) for k in range(6)]))
    P.append(part('hv.module', 'HV supply module', ['HV', A], rgb('#8a2d2d'), lambda m: (m.box(60, 12, TOP, 90, 27, TOP + 1.2), m.box(64, 15, TOP + 1.2, 78, 24, TOP + 9))))
    P.append(part('hv.leads', 'HV lead to tube', ['HV', A], rgb('#e2b04a'), lambda m: m.box(90, 20, TOP + 0.6, 92, 21, TOP + 1.4)))
    P.append(part('oled.module', 'OLED display', ['Display', A], rgb('#0a0a0a'), lambda m: (m.box(80, 54, TOP, 112, 72, TOP + 1.2), m.box(84, 57, TOP + 1.2, 108, 69, TOP + 3))))
    P.append(part('usb', 'USB-C connector', ['USB', A], rgb('#9a9ea6'), lambda m: m.box(108, 28, TOP, 116, 37, TOP + 3.2)))
    P.append(part('wire.batt', 'Battery lead', ['Wiring', A], rgb('#d94a3a'), lambda m: m.box(66, 20, 6, 70, 21, 7)))
    P.append(part('lid', 'Lid (display window)', ['Lid', A], rgb('#3a404a'), lambda m: (
        m.box(0, 0, 26, 120, 50, 28), m.box(0, 76, 26, 120, 80, 28), m.box(0, 50, 26, 76, 76, 28), m.box(112, 50, 26, 120, 76, 28))))
    return P


def main():
    parts = build()
    pos, edg, idx, col, manifest_parts = [], [], [], [], []
    vs = is_ = es = 0
    for p in parts:
        m = p['mesh']
        assert len(m.v) < 65536
        c = [round(x * 255) for x in p['color']]
        lo = [min(v[k] for v in m.v) for k in range(3)]
        hi = [max(v[k] for v in m.v) for k in range(3)]
        for v in m.v:
            pos += [round(x / Q) for x in v]
            col += c
        for v in m.e:
            edg += [round(x / Q) for x in v]
        idx += m.i
        manifest_parts.append(dict(id=p['id'], native='Primitive', label=p['label'], chain=p['chain'], alpha=p['alpha'],
                                   color=p['color'], metadata={}, bbox=[lo, hi], vertices=[vs, len(m.v)],
                                   indices=[is_, len(m.i)], edges=[es, len(m.e)]))
        vs += len(m.v); is_ += len(m.i); es += len(m.e)
    assert max(abs(x) for x in pos + edg) < 32767, 'coordinates exceed Int16 range'
    b_pos = struct.pack(f'<{len(pos)}h', *pos)
    b_edg = struct.pack(f'<{len(edg)}h', *edg)
    b_idx = struct.pack(f'<{len(idx)}H', *idx)
    b_col = bytes(col)
    off_e = len(b_pos); off_i = off_e + len(b_edg); off_c = off_i + len(b_idx)
    manifest = dict(schema='sesame-build/1', units='mm, CAD Z-up; enclosure underside at Z=0',
                    source=dict(generator='scripts/build_assembly.py', note='placeholder primitives, not real CAD'),
                    tolerance_mm=0.0, quantum_mm=Q,
                    buffers=dict(positions=dict(byteOffset=0, length=len(pos)), edges=dict(byteOffset=off_e, length=len(edg)),
                                 indices=dict(byteOffset=off_i, length=len(idx)), colors=dict(byteOffset=off_c, length=len(col))),
                    parts=manifest_parts)
    OUT.mkdir(exist_ok=True)
    (OUT / 'assembly.bin').write_bytes(b_pos + b_edg + b_idx + b_col)
    (OUT / 'assembly.json').write_text(json.dumps(manifest, separators=(',', ':')))
    print(f'{len(parts)} parts, {vs} vertices, {len(b_pos + b_edg + b_idx + b_col)} bytes')


if __name__ == '__main__':
    main()
