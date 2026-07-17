const path = require('node:path');

const {
  getPackagedExecutableRelativeCandidates,
  resolvePackagedExecutable,
} = require('./node-runtime-harness-paths');

describe('node runtime harness executable paths', () => {
  it.each([
    ['win32', 'x64', path.join('win-unpacked', 'OneKey.exe')],
    ['win32', 'arm64', path.join('win-arm64-unpacked', 'OneKey.exe')],
    ['linux', 'x64', path.join('linux-unpacked', 'onekey-wallet')],
    ['linux', 'arm64', path.join('linux-arm64-unpacked', 'onekey-wallet')],
    [
      'darwin',
      'x64',
      path.join('mac', 'OneKey.app', 'Contents', 'MacOS', 'OneKey'),
    ],
    [
      'darwin',
      'arm64',
      path.join('mac-arm64', 'OneKey.app', 'Contents', 'MacOS', 'OneKey'),
    ],
  ])('prefers the native %s %s executable', (platform, arch, expected) => {
    expect(getPackagedExecutableRelativeCandidates({ arch, platform })[0]).toBe(
      expected,
    );
  });

  it('falls back to an existing universal macOS executable', () => {
    const desktopDir = path.join('workspace', 'apps', 'desktop');
    const universalExecutable = path.join(
      desktopDir,
      'build-electron',
      'mac-universal',
      'OneKey.app',
      'Contents',
      'MacOS',
      'OneKey',
    );

    expect(
      resolvePackagedExecutable({
        arch: 'arm64',
        desktopDir,
        existsSync: (candidate) => candidate === universalExecutable,
        platform: 'darwin',
      }),
    ).toBe(universalExecutable);
  });
});
