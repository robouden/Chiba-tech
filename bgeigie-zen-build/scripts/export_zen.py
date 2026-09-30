#!/usr/bin/env python3
"""Export the bGeigieZen V4.2.x 3D model to assets/assembly.{json,bin}.

Source: Zen.pcb3d (a pcb2blender/KiCad export: pcb.wrl + components/*.wrl + pads/*.toml)
from the Safecast/bGeigieZen repo, hardware/bGeigieZen V4.x.x draft and production/bGeigieZen V4.2.x/.

    python3 scripts/export_zen.py "<path>/Zen.pcb3d"

Real CAD: PCB, M5Stack CoreS3, 2x15 header, LND7318 tube + grid cover, GPS, Safepulse,
diode, battery clips, 18650, fuse and Qi connector.
Generated (marked `model` evidence in steps.js): solder joints, M3 screws, J4/J5 pins,
GPS/tube wires, microSD card and Qi coil/module.

Units mm, Z up, PCB mid-plane at Z = 0 (top side +Z), XY re-centred on the board.
Output format: see README ("Asset format").
"""
import json
import pathlib
import re
import struct
import sys
import tempfile
import tomllib
import zipfile

import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import vrml  # noqa: E402

OUT = pathlib.Path(__file__).resolve().parent.parent / 'assets'
Q = 0.005                 # quantum_mm
CREASE = np.cos(np.radians(38))
CHUNK_TRIS = 20000        # keeps split vertices under the Uint16 limit per chunk
CENTER = np.array([149.3, -99.0])   # board centre in wrl mm (x, -y)
TOP, BOT = 0.8, -0.8      # board surfaces

# ----------------------------------------------------------------- generated primitives


def _shape(color, xyz, tris):
    return dict(color=color, alpha=1.0, xyz=np.asarray(xyz, float), tris=np.asarray(tris, int))


def box(lo, hi, color):
    (x0, y0, z0), (x1, y1, z1) = lo, hi
    v = np.array([(x, y, z) for z in (z0, z1) for y in (y0, y1) for x in (x0, x1)])
    f = [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]
    return _shape(color, v, [t for a, b, c, d in f for t in ((a, b, c), (a, c, d))])


def frustum(cx, cy, z0, z1, r0, r1, color, seg=14):
    """Cylinder / cone / mound along Z; r1 == 0 gives a point apex."""
    a = np.linspace(0, 2 * np.pi, seg, endpoint=False)
    ring0 = np.c_[cx + r0 * np.cos(a), cy + r0 * np.sin(a), np.full(seg, z0)]
    ring1 = np.c_[cx + r1 * np.cos(a), cy + r1 * np.sin(a), np.full(seg, z1)]
    v = np.vstack([ring0, ring1, [[cx, cy, z0], [cx, cy, z1]]])
    t = []
    for k in range(seg):
        n = (k + 1) % seg
        t += [(k, n, seg + n), (k, seg + n, seg + k), (2 * seg, n, k), (2 * seg + 1, seg + k, seg + n)]
    return _shape(color, v, t)


def tube(points, r, color, seg=8):
    """Wire: cylinders along a polyline, with round joints."""
    shapes = []
    for p, q in zip(points, points[1:]):
        p, q = np.array(p, float), np.array(q, float)
        d = q - p
        length = np.linalg.norm(d)
        if length < 1e-6:
            continue
        d /= length
        u = np.cross(d, [0, 0, 1] if abs(d[2]) < 0.9 else [1, 0, 0])
        u /= np.linalg.norm(u)
        w = np.cross(d, u)
        a = np.linspace(0, 2 * np.pi, seg, endpoint=False)
        ring = (np.cos(a)[:, None] * u + np.sin(a)[:, None] * w) * r
        v = np.vstack([p + ring, q + ring, p, q])
        t = []
        for k in range(seg):
            n = (k + 1) % seg
            t += [(k, n, seg + n), (k, seg + n, seg + k), (2 * seg, n, k), (2 * seg + 1, seg + k, seg + n)]
        shapes.append(_shape(color, v, t))
    return shapes


# ----------------------------------------------------------------- pads


def load_pads(root):
    pads = {}
    for f in sorted((root / 'pads').glob('*.toml')):
        m = re.match(r'^.+?_(J\d+|BT1|D2|F2|H\d+|QI_charger)_\d+_\d+$', f.stem)
        if not m:
            continue
        x, y = tomllib.loads(f.read_text())['position']
        pads.setdefault(m.group(1), []).append(np.array([x, -y]))   # wrl frame: y flipped
    return pads


