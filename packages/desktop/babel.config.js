module.exports = {
  presets: ['@expo/next-adapter/babel'],
  plugins: [
    [
      'inline-import',
      {
        'extensions': ['.text-js'],
      },
    ],
    '@babel/plugin-proposal-class-properties',
  ],
};
