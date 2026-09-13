#!/bin/zsh
set -eu
FISHY_DIR="${0:A:h}"
exec python3 "$FISHY_DIR/open_latest.py"
