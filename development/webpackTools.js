const webpack = require('webpack');
const lodash = require('lodash');

const resolveExtensions = [
  '.web.ts',
  '.web.tsx',
  '.web.mjs',
  '.web.js',
  '.web.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.js',
  '.jsx',
  '.json',
  '.wasm',
  '.d.ts',
];

function normalizeConfig({ platform, config }) {
  if (platform) {
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.ONEKEY_BUILD_TYPE': JSON.stringify(platform),
      }),
    );
  }
  config.resolve.extensions = lodash.uniq(
    config.resolve.extensions.concat(resolveExtensions),
  );
  return config;
}

module.exports = {
  resolveExtensions,
  normalizeConfig,
};
