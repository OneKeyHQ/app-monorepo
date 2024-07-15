const path = require('path');
const fs = require('fs-extra');
const { execSync } = require('child_process');

const { exit } = require('process');

const projectPath = path.join(__dirname, '..', '..');
const desktopPath = path.join(projectPath, 'apps', 'desktop');

try {
  const result = execSync(`cd ${desktopPath} && yarn build:main`).toString(
    'utf-8',
  );
  console.log(result);
} catch (error) {
  console.error(error.stdout.toString('utf-8'));
  console.warn(
    'Need to check if src-electron has imported libraries such as react-native through @onekeyhq/shared or @onekeyhq/kit',
  );
  exit(1);
}
