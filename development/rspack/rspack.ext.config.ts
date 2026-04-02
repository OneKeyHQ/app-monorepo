import fs from 'fs';
import path from 'path';

import { rspack } from '@rspack/core';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import lodash from 'lodash';
import { merge } from 'webpack-merge';

import {
  isDev,
  isManifestV2,
  isManifestV3,
  nodeEnv,
  targetBrowser,
  webPort,
} from './constant';
import { createBaseConfig } from './rspack.base.config';
import { createDevelopmentConfig } from './rspack.development.config';
import { createProductionConfig } from './rspack.prod.config';
import { getOutputFolder } from './utils';

import type {
  Compiler,
  RspackOptions,
  RspackPluginInstance,
  sources,
} from '@rspack/core';

const platform = 'ext';

const consts = {
  configName: {
    bg: 'bg',
    offscreen: 'offscreen',
    ui: 'ui',
    cs: 'cs',
    passkey: 'ui-passkey',
  },
  entry: {
    'ui-passkey': 'ui-passkey',
    'ui-popup': 'ui-popup',
    'ui-devtools': 'ui-devtools',
    background: 'background',
    offscreen: 'offscreen',
    'content-script': 'content-script',
  },
};

class ChromeExtensionV3ViolationPlugin implements RspackPluginInstance {
  private replaceConfigs: Array<{ regexToFind: RegExp; replacement: string }>;

  constructor(
    replaceConfigs: Array<{ regexToFind: RegExp; replacement: string }>,
  ) {
    this.replaceConfigs = replaceConfigs;
  }

  apply(compiler: Compiler): void {
    compiler.hooks.emit.tap(
      'ChromeExtensionV3ViolationPlugin',
      (compilation) => {
        const files = Object.keys(compilation.assets);
        files.forEach((file) => {
          // Only process JS files to reduce unnecessary operations
          if (!file.endsWith('.js')) {
            return;
          }

          const asset = compilation.assets[file];
          const content = asset.source().toString();

          // Check if any replacement is needed before modifying
          let needsReplacement = false;
          for (const config of this.replaceConfigs) {
            // Reset lastIndex for global regexes to avoid stateful matching issues
            config.regexToFind.lastIndex = 0;
            if (config.regexToFind.test(content)) {
              needsReplacement = true;
              break;
            }
          }

          if (!needsReplacement) {
            return;
          }

          // Perform all replacements
          let modifiedContent = content;
          for (const config of this.replaceConfigs) {
            config.regexToFind.lastIndex = 0;
            modifiedContent = modifiedContent.replace(
              config.regexToFind,
              config.replacement,
            );
          }

          compilation.assets[file] = new rspack.sources.RawSource(
            modifiedContent,
          ) as unknown as sources.Source;
        });
      },
    );
  }
}

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

function createHtmlPlugin({
  name,
  chunks,
  basePath,
}: {
  name: string;
  chunks?: string[];
  basePath: string;
}): RspackPluginInstance[] {
  const filename = `${name}.html`;
  const htmlHeadPreloadCode = fs.readFileSync(
    path.resolve(basePath, 'src/assets/preload-html-head.js'),
    { encoding: 'utf-8' },
  );

  const htmlWebpackPlugin = new HtmlWebpackPlugin({
    template: `!!ejs-loader?esModule=false!${path.join(
      __dirname,
      '../../packages/shared/src/web/index.html.ejs',
    )}`,
    templateParameters: {
      filename,
      platform,
      browser: targetBrowser,
      htmlHeadPreloadCode,
      currentVersion: process.env.VERSION,
      isDev,
    },
    filename,
    chunks: chunks || [name],
    cache: false,
    hash: isDev,
  }) as unknown as RspackPluginInstance;

  return [htmlWebpackPlugin];
}

