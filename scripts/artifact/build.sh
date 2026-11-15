#!/bin/sh
# Builds the shareable artifact into <out dir>: index.html, the bundle, the
# stylesheet, and the images. Run `bun run build` first (the stylesheet comes
# from it). Models are copied separately: the artifact uses quantized GLBs
# with no decoder, made with `gltf-transform optimize --compress quantize`.
#   sh scripts/artifact/build.sh <out dir>
set -e
O=${1:?out dir}
mkdir -p "$O/img"
bun build scripts/artifact/entry.tsx --outdir "$O" --minify --splitting --format esm \
  --define 'process.env.NEXT_PUBLIC_BASE_PATH="."' --define 'process.env.NODE_ENV="production"'
cat out/_next/static/chunks/*.css scripts/artifact/theme.css > "$O/site.css"
cp -r public/img/close public/img/fleet "$O/img/"
cp public/img/hero.mp4 public/img/hero.webp "$O/img/"
cp scripts/artifact/index.html "$O/index.html"
