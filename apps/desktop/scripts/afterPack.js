const fs = require('fs');
const path = require('path');

const BRIDGE_BINARY_MODE = 0o755;

// Electron fuses are configured declaratively via the `electronFuses`
// property in electron-builder-base.config.js.

function getPackagedBridgeBinaryPath(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName === 'darwin' || electronPlatformName === 'mas') {
    const appName = context.packager.appInfo.productFilename;
    const appPath = `${appOutDir}/${appName}.app`;

    return path.join(appPath, 'Contents/Resources/bin/bridge/onekeyd');
  }

  if (electronPlatformName === 'linux') {
    return path.join(appOutDir, 'resources/bin/bridge/onekeyd');
  }

  return undefined;
}

function chmodPackagedBridgeBinary(context) {
  const bridgeBinaryPath = getPackagedBridgeBinaryPath(context);
  if (!bridgeBinaryPath || !fs.existsSync(bridgeBinaryPath)) {
    return;
  }

  fs.chmodSync(bridgeBinaryPath, BRIDGE_BINARY_MODE);
  console.log('chmod bridge binary finish', bridgeBinaryPath);
}

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
    fs.chmodSync(path.join(destDir, 'onekeyd'), BRIDGE_BINARY_MODE);
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

  chmodPackagedBridgeBinary(context);
};

exports.BRIDGE_BINARY_MODE = BRIDGE_BINARY_MODE;
exports.chmodPackagedBridgeBinary = chmodPackagedBridgeBinary;
exports.getPackagedBridgeBinaryPath = getPackagedBridgeBinaryPath;
