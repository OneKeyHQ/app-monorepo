// /* eslint-disable global-require */
const webpack = require('webpack');
const fs = require('fs');
// const { createWebpackConfigAsync } = require('expo-yarn-workspaces/webpack');
// const devUtils = require('@onekeyhq/ext/development/devUtils');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpackManifestPlugin = require('webpack-manifest-plugin');
const DuplicatePackageCheckerPlugin = require('duplicate-package-checker-webpack-plugin');
const WebpackBar = require('webpackbar');
const { EsbuildPlugin } = require('esbuild-loader');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const webpackTools = require('../../development/webpackTools');

// const { webModuleTranspile } = require('../../development/webpackTranspiles');

// console.log('============ webpack.version ', webpack.version);
// const platform = webpackTools.developmentConsts.platforms.web;

// module.exports = async function (env, argv) {
//   // eslint-disable-next-line no-param-reassign
//   env = await webpackTools.modifyExpoEnv({ env, platform });
//   let config = await createWebpackConfigAsync(
//     {
//       ...env,
//       babel: {
//         dangerouslyAddModulePathsToTranspile: [...webModuleTranspile],
//       },
//       mode:
//         process.env.NODE_ENV === 'production' ? 'production' : 'development',
//     },
//     argv,
//   );
//   config = webpackTools.normalizeConfig({
//     platform,
//     config,
//     env,
//     enableAnalyzerHtmlReport: Boolean(process.env.ENABLE_ANALYZER_HTML_REPORT),
//   });

//   if (process.env.NODE_ENV === 'production' && !process.env.ANALYSE_MODULE) {
//     config.devtool = false;
//   }

//   devUtils.writePreviewWebpackConfigJson(config, 'webpack.config.preview.json');
//   return config;
// };

const {
  WEB_PORT = 3000,
  ENABLE_ANALYZER = false,
  ENABLE_ANALYZER_HTML_REPORT = false,
} = process.env;

const isDev = process.env.NODE_ENV !== 'production';

