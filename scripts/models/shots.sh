#!/bin/sh
# Every render the site uses. CPU Cycles on 4 cores: about an hour in all.
# Shots that already exist in the scratch dir are skipped, so it can resume.
#   sh scripts/models/shots.sh <dir of built GLBs (build.py output)> <scratch dir>
# Then: python3 scripts/models/export.py <scratch dir> public/img
set -e
K=${1:?built GLB dir}; O=${2:?scratch dir}
R="python3 $(dirname "$0")/render.py"
shot() { out=$1; shift; [ -e "$out" ] || $R "$out" "$@"; }
STILL="--res 1600 1000 --samples 64"

# Close-ups.
shot $O/close/prometheus-tool.png $K/prometheus.glb $STILL --focus 0 0 0.12 0.16 --fstop 2.8 --az 55 --el 6
shot $O/close/menoetius-rotor.png $K/menoetius.glb $STILL --focus 0.034 -0.42 0.26 0.14 --fstop 2 --az -25 --el 10
shot $O/close/astraeus-low.png $K/astraeus.glb $STILL --focus 0.345 -0.28 0.12 0.2 --fstop 2.8 --az 60 --el 8
shot $O/close/perseus-claw.png $K/perseus.glb $STILL --focus 0 0 0.1 0.15 --fstop 2.8 --az 30 --el 4
shot $O/close/pad-corner.png $K/charging-pad-m.glb $STILL --focus 0.3 -0.25 0.03 0.22 --fstop 2.8 --az 40 --el 12
shot $O/close/rack-heads.png $K/prometheus-tool-rack.glb $STILL --focus -0.3 0 0.3 0.26 --fstop 2.8 --az 25 --el 8
shot $O/close/lynceus-rotor.png $K/lynceus.glb $STILL --focus 0.102 -0.102 0.12 0.09 --fstop 2 --az 15 --el 14
shot $O/close/pallas-deck.png $K/pallas.glb $STILL --focus 0 0 0.2 0.1 --fstop 2.8 --az 40 --el 22

# One plate per aircraft for the fleet.
for f in $K/*.glb; do
  shot $O/fleet/$(basename $f .glb).png $f --res 960 720 --samples 40 --az 32 --el 16 --margin 0.14
done

# The opening shot: a Prometheus rotor turning through 18 degrees while the key light crosses it.
[ -e $O/hero/0060.png ] || $R $O/hero $K/prometheus.glb --res 1280 800 --samples 32 --focus 0.5174 -0.2143 0.39 0.13 \
  --fstop 2 --az 20 --el 12 --spin -9 --turn 18 --sweep --frames 60
