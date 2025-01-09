const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Function to remove directory recursively
function removeDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`Removed: ${dir}`);
  }
}

console.log('Cleaning workspace...');

// Clean yarn cache
console.log('Cleaning yarn cache...');
execSync('yarn cache clean', { stdio: 'inherit' });

// Define directories to remove
const dirsToRemove = [
  // root
  './node_modules',
  './.expo',
  './.husky/_',
  './.app-mono-ts-cache',

  // desktop
  './apps/desktop/node_modules',
  './apps/desktop/.expo',
  './apps/desktop/__generated__',
  './apps/desktop/dist',
  './apps/desktop/build',
  './apps/desktop/build-electron',
  './apps/desktop/public/static/js-sdk',
  './apps/desktop/public/static/connect',
  './apps/desktop/public/static/preload.js',

  // ext
  './apps/ext/node_modules',
  './apps/ext/.expo',
  './apps/ext/build',
  './apps/ext/src/entry/injected.js',
  './apps/ext/src/entry/injected.text-js',

  // mobile
  './apps/mobile/node_modules',
  './apps/mobile/.expo',
  './apps/mobile/__generated__',
  './apps/mobile/ios/Pods',
  './apps/mobile/ios/build',
  './apps/mobile/ios/OneKeyWallet/web-embed',
  './apps/mobile/ios/OneKeyWallet.xcworkspace/xcuserdata',
  './apps/mobile/src/public/static/connect',
  './apps/mobile/android/.gradle',
  './apps/mobile/android/build',
  './apps/mobile/android/app/build',
  './apps/mobile/android/lib-keys-secret/build',
  './apps/mobile/android/lib-keys-secret/.cxx',
  './apps/mobile/android/app/src/main/assets/web-embed',

  // web
  './apps/web/node_modules',
  './apps/web/.expo',
  './apps/web/__generated__',
  './apps/web/dist',
  './apps/web/web-build',
  './apps/web/.expo-shared',

  // web-embed
  './apps/web-embed/node_modules',
  './apps/web-embed/.expo',
  './apps/web-embed/__generated__',
  './apps/web-embed/dist',
  './apps/web-embed/web-build',
  './apps/web-embed/.expo-shared',

  // components
  './packages/components/node_modules',

  // core
  './packages/core/node_modules',

  // kit
  './packages/kit/node_modules',
  './packages/kit/src/components/WebView/injectedNative.text-js',

  // kit-bg
  './packages/kit-bg/node_modules',

  // shared
  './packages/shared/node_modules',
  './packages/shared/src/web/index.html',
];

// Remove directories
dirsToRemove.forEach((dir) =>
  removeDir(path.resolve(__dirname, '..', '..', dir)),
);

console.log('Workspace cleaned successfully.');
