require('../../../development/env');
const path = require('path');
const devUtils = require('./devUtils');
const packageJson = require('../package.json');

const buildFolder = path.resolve(__dirname, '../build');

devUtils.execSync(`
  rm -rf ${buildFolder}/_dist/
  mkdir -p ${buildFolder}/_dist/
`);

const version = process.env.VERSION;

const browsers = ['chrome-extension', 'firefox-addon'];
browsers.forEach((browser) => {
  const browserFolder = `${buildFolder}/${browser.replace(/-.+$/, '')}`;
  const cmd = `
  mkdir -p ${browserFolder}
  cd ${browserFolder}
  touch .gitkeep
  zip -r ../_dist/OneKey-Wallet-${version}-${browser}.zip ./
`;
  devUtils.execSync(cmd);
});
