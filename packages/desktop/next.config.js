const webpack = require('webpack');
const { withExpo } = require('@expo/next-adapter');
const withTM = require('next-transpile-modules')([
  '@onekeyhq/components',
  '@onekeyhq/kit',
]);
const withPlugins = require('next-compose-plugins');
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
      config.plugins.push(
        new webpack.DefinePlugin({
          'process.env.ONEKEY_BUILD_TYPE': JSON.stringify('desktop'),
          'process.env.VERSION': JSON.stringify(packageJson.version),
        }),
      );
      return config;
    },
  },
);
