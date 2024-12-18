const TerserPlugin = require('terser-webpack-plugin');
const path = require('path');
const { sentryWebpackPlugin } = require('@sentry/webpack-plugin');
const babelTools = require('../babelTools');
const extConfig = require('./webpack.ext.config');

const FILES_TO_DELETE_AFTER_UPLOAD = [
  '**/*.js.map',
  '**/*.css.map',
  '**/*.LICENSE.txt',
];

module.exports = ({ platform, basePath }) => {
  const isExt = platform === babelTools.developmentConsts.platforms.ext;
  const rootPath = isExt
    ? path.join(basePath, 'build', extConfig.getOutputFolder())
    : path.join(basePath, 'web-build');
  const filesToDeleteAfterUpload = FILES_TO_DELETE_AFTER_UPLOAD.map((file) =>
    path.join(rootPath, file),
  );
  console.log('filesToDeleteAfterUpload', filesToDeleteAfterUpload);
  return {
    mode: 'production',
    devtool: 'source-map',
    output: {
      clean: true,
    },
    plugins: [
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
};
