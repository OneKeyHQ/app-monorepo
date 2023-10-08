const { withExpo } = require('@expo/next-adapter');
const withPlugins = require('next-compose-plugins');
const { PHASE_EXPORT } = require('next/constants');
const withTM = require('./withTM');

function nextWebpack(
  webpackConfig,
  { transpileModules = [], debug = false, projectRoot },
) {
  const nextOptions = {
    isServer: false,
    defaultLoaders: {
      babel: {
        loader: 'babel-loader',
      },
    },
  };
  let nextConfig = {
    // always should be true even if webpack4
    webpack5: true,
    webpack: (config, { isServer }) => {
      // Fixes npm packages that depend on `fs` module
      if (!isServer) {
        config.resolve = config.resolve || {};
        config.resolve.fallback = {
          ...config.resolve.fallback,
          'crypto': require.resolve(
            '@onekeyhq/shared/src/modules3rdParty/cross-crypto/index.js',
          ),
          'stream': require.resolve('stream-browserify'),
          'path': false,
          'https': false,
          'http': false,
          'net': false,
          'zlib': false,
          'tls': false,
          'child_process': false,
          'process': false,
          'fs': false,
          'util': false,
          'os': false,
          'buffer': require.resolve('buffer/'),
        };
        return config;
      }
    },
    // webpack:() => config
  };
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
      // ----------------------------------------------
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

  return webpackConfig;
}

module.exports = nextWebpack;
