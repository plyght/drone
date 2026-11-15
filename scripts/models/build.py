"""Prepares the Mercury drone models for the web (Blender 4.2+ as the `bpy` module).

For every GLB in <src>: swaps the flat stand-in propeller discs for real
blades and rounds the hard edges (props.py), thins the three dense CAD meshes, and writes a GLB with
the same seven named materials to <out>, plus rotors.json (where each rotor
sits, for framing close-ups). `optimize.sh` then compresses the GLBs.

    python3 scripts/models/build.py <src dir> <out dir>
"""
import json
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from props import replace_discs  # noqa: E402

# Triangle budgets for the detailed V2 meshes; the rest ship as modelled.
THIN = {"pallas": 0.42, "lynceus": 0.5, "perseus": 0.55}

# Left as modelled: the dense meshes already have their detail, and the wing
# skin is one smooth surface whose panel seams must not be filleted.
AS_MODELLED = set(THIN) | {"astraeus"}

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
rotors = {}
for glb in sorted(src.glob("*.glb")):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    found = []
    for o in [o for o in bpy.data.objects if o.type == "MESH"]:
        for c, a, r in replace_discs(o, refine=glb.stem not in AS_MODELLED):
            w = o.matrix_world @ c
            found.append({"at": [round(v, 4) for v in w], "axis": [round(v, 3) for v in a], "r": round(r, 4)})
        if glb.stem in THIN:
            bpy.context.view_layer.objects.active = o
            mod = o.modifiers.new("Thin", "DECIMATE")
            mod.ratio = THIN[glb.stem]
            bpy.ops.object.modifier_apply(modifier=mod.name)
    rotors[glb.stem] = found
    bpy.ops.export_scene.gltf(filepath=str(out / glb.name), export_format="GLB", export_apply=True,
                              export_yup=True, export_texcoords=False, export_animations=False)
    print(f"{glb.stem}: {len(found)} propellers rebuilt")
(out / "rotors.json").write_text(json.dumps(rotors, indent=1))
