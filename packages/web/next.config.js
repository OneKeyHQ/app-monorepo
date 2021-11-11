const { withExpo } = require('@expo/next-adapter');
const withTM = require('next-transpile-modules')([
  '@onekeyhq/components',
  '@onekeyhq/kit',
]);
const withPlugins = require('next-compose-plugins');
const { withSentryConfig } = require('@sentry/nextjs');

const webpack = require('webpack');
const packageJson = require('./package.json');

module.exports = withPlugins(
  [
    withTM,
    [withExpo, { projectRoot: __dirname }],
    [withSentryConfig, { silent: true }],
  ],
  {
    sentry: {
      disableServerWebpackPlugin: true,
      disableClientWebpackPlugin: true,
    },
    webpack: (config, options) => {
      config.plugins.push(
        new webpack.DefinePlugin({
          'process.env.SUITE_TYPE': JSON.stringify('web'),
          'process.env.VERSION': JSON.stringify(packageJson.version),
          'process.env.assetPrefix': JSON.stringify(process.env.assetPrefix),
        }),
      );
      return config;
    },
  },
);
