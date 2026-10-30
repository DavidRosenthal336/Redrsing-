#!/usr/bin/env bash
# Assembles the game into one self-contained HTML file.
#   dist/break-the-chains.html : page body only (for hosts that add their own skeleton)
#   index.html                 : full standalone page, open it in any browser
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
{
  cat src/shell.html
  echo '<script>'
  echo '(() => {'
  cat src/core.js src/story.js src/mine.js src/duel.js src/institute.js src/rain.js src/main.js
  echo '})();'
  echo '</script>'
} > dist/break-the-chains.html
{
  echo '<!doctype html>'
  echo '<html lang="en"><head><meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  echo '</head><body>'
  cat dist/break-the-chains.html
  echo '</body></html>'
} > index.html
echo "built index.html ($(wc -c < index.html) bytes)"
