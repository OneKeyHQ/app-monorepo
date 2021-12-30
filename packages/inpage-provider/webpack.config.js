const path = require('path');
const webpack = require('webpack');
const packageJson = require('./package.json');

// TODO building components WebView
// https://github.com/expo/expo-cli/blob/master/packages/next-adapter/src/withExpo.ts

module.exports = {
  mode: 'production', // development, production
  entry: {
    main: './src/index.tsx',
  },
  output: {
    library: {
      // Fix: "Uncaught ReferenceError: exports is not defined".
      type: 'umd',
    },
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.d.ts'],
  },
  module: {
    rules: [
      {
        test: /\.text-(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        use: ['raw-loader'],
      },
      {
        test: /\.(js|jsx|ts|tsx)$/,
        // exclude: /node_modules/,
        exclude: [/node_modules/, /\.text\.(js|jsx|ts|tsx)$/],
        use: ['babel-loader'],
      },
      // {
      //   test: /\.(ts|tsx)$/,
      //   exclude: /node_modules/,
      //   use: ['ts-loader'],
      // },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.VERSION': JSON.stringify(packageJson.version),
    }),
  ],
};
