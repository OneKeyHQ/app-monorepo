const path = require('path');
const { merge } = require('webpack-merge');
const DuplicatePackageCheckerPlugin = require('duplicate-package-checker-webpack-plugin');

const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');
const { InjectManifest } = require('workbox-webpack-plugin');
const baseConfig = require('./webpack.base.config');
const analyzerConfig = require('./webpack.analyzer.config');
const developmentConfig = require('./webpack.development.config');
const productionConfig = require('./webpack.prod.config');
const babelTools = require('../babelTools');
const { ENABLE_ANALYZER, NODE_ENV } = require('./constant');

const webConfig = {
  plugins: [new DuplicatePackageCheckerPlugin()],
};

module.exports = ({
  basePath,
  platform = babelTools.developmentConsts.platforms.web,
}) => {
  const configs = ENABLE_ANALYZER
    ? [webConfig, analyzerConfig({ configName: platform })]
    : [webConfig];
  switch (NODE_ENV) {
    case 'production':
      return merge(
        baseConfig({ platform, basePath }),
        productionConfig({ platform, basePath }),
        ...configs,
        {
          output: {
            crossOriginLoading: 'anonymous',
          },
          plugins: [
            new SubresourceIntegrityPlugin(),
            new InjectManifest({
              swSrc: path.join(basePath, 'src/service-worker.js'),
              swDest: 'service-worker.js',
              exclude: [
                /\.map$/,
                /asset-manifest\.json$/,
                /LICENSE/,
                /index\.html$/,
              ],
            }),
          ],
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
