require('./env');
const path = require('path');
const developmentConsts = require('./developmentConsts');
const envExposedToClient = require('./envExposedToClient');

function fullPath(pathStr) {
  return path.resolve(__dirname, pathStr);
}

const moduleResolverAliasForAllWebPlatform = {
  // * cause firefox popup resize issue
  'react-native-restart': fullPath(
    './module-resolver/react-native-restart-mock',
  ),
  'react-native-fast-image': fullPath(
    './module-resolver/react-native-fast-image-mock',
  ),
  'react-native-keyboard-manager': fullPath(
    './module-resolver/react-native-keyboard-manager-mock',
  ),
};

function normalizeConfig({ platform, config }) {
  process.env.ONEKEY_PLATFORM = platform;
  let moduleResolver = null;
  if (platform === developmentConsts.platforms.ext) {
    moduleResolver = {
      alias: {
        ...moduleResolverAliasForAllWebPlatform,
        ...(developmentConsts.isManifestV3
          ? {
              'filecoin.js': fullPath(
                './module-resolver/filecoin.js/index.ext-bg-v3.js',
              ),
            }
          : {}),
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
  if (platform === developmentConsts.platforms.webEmbed) {
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
        '@ipld/dag-cbor': '@ipld/dag-cbor/dist/index.min.js',
        'multiformats/basics': 'multiformats/basics',
        'multiformats/cid': 'multiformats/cid',
        'multiformats/hashes': 'multiformats/hashes',
        'multiformats': 'multiformats/index.js',
      },
    };
  }
  const {
    isJest,
    isDev,
    isE2E,
    isProduction,
    isWeb,
    isWebEmbed,
    isDesktop,
    isExtension,
    isNative,
    isExtChrome,
    isExtFirefox,
  } = require('../packages/shared/src/buildTimeEnv');

  config.plugins = [
    ...(config.plugins || []),
    [
      // Expose env variable to app client-side code, so you can access it like `process.env.XXXXX`
      'transform-inline-environment-variables',
      {
        // *** ATTENTION: DO NOT expose any sensitive variable here ***
        // ***        like password, secretKey, etc.                ***
        'include': [
          ...envExposedToClient.buildEnvExposedToClientDangerously({
            platform,
          }),
        ],
      },
    ],
    [
      'transform-define',
      {
        // override runtime env with buildtime env
        // so it can do more tree shaking
        'platformEnv.isJest': isJest,
        'platformEnv.isDev': isDev,
        'platformEnv.isE2E': isE2E,
        'platformEnv.isProduction': isProduction,
        'platformEnv.isWeb': isWeb,
        'platformEnv.isWebEmbed': isWebEmbed,
        'platformEnv.isDesktop': isDesktop,
        'platformEnv.isExtension': isExtension,
        'platformEnv.isNative': isNative,
        'platformEnv.isExtChrome': isExtChrome,
        'platformEnv.isExtFirefox': isExtFirefox,
      },
    ],
    /*
    support lodash import in Ext background like this:
      import { isFunction } from 'lodash';

    error in ui:
       Unchecked runtime.lastError: Could not establish connection. Receiving end does not exist.
    and background code will never be executed.
     */
    // ['babel-plugin-lodash'],
    [
      'babel-plugin-import',
      {
        'libraryName': 'lodash',
        'libraryDirectory': '',
        'camel2DashComponentName': false, // default: true
      },
      'lodash',
    ],
    [
      'babel-plugin-inline-import',
      {
        'extensions': ['.text-js'],
      },
    ],
    /* FIX:
       TypeError: undefined is not an object. (evaluating 'this._callListeners.bind')
       And Don't remove any plugin here, it will cause other error.
        https://github.com/facebook/react-native/issues/36828
     */
    ['@babel/plugin-transform-flow-strip-types'],
    ['@babel/plugin-proposal-decorators', { 'legacy': true }],
    ['@babel/plugin-proposal-class-properties', { 'loose': true }],
    ['@babel/plugin-proposal-private-methods', { 'loose': true }],
    ['@babel/plugin-proposal-private-property-in-object', { 'loose': true }],
    ['@babel/plugin-proposal-export-namespace-from'],
    ['@babel/plugin-proposal-nullish-coalescing-operator'],
    ['@babel/plugin-proposal-class-static-block'],
    isDev && !isJest && !isNative && ['react-refresh/babel'],
    // isDev && [
    //   'babel-plugin-catch-logger',
    //   {
    //     source: '@onekeyhq/shared/src/logger/autoLogger',
    //     name: 'autoLogger',
    //     methodName: 'error',
    //     catchPromise: false,
    //     namespaced: false,
    //   },
    // ],
    moduleResolver && ['module-resolver', moduleResolver],
  ].filter(Boolean);
  // console.log('babelToolsConfig > moduleResolver: ', moduleResolver);

  // https://babeljs.io/docs/en/options#no-targets
  if (!config.targets) {
    config.targets = 'defaults';
  }

  // https://babeljs.io/docs/en/assumptions
  config.assumptions = {
    noDocumentAll: true,
    noClassCalls: true,
    noIncompleteNsImportDetection: true,
    noNewArrows: true,
    setClassMethods: true,
    setComputedProperties: true,
  };

  return config;
}

module.exports = {
  developmentConsts,
  normalizeConfig,
};
