/* cspell:words prebundle */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  getMobileShellCacheRoot,
  getSharedCacheRoot,
} = require('../../apps/mobile/scripts/dev-cache-paths');

// Function to remove directory recursively
function removeDir(dir, log) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    log(`Removed: ${dir}`);
  }
}

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
  './apps/mobile/out-dir-bundle',
  './apps/mobile/ios/Pods',
  './apps/mobile/ios/build',
  './apps/mobile/ios/outputs',
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
  './apps/web-embed/out-dir-bundle',
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
  './packages/kit/src/components/WebView/injectedNative.js.txt',
  './packages/kit/src/components/WebViewWebEmbed/injectedWebEmbed.text-js',
  './packages/kit/src/components/WebViewWebEmbed/injectedWebEmbed.js.LICENSE.txt',
  './packages/kit/src/components/WebView/translateInject.text-js',
  './packages/kit/src/components/LightweightChart/utils/lightweightChartsStandalone.text-js',

  // kit-bg
  './packages/kit-bg/node_modules',
  './packages/kit-bg/src/desktopApis/injectedDesktopCode.text-js',

  // shared
  './packages/shared/node_modules',
  './packages/shared/src/web/index.html',
];

function cleanWorkspace({
  repoRoot = path.resolve(__dirname, '../..'),
  env = process.env,
  platform = process.platform,
  homeDirectory = os.homedir(),
  run = execSync,
  log = console.log,
} = {}) {
  log('Cleaning workspace...');
  log('Cleaning yarn cache...');
  run('yarn cache clean', { stdio: 'inherit', cwd: repoRoot, env });

  const sharedRoots = new Set([
    getMobileShellCacheRoot({}, homeDirectory),
    getMobileShellCacheRoot(env, homeDirectory),
    getSharedCacheRoot({}, platform, homeDirectory),
    getSharedCacheRoot(
      { ...env, ONEKEY_METRO_PREBUNDLE_CACHE_DIR: undefined },
      platform,
      homeDirectory,
    ),
    getSharedCacheRoot(env, platform, homeDirectory),
  ]);
  for (const root of sharedRoots) {
    if (fs.existsSync(root)) {
      // Custom roots may contain unrelated files; OneKey artifacts live in version directories.
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (
          /^v\d+$/u.test(entry.name) &&
          (entry.isDirectory() || entry.isSymbolicLink())
        ) {
          removeDir(path.join(root, entry.name), log);
        }
      }
    }
  }
  for (const dir of dirsToRemove) removeDir(path.resolve(repoRoot, dir), log);
  log('Workspace cleaned successfully.');
}

if (require.main === module) cleanWorkspace();

module.exports = { cleanWorkspace };