def solder(pads, side, color=(0.86, 0.87, 0.9)):
    z = TOP if side > 0 else BOT
    return [frustum(p[0], p[1], z, z + side * 0.9, 1.15, 0.45, color) for p in pads]


# ----------------------------------------------------------------- mesh conditioning


def condition(shapes):
    """Merge shapes -> welded, crease-split triangle mesh with vertex colours + feature edges."""
    xyz = np.vstack([s['xyz'] for s in shapes])
    col = np.vstack([np.tile(s['color'], (len(s['xyz']), 1)) for s in shapes])
    off, tris = 0, []
    for s in shapes:
        tris.append(s['tris'] + off)
        off += len(s['xyz'])
    tris = np.vstack(tris)
    # drop degenerate triangles
    a, b, c = (xyz[tris[:, k]] for k in range(3))
    n = np.cross(b - a, c - a)
    area = np.linalg.norm(n, axis=1)
    keep = area > 1e-9
    tris, n, area = tris[keep], n[keep], area[keep]
    n = n / area[:, None]
    # weld by position
    _, weld = np.unique(np.round(xyz / 1e-4).astype(np.int64), axis=0, return_inverse=True)
    weld = weld.ravel()
    wt = weld[tris]
    # edge -> faces
    e = np.sort(np.concatenate([wt[:, [0, 1]], wt[:, [1, 2]], wt[:, [2, 0]]]), axis=1)
    face = np.tile(np.arange(len(tris)), 3)
    order = np.lexsort((e[:, 1], e[:, 0]))
    e, face = e[order], face[order]
    same = np.all(e[1:] == e[:-1], axis=1)
    starts = np.flatnonzero(np.r_[True, ~same])
    counts = np.diff(np.r_[starts, len(e)])
    # smoothing groups via union-find over smooth two-face edges
    parent = np.arange(len(tris))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    feature = []
    for s0, cnt in zip(starts, counts):
        if cnt == 1:
            feature.append(e[s0])
        elif cnt == 2:
            f0, f1 = face[s0], face[s0 + 1]
            if n[f0] @ n[f1] >= CREASE:
                parent[find(f0)] = find(f1)
            else:
                feature.append(e[s0])
        else:
            feature.append(e[s0])
    comp = np.array([find(i) for i in range(len(tris))])
    # corner vertices keyed by (weld id, smoothing group)
    key = np.c_[wt.ravel(), np.repeat(comp, 3)]
    ukey, inv = np.unique(key, axis=0, return_inverse=True)
    inv = inv.ravel()
    # position/colour of each corner vertex from any source vertex that produced it
    src = tris.ravel()
    first = np.zeros(len(ukey), dtype=np.int64)
    first[inv] = src
    verts, vcol = xyz[first], col[first]
    itris = inv.reshape(-1, 3)
    # feature edge coordinates (welded positions)
    wpos = np.zeros((weld.max() + 1, 3))
    wpos[weld] = xyz
    fe = np.array(feature, dtype=np.int64).reshape(-1, 2)
    edges = wpos[fe].reshape(-1, 3) if len(fe) else np.zeros((0, 3))
    return verts, vcol, itris, edges


def chunks(verts, vcol, itris):
    for i in range(0, len(itris), CHUNK_TRIS):
        t = itris[i:i + CHUNK_TRIS]
        used, inv = np.unique(t, return_inverse=True)
        yield verts[used], vcol[used], inv.reshape(-1, 3)


# ----------------------------------------------------------------- part table


