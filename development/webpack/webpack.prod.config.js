const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'production',
  devtool: false,
  output: {
    clean: true,
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          keep_fnames: /^forModalPresentationIOS$/,
        },
      }),
    ],
    splitChunks: {
      chunks: 'all',
      minSize: 102400,
      maxSize: 4194304,
      hidePathInfo: true,
      automaticNameDelimiter: '.',
      name: false,
      maxInitialRequests: 20,
      maxAsyncRequests: 50000,
      cacheGroups: {},
    },
  },
};
