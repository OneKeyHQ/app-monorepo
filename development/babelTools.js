require('./env');
const path = require('path');

const developmentConsts = require('./developmentConsts');
const envExposedToClient = require('./envExposedToClient');
const { buildPlatformEnvDefineMap } = require('./platformEnvDefine');

function fullPath(pathStr) {
  return path.resolve(__dirname, pathStr);
}

const moduleResolverAliasForAllWebPlatform = {
  'react-native-fast-image': fullPath(
    './module-resolver/react-native-fast-image-mock',
  ),
  'react-native-keyboard-controller': fullPath(
    './module-resolver/react-native-keyboard-controller-mock',
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
  const buildTimeEnv = require('../packages/shared/src/buildTimeEnv');
  // Only the flags used directly below are destructured; the platformEnv.*
  // transform-define map reads the rest from buildTimeEnv via
  // buildPlatformEnvDefineMap (single source of truth in platformEnvDefine.js).
  const { isJest, isDev, isNative, enablePerfMonitor } = buildTimeEnv;

  config.plugins = [
    ...(config.plugins || []),
    !isJest && ['@sentry/babel-plugin-component-annotate'],
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
    // Skip transform-define in harness mode so platformEnv properties remain
    // as runtime accesses (allowing tests to mock platform values).
    process.env.RN_HARNESS !== 'true' && [
      'transform-define',
      // override runtime env with buildtime env so it can do more tree shaking.
      // Single source of truth shared with the rspack web build — see
      // development/platformEnvDefine.js.
      buildPlatformEnvDefineMap(buildTimeEnv),
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
    enablePerfMonitor && [fullPath('./babel-plugins/rn-heartbeat')],
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
    ['@babel/plugin-proposal-nullish-coalescing-operator'],
    ['@babel/plugin-proposal-class-static-block'],
    [
      developmentConsts.platforms.web,
      developmentConsts.platforms.webEmbed,
    ].includes(platform) && ['@babel/plugin-transform-optional-chaining'],
    [
      developmentConsts.platforms.web,
      developmentConsts.platforms.webEmbed,
    ].includes(platform) && ['@babel/plugin-transform-numeric-separator'],
    isDev && !isJest && !isNative && ['react-refresh/babel'],
    // Need to adapt to the new version of the metro build system.
    isDev &&
      !isJest &&
      !isNative && [
        'babel-plugin-catch-logger',
        {
          source: '@onekeyhq/shared/src/logger/autoLogger',
          name: 'autoLogger',
          methodName: 'error',
          catchPromise: false,
          namespaced: false,
        },
      ],
    !isDev && !isJest && ['babel-plugin-transform-remove-console'],
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
