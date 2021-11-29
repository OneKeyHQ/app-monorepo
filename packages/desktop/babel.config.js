module.exports = {
  presets: ['@expo/next-adapter/babel'],
  plugins: [
    [
      'babel-plugin-inline-import',
      {
        'extensions': ['.text-js'],
      },
    ],
    '@babel/plugin-proposal-class-properties',
  ],
};
