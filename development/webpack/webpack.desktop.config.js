const { merge, mergeWithRules, CustomizeRule } = require('webpack-merge');

const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');
const baseConfig = require('./webpack.base.config');
const developmentConfig = require('./webpack.development.config');
const productionConfig = require('./webpack.prod.config');

const { NODE_ENV = 'development' } = process.env;

const desktopConfig = {
  resolve: {
    extensions: [
      '.desktop.ts',
      '.desktop.tsx',
      '.desktop.mjs',
      '.desktop.js',
      '.desktop.jsx',
    ],
  },
};

module.exports = ({ basePath, platform = 'desktop' }) => {
  switch (NODE_ENV) {
    case 'production': {
      const mergedConfig = merge(
        baseConfig({ platform, basePath }),
        productionConfig,
        {
          output: {
            crossOriginLoading: 'anonymous',
          },
          plugins: [new SubresourceIntegrityPlugin()],
        },
      );
      return mergeWithRules({
        resolve: {
          extensions: CustomizeRule.Prepend,
        },
      })(mergedConfig, desktopConfig);
    }
    case 'development':
    default: {
      const mergedConfig = merge(
        baseConfig({ platform, basePath }),
        developmentConfig({ platform, basePath }),
        {
          devServer: {
            open: false,
          },
        },
      );
      return mergeWithRules({
        resolve: {
          extensions: CustomizeRule.Prepend,
        },
      })(mergedConfig, desktopConfig);
    }
  }
};
