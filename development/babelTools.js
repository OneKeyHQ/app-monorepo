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
  const customAliasForComponents = (name, file) => {
    // const filename = file.opts.filename;
    if (name.startsWith('use')) {
      return `@onekeyhq/components/src/Provider/hooks/${name}`;
    }
    return `@onekeyhq/components/src/${name}`;
  };

  config.plugins = [
    ...(config.plugins || []),
    [
      // Expose env variable to app client-side code, so you can access it like `process.env.XXXXX`
      'transform-inline-environment-variables',
      {
        // *** ATTENTION: DO NOT expose any sensitive variable here ***
        // ***        like password, secretKey, etc.                ***
        'include': envExposedToClient.buildEnvExposedToClientDangerously({
          platform,
        }),
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
      'babel-plugin-import',
      {
        'libraryName': '@onekeyhq/components',
        'camel2DashComponentName': false, // default: true
        'customName': customAliasForComponents,
      },
      '@onekeyhq_components',
    ],
    [
      'babel-plugin-import',
      {
        'libraryName': '@onekeyhq/components/src',
        'camel2DashComponentName': false, // default: true
        'customName': customAliasForComponents,
      },
      '@onekeyhq_components_src',
    ],
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
    ['@babel/plugin-proposal-export-namespace-from'],
    ['@babel/plugin-proposal-nullish-coalescing-operator'],
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
