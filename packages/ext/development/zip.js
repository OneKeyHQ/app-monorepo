require('../../../development/env');
const path = require('path');
const devUtils = require('./devUtils');
const packageJson = require('../package.json');

const buildFolder = path.resolve(__dirname, '../build');

devUtils.execSync(`
  rm -rf ${buildFolder}/_dist/
  mkdir -p ${buildFolder}/_dist/
`);

const buildVersion = 'beta';
const version = `${process.env.VERSION || packageJson.version}-${
  process.env.BUILD_NUMBER || buildVersion
}`;

const browsers = ['chrome', 'firefox'];
browsers.forEach((browser) => {
  const cmd = `
  cd ${buildFolder}/${browser}
  zip -r ../_dist/${browser}-${version}.zip ./
`;
  devUtils.execSync(cmd);
});
