const webpack = require('webpack');
const path = require('path');
const fileSystem = require('fs-extra');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { withExpo } = require('@expo/next-adapter');
const withPlugins = require('next-compose-plugins');
const { PHASE_DEVELOPMENT_SERVER, PHASE_EXPORT } = require('next/constants');
const env = require('./development/env');
const pluginsHtml = require('./development/pluginsHtml');
const pluginsCopy = require('./development/pluginsCopy');

const ASSET_PATH = process.env.ASSET_PATH || '/';

const alias = {
  'react-dom': '@hot-loader/react-dom',
};

// load the secrets
const secretsPath = path.join(__dirname, `secrets.${env.NODE_ENV}.js`);

const fileExtensions = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'eot',
  'otf',
  'svg',
  'ttf',
  'woff',
  'woff2',
];

if (fileSystem.existsSync(secretsPath)) {
  alias.secrets = secretsPath;
}

const IS_DEV = process.env.NODE_ENV !== 'production';

let webpackConfig = {
  mode: IS_DEV ? 'development' : 'production', // development, production
  // mode: 'development',
  entry: {
    background: path.join(__dirname, 'src/entry/background.ts'),
    'content-script': path.join(__dirname, 'src/entry/content-script.ts'),
    'ui-popup': path.join(__dirname, 'src/entry/ui-popup.ts'),
    // 'ui-options': path.join(__dirname, 'src/entry/ui-options.ts'),
    // 'ui-newtab': path.join(__dirname, 'src/entry/ui-newtab.ts'),
    // 'ui-devtools': path.join(__dirname, 'src/entry/ui-devtools.ts'),
    // 'ui-devtools-panel': path.join(__dirname, 'src/entry/ui-devtools-panel.ts'),
  },
  chromeExtensionBoilerplate: {
    notHotReload: ['content-script', 'ui-devtools'],
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'js/[name].bundle.js',
    clean: true,
    publicPath: ASSET_PATH,
  },
  module: {
    rules: [
      {
        // project/html-loader
        test: /\.shtml$/,
        use: { loader: 'html-loader' },
        exclude: /node_modules/,
      },
      {
        // project/css-loader
        // look for .css or .scss files
        test: /\.(css|scss)$/,
        // in the `src` directory
        use: [
          {
            loader: 'style-loader',
          },
          {
            loader: 'css-loader',
          },
          {
            loader: 'sass-loader',
            options: {
              sourceMap: IS_DEV,
            },
          },
        ],
      },
      // {
      //   test: new RegExp(`.(${fileExtensions.join('|')})$`),
      //   loader: 'file-loader',
      //   options: {
      //     name: '[name].[ext]',
      //   },
      //   exclude: /node_modules/,
      // },
      // {
      //   test: /\.(png|jpg|jpeg|gif|webp|ico|bmp|svg)$/i,
      //   loader: 'next-image-loader',
      //   issuer: { not: /\.(css|scss|sass)(\.webpack\[javascript\/auto\])?$/ },
      //   // dependency: { not: [Array] },
      //   options: { isServer: false, isDev: true, assetPrefix: '' },
      // },
    ],
  },
  resolve: {
    alias,
    extensions: fileExtensions
      .map((extension) => `.${extension}`)
      .concat(['.js', '.jsx', '.ts', '.tsx', '.css']),
  },
  plugins: [
    new webpack.ProgressPlugin(),
    // expose and write the allowed env vars on the compiled bundle
    new webpack.EnvironmentPlugin(['NODE_ENV']),
    ...pluginsCopy,
    ...pluginsHtml,
  ],
  infrastructureLogging: {
    level: 'info',
  },
};

if (env.NODE_ENV === 'development') {
  webpackConfig.devtool = 'cheap-module-source-map';
} else {
  webpackConfig.optimization = {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      }),
    ],
  };
}

const nextOptions = {
  isServer: false,
  defaultLoaders: {
    babel: {
      loader: 'babel-loader',
    },
  },
};
let nextConfig = {
  webpack5: true,
  // webpack:()=>config
};

const nextWithTM = require('./development/withTM')(
  ['@onekeyhq/components', '@onekeyhq/kit', '@onekeyhq/inpage-provider'],
  { resolveSymlinks: true, debug: false },
);

const createNextConfig = withPlugins(
  [
    /*
    test: /\.+(js|jsx|mjs|ts|tsx)$/,
    test: /\.(png|jpg|jpeg|gif|webp|ico|bmp|svg)$/i,
     */
    nextWithTM,
    /*
    test: /\.html$/,
    test: /\.(mjs|[jt]sx?)$/,
     */
    [withExpo, { projectRoot: __dirname }],
  ],
  nextConfig,
);

// PHASE_DEVELOPMENT_SERVER PHASE_EXPORT
nextConfig = createNextConfig(PHASE_EXPORT, {
  defaultConfig: nextConfig,
});

webpackConfig = nextConfig.webpack(webpackConfig, nextOptions);

console.log('------- webpackConfig', webpackConfig.module.rules);
console.log('------- webpackConfig', {
  devtool: webpackConfig.devtool,
});
// process.exit(1);

// Reset sourcemap here, withExpo will change this value
//    only inline-source-map supported in extension
// TODO external file sourcemap
if (IS_DEV) {
  webpackConfig.devtool = 'inline-source-map';
}

module.exports = webpackConfig;