function createCopyPlugin(basePath: string): RspackPluginInstance {
  return new rspack.CopyRspackPlugin({
    patterns: [
      {
        from: path.join(basePath, 'src/manifest/index.js'),
        to: 'manifest.json',
        transform() {
          // eslint-disable-next-line import/no-dynamic-require
          const manifest = require(
            path.join(basePath, 'src/manifest'),
          ) as Record<string, unknown>;
          return Buffer.from(JSON.stringify(manifest, null, 2));
        },
      },
      { from: path.join(basePath, 'src/entry/injected.js') },
      { from: path.join(basePath, 'src/assets/img/icon-48.png') },
      { from: path.join(basePath, 'src/assets/img/icon-128.png') },
      { from: path.join(basePath, 'src/assets/img/icon-128-disable.png') },
      { from: path.join(basePath, 'src/assets/ui-popup-boot.html') },
      { from: path.join(basePath, 'src/assets/ui-popup-boot.js') },
      { from: path.join(basePath, 'src/assets/preload-html-head.js') },
      { from: path.join(basePath, 'src/assets/ui-oauth-callback.html') },
    ],
  });
}

function enableCodeSplitChunks(config: RspackOptions): void {
  const isFirefox = targetBrowser === 'firefox';
  let maxSizeMb = 4;
  if (isFirefox) {
    maxSizeMb = 1;
  }
  config.optimization = config.optimization || {};
  config.optimization.splitChunks = {
    ...config.optimization.splitChunks,
    chunks: 'all',
    minSize: 100 * 1024,
    maxSize: maxSizeMb * 1024 * 1024,
    name: false,
    hidePathInfo: false,
    automaticNameDelimiter: '.',
  };
}

function disableCodeSplitChunks(config: RspackOptions): void {
  config.optimization = config.optimization || {};
  delete config.optimization.splitChunks;
  config.output = config.output || {};
  config.output.asyncChunks = false;
}

interface IExtConfigOptions {
  basePath: string;
}

function createMultipleEntryConfigs(
  createConfig: (options: { config: RspackOptions }) => RspackOptions,
  multipleEntryConfigs: Array<{
    config: RspackOptions;
    configUpdater: (config: RspackOptions) => RspackOptions;
  }>,
): RspackOptions[] {
  return multipleEntryConfigs.map(({ config, configUpdater }) => {
    const rspackConfig = createConfig({ config });
    const configMerged = lodash.merge(rspackConfig, config);
    return configUpdater(configMerged);
  });
}

