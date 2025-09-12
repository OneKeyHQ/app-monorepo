const webpack = require('webpack');
const fs = require('fs');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpackManifestPlugin = require('webpack-manifest-plugin');
const ProgressBarPlugin = require('progress-bar-webpack-plugin');
const notifier = require('node-notifier');
const { exit } = require('process');
const { createResolveExtensions } = require('./utils');
const { isDev, PUBLIC_URL, NODE_ENV, ONEKEY_PROXY } = require('./constant');

const IS_EAS_BUILD = !!process.env.EAS_BUILD;

class BuildDoneNotifyPlugin {
  apply(compiler) {
    compiler.hooks.done.tap('BuildDoneNotifyPlugin', (compilation) => {
      if (IS_EAS_BUILD) {
        exit(0);
      } else {
        const msg = `OneKey Build at ${new Date().toLocaleTimeString()}, completed in ${
          (compilation.endTime - compilation.startTime) / 1000
        }s`;
        setTimeout(() => {
          console.log('\u001b[33m'); // yellow color
          console.log('===================================');
          console.log(msg);
          console.log('===================================');
          console.log('\u001b[0m'); // reset color
        }, 300);
        try {
          notifier.notify(msg);
        } catch {
          // ignore
        }
      }
    });
  }
}

const baseResolve = ({ platform, configName, basePath }) => ({
  mainFields: ['browser', 'module', 'main'],
  aliasFields: ['browser', 'module', 'main'],
  extensions: createResolveExtensions({ platform, configName }),
  symlinks: true,
  alias: {
    'react-native$': 'react-native-web',
    'react-native-aes-crypto': false,
    'react-native/Libraries/Components/View/ViewStylePropTypes$':
      'react-native-web/dist/exports/View/ViewStylePropTypes',
    'react-native/Libraries/EventEmitter/RCTDeviceEventEmitter$':
      'react-native-web/dist/vendor/react-native/NativeEventEmitter/RCTDeviceEventEmitter',
    'react-native/Libraries/vendor/emitter/EventEmitter$':
      'react-native-web/dist/vendor/react-native/emitter/EventEmitter',
    'react-native/Libraries/vendor/emitter/EventSubscriptionVendor$':
      'react-native-web/dist/vendor/react-native/emitter/EventSubscriptionVendor',
    'react-native/Libraries/EventEmitter/NativeEventEmitter$':
      'react-native-web/dist/vendor/react-native/NativeEventEmitter',
    '@react-aria/focus': path.join(
      basePath,
      '../../node_modules/@react-aria/focus/src/index.ts',
    ),
    '@react-aria/interactions': path.join(
      basePath,
      '../../node_modules/@react-aria/interactions/src/index.ts',
    ),
    '@react-aria/ssr': path.join(
      basePath,
      '../../node_modules/@react-aria/ssr/src/index.ts',
    ),
    '@react-aria/utils': path.join(
      basePath,
      '../../node_modules/@react-aria/utils/src/index.ts',
    ),
  },
  fallback: {
    'crypto': require.resolve(
      '@onekeyhq/shared/src/modules3rdParty/cross-crypto/index.js',
    ),
    stream: require.resolve('stream-browserify'),
    path: false,
    https: false,
    http: false,
    net: false,
    zlib: false,
    tls: false,
    child_process: false,
    process: false,
    fs: false,
    util: false,
    os: false,
    wbg: false,
    buffer: require.resolve('buffer/'),
  },
});

const basePlugins = [
  isDev && new ProgressBarPlugin(),
  new webpack.DefinePlugin({
    __DEV__: isDev,
    process: {
      env: {
        ONEKEY_PROXY: JSON.stringify(ONEKEY_PROXY),
        NODE_ENV: JSON.stringify(NODE_ENV),
        TAMAGUI_TARGET: JSON.stringify('web'),
      },
    },
  }),
  new webpack.ProvidePlugin({
    Buffer: ['buffer', 'Buffer'],
  }),
  isDev && new BuildDoneNotifyPlugin(),
].filter(Boolean);

const baseExperiments = {
  asyncWebAssembly: true,
};

const basePerformance = {
  maxAssetSize: 600_000,
  maxEntrypointSize: 600_000,
};

