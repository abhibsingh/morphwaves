#!/bin/sh
# Rebuilds site/assets/js/orbit-scene.js from site/src/. Needs npm once.
# The bundled file is committed, so the Netlify build itself has no dependencies.
set -e
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
(cd "$TMP" && npm i --silent --no-audit --no-fund three@0.187.0 esbuild@0.24)
NODE_PATH="$TMP/node_modules" "$TMP/node_modules/.bin/esbuild" site/src/hero.js --bundle --minify \
  --format=esm --target=es2020 --legal-comments=eof --outfile=site/assets/js/orbit-scene.js
rm -rf "$TMP"
