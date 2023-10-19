const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');
const manifestBuilder = require('./manifestBuilder');

CopyWebpackPlugin.prototype.pluginName = 'CopyWebpackPlugin';

function createPattern(config) {
  if (typeof config === 'string') {
    // eslint-disable-next-line no-param-reassign
    config = {
      from: config,
    };
  }
  return {
    to: '.', // root of build output folder
    force: true,
    ...config,
  };
}

function createCopyPlugin(options) {
  return new CopyWebpackPlugin(options);
}

const copy1 = createCopyPlugin({
  patterns: [
    createPattern({
      from: 'src/manifest/index.js',
      to: './manifest.json',
      transform(content, filePath) {
        return manifestBuilder.buildManifest(content, filePath);
      },
    }),
    createPattern('src/entry/injected.js'),
    // createPattern('src/entry/offscreen.html'),
    // createPattern('src/entry/offscreen.js'),

    createPattern('src/assets/img/icon-128.png'),
    createPattern('src/assets/img/icon-128-disable.png'),
    createPattern('src/assets/ui-popup-boot.html'),
    createPattern('src/assets/ui-popup-boot.js'),
    createPattern('src/assets/preload-html-head.js'),
    // createPattern('src/entry/content-script.css'),
  ],
});

const pluginsCopy = [copy1];
module.exports = pluginsCopy;
