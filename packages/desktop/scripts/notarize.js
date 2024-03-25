const { notarize } = require('@electron/notarize');
const build = require('../electron-builder.config');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  if (!process.env.APPLEID || !process.env.APPLEIDPASS) {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`notarizing ${appPath} ...`);

  const result = await notarize({
    tool: 'legacy',
    appBundleId: build.appId,
    appPath,
    appleId: process.env.APPLEID,
    appleIdPassword: process.env.APPLEIDPASS,
    ascProvider: process.env.ASC_PROVIDER,
  });
  return result;
};
