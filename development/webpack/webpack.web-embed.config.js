const { merge } = require('webpack-merge');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const developmentConfig = require('./webpack.development.config');
const productionConfig = require('./webpack.prod.config');
const babelTools = require('../babelTools');
const { isDev, PUBLIC_URL, NODE_ENV } = require('./constant');
const BaseConfig = require('./webpack.base.config');

const baseConfig = ({ platform, basePath, configName }) => {
  const baseLoaderOption = {
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
          htmlHeadPreloadCode: '',
          WEB_PUBLIC_URL: PUBLIC_URL || '/',
          WEB_TITLE: platform,
          LANG_ISO_CODE: 'en',
          NO_SCRIPT: '',
          ROOT_ID: 'root',
        },
      }),
      ...BaseConfig.basePlugins,
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
              test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/, /\.svg$/],
              type: 'asset',
              parser: { dataUrlCondition: { maxSize: 1000 } },
            },
            {
              test: /\.(js|mjs|ts)$/,
              exclude: [/node_modules/],
              use: [
                {
                  loader: 'babel-loader',
                  options: baseLoaderOption,
                },
              ],
              resolve: { fullySpecified: false },
            },
            {
              test: /lru-cache.*\.(ts|js)x?$/,
              use: {
                loader: 'babel-loader',
                options: baseLoaderOption,
              },
              resolve: { fullySpecified: false },
            },
            {
              test: /(@?react-(navigation|native)).*\.(ts|js)x?$/,
              use: {
                loader: 'babel-loader',
                options: baseLoaderOption,
              },
              resolve: { fullySpecified: false },
            },
            {
              test: /(@?expo).*\.(ts|js)x?$/,
              use: {
                loader: 'babel-loader',
                options: baseLoaderOption,
              },
              resolve: { fullySpecified: false },
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
    resolve: BaseConfig.baseResolve({ platform, configName }),
    experiments: BaseConfig.baseExperiments,
    performance: BaseConfig.basePerformance,
  };
};

module.exports = ({
  basePath,
  platform = babelTools.developmentConsts.platforms.webEmbed,
}) => {
  switch (NODE_ENV) {
    case 'production':
      return merge(
        baseConfig({ platform, basePath }),
        productionConfig({ platform, basePath }),
        {
          optimization: {
            splitChunks: false,
          },
          output: {
            publicPath: './',
            path: path.join(basePath, 'web-build'),
            assetModuleFilename:
              'static/media/web-embed.[name].[contenthash][ext]',
            uniqueName: 'web',
            filename: 'web-embed.[contenthash:10].js',
          },
        },
      );
    case 'development':
    default:
      return merge(
        baseConfig({ platform, basePath }),
        developmentConfig({ platform, basePath }),
        {
          output: {
            publicPath: '',
          },
        },
      );
  }
};
