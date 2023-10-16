// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';
process.env.ASSET_PATH = '/';

const webpack = require('webpack');
const configs = require('../webpack.config');
const devUtils = require('./devUtils');

devUtils.cleanBrowserBuild();

devUtils.cleanWebpackDebugFields(configs, { boilerplate: true });

[].concat(configs).forEach((config) => (config.mode = 'production'));

webpack(configs, (err, stats) => {
  if (err) {
    console.error('build failed:', err);
    throw err;
  }
  if (stats.hasErrors()) {
    console.error('build failed:', stats.toJson());
    process.exit(1);
  }
  // Done processing
  process.exit(0);
});
