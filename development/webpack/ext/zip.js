require('../../env');
const path = require('path');
const devUtils = require('./devUtils');

const buildFolder = path.resolve(__dirname, '../../../apps/ext/build');

// TODO:
// commands cannot be work on Windows.
devUtils.execSync(`
  rm -rf ${buildFolder}/_dist/
  mkdir -p ${buildFolder}/_dist/
`);

const version = process.env.VERSION;

const browsers = [
  // 'chrome-extension', // chrome v2 extension
  'chrome_v3-extension', // chrome v3 extension
  // 'firefox-addon', // firefox not supported anymore
  // 'edge-extension', // use chrome v2 extension
];
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
