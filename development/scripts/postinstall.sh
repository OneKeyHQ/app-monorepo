#!/usr/bin/env bash

yarn setup:env && patch-package && yarn copy:inject

rm -rf node_modules/realm-flipper-plugin-device/src

