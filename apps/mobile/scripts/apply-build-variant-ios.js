// cspell:ignore pbxproj Pbxproj ASSETCATALOG
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const infoPlistPath = path.join(rootDir, 'ios/OneKeyWallet/Info.plist');
const pbxprojPath = path.join(
  rootDir,
  'ios/OneKeyWallet.xcodeproj/project.pbxproj',
);

const envVariant = (process.env.ONEKEY_BUILD_VARIANT || '').toLowerCase();
const allowSkipGpg =
  (process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION || '').toLowerCase() ===
  'true';
const variant =
  envVariant === 'skip_gpg' || allowSkipGpg ? 'skip_gpg' : 'standard';

const appDisplayName = variant === 'skip_gpg' ? 'OneKey SG' : 'OneKey';
const appIconName = variant === 'skip_gpg' ? 'OneKeyLogoSkipGpg' : 'OneKeyLogo';

function updateInfoPlistDisplayName(filePath, displayName) {
  const content = fs.readFileSync(filePath, 'utf8');
  const pattern =
    /(<key>CFBundleDisplayName<\/key>\s*<string>)([^<]*)(<\/string>)/;
  if (!pattern.test(content)) {
    throw new Error('Failed to locate CFBundleDisplayName in Info.plist');
  }
  const updated = content.replace(pattern, `$1${displayName}$3`);
  fs.writeFileSync(filePath, updated);
}

function updatePbxprojAppIcon(filePath, iconName) {
  const content = fs.readFileSync(filePath, 'utf8');
  const pattern = /ASSETCATALOG_COMPILER_APPICON_NAME = [^;]+;/g;
  const matches = content.match(pattern);
  if (!matches || matches.length === 0) {
    throw new Error(
      'Failed to locate ASSETCATALOG_COMPILER_APPICON_NAME in project.pbxproj',
    );
  }
  const updated = content.replace(
    pattern,
    `ASSETCATALOG_COMPILER_APPICON_NAME = ${iconName};`,
  );
  fs.writeFileSync(filePath, updated);
}

updateInfoPlistDisplayName(infoPlistPath, appDisplayName);
updatePbxprojAppIcon(pbxprojPath, appIconName);

console.log(
  `[mobile-ios-variant] Applied variant=${variant}, displayName="${appDisplayName}", appIcon="${appIconName}"`,
);
