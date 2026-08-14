#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/dist"
STAMP="$(date +%Y%m%d)"
rm -rf "$OUT"
mkdir -p "$OUT/assets"
cp "$ROOT/index.html" "$ROOT/styles.css" "$OUT/"
cp -R "$ROOT/assets/." "$OUT/assets/"
ZIP="$ROOT/bspbuddy-website-$STAMP.zip"
rm -f "$ZIP"
(cd "$OUT" && zip -r "$ZIP" .)
echo "[website] done: $OUT"
echo "[website] zip:  $ZIP"
