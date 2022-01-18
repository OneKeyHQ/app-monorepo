require('./env');

const webpack = require('webpack');
const lodash = require('lodash');
const notifier = require('node-notifier');

class BuildDoneNotifyPlugin {
  apply(compiler) {
    compiler.hooks.done.tap(
      'BuildDoneNotifyPlugin',
      (compilation, callback) => {
        const msg = `OneKey Build at ${new Date().toLocaleTimeString()}`;
        setTimeout(() => {
          console.log('\u001b[33m'); // yellow color
          console.log('===================================');
          console.log(msg);
          console.log('===================================');
          console.log('\u001b[0m'); // reset color
        }, 300);
        notifier.notify(msg);
      },
    );
  }
}

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
    config.plugins = [
      ...config.plugins,
      new BuildDoneNotifyPlugin(),
      new webpack.DefinePlugin({
        'process.env.ONEKEY_BUILD_TYPE': JSON.stringify(platform),
        'process.env.EXT_INJECT_RELOAD_BUTTON': JSON.stringify(
          process.env.EXT_INJECT_RELOAD_BUTTON,
        ),
      }),
    ];
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
