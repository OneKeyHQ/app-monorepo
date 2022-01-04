const webpack = require('webpack');
const path = require('path');
const fse = require('fs-extra');
const fs = require('fs');
const TerserPlugin = require('terser-webpack-plugin');
const lodash = require('lodash');
const env = require('./development/env');
const pluginsHtml = require('./development/pluginsHtml');
const pluginsCopy = require('./development/pluginsCopy');
const devUtils = require('./development/devUtils');
const nextWebpack = require('./development/nextWebpack');
const packageJson = require('./package.json');
const webpackTools = require('../../development/webpackTools');

const ASSET_PATH = process.env.ASSET_PATH || '/';
const IS_DEV = process.env.NODE_ENV !== 'production';

// FIX error:
//    Module parse failed: Unexpected token (7:11)
//    You may need an appropriate loader to handle this file type
const transpileModules = [
  '@onekeyhq/components',
  '@onekeyhq/kit',
  '@onekeyhq/inpage-provider',
  '@onekeyhq/shared',
];

// TODO use webpack 4.43.0
console.log('============ webpack.version ', webpack.version);

// load the secrets
const secretsPath = path.join(__dirname, `secrets.${env.NODE_ENV}.js`);
const secrets = fse.existsSync(secretsPath) ? secretsPath : false;

const alias = {
  'react-dom': '@hot-loader/react-dom',
  // 'secrets': secrets,
};

const fileExtensions = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'eot',
  'otf',
  'svg',
  'ttf',
  'woff',
  'woff2',
];

const resolveExtensions = fileExtensions
  .map((extension) => `.${extension}`)
  .concat(['.js', '.jsx', '.ts', '.tsx', '.d.ts', '.css']);

let webpackConfig = {
  // add custom config, will be deleted later
  chromeExtensionBoilerplate: {
    notHotReload: [
      // ignore background
      'background',
      'content-script',
      'ui-devtools',
    ],
  },
  mode: IS_DEV ? 'development' : 'production', // development, production
  // mode: 'development',
  entry: {
    'background': path.join(__dirname, 'src/entry/background.ts'),
    'content-script': path.join(__dirname, 'src/entry/content-script.ts'),
    'ui-popup': path.join(__dirname, 'src/entry/ui-popup.tsx'),
    'ui-expand-tab': path.join(__dirname, 'src/entry/ui-expand-tab.tsx'),
    'ui-standalone-window': path.join(
      __dirname,
      'src/entry/ui-standalone-window.tsx',
    ),
    // 'ui-options': path.join(__dirname, 'src/entry/ui-options.ts'),
    // 'ui-newtab': path.join(__dirname, 'src/entry/ui-newtab.ts'),
    'ui-devtools': path.join(__dirname, 'src/entry/ui-devtools.ts'),
    'ui-devtools-panel': path.join(
      __dirname,
      'src/entry/ui-devtools-panel.tsx',
    ),
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'js/[name].bundle.js',
    clean: true,
    publicPath: ASSET_PATH,
  },
  module: {
    rules: [
      {
        __ruleName__: 'shtml-rule',
        // project/html-loader
        test: /\.(shtml)$/i, // MUST BE .shtml different with withExpo() builtin .html
        use: { loader: 'html-loader' },
        exclude: /node_modules/,
      },
      {
        __ruleName__: 'css-rule',
        // project/css-loader
        // look for .css or .scss files
        test: /\.(css)$/i,
        // in the `src` directory
        use: [
          {
            loader: 'style-loader',
          },
          {
            loader: 'css-loader',
          },
        ],
      },
      // {
      //   test: new RegExp(`.(${fileExtensions.join('|')})$`),
      //   loader: 'file-loader',
      //   options: {
      //     name: '[name].[ext]',
      //     esModule: false,
      //   },
      //   exclude: /node_modules/,
      // },
      // {
      //   test: /\.(png|jpg|jpeg|gif|webp|ico|bmp|svg)$/i,
      //   loader: 'next-image-loader',
      //   issuer: { not: /\.(css|scss|sass)(\.webpack\[javascript\/auto\])?$/ },
      //   // dependency: { not: [Array] },
      //   options: { isServer: false, isDev: true, assetPrefix: '' },
      // },
    ],
  },
  resolve: {
    alias,
    extensions: [
      // move to: ./development/resolveExtension.js
    ],
  },
  plugins: [
    new webpack.ProgressPlugin(),
    // expose and write the allowed env vars on the compiled bundle
    new webpack.EnvironmentPlugin(['NODE_ENV']),
    new webpack.DefinePlugin({
      'process.env.VERSION': JSON.stringify(packageJson.version),
    }),
    // FIX ERROR: process is not defined
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
    ...pluginsCopy,
    ...pluginsHtml,
  ],
  infrastructureLogging: {
    level: 'info',
  },
  optimization: {
    // splitChunks
    // minimize
    // minimizer
    splitChunks: {
      chunks: 'all',
      minSize: 300000,
      maxSize: 500000,
    },
  },
};

webpackConfig = nextWebpack(webpackConfig, {
  transpileModules,
  debug: false,
  projectRoot: __dirname,
});

if (IS_DEV) {
  // webpackConfig.devtool = 'cheap-module-source-map';

  // Reset sourcemap here, withExpo will change this value
  //    only inline-source-map supported in extension
  // TODO external file sourcemap
  webpackConfig.devtool = 'inline-source-map';
} else {
  webpackConfig.optimization = {
    ...webpackConfig.optimization,
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      }),
    ],
  };
}

console.log('------- webpackConfig.module.rules', webpackConfig.module.rules);
console.log('------- webpackConfig', {
  devtool: webpackConfig.devtool,
});
// process.exit(1);
devUtils.cleanWebpackDebugFields(webpackConfig);

webpackConfig = webpackTools.normalizeConfig({
  platform: 'ext',
  config: webpackConfig,
});

devUtils.writePreviewWebpackConfigJson(
  webpackConfig,
  'webpack.config.preview.json',
);

module.exports = webpackConfig;
