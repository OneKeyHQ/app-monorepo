const { merge, mergeWithRules, CustomizeRule } = require('webpack-merge');
const path = require('path');
const webpack = require('webpack');

const baseConfig = require('./webpack.base.config');
const analyzerConfig = require('./webpack.analyzer.config');
const developmentConfig = require('./webpack.development.config');
const productionConfig = require('./webpack.prod.config');
const babelTools = require('../babelTools');
const {
  WEB_PORT,
  isManifestV3,
  isDev,
  isManifestV2,
  ENABLE_ANALYZER,
} = require('./constant');
const devUtils = require('./ext/devUtils');
const utils = require('./utils');
const codeSplit = require('./ext/codeSplit');
const pluginsHtml = require('./ext/pluginsHtml');
const pluginsCopy = require('./ext/pluginsCopy');
const ChromeExtensionV3ViolationPlugin = require('./ext/ChromeExtensionV3ViolationPlugin');
// const htmlLazyScript = require('./ext/htmlLazyScript');

const IS_DEV = isDev;

const chromeExtensionV3ViolationPlugin = new ChromeExtensionV3ViolationPlugin([
  // @sentry/react
  {
    regexToFind: /https:\/\/browser\.sentry-cdn\.com/g,
    replacement: '',
  },
  // @privy-io/react-auth
  {
    regexToFind: /https:\/\/svelte-stripe-js\.vercel\.app/g,
    replacement: '',
  },
  // @privy-io/react-auth
  {
    regexToFind: /r\.src=`\${n}\/js\/telegram-login\.js`/g,
    replacement: 'r.src=``',
  },
  // @privy-io/react-auth
  {
    regexToFind: /g\.src=`\${v}\/js\/telegram-login\.js`/g,
    replacement: 'g.src=``',
  },
  // maps.googleapis.com
  {
    regexToFind: /https:\/\/maps\.googleapis\.com\/maps\/api\/js/g,
    replacement: '',
  },
  // js.stripe.com
  {
    regexToFind: /\.p="https:\/\/js\.stripe\.com\/v3\/"/g,
    replacement: '.p=""',
  },
]);

