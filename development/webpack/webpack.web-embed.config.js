const { merge } = require('webpack-merge');

const path = require('path');
const baseConfig = require('./webpack.base.config');
const developmentConfig = require('./webpack.development.config');
const productionConfig = require('./webpack.prod.config');
const babelTools = require('../babelTools');
const { NODE_ENV } = require('./constant');

module.exports = ({
  basePath,
  platform = babelTools.developmentConsts.platforms.webEmbed,
}) => {
  switch (NODE_ENV) {
    case 'production':
      return merge(baseConfig({ platform, basePath }), productionConfig, {
        optimization: {
          splitChunks: false,
        },
        output: {
          publicPath: '/',
          path: path.join(basePath, 'web-build'),
          assetModuleFilename:
            'static/media/web-embed.[name].[contenthash][ext]',
          uniqueName: 'web',
          filename: 'web-embed.[contenthash:10].js',
        },
      });
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
