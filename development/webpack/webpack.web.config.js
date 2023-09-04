const { merge } = require('webpack-merge');
const DuplicatePackageCheckerPlugin = require('duplicate-package-checker-webpack-plugin');

const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');
const baseConfig = require('./webpack.base.config');
const analyzerConfig = require('./webpack.analyzer.config');
const developmentConfig = require('./webpack.development.config');
const productionConfig = require('./webpack.prod.config');

const { ENABLE_ANALYZER = false, NODE_ENV = 'development' } = process.env;

const webConfig = {
  plugins: [new DuplicatePackageCheckerPlugin()],
};

module.exports = ({ basePath, platform = 'web' }) => {
  const configs = ENABLE_ANALYZER
    ? [webConfig, analyzerConfig({ configName: 'web' })]
    : [webConfig];
  switch (NODE_ENV) {
    case 'production':
      return merge(
        baseConfig({ platform, basePath }),
        productionConfig,
        ...configs,
        {
          plugins: [new SubresourceIntegrityPlugin()],
        },
      );
    case 'development':
    default:
      return merge(
        baseConfig({ platform, basePath }),
        developmentConfig({ platform, basePath }),
        ...configs,
      );
  }
};
