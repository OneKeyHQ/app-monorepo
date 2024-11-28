const TerserPlugin = require('terser-webpack-plugin');
const { sentryWebpackPlugin } = require('@sentry/webpack-plugin');

module.exports = {
  mode: 'production',
  devtool: 'source-map',
  output: {
    clean: true,
  },
  plugins: [
    sentryWebpackPlugin({
      org: 'onekey-bb',
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_TOKEN,
      release: {
        name: `${process.env.VERSION} (${process.env.BUILD_NUMBER})`,
      },
    }),
  ],
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          keep_classnames: true,
          keep_fnames: true,
        },
      }),
    ],
    splitChunks: {
      chunks: 'all',
      minSize: 102_400,
      maxSize: 4_194_304,
      hidePathInfo: true,
      automaticNameDelimiter: '.',
      name: false,
      maxInitialRequests: 20,
      maxAsyncRequests: 50_000,
      cacheGroups: {},
    },
  },
};
