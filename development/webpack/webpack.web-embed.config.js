const path = require('path');

const { merge } = require('webpack-merge');
const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');

const { LavaMoatError } = require('../lavamoat/error.cjs');
const { createBaseResolveOptions } = require('../rspack/rspack.resolve.config');

const {
  createLavaMoatWebpackOptimization,
  createLavaMoatWebpackPlugin,
  createLavaMoatWebpackRules,
  createLavaMoatWebpackValidationPlugin,
  isLavaMoatEnabled,
} = require('./lavamoat');
const {
  createKaspaCompatibilityRule,
} = require('./lavamoat-kaspa-compatibility.cjs');
const { createResolveExtensions } = require('./utils');
const baseConfig = require('./webpack.base.config');
const productionConfig = require('./webpack.prod.config');

module.exports = ({ basePath }) => {
  const platform = 'web-embed';
  if (process.env.NODE_ENV !== 'production' || !isLavaMoatEnabled()) {
    throw new LavaMoatError(
      'The protected web-embed config requires production LavaMoat enforcement or policy generation.',
    );
  }

  const config = merge(
    baseConfig({ platform, basePath }),
    productionConfig({ platform, basePath }),
    {
      target: ['web', 'es2017'],
      output: {
        publicPath: './',
        filename: '[name].[contenthash:10].bundle.js',
        chunkFilename: 'static/js/[name].[contenthash:10].chunk.js',
        assetModuleFilename: 'static/media/web-embed.[name].[contenthash][ext]',
        crossOriginLoading: 'anonymous',
      },
      resolve: createBaseResolveOptions({
        basePath,
        enableSentryMinimalCompat: true,
        extensions: createResolveExtensions({ platform }),
      }),
      module: {
        rules: [
          {
            test: /\.(c|m)?jsx?$/,
            include: [
              /node_modules[\\/]@sentry(-internal)?[\\/]/,
              /node_modules[\\/]@onekeyfe[\\/]kaspa-wasm/,
              /node_modules[\\/]@revenuecat[\\/]purchases-js/,
            ],
            use: {
              loader: 'babel-loader',
              options: {
                babelrc: false,
                configFile: false,
                sourceType: 'unambiguous',
                presets: [
                  [
                    '@babel/preset-env',
                    {
                      targets: { chrome: '67', safari: '15.5' },
                      modules: false,
                    },
                  ],
                ],
              },
            },
          },
          ...createLavaMoatWebpackRules(),
          createKaspaCompatibilityRule(),
        ],
      },
      optimization: {
        ...createLavaMoatWebpackOptimization(),
        splitChunks: false,
      },
      plugins: [
        new SubresourceIntegrityPlugin(),
        createLavaMoatWebpackValidationPlugin(),
        createLavaMoatWebpackPlugin({ basePath, target: platform }),
      ].filter(Boolean),
    },
  );
  // Each realm loads one shared runtime before Sentry and the application.
  // Keep relative URLs so the same artifact works in native file WebViews.
  config.entry = {
    'web-embed-sentry': path.join(basePath, 'sentry.js'),
    main: path.join(basePath, 'index.js'),
  };
  return config;
};
