const webpack = require('webpack');
const { withExpo } = require('@expo/next-adapter');
const withTM = require('next-transpile-modules')([
  '@onekeyhq/components',
  '@onekeyhq/kit',
  '@onekeyhq/inpage-provider',
]);
const withPlugins = require('next-compose-plugins');
const path = require('path');
const packageJson = require('./package.json');

module.exports = withPlugins(
  [
    withTM,
    [
      withExpo,
      {
        projectRoot: __dirname,
      },
    ],
  ],
  {
    webpack: (config) => {
      // Module not found: Can't resolve 'fs'
      // config.target = 'electron-main'; // electron-main  electron-renderer

      console.log('desktop webpack.config.js', config);
      config.plugins.push(
        new webpack.DefinePlugin({
          'process.env.ONEKEY_BUILD_TYPE': JSON.stringify('desktop'),
          'process.env.VERSION': JSON.stringify(packageJson.version),
          'process.env.STATIC_ROOT': JSON.stringify(
            path.join(__dirname, './public/static'),
          ),
        }),
      );
      return config;
    },
  },
);
