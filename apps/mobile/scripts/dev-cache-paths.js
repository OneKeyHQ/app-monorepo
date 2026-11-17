/* cspell:words LOCALAPPDATA prebundle */
const os = require('os');
const path = require('path');

function getMobileShellCacheRoot(
  env = process.env,
  homeDirectory = os.homedir(),
) {
  return path.join(
    env.XDG_CACHE_HOME || path.join(homeDirectory, '.cache'),
    'onekey/mobile-dev-shell',
  );
}

function getSharedCacheRoot(
  env = process.env,
  platform = process.platform,
  homeDirectory = os.homedir(),
) {
  if (env.ONEKEY_METRO_PREBUNDLE_CACHE_DIR) {
    return path.resolve(env.ONEKEY_METRO_PREBUNDLE_CACHE_DIR);
  }
  if (platform === 'darwin') {
    return path.join(
      homeDirectory,
      'Library/Caches/OneKey/metro-dev-prebundle',
    );
  }
  if (platform === 'win32') {
    return path.join(
      env.LOCALAPPDATA || path.join(homeDirectory, 'AppData/Local'),
      'OneKey/metro-dev-prebundle',
    );
  }
  return path.join(
    env.XDG_CACHE_HOME || path.join(homeDirectory, '.cache'),
    'onekey/metro-dev-prebundle',
  );
}

module.exports = { getMobileShellCacheRoot, getSharedCacheRoot };