def build_parts(root):
    shapes = vrml.load(root / 'pcb.wrl')
    for s in shapes:
        s['xyz'] = s['xyz'] * 1000.0
        s['xyz'][:, :2] -= CENTER
    by_inst = {}
    for s in shapes:
        by_inst.setdefault(s['inline'][1] if s['inline'] else 0, []).append(s)
    pads = load_pads(root)
    for k in pads:
        pads[k] = [p - CENTER for p in pads[k]]

    def inst(n):
        return by_inst[n]

    silver, gold, red, black, blue = (0.8, 0.8, 0.82), (0.85, 0.7, 0.3), (0.85, 0.12, 0.1), (0.1, 0.1, 0.1), (0.15, 0.3, 0.85)
    P = []   # (id, label, chain, shapes)

    def add(pid, label, shp, chain=None):
        P.append((pid, label, chain or [pid.split('.')[0]], shp))

    # -- real CAD
    board = inst(0)
    for s in board:   # solder mask is coplanar with the copper: lift it 0.05 mm so only the pads show
        if s['alpha'] < 0.99:
            s['alpha'] = 1.0
            s['xyz'][:, 2] += 0.05 * np.sign(s['xyz'][:, 2].mean())
    add('pcb', 'Printed circuit board V4.x', board)
    add('j1', '2x15 pin header', inst(1))
    add('m5.fit', 'M5Stack CoreS3 (dry fit)', inst(2), ['m5'])
    add('m5', 'M5Stack CoreS3', inst(2))
    add('tube', 'LND 7318 pancake sensor', inst(3))
    add('tube.cover', 'Sensor protective cover', inst(4), ['tube'])
    add('gps', 'GPS receiver', inst(6))
    add('safepulse', 'Safepulse 500 V supply', inst(7))
    add('diode', 'Reverse-protection diode', inst(8))
    add('clip.a', 'Battery clip', inst(9), ['clips'])
    add('clip.b', 'Battery clip', inst(10), ['clips'])
    add('battery', '18650 Li-Ion battery', inst(11))
    add('fuse', 'Fuse holder', inst(12))
    add('qi.cable', 'Qi charger connector', inst(13))
    # -- generated: solder
    add('solder.j1', 'Header solder joints', solder(pads['J1'], -1), ['solder'])
    add('solder.clips', 'Battery clip solder joints', solder(pads['BT1'], +1), ['solder'])
    add('solder.diode', 'Diode solder joints', solder(pads['D2'], +1), ['solder'])
    add('solder.fuse', 'Fuse holder solder joints', solder(pads['F2'], +1), ['solder'])
    add('solder.qi', 'Qi connector solder joints', solder(pads['QI_charger'], +1), ['solder'])
    add('solder.gps', 'GPS wire solder joints', solder(pads['J3'], -1), ['solder'])
    add('solder.safepulse', 'Safepulse solder joints', solder(pads['J4'] + pads['J5'], +1), ['solder'])
    # -- generated: screws (M3 truss head, from the underside)
    for pid, label in (('screws.fit', 'M3 screws (dry fit)'), ('screws', 'M3 screws')):
        scr = []
        for p in pads['H4'] + pads['H6']:
            scr.append(frustum(p[0], p[1], BOT - 1.6, BOT, 2.9, 2.9, silver, 20))
            scr.append(frustum(p[0], p[1], BOT, 6.0, 1.4, 1.4, silver, 12))
        add(pid, label, scr, ['screws'])
    # -- generated: Safepulse header pins (long end + plastic carrier down)
    pins = []
    for p in pads['J4'] + pads['J5']:
        pins.append(box((p[0] - 1.27, p[1] - 1.27, BOT - 2.5), (p[0] + 1.27, p[1] + 1.27, BOT), black))
        pins.append(box((p[0] - 0.32, p[1] - 0.32, BOT - 8.0), (p[0] + 0.32, p[1] + 0.32, TOP + 2.4), gold))
    add('safepulse.pins', 'Safepulse header pins', pins, ['safepulse'])
    # -- generated: GPS wires (J3 holes -> module edge)
    wires = []
    for i, p in enumerate(sorted(pads['J3'], key=lambda q: q[0])):
        c = [(0.9, 0.1, 0.1), (0.1, 0.1, 0.1), (0.9, 0.8, 0.1), (0.1, 0.6, 0.2)][i % 4]
        wires += tube([(p[0], p[1], BOT - 2.0), (p[0], p[1], TOP + 3.0), (p[0], p[1] + 3.0, 7.0)], 0.35, c)
    add('gps.wires', 'GPS wires', wires, ['gps'])
    # -- generated: sensor wires (anode red / cathode black), approximate routing
    add('tube.anode', 'Sensor anode wire', tube([(13.5, -0.6, -10.0), (13.5, -0.6, -1.0), (22.0, 0.0, -1.0)], 0.45, red), ['tube'])
    add('tube.cathode', 'Sensor cathode wire', tube([(-7.3, 0.5, -8.0), (5.0, 0.5, -8.0), (5.0, 0.5, -1.0), (12.0, 3.0, -1.0)], 0.45, black), ['tube'])
    # -- generated: microSD card (top slot of the controller) and Qi coil / module
    add('sdcard', 'microSD card', [box((-14.0, 26.8, 6.0), (-3.0, 28.8, 7.0), (0.15, 0.15, 0.2))], ['m5'])
    coil = [frustum(-3.0, 0.0, -36.0, -35.4, 21.0, 21.0, (0.75, 0.45, 0.2), 40)]
    add('qi.coil', 'Qi receiver coil', coil, ['qi'])
    add('qi.module', 'Qi interface module', [box((31.0, -12.0, -36.0), (49.0, 2.0, -34.5), (0.15, 0.35, 0.6))], ['qi'])
    return P


