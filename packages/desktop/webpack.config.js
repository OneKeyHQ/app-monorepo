const webpack = require('webpack');
const { createWebpackConfigAsync } = require('expo-yarn-workspaces/webpack');

console.log('============ webpack.version ', webpack.version);

module.exports = async function (env, argv) {
  const config = await createWebpackConfigAsync(env, argv);
  return config;
};
