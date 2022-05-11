#!/usr/bin/env bash

# Single clean workspace command:
# touch .env && mv .env .env-bak && git clean -dfX && mv .env-bak .env

rm -rf ./node_modules
rm -rf ./.expo
rm -rf ./.husky/_

rm -rf ./packages/components/node_modules

rm -rf ./packages/shared/node_modules
rm -rf ./packages/shared/src/web/index.html

rm -rf ./packages/kit/node_modules
rm -rf ./packages/kit/src/components/WebView/injectedNative.text-js

rm -rf ./packages/app/node_modules
rm -rf ./packages/app/.expo
rm -rf ./packages/app/__generated__
rm -rf ./packages/app/ios/Pods
rm -rf ./packages/app/ios/OneKeyWallet.xcworkspace/xcuserdata
rm -rf ./packages/app/src/public/static/connect
rm -rf ./packages/app/android/.gradle
rm -rf ./packages/app/android/build
rm -rf ./packages/app/android/app/build
rm -rf ./packages/app/android/lib-keys-secret/build
rm -rf ./packages/app/android/lib-keys-secret/.cxx
rm -rf ./packages/app/src/public/static/js-sdk

rm -rf ./packages/desktop/node_modules
rm -rf ./packages/desktop/.expo
rm -rf ./packages/desktop/__generated__
rm -rf ./packages/desktop/.next
rm -rf ./packages/desktop/dist
rm -rf ./packages/desktop/build
rm -rf ./packages/desktop/build-electron
rm -rf ./packages/desktop/public/static/js-sdk
rm -rf ./packages/desktop/public/static/connect
rm -rf ./packages/desktop/public/static/preload.js

rm -rf ./packages/web/node_modules
rm -rf ./packages/web/.expo
rm -rf ./packages/web/__generated__
rm -rf ./packages/web/.next
rm -rf ./packages/web/dist
rm -rf ./packages/web/web-build
rm -rf ./packages/web/.expo-shared

rm -rf ./packages/ext/node_modules
rm -rf ./packages/ext/.expo
rm -rf ./packages/ext/build
rm -rf ./packages/ext/src/entry/injected.js
rm -rf ./packages/ext/src/entry/injected.text-js

rm -rf ./packages/engine/node_modules

rm -rf ./packages/remote-console/node_modules
rm -rf ./packages/remote-console/.next

echo "DONE! please clean ReactNative and Metro bundler cache manually:"
echo "    yarn react-native start --reset-cache"
echo "    yarn expo start --clear"
