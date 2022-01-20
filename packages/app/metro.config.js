const { createMetroConfiguration } = require('expo-yarn-workspaces');

const config = createMetroConfiguration(__dirname);

// hot-reload file type
config.resolver.sourceExts = [...config.resolver.sourceExts, 'text-js', 'd.ts'];

module.exports = config;
