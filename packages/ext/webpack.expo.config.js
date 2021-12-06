const { createWebpackConfigAsync } = require('expo-yarn-workspaces/webpack');

// yarn workspace @onekeyhq/ext expo start:web
module.exports = async function (env1, argv) {
  const config = await createWebpackConfigAsync(env1, argv);
  console.log('----------- config', config);
  console.log('----------- config.module.rules', config.module.rules);
  return config;
};
