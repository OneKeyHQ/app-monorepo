/* eslint-disable onekey/no-raw-error -- standalone build script without app runtime dependencies */
// cspell:ignore signtool
const fs = require('node:fs');
const path = require('node:path');

const { Arch, Platform, WinPackager, build } = require('electron-builder');

const desktopDir = path.resolve(__dirname, '..');
const channel = process.argv[2];
if (!['nsis', 'store'].includes(channel)) {
  throw new Error(`Unknown Windows package channel: ${channel}`);
}

const inputDir = path.join(desktopDir, 'signing-input', channel);
const prepackaged = {
  x64: path.join(inputDir, 'win-unpacked'),
  arm64: path.join(inputDir, 'win-arm64-unpacked'),
};
for (const dir of Object.values(prepackaged)) {
  if (!fs.existsSync(path.join(dir, 'OneKey.exe'))) {
    throw new Error(`Missing prepackaged OneKey.exe: ${dir}`);
  }
}

const config = require(
  path.join(
    desktopDir,
    channel === 'nsis'
      ? 'electron-builder-win.config.js'
      : 'electron-builder-ms.config.js',
  ),
);
config.win.signtoolOptions = {
  sign: path.join(__dirname, 'kms-sign-windows.js'),
  signingHashAlgorithms: ['sha256'],
  publisherName: 'ONEKEY LIMITED',
};

build({
  projectDir: desktopDir,
  config,
  win: ['nsis'],
  x64: true,
  arm64: true,
  publish: 'never',
  prepackaged: prepackaged.x64,
  platformPackagerFactory(info, platform) {
    if (platform !== Platform.WINDOWS) {
      throw new Error(`Unexpected package platform: ${platform}`);
    }
    return new (class extends WinPackager {
      computeAppOutDir(_outDir, arch) {
        const dir = prepackaged[Arch[arch]];
        if (!dir) {
          throw new Error(`Unexpected Windows package architecture: ${arch}`);
        }
        return dir;
      }
    })(info);
  },
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
