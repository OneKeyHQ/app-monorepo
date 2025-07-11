const fs = require('fs');
const path = require('path');
const { FuseVersion, FuseV1Options } = require('@electron/fuses');

exports.default = async function fileOperation(context) {
  // Copy @abandonware modules to ensure they are available at runtime
  const { electronPlatformName, appOutDir } = context;
  const appName = context.packager.appInfo.productFilename;

  console.log('=== AfterPack Script Starting ===');
  console.log('Platform:', electronPlatformName);
  console.log('AppOutDir:', appOutDir);
  console.log('AppName:', appName);
  console.log('Working directory:', process.cwd());
  console.log('Script directory:', __dirname);

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

    console.log('Resources path:', resourcesPath);
    console.log('Unpacked path:', unpackedPath);
    console.log('Node modules path:', nodeModulesPath);

    // Ensure the unpacked node_modules directory exists
    if (!fs.existsSync(nodeModulesPath)) {
      console.log('Creating node_modules directory...');
      fs.mkdirSync(nodeModulesPath, { recursive: true });
    } else {
      console.log('Node modules directory already exists');
    }

    // Copy @abandonware modules
    const sourceAbandonwarePath = path.join(
      __dirname,
      '../../../node_modules/@abandonware',
    );
    const targetAbandonwarePath = path.join(nodeModulesPath, '@abandonware');

    console.log('Source @abandonware path:', sourceAbandonwarePath);
    console.log('Target @abandonware path:', targetAbandonwarePath);
    console.log('Source exists:', fs.existsSync(sourceAbandonwarePath));

    if (fs.existsSync(sourceAbandonwarePath)) {
      console.log('Copying @abandonware modules...');

      // List source directory contents
      const sourceContents = fs.readdirSync(sourceAbandonwarePath);
      console.log('Source directory contents:', sourceContents);

      try {
        fs.cpSync(sourceAbandonwarePath, targetAbandonwarePath, {
          recursive: true,
          dereference: true, // Resolve symbolic links to their targets
        });
        console.log('@abandonware modules copied successfully');

        // Verify the copy
        if (fs.existsSync(targetAbandonwarePath)) {
          const targetContents = fs.readdirSync(targetAbandonwarePath);
          console.log('Target directory contents:', targetContents);
        } else {
          console.error('Target directory was not created!');
        }
      } catch (error) {
        console.error('Error copying @abandonware modules:', error);
      }
    } else {
      console.warn('@abandonware modules not found in source');
      console.log(
        'Listing parent directory:',
        path.dirname(sourceAbandonwarePath),
      );
      try {
        const parentContents = fs.readdirSync(
          path.dirname(sourceAbandonwarePath),
        );
        console.log('Parent directory contents:', parentContents);
      } catch (e) {
        console.error('Cannot list parent directory:', e);
      }
    }
  }

  console.log('=== AfterPack Script Completed ===');

  // https://www.electron.build/app-builder-lib.typealias.electronplatformname
  // ElectronPlatformName: "darwin" | "linux" | "win32" | "mas"
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

  if (electronPlatformName === 'darwin' || electronPlatformName === 'win32') {
    await context.packager.addElectronFuses(context, {
      version: FuseVersion.V1,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    });
  }
};
