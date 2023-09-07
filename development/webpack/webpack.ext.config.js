const { mergeWithRules, CustomizeRule } = require('webpack-merge');
const path = require('path');
const webpack = require('webpack');
const WebpackBar = require('webpackbar');

const baseConfig = require('./webpack.base.config');
const analyzerConfig = require('./webpack.analyzer.config');
const developmentConfig = require('./webpack.development.config');
const productionConfig = require('./webpack.prod.config');
const babelTools = require('../babelTools');
const { WEB_PORT } = require('./constant');
const devUtils = require('../../packages/ext/development/devUtils');
const codeSplit = require('../../packages/ext/development/codeSplit');
const pluginsHtml = require('../../packages/ext/development/pluginsHtml');
const pluginsCopy = require('../../packages/ext/development/pluginsCopy');
const htmlLazyScript = require('../../packages/ext/development/htmlLazyScript');

const {
  ENABLE_ANALYZER = false,
  NODE_ENV = 'development',
  EXT_MANIFEST_V3 = false,
} = process.env;

const isManifestV3 = !!EXT_MANIFEST_V3;
const isManifestV2 = !isManifestV3;
function getBuildTargetBrowser() {
  let buildTargetBrowser = process.env.EXT_CHANNEL || 'chrome';
  const argv = process.argv[process.argv.length - 1];
  if (argv === '--firefox') {
    buildTargetBrowser = 'firefox';
  }
  if (argv === '--chrome') {
    buildTargetBrowser = 'chrome';
  }
  if (argv === '--edge') {
    buildTargetBrowser = 'edge';
  }
  process.env.EXT_CHANNEL = buildTargetBrowser;
  return buildTargetBrowser;
}

const IS_DEV = NODE_ENV !== 'production';

function getOutputFolder() {
  // isManifestV3 ? `${buildTargetBrowser}_v3` : buildTargetBrowser,
  const buildTargetBrowser = getBuildTargetBrowser();
  return isManifestV3 ? `${buildTargetBrowser}_v3` : buildTargetBrowser;
}

module.exports = ({
  basePath,
  platform = babelTools.developmentConsts.platforms.ext,
}) => {
  const buildTargetBrowser = getBuildTargetBrowser();
  const extConfig = ({ name }) => ({
    optimization: {
      splitChunks: {
        chunks: 'all',
        minSize: 102400,
        maxSize: 4194304,
        hidePathInfo: true,
        automaticNameDelimiter: '.',
        name: false,
        maxInitialRequests: 20,
        maxAsyncRequests: 50000,
        cacheGroups: {},
      },
    },
    plugins: baseConfig.basePlugins({ platform }),
    output: {
      clean: false,
      path: path.resolve(basePath, 'build', getOutputFolder()),
      // do not include [hash] here, as `content-script.bundle.js` filename should be stable
      filename: '[name].bundle.js',
      chunkFilename: `${name}.[name]-[chunkhash:6].chunk.js`,
      publicPath: '/',
      globalObject: 'this', // FIX: window is not defined in service-worker background
    },
    devServer: {
      open: false,
      devMiddleware: {
        publicPath: `http://localhost:${WEB_PORT}/`,
        writeToDisk: true,
      },
    },
    resolve: {
      extensions: [
        ...(buildTargetBrowser
          ? ['.ts', '.tsx', '.js', '.jsx'].map(
              (ext) => `.${buildTargetBrowser}-${platform}${ext}`,
            )
          : []),
        // .ext-bg-v3.ts
        ...(name &&
        platform === 'ext' &&
        babelTools.developmentConsts.isManifestV3
          ? ['.ts', '.tsx', '.js', '.jsx'].map(
              (ext) => `.${platform}-${name}-v3${ext}`,
            )
          : []),
        // .ext-ui.ts, .ext-bg.ts
        ...(name
          ? ['.ts', '.tsx', '.js', '.jsx'].map(
              (ext) => `.${platform}-${name}${ext}`,
            )
          : []),
        // .ext.ts, .web.ts, .android.ts, .ios.ts, .native.ts
        ...['.ts', '.tsx', '.js', '.jsx'].map((ext) => `.${platform}${ext}`),
      ],
    },
  });
  const extConfigs = ({ name }) =>
    ENABLE_ANALYZER
      ? [extConfig({ name }), analyzerConfig({ configName: platform })]
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
          // ...(isManifestV3 ? [] : pluginsHtml.backgroundHtml),
        ].filter(Boolean);
        return config;
      },
    },

    // **** manifest v3 background standalone build without code-split
    (isManifestV3 || isManifestV2) && {
      config: {
        name: devUtils.consts.configName.bg,
        dependencies: IS_DEV
          ? [devUtils.consts.configName.ui]
          : [devUtils.consts.configName.ui],
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
        config.plugins = [...config.plugins, ...pluginsCopy].filter(Boolean);
        return config;
      },
    },
  ].filter(Boolean);

  const entryConfigs = devUtils.createMultipleEntryConfigs(
    ({ config }) =>
      mergeWithRules({
        plugins: CustomizeRule.Replace,
        resolve: {
          extensions: CustomizeRule.Prepend,
        },
      })(
        baseConfig({ platform, basePath }),
        IS_DEV ? developmentConfig({ platform, basePath }) : productionConfig,
        ...extConfigs({ name: config.name }),
        config,
      ),
    multipleEntryConfigs,
  );

  // remove devServer from all but the first entry
  for (let index = 1; index < entryConfigs.length; index += 1) {
    delete entryConfigs[index].devServer;
  }
  return entryConfigs;
};
