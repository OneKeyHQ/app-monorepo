const { getDefaultConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname, { isCSSEnabled: true });

if (process.env.STORYBOOK_ENABLED) {
  const path = require('path');
  const { writeRequires } = require('@storybook/react-native/scripts/loader');

  writeRequires({
    configPath: path.resolve(__dirname, './.ondevice'),
    unstable_useRequireContext: true,
  });

  defaultConfig.resolver.resolverMainFields = [
    'sbmodern',
    ...defaultConfig.resolver.resolverMainFields,
  ];
}

defaultConfig.resolver.sourceExts.push('mjs');

defaultConfig.transformer.unstable_allowRequireContext = true;

module.exports = defaultConfig;
