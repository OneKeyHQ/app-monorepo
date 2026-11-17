#!/usr/bin/env node
/* eslint-disable no-restricted-syntax, onekey/no-raw-error -- standalone release tooling */
const path = require('node:path');

const { repoRoot, packageFirefox } = require('./lib/firefox-build');
console.log(
  packageFirefox(
    path.join(repoRoot, 'apps/ext/build/firefox_v3'),
    path.join(repoRoot, 'apps/ext/build/_dist/firefox'),
  ),
);
