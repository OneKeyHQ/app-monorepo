#!/usr/bin/env bash

set -x 

echo $(pwd)
echo $(uname)
echo $(arch)

cd ../../node_modules/keytar
npx node-gyp rebuild
file build/Release/keytar.node

