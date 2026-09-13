#!/bin/zsh
set -eu
FISHY_DIR="${0:A:h}"
FISHY_BLENDER="/Users/joshuabanzon/Applications/Blender.app/Contents/MacOS/Blender"
if [[ ! -x "$FISHY_BLENDER" ]]; then
  print "Blender was not found at $FISHY_BLENDER"
  exit 1
fi
FISHY_SCENE="${1:-$FISHY_DIR/fishy-studio.blend}"
exec "$FISHY_BLENDER" "$FISHY_SCENE" --python "$FISHY_DIR/fishy_controls.py" --python "$FISHY_DIR/fishy_generation.py"
