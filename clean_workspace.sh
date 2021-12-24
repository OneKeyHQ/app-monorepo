#!/usr/bin/env bash

rm -rf ./node_modules
rm -rf ./.husky/_

rm -rf ./packages/components/node_modules
rm -rf ./packages/kit/node_modules
rm -rf ./packages/inpage-provider/node_modules
rm -rf ./packages/inpage-provider/dist
rm -rf ./packages/inpage-provider/src/injected-autogen

rm -rf ./packages/app/node_modules
rm -rf ./packages/app/.expo
rm -rf ./packages/app/__generated__
rm -rf ./packages/app/ios/Pods

rm -rf ./packages/desktop/node_modules
rm -rf ./packages/desktop/.expo
rm -rf ./packages/desktop/__generated__
rm -rf ./packages/desktop/.next
rm -rf ./packages/desktop/dist
rm -rf ./packages/desktop/build
rm -rf ./packages/desktop/build-electron

rm -rf ./packages/web/node_modules
rm -rf ./packages/web/.expo
rm -rf ./packages/web/__generated__
rm -rf ./packages/web/.next
rm -rf ./packages/web/dist
rm -rf ./packages/web/web-build
rm -rf ./packages/web/.expo-shared

echo "DONE! please clean ReactNative and Metro bundler cache manually:"
echo "    yarn react-native start --reset-cache"
echo "    yarn expo start --clear"
