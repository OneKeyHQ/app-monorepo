const webpack = require('webpack');
const { createWebpackConfigAsync } = require('expo-yarn-workspaces/webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const webpackTools = require('../../development/webpackTools');

const InlineChunkHtmlPlugin = require('./development/InlineChunkHtmlPlugin');
const { webModuleTranspile } = require('../../development/webpackTranspiles');

const platform = webpackTools.developmentConsts.platforms.webEmbed;
console.log('============ webpack.version ', webpack.version, platform);

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

  if (process.env.NODE_ENV !== 'production') {
    config.output.publicPath = '/';
  } else {
    // set publicPath to empty string to generate local static html file
    config.output.publicPath = '';
  }

  config = webpackTools.normalizeConfig({
    platform,
    config,
    env,
  });
  // const htmlWebpackPlugin = config.plugins.find(
  //   (p) => p.constructor.name === 'HtmlWebpackPlugin',
  // );

  config.plugins = [
    ...config.plugins,
    // new HtmlWebpackPlugin({
    //   inject: true,
    //   template: path.resolve(__dirname, '../shared/src/web/index.html.ejs'),
    // }),
    // new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/.*\.js$/gi]),
  ];
  return config;
};