module.exports = ({ platform, basePath, configName }) => {
  const babelLoaderOption = {
    babelrc: false,
    configFile: true,
    sourceType: 'unambiguous',
    root: basePath,
    compact: !isDev,
    sourceMaps: isDev,
    inputSourceMap: isDev,
    cacheCompression: false,
    cacheDirectory: path.resolve(basePath, 'node_modules/.cache/babel-loader'),
  };
  const useBabelLoader = {
    loader: 'babel-loader',
    options: babelLoaderOption,
  };
  return {
    entry: path.join(basePath, 'index.js'),
    context: path.resolve(basePath),
    bail: false,
    target: ['web'],
    watchOptions: {
      aggregateTimeout: 5,
      ignored: [
        '**/.git/**',
        '**/node_modules/**',
        '**/.expo/**',
        '**/.expo-shared/**',
        '**/web-build/**',
        '**/.#*',
      ],
    },
    stats: 'errors-warnings',
    infrastructureLogging: { 'debug': false, 'level': 'none' },
    output: {
      publicPath: PUBLIC_URL || '/',
      path: path.join(basePath, 'web-build'),
      assetModuleFilename: isDev
        ? 'static/media/[name].[ext]'
        : 'static/media/[name].[hash][ext]',
      uniqueName: 'web',
      filename: isDev ? '[name].bundle.js' : '[name].[chunkhash:10].bundle.js',
      chunkFilename: isDev
        ? 'static/js/[name].chunk.js'
        : 'static/js/[name].[chunkhash:10].chunk.js',
    },
    plugins: [
      new HtmlWebpackPlugin({
        title: platform,
        minify: !isDev,
        inject: true,
        filename: path.join(basePath, 'web-build/index.html'),
        template: `!!ejs-loader?esModule=false!${path.join(
          __dirname,
          '../../packages/shared/src/web/index.html',
        )}`,
        favicon: path.join(
          basePath,
          'public/static/images/icons/favicon/favicon.png',
        ),
        templateParameters: {
          filename: '',
          browser: '',
          platform,
          isDev,
          htmlHeadPreloadCode: fs.readFileSync(
            path.resolve(basePath, '../ext/src/assets/preload-html-head.js'),
            {
              encoding: 'utf-8',
            },
          ),
          WEB_PUBLIC_URL: PUBLIC_URL || '/',
          WEB_TITLE: platform,
          LANG_ISO_CODE: 'en',
          NO_SCRIPT:
            '<form action="" style="background-color:#fff;position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;"><div style="font-size:18px;font-family:Helvetica,sans-serif;line-height:24px;margin:10%;width:80%;"> <p>Oh no! It looks like JavaScript is not enabled in your browser.</p> <p style="margin:20px 0;"> <button type="submit" style="background-color: #4630EB; border-radius: 100px; border: none; box-shadow: none; color: #fff; cursor: pointer; font-weight: bold; line-height: 20px; padding: 6px 16px;">Reload</button> </p> </div> </form>',
          ROOT_ID: 'root',
        },
      }),
      // Generate an asset manifest file with the following content:
      // - "files" key: Mapping of all asset filenames to their corresponding
      //   output file so that tools can pick it up without having to parse
      //   `index.html`
      // - "entrypoints" key: Array of files which are included in `index.html`,
      //   can be used to reconstruct the HTML if necessary
      new webpackManifestPlugin.WebpackManifestPlugin({
        fileName: 'asset-manifest.json',
        publicPath: './',
        filter: ({ path }) => {
          if (
            path.match(
              /(apple-touch-startup-image|apple-touch-icon|chrome-icon|precache-manifest)/,
            )
          ) {
            return false;
          }
          // Remove compressed versions and service workers
          return !(path.endsWith('.gz') || path.endsWith('worker.js'));
        },
        generate: (seed, files, entrypoints) => {
          const manifestFiles = files.reduce((manifest, file) => {
            if (file.name) {
              manifest[file.name] = file.path;
            }
            return manifest;
          }, seed);
          const entrypointFiles = entrypoints.main.filter(
            (fileName) => !fileName.endsWith('.map'),
          );
          return {
            files: manifestFiles,
            entrypoints: entrypointFiles,
          };
        },
      }),
      ...basePlugins,
    ],
    module: {
      strictExportPresence: false,
      rules: [
        {
          exclude: [/@babel(?:\/|\\{1,2})runtime/],
          test: /\.(js|mjs|jsx|ts|tsx|css)$/,
          resolve: {
            fullySpecified: false,
          },
        },
        {
          'oneOf': [
            {
              test: /\.wasm$/,
              type: 'webassembly/async',
            },
            {
              test: [/\.avif$/],
              type: 'asset',
              mimetype: 'image/avif',
              parser: {
                dataUrlCondition: {
                  maxSize: 1000,
                },
              },
            },
            {
              test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/, /\.svg$/],
              type: 'asset',
              parser: { dataUrlCondition: { maxSize: 1000 } },
            },

            {
              test: /\.(js|mjs|jsx|ts|tsx)$/,
              exclude: [/node_modules/],
              use: [
                useBabelLoader,
                {
                  loader: 'tamagui-loader',
                  options: {
                    config: path.join(
                      basePath,
                      '../../packages/components/tamagui.config.ts',
                    ),
                    components: ['tamagui'],
                    importsWhitelist: [],
                    logTimings: false,
                    disableExtraction: isDev,
                  },
                },
              ],
              resolve: { fullySpecified: false },
            },
            {
              test: /(@?react-(navigation|native)).*\.(ts|js)x?$/,
              exclude: [/react-native-logs/, /react-native-modalize/],
              use: useBabelLoader,
              resolve: { fullySpecified: false },
            },
            {
              test: [
                // expo
                /(@?expo-*).*\.(c|m)?(ts|js)x?$/,
                // set-interval-async (webembed android webview required)
                /(@?set-interval-async).*\.(c|m)?(ts|js)x?$/,
                // // tamagui (webembed android webview required)
                // /(@?tamagui*).*\.(c|m)?(ts|js)x?$/,
                // // keystonehq
                // /(@?keystonehq).*\.(c|m)?(ts|js)x?$/,

                /* web-embed on  */
                /react-router/,
                /turbo-stream/,
                // @react-aria packages
                /(@?react-aria).*\.(c|m)?(ts|js)x?$/,
              ],
              exclude: [/react-native-logs/, /react-native-modalize/],
              use: useBabelLoader,
              resolve: { fullySpecified: false },
            },
            {
              test: /lru-cache.*\.(ts|js)x?$/,
              use: useBabelLoader,
              resolve: { fullySpecified: false },
            },
            {
              test: /\.(css)$/,
              use: [
                'style-loader',
                {
                  loader: 'css-loader',
                  options: {
                    importLoaders: 1,
                    sourceMap: true,
                    modules: { mode: 'global' },
                  },
                },
              ].filter(Boolean),
              'sideEffects': true,
            },
            {
              exclude: [
                /^$/,
                /\.(js|mjs|cjs|jsx|ts|tsx)$/,
                /\.html$/,
                /\.json$/,
              ],
              type: 'asset/resource',
            },
          ],
        },
        {
          test: /@polkadot/,
          loader: require.resolve('@open-wc/webpack-import-meta-loader'),
        },
        {
          test: /\.mjs$/,
          include: /node_modules/,
          type: 'javascript/auto',
        },
        {
          test: /\.ejs$/i,
          use: ['html-loader', 'template-ejs-loader'],
        },
        {
          test: /\.worker\.(js|ts)$/,
          use: {
            loader: 'worker-loader',
            options: {
              inline: 'fallback',
            },
          },
        },
      ],
    },
    resolve: baseResolve({ platform, configName, basePath }),
    experiments: baseExperiments,
    performance: basePerformance,
    optimization: {
      splitChunks: {
        cacheGroups: {
          icons: {
            test: (module) => {
              const iconTestRegex =
                /[\\/]packages[\\/]components[\\/]src[\\/]primitives[\\/]Icon[\\/]react[\\/]/;
              return module.resource && iconTestRegex.test(module.resource);
            },
            name: 'icons',
            chunks: 'async',
            enforce: true,
            priority: 30,
            reuseExistingChunk: true,
          },
        },
      },
    },
  };
};

module.exports.basePlugins = basePlugins;
