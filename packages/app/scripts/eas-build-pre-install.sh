#!/usr/bin/env bash
# EAS Environment Secrets
# Run Path: packages/app

echo "@onekeyhq:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=${NPM_TOKEN}" > ~/.npmrc

# Install Secret Keys
echo $IOS_SECRET | base64 -d > .env
echo $ANDROID_SECRET | base64 -d > android/keys.secret

# Install cmake 3.18.1 for react-native-reanimated
if [ -x "$(command -v sdkmanager)" ]; then
  sdkmanager "cmake;3.18.1";
fi

