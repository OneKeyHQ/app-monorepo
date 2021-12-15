const { withExpo } = require('@expo/next-adapter');
const withPlugins = require('next-compose-plugins');
const { PHASE_DEVELOPMENT_SERVER, PHASE_EXPORT } = require('next/constants');
const lodash = require('lodash');
const withTM = require('./withTM');
const resolveExtensions = require('./resolveExtensions');

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
  // webpack:() => config
};

function nextWebpack(
  webpackConfig,
  { transpileModules = [], debug = false, projectRoot },
) {
  const nextWithTM = withTM([...transpileModules], {
    resolveSymlinks: true,
    debug,
  });

  const createNextConfig = withPlugins(
    [
      /* support node_modules building
      test: /\.+(js|jsx|mjs|ts|tsx)$/,
      test: /\.(png|jpg|jpeg|gif|webp|ico|bmp|svg)$/i,
       */
      nextWithTM,
      /* support react-native web building
      test: /\.html$/,
      test: /\.(mjs|[jt]sx?)$/,
       */
      [withExpo, { projectRoot }],
    ],
    nextConfig,
  );

  // PHASE_DEVELOPMENT_SERVER PHASE_EXPORT
  nextConfig = createNextConfig(PHASE_EXPORT, {
    defaultConfig: nextConfig,
  });

  // eslint-disable-next-line no-param-reassign
  webpackConfig = nextConfig.webpack(webpackConfig, nextOptions);
  webpackConfig.resolve.extensions = lodash.uniq(
    webpackConfig.resolve.extensions.concat(resolveExtensions),
  );
  return webpackConfig;
}

module.exports = nextWebpack;
