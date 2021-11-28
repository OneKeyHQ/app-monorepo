const { createMetroConfiguration } = require('expo-yarn-workspaces');

const config = createMetroConfiguration(__dirname);

// hot-reload file type
config.resolver.sourceExts = [...config.resolver.sourceExts, 'text-js'];
// support babel.config.js
// config.transformer.enableBabelRCLookup = false;

console.log('metro.config.js : ', config);

module.exports = config;
