const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');

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
        // eslint-disable-next-line global-require,import/no-dynamic-require
        const manifest = require(filePath);
        // generates the manifest file using the package.json informations
        return Buffer.from(JSON.stringify(manifest, null, 2));
      },
    }),
    createPattern('src/entry/injected.js'),
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
