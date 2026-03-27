const fs = require('fs');
const path = require('path');
const asar = require('@electron/asar');

// Electron fuses are configured declaratively via the `electronFuses`
// property in electron-builder-base.config.js.

exports.default = async function fileOperation(context) {
  // Workaround: electron-builder 26.4.0 + Electron 39.8.x writes asar data
  // twice (first pass data is left in place, second pass appends with new
  // offsets), roughly doubling the file size. Repack the asar to eliminate
  // the stale data.
  const { appOutDir } = context;
  const appName = context.packager.appInfo.productFilename;
  const resourcesDir =
    context.electronPlatformName === 'darwin' ||
    context.electronPlatformName === 'mas'
      ? path.join(appOutDir, `${appName}.app`, 'Contents', 'Resources')
      : path.join(appOutDir, 'resources');
  const asarPath = path.join(resourcesDir, 'app.asar');
  if (fs.existsSync(asarPath)) {
    const sizeBefore = fs.statSync(asarPath).size;
    const tmpDir = path.join(resourcesDir, '__asar_repack_tmp__');
    try {
      asar.extractAll(asarPath, tmpDir);
      const unpackedDir = `${asarPath}.unpacked`;
      const hasUnpacked = fs.existsSync(unpackedDir);
      await asar.createPackage(tmpDir, asarPath);
      // If there was an unpacked dir, restore it (createPackage may overwrite)
      if (hasUnpacked && !fs.existsSync(unpackedDir)) {
        console.log('[afterPack] Warning: unpacked dir lost during repack');
      }
      const sizeAfter = fs.statSync(asarPath).size;
      const saved = ((sizeBefore - sizeAfter) / 1024 / 1024).toFixed(0);
      console.log(
        `[afterPack] Repacked asar: ${(sizeBefore / 1024 / 1024).toFixed(0)}MB → ${(sizeAfter / 1024 / 1024).toFixed(0)}MB (saved ${saved}MB)`,
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
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
};
