"""Run inside Blender:  blender -b "pelican 1015case.blend" --python scripts/export_pelican.py -- out.npz

Exports the Pelican 1015 polycarbonate parts (bottom half, lid, latch) and the rubber liner
from Safecast/bGeigieZen `Misc documents  and software/3d models/pelican 1015case.blend`
as triangle meshes in millimetres (Blender world frame, Z up) for scripts/export_zen.py.
"""
import sys
import bpy
import numpy as np

NAMES = {'body': 'Fusion012.001', 'lid': 'Fillet042.001', 'latch': 'Latch', 'liner': 'Rubber innerliner'}
out = sys.argv[sys.argv.index('--') + 1]
dg = bpy.context.evaluated_depsgraph_get()
data = {}
for key, name in NAMES.items():
    o = bpy.data.objects[name].evaluated_get(dg)
    me = o.to_mesh()
    me.calc_loop_triangles()
    v = np.array([(o.matrix_world @ p.co)[:] for p in me.vertices], dtype=np.float32) * 1000.0
    t = np.array([tri.vertices[:] for tri in me.loop_triangles], dtype=np.int32)
    data[key + '_v'], data[key + '_t'] = v, t
    print(key, len(v), len(t))
np.savez_compressed(out, **data)
