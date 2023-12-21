#!/usr/bin/env bash

set -x

# copy to Desktop preload.js
cp ./node_modules/@onekeyfe/cross-inpage-provider-injected/dist/injected/injectedDesktop.js   ./apps/desktop/public/static/preload.js

# copy to Extension injected.js
cp ./node_modules/@onekeyfe/cross-inpage-provider-injected/dist/injected/injectedExtension.js   ./apps/ext/src/entry/injected.js
cp ./apps/ext/src/entry/injected.js ./apps/ext/src/entry/injected.text-js

# copy to Native injectedCode
cp ./node_modules/@onekeyfe/cross-inpage-provider-injected/dist/injected/injectedNative.js   ./packages/kit/src/views/Discovery/components/WebView/injectedNative.text-js

# copy index html
cp ./packages/shared/src/web/index.html.ejs ./packages/shared/src/web/index.html

# copy hardware js-sdk iframe files to desktop
mkdir -p ./apps/desktop/public/static/js-sdk/
rsync ./node_modules/@onekeyfe/hd-web-sdk/build/ ./apps/desktop/public/static/js-sdk/ --checksum  --recursive --verbose

