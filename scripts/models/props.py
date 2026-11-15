"""Real propellers for the Mercury models.

The CAD exports stand each propeller in as a thin smoked disc. This finds
every disc (a connected, flat, round island of the "Propellers" material),
removes it and builds a twisted, tapered blade set with a hub in its place,
on the same centre, axis and diameter. Islands that are not discs (the
detailed V2 models already carry blade geometry) are left alone.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

PROP_MATERIAL = "Propellers"


def _islands(bm, faces):
    seen, out = set(), []
    for f in faces:
        if f.index in seen:
            continue
        stack, isle = [f], []
        seen.add(f.index)
        while stack:
            g = stack.pop()
            isle.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen and h.material_index == f.material_index:
                        seen.add(h.index)
                        stack.append(h)
        out.append(isle)
    return out


def _disc(isle):
    """(centre, axis, radius) if the island is a thin round disc, else None."""
    verts = {v for f in isle for v in f.verts}
    pts = np.array([v.co[:] for v in verts])
    if len(pts) < 12:
        return None
    m = np.zeros((3, 3))
    for f in isle:
        n = np.array(f.normal[:])
        m += f.calc_area() * np.outer(n, n)
    w, vec = np.linalg.eigh(m)
    axis = vec[:, 2]
    centre = (pts.max(0) + pts.min(0)) / 2
    rel = pts - centre
    along = rel @ axis
    radial = np.linalg.norm(rel - np.outer(along, axis), axis=1)
    radius = radial.max()
    thick = along.max() - along.min()
    if radius < 0.01 or thick > radius * 0.35:
        return None
    # A disc has (nearly) every vertex on the rim; real blades do not.
    if (radial > radius * 0.9).mean() < 0.5:
        return None
    if axis[2] < 0:
        axis = -axis
    return Vector(centre), Vector(axis), float(radius)


def _blade_set(bm, mat_index, centre, axis, radius, blades, phase):
    z = axis.normalized()
    x = z.orthogonal().normalized()
    y = z.cross(x)
    frame = Matrix((x, y, z)).transposed()
    stations = 12
    profile = 10

    def chord(t):  # widest about a third out, narrow tip
        return radius * (0.045 + 0.15 * math.sin(math.pi * min(1.0, t * 1.05) ** 0.62) ** 1.25) * (1 - 0.45 * t ** 3)

    def section(t, turn):
        r = radius * (0.1 + 0.9 * t)
        c = chord(t)
        pitch = math.radians(30 - 22 * t ** 0.8)
        ring = []
        for k in range(profile):
            a = 2 * math.pi * k / profile
            u = math.cos(a) * 0.5 * c
            w = math.sin(a) * 0.06 * c * (1.0 + 0.6 * math.cos(a))
            lx = u * math.cos(pitch) - w * math.sin(pitch) - 0.08 * c
            lz = u * math.sin(pitch) + w * math.cos(pitch)
            p = Vector((r, lx, lz))
            p = Matrix.Rotation(turn, 3, "Z") @ p
            ring.append(bm.verts.new(centre + frame @ p))
        return ring

    made = []
    for b in range(blades):
        turn = phase + 2 * math.pi * b / blades
        rings = [section(i / (stations - 1), turn) for i in range(stations)]
        for a, c in zip(rings, rings[1:]):
            for k in range(profile):
                made.append(bm.faces.new((a[k], a[(k + 1) % profile], c[(k + 1) % profile], c[k])))
        made.append(bm.faces.new(rings[-1]))
        made.append(bm.faces.new(list(reversed(rings[0]))))
    # Hub.
    seg, hr, hh = 20, radius * 0.085, radius * 0.07
    top, bot = [], []
    for k in range(seg):
        a = 2 * math.pi * k / seg
        top.append(bm.verts.new(centre + frame @ Vector((math.cos(a) * hr, math.sin(a) * hr, hh))))
        bot.append(bm.verts.new(centre + frame @ Vector((math.cos(a) * hr, math.sin(a) * hr, -hh))))
    for k in range(seg):
        made.append(bm.faces.new((bot[k], bot[(k + 1) % seg], top[(k + 1) % seg], top[k])))
    made.append(bm.faces.new(top))
    made.append(bm.faces.new(list(reversed(bot))))
    for f in made:
        f.material_index = mat_index
        f.smooth = True


def replace_discs(obj, refine=True):
    """Swap prop discs for blades on one mesh object, and (unless refine is
    False) round the airframe's hard edges on the way. Returns the
    (centre, axis, radius) of each rotor."""
    idx = next((i for i, s in enumerate(obj.material_slots)
                if s.material and s.material.name.split(".")[0] == PROP_MATERIAL), None)
    discs = []
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    # glTF splits vertices at hard edges; weld so bodies are closed again and a
    # disc's caps and rim are one island. A model left as modelled keeps its
    # own normals: only its prop faces are welded.
    weld = bm.verts if refine or idx is None else list(
        {v for f in bm.faces if f.material_index == idx for v in f.verts})
    bmesh.ops.remove_doubles(bm, verts=weld, dist=1e-5)
    bm.faces.ensure_lookup_table()
    bm.faces.index_update()
    bm.normal_update()
    if idx is not None:
        doomed = []
        for isle in _islands(bm, [f for f in bm.faces if f.material_index == idx]):
            d = _disc(isle)
            if d:
                discs.append(d)
                doomed += isle
        bmesh.ops.delete(bm, geom=doomed, context="FACES")
    discs.sort(key=lambda d: (round(d[0].x, 3), round(d[0].y, 3)))
    if refine:
        _soften(bm)
    for i, (centre, axis, radius) in enumerate(discs):
        _blade_set(bm, idx, centre, axis, radius, 3 if radius < 0.07 else 2, phase=0.6 + i * 2.39996)
    bm.normal_update()
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    if refine:
        obj.data.shade_smooth()
        try:
            obj.data.set_sharp_from_angle(angle=math.radians(38))
        except AttributeError:
            pass
    return discs


def _soften(bm):
    """Round every hard edge with a small three-step fillet, sized to the part.

    The CAD comes over with razor edges and blocky stand-ins. Nothing is added
    or moved: each sharp edge just gets the radius a printed or machined part
    would have, so it catches light instead of reading as a box.
    """
    pts = [v.co for v in bm.verts]
    if not pts:
        return
    span = max(max(p[i] for p in pts) - min(p[i] for p in pts) for i in range(3))
    width = min(0.004, max(0.0012, span * 0.004))
    sharp = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(40)]
    # Leave slivers alone: an edge shorter than a few fillet widths has no room for one.
    sharp = [e for e in sharp if e.calc_length() > width * 3]
    for e in bm.edges:
        e.smooth = True
    bmesh.ops.bevel(bm, geom=sharp, offset=width, offset_type="OFFSET", segments=3, profile=0.5,
                    affect="EDGES", clamp_overlap=True, harden_normals=False)
    for f in bm.faces:
        f.smooth = True
