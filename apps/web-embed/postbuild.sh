#!/usr/bin/env bash

set -euo pipefail -x

echo "Creating .well-known directory..."
mkdir -p ./web-build/.well-known

echo "Cleaning old Android web-embed assets..."
rm -rf ../mobile/android/app/src/main/assets/web-embed

echo "Creating Android assets directory..."
mkdir -p ../mobile/android/app/src/main/assets

echo "Syncing web-build to Android assets..."
rsync -r -c -v ./web-build/ ../mobile/android/app/src/main/assets/web-embed/

echo "Cleaning old iOS web-embed assets..."
rm -rf ../mobile/ios/OneKeyWallet/web-embed/

echo "Syncing web-build to iOS assets..."
rsync -r -c -v ./web-build/ ../mobile/ios/OneKeyWallet/web-embed/

echo "Postbuild completed successfully."

