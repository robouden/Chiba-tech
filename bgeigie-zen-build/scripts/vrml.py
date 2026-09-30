"""Minimal VRML 2.0 reader for KiCad / pcb2blender exports (numpy only).

Handles DEF/USE, Transform (translation, rotation, scale), Group, Inline,
Shape > Appearance > Material and IndexedFaceSet. Yields Shape records
already transformed into the root frame:

    dict(color=(r, g, b), alpha=a, xyz=float64[n,3], tris=int[m,3], inline=(url, instance) or None)
"""
import re
import pathlib
import numpy as np

NUM = re.compile(r'^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$')
TOKEN = re.compile(r'"[^"]*"|[{}\[\]]|[^\s{}\[\],]+')


class Node:
    __slots__ = ('type', 'f', 'name')

    def __init__(self, type_, name=None):
        self.type, self.f, self.name = type_, {}, name


def parse(text):
    toks = TOKEN.findall(text)
    defs = {}
    pos = 0

    def value():
        nonlocal pos
        t = toks[pos]
        if t == '[':
            pos += 1
            out = []
            while toks[pos] != ']':
                v = value()
                out.extend(v) if isinstance(v, list) else out.append(v)
            pos += 1
            return out
        if t == 'DEF':
            name = toks[pos + 1]
            pos += 2
            n = node()
            n.name = name
            defs[name] = n
            return n
        if t == 'USE':
            pos += 2
            return defs[toks[pos - 1]]
        if pos + 1 < len(toks) and toks[pos + 1] == '{':
            return node()
        if NUM.match(t):  # bare multi-value field: translation 1 2 3
            run = []
            while pos < len(toks) and NUM.match(toks[pos]):
                run.append(toks[pos])
                pos += 1
            return run
        pos += 1
        return t.strip('"') if t.startswith('"') else t

    def node():
        nonlocal pos
        n = Node(toks[pos])
        pos += 2  # type, '{'
        while toks[pos] != '}':
            key = toks[pos]
            pos += 1
            n.f[key] = value()
        pos += 1
        return n

    roots = []
    while pos < len(toks):
        if toks[pos] in ('DEF', 'USE') or (pos + 1 < len(toks) and toks[pos + 1] == '{'):
            roots.append(value())
        else:
            pos += 1  # header comment tokens etc.
    return roots


def _floats(seq):
    """Flatten a parsed field into a float array (numbers arrive as strings)."""
    return np.array([float(x) for x in seq], dtype=np.float64)


def _matrix(n):
    t = _floats(n.f.get('translation', ['0', '0', '0']))
    r = _floats(n.f.get('rotation', ['0', '0', '1', '0']))
    s = _floats(n.f.get('scale', ['1', '1', '1']))
    ax = r[:3]
    ln = np.linalg.norm(ax)
    R = np.eye(3)
    if ln > 1e-12 and abs(r[3]) > 1e-12:
        x, y, z = ax / ln
        c, si = np.cos(r[3]), np.sin(r[3])
        C = 1 - c
        R = np.array([[c + x * x * C, x * y * C - z * si, x * z * C + y * si],
                      [y * x * C + z * si, c + y * y * C, y * z * C - x * si],
                      [z * x * C - y * si, z * y * C + x * si, c + z * z * C]])
    M = np.eye(4)
    M[:3, :3] = R @ np.diag(s)
    M[:3, 3] = t
    return M


def _shape(n, M):
    geo = n.f.get('geometry')
    if geo is None or geo.type != 'IndexedFaceSet':
        return None
    pts = _floats(geo.f['coord'].f['point']).reshape(-1, 3)
    idx = np.array([int(x) for x in geo.f['coordIndex']], dtype=np.int64)
    color, alpha = (0.8, 0.8, 0.8), 1.0
    app = n.f.get('appearance')
    if app is not None and 'material' in app.f:
        m = app.f['material']
        if 'diffuseColor' in m.f:
            color = tuple(float(x) for x in m.f['diffuseColor'])
        alpha = 1.0 - float(m.f.get('transparency', ['0'])[0])
    tris = []
    start = 0
    for k in np.flatnonzero(idx < 0):
        poly = idx[start:k]
        start = k + 1
        for j in range(1, len(poly) - 1):
            tris.append((poly[0], poly[j], poly[j + 1]))
    if not tris:
        return None
    xyz = pts @ M[:3, :3].T + M[:3, 3]
    return dict(color=color, alpha=alpha, xyz=xyz, tris=np.array(tris, dtype=np.int64))


def walk(node, M, base, out, inline=None, count=None):
    if node.type in ('Transform', 'Group'):
        M2 = M @ _matrix(node) if node.type == 'Transform' else M
        kids = node.f.get('children', [])
        for c in kids if isinstance(kids, list) else [kids]:
            if isinstance(c, Node):
                walk(c, M2, base, out, inline, count)
    elif node.type == 'Shape':
        s = _shape(node, M)
        if s:
            s['inline'] = inline
            out.append(s)
    elif node.type == 'Inline':
        url = node.f['url']
        url = url[0] if isinstance(url, list) else url
        count[0] += 1
        for r in parse((base / url).read_text()):
            walk(r, M, base, out, (url, count[0]), count)


def load(path):
    path = pathlib.Path(path)
    out, count = [], [0]
    for r in parse(path.read_text()):
        walk(r, np.eye(4), path.parent, out, None, count)
    return out
