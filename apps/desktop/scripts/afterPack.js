const fs = require('fs');
const path = require('path');
const { FuseVersion, FuseV1Options } = require('@electron/fuses');

exports.default = async function fileOperation(context) {
  // Copy @abandonware modules to ensure they are available at runtime
  const { electronPlatformName, appOutDir } = context;
  const appName = context.packager.appInfo.productFilename;

  if (
    electronPlatformName === 'darwin' ||
    electronPlatformName === 'win32' ||
    electronPlatformName === 'linux'
  ) {
    const appPath =
      electronPlatformName === 'darwin'
        ? `${appOutDir}/${appName}.app`
        : `${appOutDir}`;

    const resourcesPath =
      electronPlatformName === 'darwin'
        ? path.join(appPath, 'Contents/Resources')
        : path.join(appPath, 'resources');

    const unpackedPath = path.join(resourcesPath, 'app.asar.unpacked');
    const nodeModulesPath = path.join(unpackedPath, 'node_modules');
    const mainNodeModulesPath = path.join(resourcesPath, 'node_modules');

    // Ensure directories exist
    if (!fs.existsSync(nodeModulesPath)) {
      fs.mkdirSync(nodeModulesPath, { recursive: true });
    }
    if (!fs.existsSync(mainNodeModulesPath)) {
      fs.mkdirSync(mainNodeModulesPath, { recursive: true });
    }

    // Copy @abandonware modules
    const sourceAbandonwarePath = path.join(
      __dirname,
      '../../../node_modules/@abandonware',
    );
    const targetAbandonwarePath = path.join(nodeModulesPath, '@abandonware');
    const mainTargetAbandonwarePath = path.join(
      mainNodeModulesPath,
      '@abandonware',
    );

    if (fs.existsSync(sourceAbandonwarePath)) {
      try {
        // Copy to unpacked directory
        fs.cpSync(sourceAbandonwarePath, targetAbandonwarePath, {
          recursive: true,
          dereference: true,
        });

        // Copy to main node_modules for Node.js module resolution
        fs.cpSync(sourceAbandonwarePath, mainTargetAbandonwarePath, {
          recursive: true,
          dereference: true,
        });

        // Copy noble's dependencies
        const nobleDependencies = [
          'debug',
          'napi-thread-safe-callback',
          'node-addon-api',
          'node-gyp-build',
        ];

        const sourceRootNodeModules = path.join(
          __dirname,
          '../../../node_modules',
        );

        for (const dep of nobleDependencies) {
          const depSourcePath = path.join(sourceRootNodeModules, dep);
          const depTargetPath = path.join(mainNodeModulesPath, dep);

          if (fs.existsSync(depSourcePath)) {
            fs.cpSync(depSourcePath, depTargetPath, {
              recursive: true,
              dereference: true,
            });
          }
        }
      } catch (error) {
        console.error('Error copying @abandonware modules:', error);
      }
    }
  }

  // https://www.electron.build/app-builder-lib.typealias.electronplatformname
  // ElectronPlatformName: "darwin" | "linux" | "win32" | "mas"
  if (electronPlatformName === 'mas' && appOutDir.endsWith('universal')) {
    const appPath = `${appOutDir}/${appName}.app`;
    const destDir = path.join(appPath, 'Contents/Resources/bin/bridge');
    const originPath = path.join(
      __dirname,
      '../app/build/static/bin/bridge/mac-x64',
    );
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(
      path.join(originPath, 'onekeyd'),
      path.join(destDir, 'onekeyd'),
    );

    // Clean up unnecessary files
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
  }

  if (electronPlatformName === 'darwin' || electronPlatformName === 'win32') {
    await context.packager.addElectronFuses(context, {
      version: FuseVersion.V1,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    });
  }
};
