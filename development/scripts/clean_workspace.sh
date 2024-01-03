#!/usr/bin/env bash

# This script is used to clean the workspace.
set -x

# clean yarn cache
yarn cache clean

# root
rm -rf ./node_modules
rm -rf ./.expo
rm -rf ./.husky/_
rm -rf ./.app-mono-ts-cache

# desktop
rm -rf ./apps/desktop/node_modules
rm -rf ./apps/desktop/.expo
rm -rf ./apps/desktop/__generated__
rm -rf ./apps/desktop/dist
rm -rf ./apps/desktop/build
rm -rf ./apps/desktop/build-electron
rm -rf ./apps/desktop/public/static/js-sdk
rm -rf ./apps/desktop/public/static/connect
rm -rf ./apps/desktop/public/static/preload.js

# ext
rm -rf ./apps/ext/node_modules
rm -rf ./apps/ext/.expo
rm -rf ./apps/ext/build
rm -rf ./apps/ext/src/entry/injected.js
rm -rf ./apps/ext/src/entry/injected.text-js

# mobile
rm -rf ./apps/mobile/node_modules
rm -rf ./apps/mobile/.expo
rm -rf ./apps/mobile/__generated__
rm -rf ./apps/mobile/ios/Pods
rm -rf ./apps/mobile/ios/build
rm -rf ./apps/mobile/ios/OneKeyWallet/web-embed
rm -rf ./apps/mobile/ios/OneKeyWallet.xcworkspace/xcuserdata
rm -rf ./apps/mobile/src/public/static/connect
rm -rf ./apps/mobile/android/.gradle
rm -rf ./apps/mobile/android/build
rm -rf ./apps/mobile/android/app/build
rm -rf ./apps/mobile/android/lib-keys-secret/build
rm -rf ./apps/mobile/android/lib-keys-secret/.cxx
rm -rf ./apps/mobile/android/app/src/main/assets/web-embed

# web
rm -rf ./apps/web/node_modules
rm -rf ./apps/web/.expo
rm -rf ./apps/web/__generated__
rm -rf ./apps/web/dist
rm -rf ./apps/web/web-build
rm -rf ./apps/web/.expo-shared

# web-embed
rm -rf ./apps/web-embed/node_modules
rm -rf ./apps/web-embed/.expo
rm -rf ./apps/web-embed/__generated__
rm -rf ./apps/web-embed/dist
rm -rf ./apps/web-embed/web-build
rm -rf ./apps/web-embed/.expo-shared

# components
rm -rf ./packages/components/node_modules

# core
rm -rf ./packages/core/node_modules

# kit
rm -rf ./packages/kit/node_modules
rm -rf ./packages/kit/src/components/WebView/injectedNative.text-js

# kit-bg
rm -rf ./packages/kit-bg/node_modules

# shared
rm -rf ./packages/shared/node_modules
rm -rf ./packages/shared/src/web/index.html

