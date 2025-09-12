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

  // Renderer process externals - only exclude packages that shouldn't be bundled
  const commonDesktopConfig = {
    externals: {
      // Exclude the entire BLE transport package to prevent Node.js modules from leaking to renderer
      '@onekeyfe/hd-transport-electron': 'commonjs @onekeyfe/hd-transport-electron',      
      '@stoprocent/noble': 'commonjs @stoprocent/noble',
      '@stoprocent/bluetooth-hci-socket': 'commonjs @stoprocent/bluetooth-hci-socket',
    },
  };

  switch (NODE_ENV) {
    case 'production': {
      return merge(
        baseConfig({ platform, basePath }),
        productionConfig({ platform, basePath }),
        ...configs,
        commonDesktopConfig,
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
        commonDesktopConfig,
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
