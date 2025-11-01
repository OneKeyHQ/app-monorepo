const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { FuseVersion, FuseV1Options } = require('@electron/fuses');

async function signMacApiBridgeBinaries(context) {
  const { appOutDir } = context;
  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;
  const binDir = path.join(appPath, 'Contents/Resources/bin');

  // Get signing identity from environment or use ad-hoc signing
  let identity = '-'; // Default to ad-hoc signing

  if (process.env.APPLEID) {
    if (process.env.CSC_NAME) {
      // Use explicitly provided identity
      identity = process.env.CSC_NAME;
    } else if (process.env.CSC_LINK) {
      // Auto-detect identity from imported certificate
      try {
        console.log('Auto-detecting signing identity from keychain...');
        const identityList = execSync(
          'security find-identity -v -p codesigning',
          { encoding: 'utf8' },
        );
        // Find "Developer ID Application" identity
        const match = identityList.match(/"(Developer ID Application: [^"]+)"/);
        if (match) {
          identity = match[1];
          console.log(`Found signing identity: ${identity}`);
        } else {
          console.log(
            'No Developer ID Application identity found, using ad-hoc signing',
          );
        }
      } catch (error) {
        console.log(
          'Failed to detect signing identity, using ad-hoc signing:',
          error.message,
        );
      }
    }
  }

  // Path to entitlements file
  const entitlementsPath = path.join(__dirname, '..', 'entitlements.mac.plist');

  console.log('Signing Mac API Bridge binaries...');

  // Find all Mac API Bridge binaries
  const binaryPattern = /^onekey-desktop-mac-api-bridge-(x64|arm64)$/;

  if (fs.existsSync(binDir)) {
    const files = fs.readdirSync(binDir);

    for (const file of files) {
      if (binaryPattern.test(file)) {
        const binaryPath = path.join(binDir, file);

        try {
          console.log(`  Signing ${file}...`);

          // Sign the binary with hardened runtime and entitlements
          const signCommand = [
            'codesign',
            '--force',
            '--sign',
            `"${identity}"`,
            '--timestamp',
            '--options',
            'runtime',
            '--entitlements',
            `"${entitlementsPath}"`,
            `"${binaryPath}"`,
          ].join(' ');

          execSync(signCommand, {
            stdio: 'inherit',
          });

          // Verify the signature
          execSync(`codesign --verify --verbose "${binaryPath}"`, {
            stdio: 'inherit',
          });

          console.log(`  ✓ ${file} signed successfully`);
        } catch (error) {
          console.error(`  ✗ Failed to sign ${file}:`, error.message);
          throw error;
        }
      }
    }
  }

  console.log('Mac API Bridge binaries signing completed.');
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

  if (electronPlatformName === 'darwin') {
    // Sign Mac API Bridge binaries before adding fuses
    // await signMacApiBridgeBinaries(context);
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
