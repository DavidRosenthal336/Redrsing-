#!/usr/bin/env bash
# Builds Iron Rain into one page.
#   iron-rain/index.html          : standalone page (open in any modern browser)
#   iron-rain/dist/iron-rain.html : page body only, for hosts that add their own skeleton
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
CDN=https://cdn.jsdelivr.net/npm/three@0.147.0
{
  cat src/shell.html
  for f in build/three.min.js examples/js/shaders/CopyShader.js examples/js/shaders/LuminosityHighPassShader.js \
           examples/js/postprocessing/EffectComposer.js examples/js/postprocessing/RenderPass.js \
           examples/js/postprocessing/ShaderPass.js examples/js/postprocessing/UnrealBloomPass.js; do
    echo "<script src=\"$CDN/$f\"></script>"
  done
  echo '<script>'
  echo '(() => {'
  cat src/engine.js src/models.js src/bay.js src/space.js src/main.js
  echo '})();'
  echo '</script>'
} > dist/iron-rain.html
{
  echo '<!doctype html>'
  echo '<html lang="en"><head><meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  echo '</head><body>'
  cat dist/iron-rain.html
  echo '</body></html>'
} > index.html
echo "built iron-rain/index.html ($(wc -c < index.html) bytes)"
