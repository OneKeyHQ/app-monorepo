const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');

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

const copy1 = new CopyWebpackPlugin({
  patterns: [
    createPattern({
      from: 'src/manifest.json',
      transform(content, path1) {
        // TODO firefox, chrome, edge manifest.json
        // generates the manifest file using the package.json informations
        return Buffer.from(
          JSON.stringify({
            description: process.env.npm_package_description,
            version: process.env.npm_package_version,
            ...JSON.parse(content.toString()),
          }),
        );
      },
    }),
    createPattern('src/assets/img/icon-128.png'),
    createPattern('src/assets/img/icon-34.png'),
    // createPattern('src/entry/content-script.css'),
  ],
});

const pluginsCopy = [copy1];
module.exports = pluginsCopy;
