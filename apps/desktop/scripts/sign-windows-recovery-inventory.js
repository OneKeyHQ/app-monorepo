/* eslint-disable onekey/no-raw-error -- standalone build script without app runtime dependencies */
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const {
  prepareWindowsRecoveryInventory,
} = require('./windows-recovery-inventory');

module.exports = async function signWindowsRecoveryInventory({
  sign,
  ...inventory
}) {
  await prepareWindowsRecoveryInventory(inventory);
  if (!(await sign(inventory.outputPath))) {
    throw new Error('Windows directory recovery inventory was not signed');
  }
  const helper = path.join(
    path.dirname(inventory.templatePath),
    'OneKeyInstallerDirectoryRecovery.exe',
  );
  execFileSync(
    helper,
    ['verify-inventory', inventory.release, inventory.outputPath],
    { stdio: 'inherit', windowsHide: true },
  );
};
