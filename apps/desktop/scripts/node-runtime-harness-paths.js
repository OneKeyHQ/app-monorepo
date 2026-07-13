const fs = require('node:fs');
const path = require('node:path');

function getPackagedExecutableRelativeCandidates({ arch, platform }) {
  if (platform === 'win32') {
    return arch === 'arm64'
      ? [
          path.join('win-arm64-unpacked', 'OneKey.exe'),
          path.join('win-unpacked', 'OneKey.exe'),
        ]
      : [
          path.join('win-unpacked', 'OneKey.exe'),
          path.join('win-arm64-unpacked', 'OneKey.exe'),
        ];
  }

  if (platform === 'linux') {
    return arch === 'arm64'
      ? [
          path.join('linux-arm64-unpacked', 'onekey-wallet'),
          path.join('linux-unpacked', 'onekey-wallet'),
        ]
      : [
          path.join('linux-unpacked', 'onekey-wallet'),
          path.join('linux-arm64-unpacked', 'onekey-wallet'),
        ];
  }

  if (platform === 'darwin') {
    const executableIn = (directory) =>
      path.join(directory, 'OneKey.app', 'Contents', 'MacOS', 'OneKey');
    return arch === 'arm64'
      ? [
          executableIn('mac-arm64'),
          executableIn('mac-universal'),
          executableIn('mac'),
        ]
      : [
          executableIn('mac'),
          executableIn('mac-universal'),
          executableIn('mac-arm64'),
        ];
  }

  return [];
}

function getPackagedExecutableCandidates({ arch, desktopDir, platform }) {
  return getPackagedExecutableRelativeCandidates({ arch, platform }).map(
    (relativePath) => path.join(desktopDir, 'build-electron', relativePath),
  );
}

function resolvePackagedExecutable({
  arch = process.arch,
  desktopDir,
  existsSync = fs.existsSync,
  platform = process.platform,
}) {
  // This is intentionally one runner-native smoke test per platform. Other
  // architectures and distribution variants reuse this platform gate.
  return (
    getPackagedExecutableCandidates({ arch, desktopDir, platform }).find(
      (candidate) => existsSync(candidate),
    ) ?? null
  );
}

module.exports = {
  getPackagedExecutableCandidates,
  getPackagedExecutableRelativeCandidates,
  resolvePackagedExecutable,
};
