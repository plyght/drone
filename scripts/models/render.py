"""Mercury night-studio renders (Blender 4.2+ as the `bpy` module, Cycles on CPU).

Imports drone GLBs, gives them real propellers (props.py) and studio materials
(woven carbon under a clear coat, printed carbon-nylon with layer lines,
brushed metal, electronics, TPU), and shoots them in a dark studio: a black
wet-look floor, long strip lights that draw a line down every tube and edge,
a cold rim and a warm low kicker. Made for close-ups: frame a small sphere
with --focus and open the lens up with --fstop.

    python3 scripts/models/render.py <out> <a.glb> [<b.glb> ...] [options]

<out> is a PNG for a still, or a directory when --frames is above 1.

Framing
    --res W H        output size (default 1600 1000)
    --az DEG         camera azimuth around the subject (default 32)
    --el DEG         camera elevation (default 14)
    --lens MM        focal length (default 85)
    --margin F       empty border as a fraction of the frame (default 0.1)
    --shift X Y      slide the subject in the frame, in frame fractions
    --focus X Y Z R  frame and focus on a sphere (model space, metres, Z up)
    --fstop F        depth of field (default 5.6; 1.4 to 2.8 for close-ups)
Subject
    --spin DEG       turn the models about the vertical axis
    --row GAP        several GLBs: stand them in a row GAP metres apart, true scale
    --explode F      pull the solid bodies apart (0 = assembled, 1 = fully apart)
Animation (one process, frames written as 0001.png ...)
    --frames N       number of frames
    --turn DEG       total rotation over the frames, about the focus (360 loops)
    --explode-to F   animate --explode from its value to F, eased
    --sweep          the key strip travels across the subject over the frames
    --only A B       render only frames A..B (to split a job across runs)
Quality
    --samples N      Cycles samples (default 96)
    --transparent    transparent film with a shadow catcher instead of the studio
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from props import replace_discs  # noqa: E402

FLAGS = {"sweep", "transparent"}
ARITY = {"res": 2, "shift": 2, "focus": 4, "only": 2}
DEFAULTS = {"res": (1600, 1000), "samples": 96, "az": 32.0, "el": 14.0, "lens": 85.0, "margin": 0.1,
            "shift": (0.0, 0.0), "focus": None, "fstop": 5.6, "spin": 0.0, "row": None, "explode": 0.0,
            "frames": 1, "turn": 0.0, "explode-to": None, "only": None, "sweep": False, "transparent": False}


def parse():
    argv = sys.argv[1:]
    o = dict(DEFAULTS, out=Path(argv[0]), src=[])
    i = 1
    while i < len(argv):
        a = argv[i]
        if not a.startswith("--"):
            o["src"].append(Path(a)); i += 1; continue
        k = a[2:]
        if k in FLAGS:
            o[k] = True; i += 1
        elif k in ARITY:
            n = ARITY[k]; o[k] = tuple(float(v) for v in argv[i + 1:i + 1 + n]); i += 1 + n
        else:
            o[k] = float(argv[i + 1]); i += 2
    for k in ("samples", "frames"):
        o[k] = int(o[k])
    o["res"] = tuple(int(v) for v in o["res"])
    return o


# ---------------------------------------------------------------- materials
def _bsdf(m):
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(b.outputs["BSDF"], out.inputs["Surface"])
    return nt, b


def _set(b, name, value):
    if name in b.inputs:
        b.inputs[name].default_value = value


def mat_weave():
    """2x2 twill carbon: two stripe sets at right angles in a checker, under a clear coat."""
    m = bpy.data.materials.new("Mercury Carbon Weave")
    nt, b = _bsdf(m)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (260, 260, 260)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    w1 = nt.nodes.new("ShaderNodeTexWave"); w1.wave_type = "BANDS"; w1.bands_direction = "X"
    w2 = nt.nodes.new("ShaderNodeTexWave"); w2.wave_type = "BANDS"; w2.bands_direction = "Y"
    for w in (w1, w2):
        w.inputs["Scale"].default_value = 6.0; w.inputs["Distortion"].default_value = 0.0
        nt.links.new(mp.outputs["Vector"], w.inputs["Vector"])
    ck = nt.nodes.new("ShaderNodeTexChecker"); ck.inputs["Scale"].default_value = 1.0
    nt.links.new(mp.outputs["Vector"], ck.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "FLOAT"
    nt.links.new(ck.outputs["Fac"], mix.inputs["Factor"])
    nt.links.new(w1.outputs["Fac"], mix.inputs["A"]); nt.links.new(w2.outputs["Fac"], mix.inputs["B"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.006, 0.006, 0.008, 1)
    ramp.color_ramp.elements[1].color = (0.075, 0.078, 0.086, 1)
    nt.links.new(mix.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    _set(b, "Metallic", 0.25); _set(b, "Roughness", 0.32)
    _set(b, "Coat Weight", 1.0); _set(b, "Coat Roughness", 0.04)
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.2
    nt.links.new(mix.outputs["Result"], bump.inputs["Height"]); nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def mat_print():
    """Charcoal carbon-nylon: fine layer lines and a fibre speckle."""
    m = bpy.data.materials.new("Mercury Printed CF-Nylon")
    nt, b = _bsdf(m)
    _set(b, "Base Color", (0.03, 0.032, 0.037, 1)); _set(b, "Roughness", 0.52); _set(b, "Metallic", 0.1)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    w = nt.nodes.new("ShaderNodeTexWave"); w.wave_type = "BANDS"; w.bands_direction = "Z"
    w.inputs["Scale"].default_value = 1300.0; w.inputs["Distortion"].default_value = 0.0
    nt.links.new(tc.outputs["Object"], w.inputs["Vector"])
    n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 3200.0
    nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
    add = nt.nodes.new("ShaderNodeMath"); add.operation = "ADD"
    nt.links.new(w.outputs["Fac"], add.inputs[0]); nt.links.new(n.outputs["Fac"], add.inputs[1])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.14
    nt.links.new(add.outputs[0], bump.inputs["Height"])
    spec = nt.nodes.new("ShaderNodeMapRange")
    spec.inputs["To Min"].default_value = 0.44; spec.inputs["To Max"].default_value = 0.6
    nt.links.new(n.outputs["Fac"], spec.inputs["Value"]); nt.links.new(spec.outputs["Result"], b.inputs["Roughness"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def mat_plain(name, rgba, metallic, rough, alpha=1.0, transmission=0.0, coat=0.0, emit=None):
    m = bpy.data.materials.new(name)
    _, b = _bsdf(m)
    _set(b, "Base Color", rgba); _set(b, "Metallic", metallic); _set(b, "Roughness", rough); _set(b, "Alpha", alpha)
    _set(b, "Transmission Weight", transmission); _set(b, "Coat Weight", coat)
    if emit:
        _set(b, "Emission Color", emit[0]); _set(b, "Emission Strength", emit[1])
    return m


def studio_materials():
    return {
        "weave": mat_weave(),
        "print": mat_print(),
        "metal": mat_plain("Mercury Brushed Metal", (0.62, 0.64, 0.67, 1), 1.0, 0.24),
        # Electronics glow faintly, the one live colour in the dark.
        "electronics": mat_plain("Mercury Electronics", (0.02, 0.2, 0.32, 1), 0.3, 0.35, coat=0.5,
                                 emit=((0.1, 0.72, 0.95, 1), 0.22)),
        "tpu": mat_plain("Mercury TPU", (0.85, 0.24, 0.04, 1), 0.0, 0.7),
        "prop": mat_plain("Mercury Prop", (0.016, 0.017, 0.02, 1), 0.0, 0.22, coat=0.6),
        "clear": mat_plain("Mercury Clear Hatch", (0.75, 0.9, 1.0, 1), 0.0, 0.05, alpha=0.35, transmission=0.9),
    }


LOOK_BY_NAME = {"Printed carbon-nylon": "print", "Carbon-fibre tube": "weave", "Motors and hardware": "metal",
                "Electronics": "electronics", "Flexible TPU": "tpu", "Propellers": "prop", "Clear hatch": "clear"}


# ---------------------------------------------------------------- subject
def import_glb(path, studio, bodies):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    for o in meshes:
        replace_discs(o, refine=False)  # built GLBs are already refined
        for slot in o.material_slots:
            key = slot.material and LOOK_BY_NAME.get(slot.material.name.split(".")[0])
            if key:
                slot.material = studio[key]
    if bodies:
        meshes = split_bodies(meshes)
        new = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new(path.stem, None)
    bpy.context.collection.objects.link(root)
    for o in new:
        if o.parent is None:
            o.parent = root
    bpy.context.view_layer.update()
    return root, meshes


def split_bodies(meshes):
    """Weld the split glTF vertices, then separate each mesh into its solid bodies."""
    before = set(bpy.data.objects)
    for o in meshes:
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.remove_doubles(threshold=1e-5, use_sharp_edge_from_normals=True)
        bpy.ops.mesh.separate(type="LOOSE")
        bpy.ops.object.mode_set(mode="OBJECT")
    out = list(meshes) + [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in out:
        o.select_set(True)
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    return out


def bounds(meshes):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi, pts


def ease(t):
    return t * t * t * (t * (6 * t - 15) + 10)


def strip(name, loc, target, power, length, width, color=(1, 1, 1)):
    d = bpy.data.lights.new(name, "AREA")
    d.energy = power; d.color = color; d.shape = "RECTANGLE"; d.size = length; d.size_y = width
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    o.location = loc
    tr = o.constraints.new("TRACK_TO"); tr.target = target; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
    return o


def main():
    o = parse()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    studio = studio_materials()
    exploding = o["explode"] > 0 or o["explode-to"] is not None

    pivot = bpy.data.objects.new("Pivot", None); bpy.context.collection.objects.link(pivot)
    all_meshes, x = [], 0.0
    for src in o["src"]:
        root, meshes = import_glb(src, studio, exploding)
        lo, hi, _ = bounds(meshes)
        if o["row"] is not None:
            root.location.x += x - lo.x
            x += (hi.x - lo.x) + o["row"]
        root.location.z -= lo.z
        root.parent = pivot
        all_meshes += meshes
    if o["row"] is not None:
        lo, hi, _ = bounds(all_meshes)
        for ob in pivot.children:
            ob.location.x -= (lo.x + hi.x) / 2
    spin = math.radians(o["spin"])
    pivot.rotation_euler.z = spin
    lo, hi, pts = bounds(all_meshes)
    centre = (lo + hi) / 2
    span = max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)
    radius = max(math.hypot(p.x, p.y) for p in pts)

    # Exploded view: every body moves away from the airframe's core, mostly
    # outwards and a little up, by an amount that grows with its distance.
    homes = []
    if exploding:
        core = Vector((0, 0, centre.z))
        for ob in all_meshes:
            away = ob.matrix_world.translation - core
            d = Vector((away.x * 0.75, away.y * 0.75, away.z * 1.9 + span * 0.05))
            homes.append((ob, ob.location.copy(), ob.matrix_world.to_3x3().inverted() @ d))

    def set_explode(f):
        for ob, home, d in homes:
            ob.location = home + d * f

    set_explode(max(o["explode"], o["explode-to"] or 0))
    lo_e, hi_e, pts_e = bounds(all_meshes)
    lift = -lo_e.z if lo_e.z < 0 else 0.0
    set_explode(o["explode"])

    # What the camera frames, and the point a turn rotates about.
    scale = span
    if o["focus"]:
        fx, fy, fz, fr = o["focus"]
        hub = Matrix.Rotation(spin, 3, "Z") @ Vector((fx, fy, 0))
        hub.z = fz + lift
        pts = [hub + Vector((sx * fr, sy * fr, sz * fr)) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
        scale = fr * 2
    else:
        hub = Vector((0, 0, centre.z + lift))
        if o["turn"]:
            r = max(math.hypot(p.x, p.y) for p in pts_e)
            pts = [Vector((math.cos(a) * r, math.sin(a) * r, z))
                   for a in [i * math.pi / 12 for i in range(24)] for z in (lo_e.z + lift, hi_e.z + lift)]
        elif exploding:
            pts = [p + Vector((0, 0, lift)) for p in pts_e]

    def set_turn(deg):
        a = math.radians(deg)
        pivot.rotation_euler.z = spin + a
        off = Vector((hub.x, hub.y, 0))
        moved = off - Matrix.Rotation(a, 3, "Z") @ off
        pivot.location = (moved.x, moved.y, lift)

    set_turn(0)
    target = bpy.data.objects.new("Target", None); bpy.context.collection.objects.link(target)
    target.location = hub

    # Lights are sized to the whole subject for a full shot and to the framed
    # sphere for a close-up, so a macro keeps the same drawn-line look.
    s = max(span, radius * 1.6) if not o["focus"] else max(scale * 2.2, span * 0.45)
    az = math.radians(o["az"])
    cam_dir = Vector((math.sin(az), -math.cos(az), 0))
    side = Vector((-cam_dir.y, cam_dir.x, 0))  # camera right
    up_z = Vector((0, 0, 1))

    if o["transparent"]:
        bpy.ops.mesh.primitive_plane_add(size=span * 40)
        bpy.context.active_object.is_shadow_catcher = True
    else:
        bpy.ops.mesh.primitive_plane_add(size=span * 80)
        floor = bpy.context.active_object
        fm = bpy.data.materials.new("Floor")
        nt, b = _bsdf(fm)
        _set(b, "Base Color", (0.012, 0.013, 0.016, 1)); _set(b, "Specular IOR Level", 0.35)
        n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 1.4 / span; n.inputs["Detail"].default_value = 6
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.35; ramp.color_ramp.elements[0].color = (0.14, 0.14, 0.14, 1)
        ramp.color_ramp.elements[1].position = 0.75; ramp.color_ramp.elements[1].color = (0.4, 0.4, 0.4, 1)
        nt.links.new(n.outputs["Fac"], ramp.inputs["Fac"]); nt.links.new(ramp.outputs["Color"], b.inputs["Roughness"])
        floor.data.materials.append(fm)

    key = strip("Key", hub + up_z * s * 1.25 + cam_dir * s * 0.2 + side * s * 0.5, target, 38 * s * s, s * 3.2, s * 0.16,
                (1.0, 0.98, 0.95))
    strip("Rim", hub + up_z * s * 0.45 - cam_dir * s * 1.6 - side * s * 1.0, target, 26 * s * s, s * 2.6, s * 0.07,
          (0.42, 0.86, 1.0))
    strip("Kicker", hub - up_z * s * 0.05 - cam_dir * s * 1.2 + side * s * 1.7, target, 16 * s * s, s * 1.6, s * 0.2,
          (1.0, 0.7, 0.36))
    strip("Fill", hub + up_z * s * 0.5 + cam_dir * s * 1.8 - side * s * 0.6, target, 5 * s * s, s * 2.6, s * 1.4,
          (0.8, 0.88, 1.0))

    world = bpy.data.worlds.new("World"); sc.world = world; world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.3, 0.36, 0.46, 1)
    bg.inputs["Strength"].default_value = 0.2 if o["transparent"] else 0.035

    # Camera: on a sphere around the hub, pulled back until every point fits.
    cam_d = bpy.data.cameras.new("Camera"); cam_d.lens = o["lens"]; cam_d.sensor_width = 36
    cam = bpy.data.objects.new("Camera", cam_d); bpy.context.collection.objects.link(cam)
    sc.camera = cam
    el = math.radians(o["el"])
    direction = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    forward = -direction
    right = forward.cross(up_z).normalized()
    up = right.cross(forward).normalized()
    w, h = o["res"]
    half_w = (36 / 2) / o["lens"] * (1 - 2 * o["margin"])
    half_h = half_w * h / w

    def fits(dist, look):
        pos = look + direction * dist
        for p in pts:
            v = p - pos
            z = v.dot(forward)
            if z <= 0.001 or abs(v.dot(right)) > z * half_w or abs(v.dot(up)) > z * half_h:
                return False
        return True

    look = hub.copy()
    dist = scale
    for _ in range(6):
        lo_d, hi_d = 0.001, span * 60
        for _ in range(48):
            m = (lo_d + hi_d) / 2
            if fits(m, look): hi_d = m
            else: lo_d = m
        dist = hi_d
        pos = look + direction * dist
        us = [(p - pos).dot(right) / (p - pos).dot(forward) for p in pts]
        vs = [(p - pos).dot(up) / (p - pos).dot(forward) for p in pts]
        look += right * ((max(us) + min(us)) / 2 * dist) + up * ((max(vs) + min(vs)) / 2 * dist)
    frame_w = 2 * dist * (36 / 2) / o["lens"]
    look -= right * (o["shift"][0] * frame_w) + up * (o["shift"][1] * frame_w * h / w)
    cam.location = look + direction * dist
    cam.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    cam_d.dof.use_dof = True
    cam_d.dof.focus_distance = (hub - cam.location).dot(forward) - (0 if o["focus"] else radius * 0.35)
    cam_d.dof.aperture_fstop = o["fstop"]
    cam_d.clip_start = 0.005; cam_d.clip_end = span * 200

    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = o["samples"]
    sc.cycles.use_denoising = True
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.02
    sc.cycles.max_bounces = 6
    sc.cycles.transparent_max_bounces = 12
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.render.use_persistent_data = True
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = o["transparent"]
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA" if o["transparent"] else "RGB"
    try:
        sc.view_settings.view_transform = "AgX"
        sc.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass

    frames = o["frames"]
    out = o["out"].resolve()
    key_home = key.location.copy()
    first, last = (int(o["only"][0]), int(o["only"][1])) if o["only"] else (1, frames)
    for f in range(first, last + 1):
        loops = o["turn"] and o["turn"] % 360 == 0
        t = 0.0 if frames == 1 else (f - 1) / (frames if loops else frames - 1)
        set_turn(o["turn"] * t)
        if o["explode-to"] is not None:
            set_explode(o["explode"] + (o["explode-to"] - o["explode"]) * ease(min(1.0, t)))
        if o["sweep"]:
            key.location = key_home + side * s * (-2.0 + 3.0 * ease(min(1.0, t)))
        if frames == 1:
            out.parent.mkdir(parents=True, exist_ok=True)
            sc.render.filepath = str(out)
        else:
            out.mkdir(parents=True, exist_ok=True)
            sc.render.filepath = str(out / f"{f:04d}.png")
        bpy.ops.render.render(write_still=True)
    print("done", out)


main()
