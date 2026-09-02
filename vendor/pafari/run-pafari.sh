#!/bin/sh
# Rulează Pafari din arborele de build cu iconul tău (applogo).
# După build: ./run-pafari.sh
cd "$(dirname "$0")"
build_dir=build
[ -x "${build_dir}/src/pafari" ] || { echo "Rulează mai întâi: meson setup build && ninja -C build"; exit 1; }
export XDG_DATA_DIRS="${PWD}/${build_dir}/data:${XDG_DATA_DIRS:-/usr/share}"
exec "${build_dir}/src/pafari" "$@"
