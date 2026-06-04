#!/usr/bin/env bash
set -euo pipefail
for file in /mnt/c/Proyectos_local/gemdigital/pipeline/data/raw/cnig/mdt/*.tif; do
  echo "---"
  basename "$file"
  gdalinfo "$file" | sed -n '/Corner Coordinates:/,/Center/p'
done
