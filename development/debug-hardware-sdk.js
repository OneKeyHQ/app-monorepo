/**
 * @file debug-hardware-sdk.js
 * hardware sdk debug script
 * hardware sdk publish script: yarn publish:yalc
 *
 * example: yarn debug:hardware-sdk -v 0.2.40
 */
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const argv = require('minimist')(process.argv.slice(2));

const LIB_VERSION = argv.v || 'latest';

// Check whether yalc is installed
exec('which yalc', (error) => {
  if (error) {
    // If yalc is not installed, run the installation command
    console.log('yalc not installed, start installing...');
    installYalc();
    return;
  }

  console.log('yalc installed, start adding libraries...');
  addLibrary();
});

const needDependenceLibrary = [
  'hd-shared',
  'hd-transport',
  'hd-transport-http',
  'hd-transport-web-device',
  'hd-transport-lowlevel',
  'hd-transport-emulator',
  'hd-transport-usb',
  'hd-transport-electron',
  'hd-transport-react-native',
  'hd-core',
  'hd-common-connect-sdk',
  'hd-web-sdk',
  'hd-ble-sdk',
];

/**
 * Dependence Hardware SDK
 */
function addLibrary() {
  needDependenceLibrary.forEach((library) => {
    try {
      execSync(`yalc add @onekeyfe/${library}@${LIB_VERSION}`, {
        stdio: 'inherit',
      });
      console.log(`add @onekeyfe/${library}@${LIB_VERSION} Done`);
    } catch (error) {
      console.error(`An error occurred while executing the command: ${error}`);
    }
  });
  clearDesktopSdkWebpackCache();
}

function clearDesktopSdkWebpackCache() {
  const cacheDirs = [
    path.resolve(__dirname, '../apps/desktop/node_modules/.cache/web'),
    path.resolve(__dirname, '../apps/desktop/node_modules/.cache/rspack'),
  ];

  cacheDirs.forEach((cacheDir) => {
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      console.log(`removed desktop hardware sdk cache: ${cacheDir}`);
    }
  });
}

/**
 * install yalc
 */
function installYalc() {
  exec('npm install -g yalc', (error) => {
    if (error) {
      console.error(`An error occurred while executing the command: ${error}`);
      return;
    }
    console.log('yalc installed, start adding libraries...');
    addLibrary();
  });
}
