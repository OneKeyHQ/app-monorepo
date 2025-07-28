require('../../env');
const path = require('path');
const devUtils = require('./devUtils');

const extFolder = path.resolve(__dirname, '../../../apps/ext');
const developmentImgFolder = path.resolve(
  extFolder,
  './src/assets/img-development',
);
const buildFolder = path.resolve(__dirname, '../../../apps/ext/build');

// TODO:
// commands cannot be work on Windows.
devUtils.execSync(`
  rm -rf ${buildFolder}/_dist/
  mkdir -p ${buildFolder}/_dist/

  rm -rf ${buildFolder}/_development_build_dist/
  mkdir -p ${buildFolder}/_development_build_dist/
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

  // Modify manifest.json to add DEVELOPMENT BUILD suffix using sed command
  const manifestPath = `${browserFolder}/manifest.json`;
  const developmentBuildCmd = `
  cd ${browserFolder}
  cp -rf ${developmentImgFolder}/* ${browserFolder}/
  sed -i.bak 's/"name": "OneKey"/"name": "OneKey (DEVELOPMENT BUILD)"/g' ${manifestPath}
  zip -r ../_development_build_dist/OneKey-Wallet-${version}-${browser}-development-build.zip ./
`;
  devUtils.execSync(developmentBuildCmd);
});
