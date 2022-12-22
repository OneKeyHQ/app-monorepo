require('./env');
const path = require('path');
const developmentConsts = require('./developmentConsts');

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
        '@onekeyfe/js-sdk': fullPath(
          '../node_modules/@onekeyfe/js-sdk/dist/js-sdk-native',
        ),
        // 'bn.js': fullPath('../node_modules/react-native-bignumber'),
        // 'buffer': fullPath('../node_modules/@craftzdog/react-native-buffer'),
        // 'base64-js': fullPath('../node_modules/react-native-quick-base64'),
      },
    };
  }

  const transformInlineEnviromentVariables = [
    'NODE_ENV',
    'VERSION',
    'BUILD_NUMBER',
    'ONEKEY_PLATFORM',
    'EXT_CHANNEL',
    'ANDROID_CHANNEL',
    'COVALENT_KEY',
    'MOONPAY_KEY',
    'HARDWARE_SDK_CONNECT_SRC',
    'GITHUB_SHA',
  ];

  if (platform === developmentConsts.platforms.app) {
    transformInlineEnviromentVariables.push('JPUSH_KEY');
  }

  config.plugins = [
    ...(config.plugins || []),
    [
      // Expose env variable to app client-side code, so you can access it like `process.env.XXXXX`
      'transform-inline-environment-variables',
      {
        // *** ATTENTION: DO NOT expose any sensitive variable here ***
        // ***        like password, secretKey, etc.                ***
        'include': transformInlineEnviromentVariables,
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
    ['@babel/plugin-proposal-export-namespace-from'],
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
