const { execSync } = require('child_process');
const path = require('path');
const { exit } = require('process');

const fs = require('fs-extra');

const { auditDesktopMainBundle } = require('./electron-runtime-integrity');

class DesktopLintError extends Error {}

const getTimestamp = () => new Date().toLocaleTimeString();
const startTime = Date.now();

console.log(`[${getTimestamp()}] Electron build check started...`);

const projectPath = path.join(__dirname, '..', '..');
const desktopPath = path.join(projectPath, 'apps', 'desktop');

// check if build:main is successful
try {
  const result = execSync(`cd ${desktopPath} && yarn build:main`).toString(
    'utf-8',
  );
  console.log(result);
} catch (error) {
  const stdout = error.stdout?.toString('utf-8') ?? '';
  const stderr = error.stderr?.toString('utf-8') ?? '';
  console.error([stdout, stderr].filter(Boolean).join('\n') || error.message);
  console.warn(
    'Need to check if app has imported libraries such as react-native through @onekeyhq/shared or @onekeyhq/kit',
  );
  exit(1);
}

// Check if APP_NAME is correctly set to "OneKey Wallet"
const distAppPath = path.join(desktopPath, 'app', 'dist', 'app.js');
console.log(distAppPath);
if (!fs.existsSync(distAppPath)) {
  throw new DesktopLintError(`Build output file not found: ${distAppPath}`);
}
const distAppSource = fs.readFileSync(distAppPath, 'utf8');
const expectedAppName = 'APP_NAME = "OneKey Wallet"';
if (!distAppSource.includes(expectedAppName)) {
  throw new DesktopLintError(
    `APP_NAME must be set to "OneKey Wallet" in the built app.js file. ` +
      `Expected: ${expectedAppName}`,
  );
}

const runtimeIntegrityErrors = auditDesktopMainBundle(distAppSource);
if (runtimeIntegrityErrors.length > 0) {
  throw new DesktopLintError(
    `Electron main Node runtime integrity check failed:\n- ${runtimeIntegrityErrors.join(
      '\n- ',
    )}`,
  );
}
console.log('Electron main Node runtime integrity check passed.');

const duration = ((Date.now() - startTime) / 1000).toFixed(2);
console.log(
  `[${getTimestamp()}] Electron build check completed. (${duration}s)`,
);