module.exports = ({
  basePath,
  platform = babelTools.developmentConsts.platforms.ext,
}) => {
  const extConfig = ({ name }) => ({
    optimization: {
      splitChunks: {
        chunks: 'all',
        minSize: 102_400,
        maxSize: 4_194_304,
        hidePathInfo: true,
        automaticNameDelimiter: '.',
        name: false,
        maxInitialRequests: 20,
        maxAsyncRequests: 50_000,
        cacheGroups: {},
      },
    },
    plugins: baseConfig.basePlugins,
    output: {
      clean: false,
      path: path.resolve(basePath, 'build', utils.getOutputFolder()),
      // do not include [hash] here, as `content-script.bundle.js` filename should be stable
      filename: '[name].bundle.js',
      chunkFilename: isDev
        ? `${name}.[name].chunk.js`
        : `${name}.[name]-[chunkhash:6].chunk.js`,
      publicPath: '/',
      globalObject: 'this', // FIX: window is not defined in service-worker background
    },
    devServer: {
      open: false,
      devMiddleware: {
        publicPath: `http://localhost:${WEB_PORT}/`,
        writeToDisk: true,
      },
      client: {
        webSocketURL: {
          hostname: 'localhost',
          pathname: '/ws',
          port: WEB_PORT,
          protocol: 'ws',
        },
      },
    },
  });
  const extConfigs = ({ name }) =>
    ENABLE_ANALYZER
      ? [
          extConfig({ name }),
          analyzerConfig({ configName: [platform, name].join('-') }),
        ]
      : [extConfig({ name })];

  const multipleEntryConfigs = [
    // **** ui build (always code-split)
    {
      config: {
        name: devUtils.consts.configName.ui,
        entry: {
          [devUtils.consts.entry['ui-popup']]: path.join(
            basePath,
            'src/entry/ui-popup.tsx',
          ),
          ...(isManifestV3
            ? {}
            : {
                // [devUtils.consts.entry.background]: path.join(basePath, 'src/entry/background.ts'),
              }),
        },
      },
      configUpdater(config) {
        if (isManifestV2) {
          codeSplit.enableCodeSplitChunks({
            config,
          });
        } else {
          codeSplit.enableCodeSplitChunks({
            config,
          });
        }
        config.plugins = [
          ...config.plugins,
          ...pluginsHtml.uiHtml,
          chromeExtensionV3ViolationPlugin,
          // ...(isManifestV3 ? [] : pluginsHtml.backgroundHtml),
        ].filter(Boolean);
        return config;
      },
    },

    // **** passkey standalone entry build without code-split
    {
      config: {
        name: devUtils.consts.configName.passkey,
        entry: {
          [devUtils.consts.entry['ui-passkey']]: path.join(
            basePath,
            'src/entry/ui-passkey.tsx',
          ),
        },
      },
      configUpdater(config) {
        if (isManifestV2) {
          codeSplit.enableCodeSplitChunks({
            config,
          });
        } else {
          codeSplit.enableCodeSplitChunks({
            config,
          });
        }
        config.plugins = [
          ...config.plugins,
          ...pluginsHtml.passkeyHtml,
          chromeExtensionV3ViolationPlugin,
        ].filter(Boolean);
        return config;
      },
    },

    // **** manifest v3 background standalone build without code-split
    (isManifestV3 || isManifestV2) && {
      config: {
        name: devUtils.consts.configName.bg,
        dependencies: [devUtils.consts.configName.ui],
        entry: {
          [devUtils.consts.entry.background]: path.join(
            basePath,
            'src/entry/background.ts',
          ),
        },
      },
      configUpdater(config) {
        if (isManifestV2) {
          codeSplit.enableCodeSplitChunks({
            config,
          });
        } else {
          // manifest v3 background can NOT split code
          codeSplit.disableCodeSplitChunks({
            config,
          });
        }

        config.plugins = [
          ...config.plugins,
          ...pluginsHtml.backgroundHtml,
          new webpack.ProvidePlugin({
            process: 'process/browser',
          }),
          chromeExtensionV3ViolationPlugin,
          // new htmlLazyScript.HtmlLazyScriptPlugin(config),
        ].filter(Boolean);
        return config;
      },
    },

    // **** manifest v3 offscreen standalone build
    isManifestV3 && {
      config: {
        name: devUtils.consts.configName.offscreen,
        entry: {
          [devUtils.consts.entry.offscreen]: path.join(
            basePath,
            'src/entry/offscreen.ts',
          ),
        },
        dependencies: [
          devUtils.consts.configName.ui,
          devUtils.consts.configName.bg,
        ],
      },
      configUpdater(config) {
        codeSplit.enableCodeSplitChunks({
          config,
        });

        config.plugins = [
          ...config.plugins,
          ...pluginsHtml.offscreenHtml,
          chromeExtensionV3ViolationPlugin,
        ].filter(Boolean);

        return config;
      },
    },

    // **** content-script build (do NOT code-split)
    {
      config: {
        name: devUtils.consts.configName.cs,
        dependencies: isManifestV3
          ? [
              devUtils.consts.configName.ui,
              devUtils.consts.configName.bg,
              devUtils.consts.configName.offscreen,
            ]
          : [devUtils.consts.configName.ui, devUtils.consts.configName.bg],
        entry: {
          [devUtils.consts.entry['content-script']]: path.join(
            basePath,
            'src/entry/content-script.ts',
          ),
        },
      },
      configUpdater(config) {
        // content-script can NOT split code
        codeSplit.disableCodeSplitChunks({
          config,
        });
        config.plugins = [
          ...config.plugins,
          ...pluginsCopy,
          chromeExtensionV3ViolationPlugin,
        ].filter(Boolean);
        return config;
      },
    },
  ].filter(Boolean);

  const entryConfigs = devUtils.createMultipleEntryConfigs(
    ({ config }) =>
      mergeWithRules({
        plugins: CustomizeRule.Replace,
      })(
        baseConfig({ platform, basePath, configName: config.name }),
        merge(
          IS_DEV
            ? developmentConfig({ platform, basePath })
            : productionConfig({ platform, basePath }),
          ...extConfigs({ name: config.name }),
          config,
        ),
      ),
    multipleEntryConfigs,
  );

  // remove devServer from all but the first entry
  for (let index = 1; index < entryConfigs.length; index += 1) {
    delete entryConfigs[index].devServer;
  }
  return entryConfigs;
};
