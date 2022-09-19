/* eslint-disable global-require */
const webpack = require('webpack');
const { createWebpackConfigAsync } = require('expo-yarn-workspaces/webpack');
const webpackTools = require('../../development/webpackTools');

console.log('============ webpack.version ', webpack.version);
const platform = webpackTools.developmentConsts.platforms.web;

module.exports = async function (env, argv) {
  // eslint-disable-next-line no-param-reassign
  env = await webpackTools.modifyExpoEnv({ env, platform });
  let config = await createWebpackConfigAsync(
    {
      ...env,
      babel: { dangerouslyAddModulePathsToTranspile: ['@gorhom'] },
      mode:
        process.env.NODE_ENV === 'production' ? 'production' : 'development',
    },
    argv,
  );
  config = webpackTools.normalizeConfig({
    platform,
    config,
    env,
  });
  if (process.env.ENABLE_ANALYZER) {
    const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
    config.plugins.push(
      new BundleAnalyzerPlugin({
        analyzerMode: 'disabled',
        generateStatsFile: true,
        statsOptions: {
          reasons: false,
          warnings: false,
          errors: false,
          optimizationBailout: false,
          usedExports: false,
          providedExports: false,
          source: false,
          ids: false,
          children: false,
          chunks: false,
          modules: process.env.ANALYSE_MODULE === 'module',
        },
      }),
    );
    config.devtool = false;
  }
  return config;
};
