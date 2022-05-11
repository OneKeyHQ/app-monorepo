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

# copy hardware js-sdk lib files to app
mkdir -p ./packages/app/src/public/static/js-sdk/lib/
rsync ./node_modules/@onekeyfe/js-sdk/dist/js-sdk-native/lib/ ./packages/app/src/public/static/js-sdk/lib/ --checksum  --recursive --verbose
# TODO ERROR: Attempted to assign to readonly property.   CoreAnimation: Message::send_message() returned 0x1000000e
# rsync ./node_modules/@onekeyfe/js-sdk/dist/js-sdk-native/index.js ./packages/app/src/public/static/js-sdk/index.js --checksum  --recursive --verbose

# copy hardware js-sdk lib files to desktop
mkdir -p ./packages/desktop/public/static/js-sdk/
rsync ./node_modules/@onekeyfe/js-sdk/dist/js-sdk-desktop/ ./packages/desktop/public/static/js-sdk/ --checksum  --recursive --verbose
