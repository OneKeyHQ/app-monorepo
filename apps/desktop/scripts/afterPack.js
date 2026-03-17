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

  // Remove unused native prebuilds for other OS platforms.
  // Many packages (serialport, noble, usb, bufferutil, etc.) bundle prebuilds
  // for all platforms but each build only needs its own OS. Removing cross-OS
  // prebuilds reduces package size and eliminates snap linter warnings.
  // Keep all arch variants for the same OS to avoid breaking fallbacks
  // (e.g., Windows ARM64 runs x64 binaries via WoW64 emulation).
  // Only process standard "os-arch" named directories (e.g., "linux-x64",
  // "darwin-x64+arm64"); skip non-standard names (e.g., "node", "apple").
  //
  // Skip cleanup for macOS universal temp directories (e.g. mac-universal-x64-temp).
  // @electron/universal merges x64-temp and arm64-temp by comparing asar contents.
  // If we delete prebuilds from the unpacked dir but the asar index still
  // references them, the merge fails with ENOENT.
  const isUniversalTemp = appOutDir.includes('-universal-');
  if (!isUniversalTemp) {
    const resourcesDir = path.join(
      appOutDir,
      electronPlatformName === 'darwin' || electronPlatformName === 'mas'
        ? `${appName}.app/Contents/Resources`
        : 'resources',
    );
    const unpackedDir = path.join(resourcesDir, 'app.asar.unpacked');
    if (fs.existsSync(unpackedDir)) {
      const platformPrefix =
        electronPlatformName === 'mas' ? 'darwin' : electronPlatformName;
      const knownPlatforms = ['android', 'darwin', 'linux', 'win32'];
      let removedCount = 0;

      // cspell:ignore prebuilds
      const findPrebuildsRecursive = (dir) => {
        let entries;
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const fullPath = path.join(dir, entry.name);
            if (entry.name === 'prebuilds') {
              processPrebuildsDir(fullPath);
            } else if (entry.name !== '.cache' && entry.name !== '.git') {
              findPrebuildsRecursive(fullPath);
            }
          }
        }
      };

      const processPrebuildsDir = (fullPath) => {
        let prebuildEntries;
        try {
          prebuildEntries = fs.readdirSync(fullPath, {
            withFileTypes: true,
          });
        } catch {
          return;
        }
        const pkgRelative = path.relative(unpackedDir, fullPath);
        console.log(`[prebuilds] Scanning: ${pkgRelative}`);
        for (const prebuild of prebuildEntries) {
          if (prebuild.isDirectory()) {
            processPrebuildEntry(fullPath, prebuild.name);
          }
        }
      };

      const processPrebuildEntry = (parentDir, prebuildName) => {
        // Only process dirs with known OS prefix (e.g., "linux-x64")
        // Skip non-standard names like "node", "apple" to be safe
        const isKnownPlatform = knownPlatforms.some(
          (p) => prebuildName === p || prebuildName.startsWith(`${p}-`),
        );
        if (!isKnownPlatform) {
          console.log(`[prebuilds]   Skipped (non-standard): ${prebuildName}`);
          return;
        }
        if (
          prebuildName === platformPrefix ||
          prebuildName.startsWith(`${platformPrefix}-`)
        ) {
          console.log(`[prebuilds]   Kept: ${prebuildName}`);
          return;
        }
        try {
          fs.rmSync(path.join(parentDir, prebuildName), { recursive: true });
          console.log(`[prebuilds]   Removed: ${prebuildName}`);
          removedCount += 1;
        } catch (err) {
          console.warn(
            `[prebuilds]   Failed to remove ${prebuildName}: ${err.message}`,
          );
        }
      };

      console.log(
        `[prebuilds] Cleaning cross-OS prebuilds (keeping: ${platformPrefix}-*)`,
      );
      findPrebuildsRecursive(unpackedDir);
      console.log(`[prebuilds] Done. Removed ${removedCount} directories.`);
    }
  } else {
    console.log(
      `[prebuilds] Skipping cleanup for universal temp build: ${appOutDir}`,
    );
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
