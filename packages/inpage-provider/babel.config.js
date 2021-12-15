module.exports = {
  presets: [
    ['@expo/next-adapter/babel'],
    // [
    //   '@babel/preset-env',
    //   // {
    //   //   'targets': {
    //   //     'browsers': 'last 2 versions',
    //   //   },
    //   //   'modules': false,
    //   //   'loose': false,
    //   // },
    // ],
    // '@babel/preset-react',
    // '@babel/preset-typescript',
  ],
  plugins: [
    ['@babel/plugin-proposal-private-methods', { 'loose': true }],
    ['@babel/plugin-proposal-class-properties', { 'loose': true }],
    ['@babel/plugin-proposal-private-property-in-object', { 'loose': true }],
  ],
};
