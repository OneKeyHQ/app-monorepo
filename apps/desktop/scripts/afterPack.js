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

  // Cross-OS prebuilds are excluded via platform-specific `files` patterns
  // in electron-builder configs, so they never enter the asar (fixes #10814).

  if (
    electronPlatformName === 'darwin' ||
    electronPlatformName === 'win32' ||
    electronPlatformName === 'linux'
  ) {
    await context.packager.addElectronFuses(context, {
      version: FuseVersion.V1,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      // Prevent ELECTRON_RUN_AS_NODE from turning the app into a plain Node.js process
      [FuseV1Options.RunAsNode]: false,
      // Prevent NODE_OPTIONS env var from injecting debug flags or inspect ports
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      // Keep file:// privileges enabled — disabling makes file:// an opaque origin,
      // breaking localStorage/sessionStorage/indexedDB for the main window.
      // Risk mitigation: the production file protocol interceptor in app.ts validates
      // all resolved paths stay within the build directory (path traversal guard),
      // preventing file:// from reading arbitrary files outside the app bundle.
      // TODO: migrate to custom app:// protocol to fully eliminate file:// privileges.
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: true,
    });
  }
};
