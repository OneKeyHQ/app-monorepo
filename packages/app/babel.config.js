module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@onekeyhq/connect': './src/public/static/connect/index.js',
          },
        },
      ],
    ],
  };
};
