#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// cspell:ignore postbuild

const webRoot = path.join(__dirname, '..');
const buildDir = path.join(webRoot, 'web-build');
const wellKnownDir = path.join(buildDir, '.well-known');

function copyFile(source, destination) {
  fs.copyFileSync(source, destination);
  // eslint-disable-next-line no-console
  console.log(`[web:postbuild] copied ${source} -> ${destination}`);
}

fs.mkdirSync(wellKnownDir, { recursive: true });
copyFile(path.join(buildDir, 'index.html'), path.join(buildDir, '404.html'));
copyFile(
  path.join(webRoot, 'validation', 'deeplink.android.json'),
  path.join(wellKnownDir, 'assetlinks.json'),
);
copyFile(
  path.join(webRoot, 'validation', 'deeplink.ios.json'),
  path.join(wellKnownDir, 'apple-app-site-association'),
);

// eslint-disable-next-line no-console
console.log('[web:postbuild] completed');
