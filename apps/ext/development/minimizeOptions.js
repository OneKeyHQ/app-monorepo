const TerserPlugin = require('terser-webpack-plugin');

function buildMinimizeOptions() {
  return {
    minimize: true,
    minimizer: [
      // https://github.com/webpack-contrib/terser-webpack-plugin#options
      new TerserPlugin({
        extractComments: false,
        terserOptions: {
          // https://github.com/terser/terser#format-options
          format: {
            comments: false,
          },
          // https://github.com/terser/terser#compress-options
          compress: {
            drop_console: true,
            drop_debugger: true,
          },
        },
      }),
    ],
  };
}

module.exports = {
  buildMinimizeOptions,
};
