const webpack = require('webpack');
const fs = require('fs');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpackManifestPlugin = require('webpack-manifest-plugin');
const ProgressBarPlugin = require('progress-bar-webpack-plugin');
const notifier = require('node-notifier');
const { createtResolveExtensions } = require('./utils');
const { isDev, PUBLIC_URL, NODE_ENV } = require('./constant');

class BuildDoneNotifyPlugin {
  apply(compiler) {
    compiler.hooks.done.tap('BuildDoneNotifyPlugin', (compilation) => {
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
      } catch {}
    });
  }
}

const basePlugins = [
  new ProgressBarPlugin(),
  new webpack.DefinePlugin({
    __DEV__: isDev,
    process: {
      env: {
        NODE_ENV: JSON.stringify(NODE_ENV),
        TAMAGUI_TARGET: JSON.stringify('web'),
      },
    },
  }),
  new webpack.ProvidePlugin({
    Buffer: ['buffer', 'Buffer'],
  }),
  new BuildDoneNotifyPlugin(),
];

module.exports = ({ platform, basePath, configName }) => ({
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
    assetModuleFilename: 'static/media/[name].[hash][ext]',
    uniqueName: 'web',
    filename: '[name].bundle.js',
    chunkFilename: 'static/js/[name].chunk.js',
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
              {
                loader: 'babel-loader',
                options: {
                  babelrc: false,
                  configFile: true,
                  sourceType: 'unambiguous',
                  root: basePath,
                  compact: !isDev,
                  sourceMaps: isDev,
                  inputSourceMap: isDev,
                  cacheCompression: false,
                  cacheDirectory: path.resolve(
                    basePath,
                    'node_modules/.cache/babel-loader',
                  ),
                },
              },
              {
                loader: 'tamagui-loader',
                options: {
                  config: path.join(
                    basePath,
                    '../../packages/components/tamagui.config.ts',
                  ),
                  components: ['tamagui'],
                  importsWhitelist: [],
                  logTimings: true,
                  disableExtraction: isDev,
                },
              },
            ],
            resolve: { fullySpecified: false },
          },
          {
            test: /(@?react-(navigation|native)).*\.(ts|js)x?$/,
            exclude: [/react-native-logs/, /react-native-modalize/],
            use: {
              loader: 'babel-loader',
              options: {
                babelrc: false,
                configFile: true,
                sourceType: 'unambiguous',
                root: basePath,
                compact: !isDev,
                sourceMaps: isDev,
                inputSourceMap: isDev,
                cacheCompression: false,
                cacheDirectory: path.resolve(
                  basePath,
                  'node_modules/.cache/babel-loader',
                ),
              },
            },
            resolve: { fullySpecified: false },
          },
          {
            test: /(@?expo-linear-gradient).*\.(ts|js)x?$/,
            exclude: [/react-native-logs/, /react-native-modalize/],
            use: {
              loader: 'babel-loader',
              options: {
                babelrc: false,
                configFile: true,
                sourceType: 'unambiguous',
                root: basePath,
                compact: !isDev,
                sourceMaps: isDev,
                inputSourceMap: isDev,
                cacheCompression: false,
                cacheDirectory: path.resolve(
                  basePath,
                  'node_modules/.cache/babel-loader',
                ),
              },
            },
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
            exclude: [/^$/, /\.(js|mjs|cjs|jsx|ts|tsx)$/, /\.html$/, /\.json$/],
            type: 'asset/resource',
          },
        ],
      },
      {
        test: /@polkadot/,
        // test: /[\s\S]*node_modules[/\\]@polkadot[\s\S]*.c?js$/,
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
    ],
  },
  resolve: {
    mainFields: ['browser', 'module', 'main'],
    aliasFields: ['browser', 'module', 'main'],
    extensions: createtResolveExtensions({ platform, configName }),
    symlinks: true,
    alias: {
      'react-native$': 'react-native-web',
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
      buffer: require.resolve('buffer/'),
    },
  },
  experiments: {
    asyncWebAssembly: true,
  },
  performance: { maxAssetSize: 600000, maxEntrypointSize: 600000 },
});

module.exports.basePlugins = basePlugins;
