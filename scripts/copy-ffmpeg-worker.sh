#!/bin/sh
# scripts/copy-ffmpeg-worker.sh
#
# Copies the @ffmpeg/ffmpeg internal worker script into /public so it can be
# served from the same origin as the page — required for Web Worker instantiation.
#
# Run this once manually, or wire it into package.json:
#   "postinstall": "sh scripts/copy-ffmpeg-worker.sh"
#   "prebuild":    "sh scripts/copy-ffmpeg-worker.sh"

WORKER_SRC="node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js"
WORKER_DST="public/ffmpeg-worker.js"

if [ ! -f "$WORKER_SRC" ]; then
  echo "ERROR: $WORKER_SRC not found. Run 'npm install @ffmpeg/ffmpeg' first."
  exit 1
fi

cp "$WORKER_SRC" "$WORKER_DST"
echo "Copied $WORKER_SRC → $WORKER_DST"
