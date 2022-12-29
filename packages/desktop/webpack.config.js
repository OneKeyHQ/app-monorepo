const webpack = require('webpack');
const { createWebpackConfigAsync } = require('expo-yarn-workspaces/webpack');
const devUtils = require('@onekeyhq/ext/development/devUtils');
const webpackTools = require('../../development/webpackTools');
const { webModuleTranspile } = require('../../development/webpackTranspiles');

console.log('============ webpack.version ', webpack.version);
const platform = webpackTools.developmentConsts.platforms.desktop;

module.exports = async function (env, argv) {
  // eslint-disable-next-line no-param-reassign
  env = await webpackTools.modifyExpoEnv({ env, platform });
  let config = await createWebpackConfigAsync(
    {
      ...env,
      babel: {
        dangerouslyAddModulePathsToTranspile: [...webModuleTranspile],
      },
    },
    argv,
  );
  config = webpackTools.normalizeConfig({
    platform,
    config,
    env,
    enableAnalyzerHtmlReport: true,
  });

  const terserExclude = config.optimization.minimizer[0].options.exclude;
  config.optimization.minimizer[0].options.exclude =
    // eslint-disable-next-line no-nested-ternary
    typeof terserExclude === 'string'
      ? [terserExclude, /static\/js-sdk/]
      : Array.isArray(terserExclude)
      ? [...terserExclude, /static\/js-sdk/]
      : [/static\/js-sdk/];

  if (process.env.NODE_ENV === 'production') {
    config.devtool = false;
  }
  devUtils.writePreviewWebpackConfigJson(config, 'webpack.config.preview.json');
  return config;
};