export function createExtConfig({
  basePath,
}: IExtConfigOptions): RspackOptions[] {
  const outputPath = path.resolve(basePath, 'build', getOutputFolder());

  const uiHtmlPlugins = [
    'ui-popup',
    'ui-expand-tab',
    'ui-side-panel',
    'ui-standalone-window',
    'ui-content-script-iframe',
  ].flatMap((name) =>
    createHtmlPlugin({ name, chunks: ['ui-popup'], basePath }),
  );

  const backgroundHtmlPlugins = createHtmlPlugin({
    name: consts.entry.background,
    basePath,
  });

  const offscreenHtmlPlugins = createHtmlPlugin({
    name: consts.entry.offscreen,
    basePath,
  });

  const passkeyHtmlPlugins = createHtmlPlugin({
    name: consts.entry['ui-passkey'],
    basePath,
  });

  const extBaseConfig = (configName: string): RspackOptions => ({
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
    output: {
      clean: false,
      path: outputPath,
      filename: '[name].bundle.js',
      chunkFilename: isDev
        ? `${configName}.[name].chunk.js`
        : `${configName}.[name]-[chunkhash:6].chunk.js`,
      publicPath: '/',
      globalObject: 'this',
    },
    devServer: {
      open: false,
      devMiddleware: {
        publicPath: `http://localhost:${webPort}/`,
        writeToDisk: true,
      },
      client: {
        webSocketURL: {
          hostname: 'localhost',
          pathname: '/ws',
          port: parseInt(webPort, 10),
          protocol: 'ws',
        },
      },
    },
  });

  const multipleEntryConfigs: Array<{
    config: RspackOptions;
    configUpdater: (config: RspackOptions) => RspackOptions;
  }> = [
    // UI build (always code-split)
    {
      config: {
        name: consts.configName.ui,
        entry: {
          [consts.entry['ui-popup']]: path.join(
            basePath,
            'src/entry/ui-popup.tsx',
          ),
        },
      },
      configUpdater(config: RspackOptions) {
        enableCodeSplitChunks(config);
        config.plugins = [...(config.plugins || []), ...uiHtmlPlugins].filter(
          Boolean,
        );
        return config;
      },
    },

    // Passkey standalone entry build
    {
      config: {
        name: consts.configName.passkey,
        entry: {
          [consts.entry['ui-passkey']]: path.join(
            basePath,
            'src/entry/ui-passkey.tsx',
          ),
        },
      },
      configUpdater(config: RspackOptions) {
        enableCodeSplitChunks(config);
        config.plugins = [
          ...(config.plugins || []),
          ...passkeyHtmlPlugins,
        ].filter(Boolean);
        return config;
      },
    },

    // Background standalone build
    ...(isManifestV3 || isManifestV2
      ? [
          {
            config: {
              name: consts.configName.bg,
              dependencies: [consts.configName.ui],
              entry: {
                [consts.entry.background]: path.join(
                  basePath,
                  'src/entry/background.ts',
                ),
              },
            },
            configUpdater(config: RspackOptions) {
              if (isManifestV2) {
                enableCodeSplitChunks(config);
              } else {
                // manifest v3 background can NOT split code
                disableCodeSplitChunks(config);
              }

              config.plugins = [
                ...(config.plugins || []),
                ...backgroundHtmlPlugins,
                new rspack.ProvidePlugin({
                  process: 'process/browser',
                }),
              ].filter(Boolean);
              return config;
            },
          },
        ]
      : []),

    // Manifest v3 offscreen standalone build
    ...(isManifestV3
      ? [
          {
            config: {
              name: consts.configName.offscreen,
              entry: {
                [consts.entry.offscreen]: path.join(
                  basePath,
                  'src/entry/offscreen.ts',
                ),
              },
              dependencies: [consts.configName.ui, consts.configName.bg],
            },
            configUpdater(config: RspackOptions) {
              enableCodeSplitChunks(config);
              config.plugins = [
                ...(config.plugins || []),
                ...offscreenHtmlPlugins,
              ].filter(Boolean);
              return config;
            },
          },
        ]
      : []),

    // Content-script build (do NOT code-split)
    {
      config: {
        name: consts.configName.cs,
        dependencies: isManifestV3
          ? [
              consts.configName.ui,
              consts.configName.bg,
              consts.configName.offscreen,
            ]
          : [consts.configName.ui, consts.configName.bg],
        entry: {
          [consts.entry['content-script']]: path.join(
            basePath,
            'src/entry/content-script.ts',
          ),
        },
      },
      configUpdater(config: RspackOptions) {
        // content-script can NOT split code
        disableCodeSplitChunks(config);
        config.plugins = [
          ...(config.plugins || []),
          createCopyPlugin(basePath),
          chromeExtensionV3ViolationPlugin,
        ].filter(Boolean);
        return config;
      },
    },
  ];

  const createConfigForEntry = ({
    config,
  }: {
    config: RspackOptions;
  }): RspackOptions => {
    const configName = config.name as string;
    const baseConfig = createBaseConfig({
      platform,
      basePath,
      configName,
    });

    // Remove default HtmlWebpackPlugin from base config
    baseConfig.plugins = (baseConfig.plugins || []).filter(
      (plugin) =>
        !(plugin as { constructor?: { name?: string } })?.constructor?.name
          ?.toLowerCase()
          .includes('html'),
    );

    const envConfig =
      nodeEnv === 'production'
        ? createProductionConfig({ platform, basePath })
        : createDevelopmentConfig({ basePath });

    return merge(baseConfig, envConfig, extBaseConfig(configName));
  };

  const entryConfigs = createMultipleEntryConfigs(
    createConfigForEntry,
    multipleEntryConfigs,
  );

  // Remove devServer from all but the first entry
  for (let index = 1; index < entryConfigs.length; index += 1) {
    delete entryConfigs[index].devServer;
  }

  return entryConfigs;
}

export default createExtConfig;
