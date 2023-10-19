/**
 * @file debug-hardware-sdk.js
 * hardware sdk debug script
 * hardware sdk publish script: yarn publish:yalc
 *
 * example: yarn debug:hardware-sdk -v 0.2.40
 */
const { exec, execSync } = require('child_process');
const argv = require('minimist')(process.argv.slice(2));

const LIB_VERSION = argv.v || 'latest';

// Check whether yalc is installed
exec('which yalc', (error, stdout, stderr) => {
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
  'hd-core',
  'hd-ble-sdk',
  'hd-transport',
  'hd-web-sdk',
  'hd-shared',
];

/**
 * Dependence Hardware SDK
 */
function addLibrary() {
  needDependenceLibrary.forEach((library) => {
    try {
      execSync(`yalc add @onekeyfe/${library}@${LIB_VERSION}`);
      console.log(`add @onekeyfe/${library}@${LIB_VERSION} Done`);
    } catch (error) {
      console.error(`An error occurred while executing the command: ${error}`);
    }
  });
}

/**
 * install yalc
 */
function installYalc() {
  exec('npm install -g yalc', (error, stdout, stderr) => {
    if (error) {
      console.error(`An error occurred while executing the command: ${error}`);
      return;
    }
    console.log('yalc installed, start adding libraries...');
    addLibrary();
  });
}
