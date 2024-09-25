#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Copying injected files...');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName),
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Function to copy file
function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
  console.log(`Copied ${src} to ${dest}`);
}

// Function to create directory if it doesn't exist
function ensureDirectoryExistence(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

// Copy to Desktop preload.js
copyFile(
  './node_modules/@onekeyfe/cross-inpage-provider-injected/dist/injected/injectedDesktop.js',
  './apps/desktop/public/static/preload.js',
);

// Copy to Extension injected.js
copyFile(
  './node_modules/@onekeyfe/cross-inpage-provider-injected/dist/injected/injectedExtension.js',
  './apps/ext/src/entry/injected.js',
);
copyFile(
  './apps/ext/src/entry/injected.js',
  './apps/ext/src/entry/injected.text-js',
);

// Copy to Native injectedCode
copyFile(
  './node_modules/@onekeyfe/cross-inpage-provider-injected/dist/injected/injectedNative.js',
  './packages/kit/src/components/WebView/injectedNative.text-js',
);

// Copy index html
copyFile(
  './packages/shared/src/web/index.html.ejs',
  './packages/shared/src/web/index.html',
);

// Copy hardware js-sdk iframe files to desktop
const jsSdkDestDir = './apps/desktop/public/static/js-sdk/';
ensureDirectoryExistence(jsSdkDestDir);

const srcDir = path.join(
  __dirname,
  '..',
  '..',
  'node_modules',
  '@onekeyfe',
  'hd-web-sdk',
  'build',
);
copyRecursiveSync(srcDir, jsSdkDestDir);
console.log(`Copied ${srcDir} to ${jsSdkDestDir}`);

// Build and copy web-embed
const webEmbedScript = path.join(__dirname, 'web-embed.js');
execSync(`node "${webEmbedScript}"`, { stdio: 'inherit' });

console.log('All files copied successfully.');
