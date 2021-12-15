const webpack = require('webpack');
const { createWebpackConfigAsync } = require('expo-yarn-workspaces/webpack');
const webpackTools = require('../../development/webpackTools');

console.log('============ webpack.version ', webpack.version);

module.exports = async function (env, argv) {
  let config = await createWebpackConfigAsync(env, argv);
  config = webpackTools.normalizeConfig({
    platform: 'desktop',
    config,
  });
  return config;
};