module.exports = async function (env, argv) {
  const platform = webpackTools.developmentConsts.platforms.web;
  // eslint-disable-next-line no-param-reassign
  env = await webpackTools.modifyExpoEnv({ env, platform });
  const configName = 'web';
  return {
    mode: 'development',
    entry: path.join(__dirname, 'index.js'),
    context: path.resolve(__dirname),
    bail: false,
    target: ['web'],
    devtool: 'cheap-module-source-map',
    watchOptions: {
      'aggregateTimeout': 5,
      'ignored': [
        '**/.git/**',
        '**/node_modules/**',
        '**/.expo/**',
        '**/.expo-shared/**',
        '**/web-build/**',
        '**/.#*',
      ],
    },
    stats: 'errors-warnings',
    cache: {
      type: 'filesystem',
      allowCollectingMemory: true,
      store: 'pack',
      buildDependencies: {
        defaultWebpack: [
          path.join(__dirname, 'package.json'),
          path.join(__dirname, '../../package.json'),
        ],
        config: [__filename],
        tsconfig: [
          path.join(__dirname, 'tsconfig.json'),
          path.join(__dirname, '../../tsconfig.json'),
        ],
      },
      cacheDirectory: path.join(__dirname, 'node_modules/.cache/web'),
    },
    'infrastructureLogging': { 'debug': false, 'level': 'none' },
    output: {
      'publicPath': '/',
      'path': path.join(__dirname, 'web-build'),
      'assetModuleFilename': 'static/media/[name].[hash][ext]',
      'uniqueName': 'web',
      'pathinfo': true,
      'filename': '[name].bundle.js',
      'chunkFilename': 'static/js/[name].chunk.js',
      // Point sourcemap entries to original disk location (format as URL on Windows)
      // 'devtoolModuleFilenameTemplate': path
      //   .relative(locations.root, info.absoluteResourcePath)
      //   .replace(/\\/g, '/'),
    },
    plugins: [
      new WebpackBar(),
      ENABLE_ANALYZER &&
        new BundleAnalyzerPlugin(
          ENABLE_ANALYZER_HTML_REPORT
            ? {
                analyzerMode: 'static',
                reportFilename: `report${
                  configName ? `-${configName}` : ''
                }.html`,
                openAnalyzer: false,
              }
            : {
                analyzerMode: 'disabled',
                generateStatsFile: true,
                statsOptions: {
                  reasons: false,
                  warnings: false,
                  errors: false,
                  optimizationBailout: false,
                  usedExports: false,
                  providedExports: false,
                  source: false,
                  ids: false,
                  children: false,
                  chunks: false,
                  modules: !!process.env.ANALYSE_MODULE,
                },
              },
        ),
      new HtmlWebpackPlugin({
        title: 'Web',
        minify: false,
        inject: true,
        filename: path.join(__dirname, 'web-build/index.html'),
        template: `!!ejs-loader?esModule=false!${path.join(
          __dirname,
          '../shared/src/web/index.html',
        )}`,
        favicon: path.join(
          __dirname,
          'public/static/images/icons/favicon/favicon.png',
        ),
        templateParameters: {
          filename: '',
          browser: '',
          platform,
          isDev: process.env.NODE_ENV === 'development',
          htmlHeadPreloadCode: fs.readFileSync(
            path.resolve(__dirname, '../ext/src/assets/preload-html-head.js'),
            {
              encoding: 'utf-8',
            },
          ),
          'WEB_PUBLIC_URL': '/',
          'WEB_TITLE': 'web',
          'LANG_ISO_CODE': 'en',
          'NO_SCRIPT':
            '<form action="" style="background-color:#fff;position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;"><div style="font-size:18px;font-family:Helvetica,sans-serif;line-height:24px;margin:10%;width:80%;"> <p>Oh no! It looks like JavaScript is not enabled in your browser.</p> <p style="margin:20px 0;"> <button type="submit" style="background-color: #4630EB; border-radius: 100px; border: none; box-shadow: none; color: #fff; cursor: pointer; font-weight: bold; line-height: 20px; padding: 6px 16px;">Reload</button> </p> </div> </form>',
          'ROOT_ID': 'root',
        },
      }),
      new webpack.DefinePlugin({
        __DEV__: true,
        process: {
          env: {
            NODE_ENV: '"development"',
            PUBLIC_URL: '""',
            APP_MANIFEST:
              '{"name":"web","slug":"web","version":"0.0.1","web":{},"description":"Multi-chain support for BTC/ETH/BNB/NEAR/Polygon/Solana/Avalanche/Fantom and others","sdkVersion":"49.0.0","platforms":["ios","android","web"]}',
            EXPO_DEBUG: false,
            PLATFORM: '"web"',
            WDS_SOCKET_PATH: '"/_expo/ws"',
            TAMAGUI_TARGET: '"web"',
            ONEKEY_BUILD_TYPE: '"web"',
            EXT_INJECT_RELOAD_BUTTON: '""',
          },
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
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      }),
      platform !== 'ext' ? new DuplicatePackageCheckerPlugin() : null,
    ].filter(Boolean),
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
              'use': {
                'loader': 'babel-loader',
                'options': {
                  'babelrc': false,
                  'configFile': true,
                  'sourceType': 'unambiguous',
                  'root': __dirname,
                  'compact': false,
                  'sourceMaps': true,
                  'inputSourceMap': true,
                  'cacheCompression': false,
                  'cacheDirectory': path.resolve(
                    __dirname,
                    'node_modules/.cache/babel-loader',
                  ),
                },
              },
              'resolve': { 'fullySpecified': false },
            },
            {
              test: /\.(css)$/,
              use: [
                'style-loader',
                {
                  loader: 'css-loader',
                  'options': {
                    'importLoaders': 1,
                    'sourceMap': true,
                    'modules': { 'mode': 'global' },
                  },
                },
                !isDev && {
                  loader: 'esbuild-loader',
                  options: {
                    minify: true,
                  },
                },
              ].filter(Boolean),
              'sideEffects': true,
            },
            {
              exclude: [/^$/, /\.(js|mjs|jsx|ts|tsx)$/, /\.html$/, /\.json$/],
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
      'mainFields': ['browser', 'module', 'main'],
      'aliasFields': ['browser', 'module', 'main'],
      'extensions': [
        '.web.ts',
        '.web.tsx',
        '.web.mjs',
        '.web.js',
        '.web.jsx',
        '.ts',
        '.tsx',
        '.mjs',
        '.js',
        '.jsx',
        '.json',
        '.wasm',
        '.cjs',
        '.d.ts',
      ],
      'symlinks': true,
      'alias': {
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
      'fallback': {
        'crypto': require.resolve('crypto-browserify'),
        'stream': require.resolve('stream-browserify'),
        'path': false,
        'https': false,
        'http': false,
        'net': false,
        'zlib': false,
        'tls': false,
        'child_process': false,
        'process': false,
        'fs': false,
        'util': false,
        'os': false,
        'buffer': require.resolve('buffer'),
      },
    },
    performance: { 'maxAssetSize': 600000, 'maxEntrypointSize': 600000 },
    devServer: {
      open: true,
      port: WEB_PORT,
      // 'allowedHosts': ['all'],
      // 'compress': true,
      'client': {
        // 'webSocketURL': { 'pathname': '/_expo/ws' },
        'overlay': false,
      },

      // 'webSocketServer': { 'type': 'ws', 'options': { 'path': '/_expo/ws' } },
      // 'devMiddleware': { 'index': true, 'publicPath': '' },
      // 'https': false,
      // 'host': '0.0.0.0',
      // 'historyApiFallback': { 'disableDotRule': true, 'index': '/' },
      // 'setupMiddlewares': '[ Function setupMiddlewares() ]',
      onBeforeSetupMiddleware: (devServer) => {
        devServer.app.get(
          '/react-render-tracker@0.7.3/dist/react-render-tracker.js',
          (req, res) => {
            const sendResponse = (text) => {
              res.setHeader(
                'Cache-Control',
                'no-store, no-cache, must-revalidate, proxy-revalidate',
              );
              res.setHeader('Age', '0');
              res.setHeader('Expires', '0');
              res.setHeader('Content-Type', 'text/javascript');
              res.write(text);
              res.end();
            };
            if (
              req.headers &&
              req.headers.cookie &&
              req.headers.cookie.includes('rrt=1')
            ) {
              // read node_modules/react-render-tracker/dist/react-render-tracker.js content
              const filePath = path.join(
                __dirname,
                '../node_modules/react-render-tracker/dist/react-render-tracker.js',
              );
              fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                  console.error(err);
                  res.status(500).send(`Error reading file:  ${filePath}`);
                  return;
                }
                sendResponse(data);
              });
            } else {
              const logScript = `console.log('react-render-tracker is disabled')`;
              sendResponse(logScript);
            }
          },
        );
      },
    },
    experiments: isDev
      ? {
          lazyCompilation: {
            imports: true,
          },
        }
      : {},
    optimization: {
      'splitChunks': {
        'chunks': 'all',
        'minSize': 102400,
        'maxSize': 4194304,
        'hidePathInfo': true,
        'automaticNameDelimiter': '.',
        'name': false,
        'maxInitialRequests': 20,
        'maxAsyncRequests': 50000,
        'cacheGroups': {},
      },
      minimizer: isDev
        ? undefined
        : [
            new EsbuildPlugin({
              legalComments: 'none',
              minifyWhitespace: true,
              target: 'es2020',
            }),
          ],
    },
  };
};
