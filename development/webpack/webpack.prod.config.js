
module.exports = {
  mode: 'production',
  devtool: false,
  output: {
    clean: true,
  },
  optimization: {
    'splitChunks': {
      'chunks': 'all',
      'minSize': 102400,
      'maxSize': 4194304,
      'hidePathInfo': true,
      'automaticNameDelimiter': '.',
      'name': false,
      'maxInitialRequests': 20,
      'maxAsyncRequests': 50000,
      'cacheGroups': {},
    },
  },
};
