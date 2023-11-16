#!/usr/bin/env bash

set -x

mkdir -p ./web-build/.well-known

rm -rf ../app/android/app/src/main/assets/web-embed
rsync -r -c -v ./web-build/ ../app/android/app/src/main/assets/web-embed/

rm -rf ../app/ios/OneKeyWallet/web-embed/
rsync -r -c -v ./web-build/ ../app/ios/OneKeyWallet/web-embed/


