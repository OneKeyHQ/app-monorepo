const path = require('path');

const DuplicatePackageCheckerPlugin = require('duplicate-package-checker-webpack-plugin');
const { merge } = require('webpack-merge');
const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');
const { InjectManifest } = require('workbox-webpack-plugin');

const babelTools = require('../babelTools');

const { ENABLE_ANALYZER, NODE_ENV } = require('./constant');
const analyzerConfig = require('./webpack.analyzer.config');
const baseConfig = require('./webpack.base.config');
const developmentConfig = require('./webpack.development.config');
const productionConfig = require('./webpack.prod.config');

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
              // Precache NOTHING. This is a large SPA (~800+ chunks); the
              // InjectManifest default precaches every emitted asset, which makes
              // the SW `install` an ATOMIC all-or-nothing fetch of every file —
              // one failed/blocked/throttled request leaves the SW stuck "trying
              // to install" forever (observed in prod/test: #2500+ installs with
              // ERR_CONNECTION_CLOSED bursts). Every asset is already covered by
              // the runtime caching routes in service-worker.js (NetworkFirst
              // navigations, StaleWhileRevalidate scripts/styles, CacheFirst
              // images/fonts), so a full precache adds fragility with no benefit.
              // `exclude: [/./]` matches every manifest URL -> empty precache.
              exclude: [/./],
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
