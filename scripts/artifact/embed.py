"""Rewrites a GLB as a single glTF JSON file with its buffer embedded.

    python3 scripts/artifact/embed.py <in.glb> <out.json>

The artifact host serves JSON but not .glb, so the shareable build loads the
models this way. The site itself keeps the smaller binary files.
"""
import base64
import json
import struct
import sys

data = open(sys.argv[1], "rb").read()
magic, version, length = struct.unpack_from("<4sII", data, 0)
assert magic == b"glTF", "not a GLB"
off, doc, blob = 12, None, b""
while off < length:
    size, kind = struct.unpack_from("<I4s", data, off)
    chunk = data[off + 8:off + 8 + size]
    if kind == b"JSON":
        doc = json.loads(chunk)
    elif kind == b"BIN\x00":
        blob = chunk
    off += 8 + size
doc["buffers"][0]["uri"] = "data:application/octet-stream;base64," + base64.b64encode(blob).decode()
json.dump(doc, open(sys.argv[2], "w"), separators=(",", ":"))
