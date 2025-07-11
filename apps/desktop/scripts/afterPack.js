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

    // Also copy to the main Resources/node_modules path where Node.js can find it
    const mainNodeModulesPath = path.join(resourcesPath, 'node_modules');

    console.log('Resources path:', resourcesPath);
    console.log('Unpacked path:', unpackedPath);
    console.log('Node modules path:', nodeModulesPath);
    console.log('Main node modules path:', mainNodeModulesPath);

    // Ensure the unpacked node_modules directory exists
    if (!fs.existsSync(nodeModulesPath)) {
      console.log('Creating node_modules directory...');
      fs.mkdirSync(nodeModulesPath, { recursive: true });
    } else {
      console.log('Node modules directory already exists');
    }

    // Ensure the main node_modules directory exists
    if (!fs.existsSync(mainNodeModulesPath)) {
      console.log('Creating main node_modules directory...');
      fs.mkdirSync(mainNodeModulesPath, { recursive: true });
    } else {
      console.log('Main node_modules directory already exists');
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

    console.log('Source @abandonware path:', sourceAbandonwarePath);
    console.log('Target @abandonware path:', targetAbandonwarePath);
    console.log('Main target @abandonware path:', mainTargetAbandonwarePath);
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
        console.log(
          '@abandonware modules copied successfully to unpacked directory',
        );

        // Verify the copy
        if (fs.existsSync(targetAbandonwarePath)) {
          const targetContents = fs.readdirSync(targetAbandonwarePath);
          console.log('Target directory contents:', targetContents);
        } else {
          console.error('Target directory was not created!');
        }

        // Also copy to main node_modules for Node.js module resolution
        console.log('Copying @abandonware modules to main node_modules...');
        try {
          fs.cpSync(sourceAbandonwarePath, mainTargetAbandonwarePath, {
            recursive: true,
            dereference: true,
          });
          console.log(
            '@abandonware modules copied successfully to main node_modules',
          );

          // Verify the main copy
          if (fs.existsSync(mainTargetAbandonwarePath)) {
            const mainTargetContents = fs.readdirSync(
              mainTargetAbandonwarePath,
            );
            console.log('Main target directory contents:', mainTargetContents);
          } else {
            console.error('Main target directory was not created!');
          }

          // Copy noble's dependencies (debug, napi-thread-safe-callback, etc.)
          console.log('Copying noble dependencies...');
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
              try {
                console.log(`Copying ${dep}...`);
                fs.cpSync(depSourcePath, depTargetPath, {
                  recursive: true,
                  dereference: true,
                });
                console.log(`${dep} copied successfully`);
              } catch (depError) {
                console.error(`Error copying ${dep}:`, depError);
              }
            } else {
              console.warn(`Dependency ${dep} not found at ${depSourcePath}`);
            }
          }
        } catch (mainCopyError) {
          console.error(
            'Error copying @abandonware modules to main node_modules:',
            mainCopyError,
          );
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
