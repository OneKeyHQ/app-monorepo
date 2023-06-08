// TODO try use expo start and build ext

const { createWebpackConfigAsync } = require('expo-yarn-workspaces/webpack');
// yarn workspace @onekeyhq/ext expo start:web
// WEB_PORT=3030 yarn workspace @onekeyhq/ext expo start --web
module.exports = async function (env1, argv) {
  const config = await createWebpackConfigAsync(env1, argv);
  return config;
};
