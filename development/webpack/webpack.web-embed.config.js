const { merge } = require('webpack-merge');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const developmentConfig = require('./webpack.development.config');
const productionConfig = require('./webpack.prod.config');
const babelTools = require('../babelTools');
const { WEB_PORT, PUBLIC_URL, NODE_ENV } = require('./constant');
const baseConfig = require('./webpack.base.config');

module.exports = ({
  basePath,
  platform = babelTools.developmentConsts.platforms.webEmbed,
}) => {
  const config = {
    entry: {
      sentry: path.join(basePath, 'sentry.js'),
      main: path.join(basePath, 'index.js'),
    },
  };
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
            publicPath: PUBLIC_URL || './',
            path: path.join(basePath, 'web-build'),
            assetModuleFilename:
              'static/media/web-embed.[name].[contenthash][ext]',
            uniqueName: 'web',
            filename: 'web-embed.[contenthash:10].js',
          },
          ...config,
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
          ...config,
        },
      );
  }
};
