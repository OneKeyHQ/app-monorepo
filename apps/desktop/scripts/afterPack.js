const fs = require('fs');
const path = require('path');
const { FuseVersion, FuseV1Options } = require('@electron/fuses');

exports.default = async function fileOperation(context) {
  // https://www.electron.build/app-builder-lib.typealias.electronplatformname
  // ElectronPlatformName: "darwin" | "linux" | "win32" | "mas"
  const { electronPlatformName, appOutDir } = context;
  const appName = context.packager.appInfo.productFilename;
  if (electronPlatformName === 'mas' && appOutDir.endsWith('universal')) {
    const appPath = `${appOutDir}/${appName}.app`;
    const destDir = path.join(appPath, 'Contents/Resources/bin/bridge');
    const originPath = path.join(
      __dirname,
      '../app/build/static/bin/bridge/mac-x64',
    );
    console.log('copy file start..', originPath);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(
      path.join(originPath, 'onekeyd'),
      path.join(destDir, 'onekeyd'),
    );
    console.log('copy file finish');
    console.log('remove file start..');
    const ethereumCryptographyFilePath = path.join(
      appPath,
      'Contents/Resources/app.asar.unpacked/node_modules/ethereum-cryptography/node_modules/secp256k1/build/node_gyp_bins',
    );
    const keccakFilePath = path.join(
      appPath,
      'Contents/Resources/app.asar.unpacked/node_modules/keccak/build/node_gyp_bins',
    );
    if (fs.existsSync(ethereumCryptographyFilePath)) {
      fs.rmSync(ethereumCryptographyFilePath, { recursive: true });
    }
    if (fs.existsSync(keccakFilePath)) {
      fs.rmSync(keccakFilePath, { recursive: true });
    }
    console.log('remove file finish..');
  }

  // Remove unused @serialport/bindings-cpp prebuilds for other platforms.
  // The package bundles prebuilds for all platforms (android, linux, darwin,
  // win32) but each build only needs the matching one. Removing the rest
  // reduces package size and eliminates snap linter warnings.
  // Arch enum: ia32=0, x64=1, armv7l=2, arm64=3, universal=4
  const { arch } = context;
  const prebuildsBase = path.join(
    appOutDir,
    electronPlatformName === 'darwin' || electronPlatformName === 'mas'
      ? `${appName}.app/Contents/Resources`
      : 'resources',
    'app.asar.unpacked/node_modules/@serialport/bindings-cpp/prebuilds',
  );
  if (fs.existsSync(prebuildsBase)) {
    // Map (platform, arch) to the exact prebuild dir names to keep.
    // darwin-x64+arm64 is a universal binary, always kept for darwin/mas.
    // For universal builds, keep all dirs matching the platform.
    const archSuffix = { 0: 'ia32', 1: 'x64', 2: 'arm', 3: 'arm64' };
    const platformName =
      electronPlatformName === 'mas' ? 'darwin' : electronPlatformName;
    const isUniversal = arch === 4;

    for (const dir of fs.readdirSync(prebuildsBase)) {
      if (!dir.startsWith(`${platformName}-`)) {
        // Wrong platform, always remove
        fs.rmSync(path.join(prebuildsBase, dir), { recursive: true });
        console.log(`Removed unused prebuild: ${dir}`);
      } else if (!isUniversal && archSuffix[arch]) {
        // Right platform but check arch (skip for universal builds)
        const dirArch = dir.slice(`${platformName}-`.length);
        // darwin-x64+arm64 contains both arches, always keep
        if (
          !dirArch.includes(archSuffix[arch]) &&
          !dirArch.includes('+')
        ) {
          fs.rmSync(path.join(prebuildsBase, dir), { recursive: true });
          console.log(`Removed unused prebuild: ${dir}`);
        }
      }
    }
  }

  if (electronPlatformName === 'darwin' || electronPlatformName === 'win32') {
    await context.packager.addElectronFuses(context, {
      version: FuseVersion.V1,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
    });
  }
};
