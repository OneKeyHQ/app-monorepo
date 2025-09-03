const TerserPlugin = require('terser-webpack-plugin');
const { RetryChunkLoadPlugin } = require('webpack-retry-chunk-load-plugin');
const path = require('path');
const { sentryWebpackPlugin } = require('@sentry/webpack-plugin');
const webpack = require('webpack');
const babelTools = require('../babelTools');
const utils = require('./utils');

const FILES_TO_DELETE_AFTER_UPLOAD = [
  '**/*.js.map',
  '**/*.css.map',
  '**/*.LICENSE.txt',
];

module.exports = ({ platform, basePath }) => {
  const isExt = platform === babelTools.developmentConsts.platforms.ext;
  const isWeb = platform === babelTools.developmentConsts.platforms.web;
  const rootPath = isExt
    ? path.join(basePath, 'build', utils.getOutputFolder())
    : path.join(basePath, 'web-build');
  const filesToDeleteAfterUpload = FILES_TO_DELETE_AFTER_UPLOAD.map((file) =>
    path.join(rootPath, file),
  );
  console.log('filesToDeleteAfterUpload', filesToDeleteAfterUpload);
  return {
    mode: 'production',
    devtool: isExt ? false : 'source-map',
    output: {
      clean: true,
    },
    plugins: [
      new webpack.DefinePlugin({
        // Inject the current file's resource path into a global variable
        __CURRENT_FILE_PATH__: JSON.stringify(
          '__CURRENT_FILE_PATH__--not-available-in-production',
        ),
      }),
      isWeb &&
        new RetryChunkLoadPlugin({
          // optional value to set the amount of time in milliseconds before trying to load the chunk again. Default is 0
          // if string, value must be code to generate a delay value. Receives retryCount as argument
          // e.g. `function(retryAttempt) { return retryAttempt * 1000 }`
          retryDelay: 3000,
          // optional value to set the maximum number of retries to load the chunk. Default is 1
          maxRetries: 5,
          // optional code to be executed in the browser context if after all retries chunk is not loaded.
          // if not set - nothing will happen and error will be returned to the chunk loader.
          // lastResortScript: "window.location.href='/500.html';",
        }),
      !isExt &&
        sentryWebpackPlugin({
          org: 'onekey-bb',
          debug: false,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_TOKEN,
          release: {
            name: `${process.env.VERSION} (${process.env.BUILD_NUMBER})`,
          },
          sourcemaps: {
            filesToDeleteAfterUpload,
          },
        }),
    ].filter(Boolean),
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
};
