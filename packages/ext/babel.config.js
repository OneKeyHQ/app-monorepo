module.exports = {
  presets: ['@expo/next-adapter/babel'],
  plugins: [
    [
      'babel-plugin-inline-import',
      {
        'extensions': ['.text-js'],
      },
    ],
    ['@babel/plugin-proposal-private-methods', { 'loose': true }],
    ['@babel/plugin-proposal-class-properties', { 'loose': true }],
    ['@babel/plugin-proposal-private-property-in-object', { 'loose': true }],
  ],
};
