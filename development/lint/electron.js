const path = require('path');
const fs = require('fs-extra');
const { execSync } = require('child_process');

const { exit } = require('process');

const projectPath = path.join(__dirname, '..', '..');
const desktopPath = path.join(projectPath, 'apps', 'desktop');

// check if build:main is successful
try {
  const result = execSync(`cd ${desktopPath} && yarn build:main`).toString(
    'utf-8',
  );
  console.log(result);
} catch (error) {
  console.error(error.stdout.toString('utf-8'));
  console.warn(
    'Need to check if app has imported libraries such as react-native through @onekeyhq/shared or @onekeyhq/kit',
  );
  exit(1);
}

// Check if APP_NAME is correctly set to "OneKey Wallet"
  const distAppPath = path.join(desktopPath, 'app', 'dist', 'app.js');
  console.log(distAppPath);
  if (!fs.existsSync(distAppPath)) {
    throw new Error(`Build output file not found: ${distAppPath}`);
  }
  const expectedAppName = 'APP_NAME = "OneKey Wallet"';
  try {
    const shellCommand = `grep '${expectedAppName}' "${distAppPath}"`;
    console.log(shellCommand);
    const grepResult = execSync(shellCommand, { encoding: 'utf-8' });
    console.log('grepResult:', grepResult);
    if (grepResult === '') {
      throw new Error('grep command should not return output');
    }
  } catch (grepError) {
    throw new Error(
      `APP_NAME must be set to "OneKey Wallet" in the built app.js file. ` +
      `Expected: ${expectedAppName}`
    );
  }