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

# copy hardware js-sdk lib files to desktop
mkdir -p ./packages/desktop/public/static/js-sdk/
rsync ./node_modules/@onekeyfe/js-sdk/dist/js-sdk-desktop/ ./packages/desktop/public/static/js-sdk/ --checksum  --recursive --verbose

# remove the invalid fs library dependence by starcoin, to fix fs polyfill issue in native
rm -rf ./node_modules/fs/

# build and copy web-embed
if [ "$EAS_BUILD" == "true" ];
  then
    yarn workspace @onekeyhq/web-embed build
  elif [ ! -d "packages/web-embed/web-build" ]; then
    yarn workspace @onekeyhq/web-embed build
fi

