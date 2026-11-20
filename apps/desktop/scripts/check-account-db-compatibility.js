const fs = require('fs');
const path = require('path');

const {
  DESKTOP_ACCOUNT_DB_COMPATIBILITY_VERSION,
  hasCompatibleDesktopAccountDbBundle,
  readDesktopAccountDbCompatibility,
} = require('../app/libs/desktopAccountDbCompatibility.ts');

function fail(message) {
  console.error(message);
  process.exit(1);
}

const [, , rendererDirectory, format] = process.argv;
if (!rendererDirectory || (format !== 'embedded' && format !== 'ota')) {
  fail('Expected a Desktop renderer directory and embedded or ota');
}
if (!fs.statSync(path.join(rendererDirectory, 'index.html')).isFile()) {
  fail('Desktop renderer index.html is missing');
}
if (
  readDesktopAccountDbCompatibility(rendererDirectory) !==
  DESKTOP_ACCOUNT_DB_COMPATIBILITY_VERSION
) {
  fail('Desktop renderer account database compatibility is missing');
}
if (format === 'ota') {
  const metadata = JSON.parse(
    fs.readFileSync(path.join(rendererDirectory, 'metadata.json'), 'utf8'),
  );
  if (!hasCompatibleDesktopAccountDbBundle(rendererDirectory, metadata)) {
    fail('Desktop OTA compatibility is missing from the manifest');
  }
}