# ----------------------------------------------------------------- packing


def main(pcb3d):
    with tempfile.TemporaryDirectory() as tmp:
        zipfile.ZipFile(pcb3d).extractall(tmp)
        parts = build_parts(pathlib.Path(tmp))
    pos, edg, idx, col, manifest = [], [], [], [], []
    vs = ix = es = 0
    for pid, label, chain, shapes in parts:
        verts, vcol, itris, edges = condition(shapes)
        # keep the same coordinate quantisation for edges
        first = True
        for cv, cc, ct in chunks(verts, vcol, itris):
            ce = edges if first else np.zeros((0, 3))
            first = False
            lo, hi = cv.min(0), cv.max(0)
            if len(ce):
                lo, hi = np.minimum(lo, ce.min(0)), np.maximum(hi, ce.max(0))
            assert len(cv) < 65536, (pid, len(cv))
            pos.append(np.round(cv / Q).astype(np.int16))
            edg.append(np.round(ce / Q).astype(np.int16))
            idx.append(ct.ravel().astype(np.uint16))
            col.append(np.round(cc * 255).astype(np.uint8))
            manifest.append(dict(id=pid, native='Shape', label=label, chain=chain, alpha=1.0,
                                 color=[round(float(x), 3) for x in cc.mean(0)], metadata={},
                                 bbox=[[round(float(x), 3) for x in lo], [round(float(x), 3) for x in hi]],
                                 vertices=[vs, len(cv)], indices=[ix, ct.size], edges=[es, len(ce)]))
            vs += len(cv)
            ix += ct.size
            es += len(ce)
    b_pos = np.concatenate(pos).ravel().astype('<i2').tobytes()
    b_edg = np.concatenate(edg).ravel().astype('<i2').tobytes()
    b_idx = np.concatenate(idx).astype('<u2').tobytes()
    b_col = np.concatenate(col).ravel().tobytes()
    off_e = len(b_pos)
    off_i = off_e + len(b_edg)
    pad = (-(off_i + len(b_idx))) % 4
    off_c = off_i + len(b_idx) + pad
    extent = max(abs(np.concatenate([p.ravel() for p in pos]).astype(int)).max(), 1) * Q
    manifest_doc = dict(
        schema='sesame-build/1', units='mm, CAD Z-up; PCB mid-plane at Z=0, top side +Z',
        source=dict(repository='Safecast/bGeigieZen', file='hardware/bGeigieZen V4.x.x draft and production/bGeigieZen V4.2.x/Zen.pcb3d',
                    generator='scripts/export_zen.py'),
        tolerance_mm=0.0, quantum_mm=Q,
        buffers=dict(positions=dict(byteOffset=0, length=int(sum(p.size for p in pos))),
                     edges=dict(byteOffset=off_e, length=int(sum(e.size for e in edg))),
                     indices=dict(byteOffset=off_i, length=int(sum(i.size for i in idx))),
                     colors=dict(byteOffset=off_c, length=int(sum(c.size for c in col)))),
        parts=manifest)
    OUT.mkdir(exist_ok=True)
    (OUT / 'assembly.bin').write_bytes(b_pos + b_edg + b_idx + b'\0' * pad + b_col)
    (OUT / 'assembly.json').write_text(json.dumps(manifest_doc, separators=(',', ':')))
    print(f'{len(parts)} parts / {len(manifest)} chunks, {vs} vertices, {es // 2} edges, '
          f'{ix // 3} triangles, max |coord| {extent:.1f} mm, {(len(b_pos) + len(b_edg) + len(b_idx) + pad + len(b_col)) / 1e6:.1f} MB')


if __name__ == '__main__':
    main(sys.argv[1])
