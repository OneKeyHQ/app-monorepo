const { EsbuildPlugin } = require('esbuild-loader');

module.exports = {
  mode: 'production',
  optimization: {
    minimizer: [
      new EsbuildPlugin({
        legalComments: 'none',
        minifyWhitespace: true,
        target: 'es2022',
      }),
    ],
  },
};
