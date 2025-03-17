const path = require('path');
const { merge, mergeWithRules, CustomizeRule } = require('webpack-merge');

const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');
const baseConfig = require('./webpack.base.config');
const analyzerConfig = require('./webpack.analyzer.config');
const developmentConfig = require('./webpack.development.config');
const productionConfig = require('./webpack.prod.config');
const { NODE_ENV, ENABLE_ANALYZER } = require('./constant');
const babelTools = require('../babelTools');

module.exports = ({
  basePath,
  platform = babelTools.developmentConsts.platforms.desktop,
}) => {
  const configs = ENABLE_ANALYZER
    ? [analyzerConfig({ configName: platform })]
    : [];
  switch (NODE_ENV) {
    case 'production': {
      return merge(
        baseConfig({ platform, basePath }),
        productionConfig({ platform, basePath }),
        ...configs,
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
        ...configs,
        {
          // development/webpack/webpack.development.config.js 10L
          // Electron 30.x doesn't support cheap-module-source-map
          devtool: 'eval-source-map',
          devServer: {
            open: false,
          },
        },
      );
    }
  }
};
