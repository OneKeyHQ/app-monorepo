#!/usr/bin/env bash

set -x

# copy to Desktop preload.js
cp ./node_modules/@onekeyfe/cross-inpage-provider-injected/dist/injected/injectedDesktop.js   ./packages/desktop/public/static/preload.js

# copy to Extension injected.js
cp ./node_modules/@onekeyfe/cross-inpage-provider-injected/dist/injected/injectedExtension.js   ./packages/ext/src/entry/injected.js
cp ./packages/ext/src/entry/injected.js ./packages/ext/src/entry/injected.text-js

# copy to Native injectedCode
cp ./node_modules/@onekeyfe/cross-inpage-provider-injected/dist/injected/injectedNative.js   ./packages/kit/src/components/WebView/injectedNative.text-js

# copy index html
cp ./packages/shared/src/web/index.html.ejs ./packages/shared/src/web/index.html

# copy hardware js-sdk iframe files to desktop
mkdir -p ./packages/desktop/public/static/js-sdk/
rsync ./node_modules/@onekeyfe/hd-web-sdk/build/ ./packages/desktop/public/static/js-sdk/ --checksum  --recursive --verbose

# build and copy web-embed
if [ "$EAS_BUILD" == "true" ];
  then
    yarn workspace @onekeyhq/web-embed build
  elif [ ! -d "packages/web-embed/web-build" ]; then
    yarn workspace @onekeyhq/web-embed build
fi

