#!/bin/sh
# Compresses the built GLBs (meshopt, quantized) into public/models.
#   sh scripts/models/optimize.sh <built dir>
set -e
for f in "${1:?built dir}"/*.glb; do
  bunx gltf-transform optimize "$f" "public/models/$(basename "$f")" \
    --compress meshopt --palette false --simplify false --texture-compress false
done
