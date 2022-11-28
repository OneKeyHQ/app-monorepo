const fs = require('fs');
const path = require('path');

exports.default = async function fileOperation(context) {
  const { electronPlatformName, appOutDir } = context;
  const appName = context.packager.appInfo.productFilename;
  if (electronPlatformName === 'mas' && appOutDir.endsWith('universal')) {
    const appPath = `${appOutDir}/${appName}.app`;
    const destDir = path.join(appPath, 'Contents/Resources/bin/bridge');
    const originPath = path.join(
      __dirname,
      '../build/static/bin/bridge/mac-x64',
    );
    console.log('copy file start..', originPath);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(
      path.join(originPath, 'onekeyd'),
      path.join(destDir, 'onekeyd'),
    );
    console.log('copy file finish');
    console.log('remove file start..');
    fs.rmSync(
      path.join(
        appPath,
        'Contents/Resources/app.asar.unpacked/node_modules/ethereum-cryptography/node_modules/secp256k1/build/node_gyp_bins/python3',
      ),
    );
    fs.rmSync(
      path.join(
        appPath,
        'Contents/Resources/app.asar.unpacked/node_modules/keccak/build/node_gyp_bins/python3',
      ),
    );
    console.log('remove file finish..');
  }
};
