#!/usr/bin/env bash

set -x

# copy to Desktop preload.js
cp ./node_modules/@onekeyfe/cross-inpage-provider-injected/dist/injected/injectedDesktop.js   ./packages/desktop/public/static/preload.js

# copy to Extension injected.js
cp ./node_modules/@onekeyfe/cross-inpage-provider-injected/dist/injected/injectedExtension.js   ./packages/ext/src/entry/injected.js

# copy to Native injectedCode
cp ./node_modules/@onekeyfe/cross-inpage-provider-injected/dist/injected/injectedNative.js   ./packages/kit/src/components/WebView/injectedNative.text-js

# copy index html
cp ./packages/shared/src/web/index.html.ejs ./packages/shared/src/web/index.html

# copy hardware js-sdk lib files to app
mkdir -p ./packages/app/src/public/static/js-sdk/lib/
rsync ./node_modules/@onekeyfe/js-sdk/lib/utils/ ./packages/app/src/public/static/js-sdk/lib/utils/ --checksum  --recursive --verbose
rsync ./node_modules/@onekeyfe/js-sdk/lib/data/ ./packages/app/src/public/static/js-sdk/lib/data/ --checksum  --recursive --verbose
rsync ./node_modules/@onekeyfe/js-sdk/lib/constants/ ./packages/app/src/public/static/js-sdk/lib/constants/ --checksum  --recursive --verbose
