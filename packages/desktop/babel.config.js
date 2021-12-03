module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxRuntime: 'automatic' }]],
    plugins: [
      ['@babel/plugin-proposal-private-methods', { 'loose': true }],
      ['@babel/plugin-proposal-class-properties', { 'loose': true }],
      ['@babel/plugin-proposal-private-property-in-object', { 'loose': true }],
    ],
  };
};
