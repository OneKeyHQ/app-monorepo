#!/usr/bin/env bash

echo "Creating .well-known directory..."
mkdir -p ./web-build/.well-known

echo "Copying Android deep link validation file..."
cp ./validation/deeplink.android.json ./web-build/.well-known/assetlinks.json

echo "Copying iOS deep link validation file..."
cp ./validation/deeplink.ios.json ./web-build/.well-known/apple-app-site-association

echo "Copying market cold-start seed file..."
mkdir -p ./web-build/static
cp ./public/static/market-home-token-seed-v1.json ./web-build/static/market-home-token-seed-v1.json

echo "Postbuild completed successfully."
