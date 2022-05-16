require('./env');
const path = require('path');
const developmentConsts = require('./developmentConsts');

function fullPath(pathStr) {
  return path.resolve(__dirname, pathStr);
}

const moduleResolverAliasForAllWebPlatform = {
  // * remote connection disallowed in ext
  'console-feed': fullPath('./module-resolver/console-feed-mock'),
  // * cause firefox popup resize issue
  'react-native-restart': fullPath(
    './module-resolver/react-native-restart-mock',
  ),
  'react-native-fast-image': fullPath(
    './module-resolver/react-native-fast-image-mock',
  ),
};

function normalizeConfig({ platform, config }) {
  process.env.PLATFORM_NAME = platform;
  let moduleResolver = null;
  if (platform === developmentConsts.platforms.ext) {
    moduleResolver = {
      alias: {
        ...moduleResolverAliasForAllWebPlatform,
      },
    };
  }
  if (platform === developmentConsts.platforms.web) {
    moduleResolver = {
      alias: {
        ...moduleResolverAliasForAllWebPlatform,
      },
    };
  }
  if (platform === developmentConsts.platforms.desktop) {
    moduleResolver = {
      alias: {
        ...moduleResolverAliasForAllWebPlatform,
      },
    };
  }
  if (platform === developmentConsts.platforms.app) {
    moduleResolver = {
      alias: {
        '@onekeyfe/js-sdk': fullPath(
          '../node_modules/@onekeyfe/js-sdk/dist/js-sdk-native',
        ),
      },
    };
  }

  config.plugins = [
    ...(config.plugins || []),
    [
      // Expose env variable to app client-side code, so you can access it like `process.env.XXXXX`
      'transform-inline-environment-variables',
      {
        // *** ATTENTION: DO NOT expose any sensitive variable here ***
        // ***        like password, secretKey, etc.                ***
        'include': [
          'NODE_ENV',
          'REMOTE_CONSOLE_SERVER',
          'VERSION',
          'BUILD_NUMBER',
          'PLATFORM_NAME',
          'OPENSEA_KEY',
          'COVALENT_KEY',
        ],
      },
    ],
    /*
    support lodash import in Ext background like this:
      import { isFunction } from 'lodash';

    error in ui:
       Unchecked runtime.lastError: Could not establish connection. Receiving end does not exist.
    and background code will never be executed.
     */
    ['babel-plugin-lodash'],
    [
      'babel-plugin-inline-import',
      {
        'extensions': ['.text-js'],
      },
    ],
    /* FIX:
       TypeError: undefiend is not an object (evaluating 'this._callListeners.bind')
     */
    ['@babel/plugin-transform-flow-strip-types'],
    ['@babel/plugin-proposal-decorators', { 'legacy': true }],
    ['@babel/plugin-proposal-class-properties', { 'loose': true }],
    ['@babel/plugin-proposal-private-methods', { 'loose': true }],
    ['@babel/plugin-proposal-private-property-in-object', { 'loose': true }],
    moduleResolver && ['module-resolver', moduleResolver],
  ].filter(Boolean);

  console.log('babelToolsConfig > moduleResolver: ', moduleResolver);

  return config;
}

module.exports = {
  developmentConsts,
  normalizeConfig,
};
