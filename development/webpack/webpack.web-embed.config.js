const { merge } = require('webpack-merge');

const baseConfig = require('./webpack.base.config');
const developmentConfig = require('./webpack.development.config');
const productionConfig = require('./webpack.prod.config');
const babelTools = require('../babelTools');

const { NODE_ENV = 'development' } = process.env;

module.exports = ({
  basePath,
  platform = babelTools.developmentConsts.platforms.webEmbed,
}) => {
  switch (NODE_ENV) {
    case 'production':
      return merge(baseConfig({ platform, basePath }), productionConfig, {
        output: {
          publicPath: '/',
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
