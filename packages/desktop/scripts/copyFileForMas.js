const fs = require('fs');
const path = require('path');

exports.default = async function copyFile(context) {
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
  }
};
