#!/usr/bin/env bash

set -x

# rename .text.js -> .text-js
#   webpack: raw-loader
#   babel:   babel-plugin-inline-import
cd ./src/injected-autogen/ || exit
for f in *.text.js; do
  mv "$f" "$(basename -- "$f" .text.js).text-js"
done
cd - || exit

# generate index.tsx
cp ./src/injected/injected.index.tsx.raw ./src/injected-autogen/index.tsx
timestamp=$(date +%s)
echo "// for Refresh RN Cache: $timestamp" >>./src/injected-autogen/index.tsx

# copy to Desktop preload.js
cp ./src/injected-autogen/injectedDesktop.text-js ../desktop/public/static/preload.js

# copy to Extension injected.js
cp ./src/injected-autogen/injectedExtension.text-js ../ext/src/entry/injected.js
