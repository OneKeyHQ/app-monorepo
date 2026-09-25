const path = require('path');

const { sentryWebpackPlugin } = require('@sentry/webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
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
  const shouldUploadSourcemapsByCli =
    process.env.SENTRY_UPLOAD_BY_CLI === 'true';
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
      !isExt &&
        !shouldUploadSourcemapsByCli &&
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
        // Vendor cache groups for long-term caching (web/desktop only).
        // Extension uses its own code splitting via HtmlWebpackPlugin chunks,
        // and named vendor chunks would NOT be included in ext HTML files,
        // breaking the extension UI in production.
        cacheGroups: isExt
          ? {}
          : {
              reactVendor: {
                test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                name: 'vendor-react',
                chunks: 'all',
                priority: 40,
                reuseExistingChunk: true,
              },
              lodashVendor: {
                // 'initial' (not 'all'): only group lodash reachable from the
                // initial graph. With 'all', lodash methods used solely by async
                // route/SDK chunks were merged into this named chunk and dragged
                // onto first paint (vendor-lodash measured ~92% unused on Home).
                test: /[\\/]node_modules[\\/]lodash/,
                name: 'vendor-lodash',
                chunks: 'initial',
                priority: 30,
                reuseExistingChunk: true,
              },
              networkVendor: {
                test: /[\\/]node_modules[\\/](axios|@supabase)[\\/]/,
                name: 'vendor-network',
                chunks: 'all',
                priority: 30,
                reuseExistingChunk: true,
              },
              cryptoVendor: {
                // 'initial' for the same reason as lodashVendor: with 'all',
                // crypto copies used solely by async SDK chunks (e.g. the
                // nested @noble/hashes and @scure/base bundled under
                // @walletconnect/utils and @alephium/web3) are merged into
                // this named chunk and dragged onto first paint.
                test: /[\\/]node_modules[\\/](@noble|@scure|ethers|bn\.js|elliptic|hash\.js|browserify)[\\/]/,
                name: 'vendor-crypto',
                chunks: 'initial',
                priority: 20,
                reuseExistingChunk: true,
              },
            },
      },
    },
  };
};
