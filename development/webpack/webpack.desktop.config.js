const { merge } = require('webpack-merge');
const DuplicatePackageCheckerPlugin = require('duplicate-package-checker-webpack-plugin');

const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');
const baseConfig = require('./webpack.base.config');
const developmentConfig = require('./webpack.development.config');
const productionConfig = require('./webpack.prod.config');

const { NODE_ENV = 'development' } = process.env;

module.exports = ({ basePath, platform = 'desktop' }) => {
  switch (NODE_ENV) {
    case 'production':
      return merge(baseConfig({ platform, basePath }), productionConfig, {
        output: {
          crossOriginLoading: 'anonymous',
        },
        plugins: [new SubresourceIntegrityPlugin()],
      });
    case 'development':
    default:
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
};
