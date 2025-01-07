const { merge, mergeWithRules, CustomizeRule } = require('webpack-merge');

const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');
const baseConfig = require('./webpack.base.config');
const developmentConfig = require('./webpack.development.config');
const productionConfig = require('./webpack.prod.config');
const { NODE_ENV } = require('./constant');
const babelTools = require('../babelTools');

module.exports = ({
  basePath,
  platform = babelTools.developmentConsts.platforms.desktop,
}) => {
  switch (NODE_ENV) {
    case 'production': {
      return merge(
        baseConfig({ platform, basePath }),
        productionConfig({ platform, basePath }),
        {
          output: {
            crossOriginLoading: 'anonymous',
          },
          plugins: [new SubresourceIntegrityPlugin()],
        },
      );
    }
    case 'development':
    default: {
      return merge(
        baseConfig({ platform, basePath }),
        developmentConfig({ platform, basePath }),
        {
          devServer: {
            open: false,
          },
        },
      );
    }
  }
};
