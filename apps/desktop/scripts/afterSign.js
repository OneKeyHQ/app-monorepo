const { notarize } = require('@electron/notarize');

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

  try {
    const result = await notarize({
      tool: 'notarytool',
      appPath,
      appleId: process.env.APPLEID,
      appleIdPassword: process.env.APPLEIDPASS,
      teamId: process.env.ASC_PROVIDER,
    });
    return result;
  } catch (err) {
    console.warn(`[afterSign] Notarization failed (non-fatal): ${err.message}`);
    console.warn('[afterSign] The build artifact will not be notarized. Check Apple Developer account agreements if this is unexpected.');
  }
};
