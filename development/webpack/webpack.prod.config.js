const { EsbuildPlugin } = require('esbuild-loader');

module.exports = {
  mode: 'production',
  output: {
    clean: true,
  },
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
