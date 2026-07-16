import fs from 'fs';
import path from 'path';

import { rspack } from '@rspack/core';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { merge } from 'webpack-merge';

import {
  isDev,
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
} from '@rspack/core';

const platform = 'ext';

const compilerNames = {
  pages: 'pages',
  background: 'background',
  contentScript: 'content-script',
} as const;

const entries = {
  uiPopup: 'ui-popup',
  uiPasskey: 'ui-passkey',
  background: 'background',
  offscreen: 'offscreen',
  contentScript: 'content-script',
} as const;

interface IReplacementConfig {
  regexToFind: RegExp;
  replacement: string;
}

class ChromeExtensionV3ViolationPlugin implements RspackPluginInstance {
  private readonly replaceConfigs: IReplacementConfig[];

  constructor(replaceConfigs: IReplacementConfig[]) {
    this.replaceConfigs = replaceConfigs;
  }

  apply(compiler: Compiler): void {
    compiler.hooks.thisCompilation.tap(
      'ChromeExtensionV3ViolationPlugin',
      (compilation) => {
        compilation.hooks.processAssets.tap(
          {
            name: 'ChromeExtensionV3ViolationPlugin',
            stage: rspack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
          },
          (assets) => {
            for (const [file, asset] of Object.entries(assets)) {
              if (file.endsWith('.js')) {
                let content = asset.source().toString();
                let changed = false;

                for (const config of this.replaceConfigs) {
                  config.regexToFind.lastIndex = 0;
                  if (config.regexToFind.test(content)) {
                    config.regexToFind.lastIndex = 0;
                    content = content.replace(
                      config.regexToFind,
                      config.replacement,
                    );
                    changed = true;
                  }
                }

                if (changed) {
                  compilation.updateAsset(
                    file,
                    new rspack.sources.RawSource(content),
                  );
                }
              }
            }
          },
        );
      },
    );
  }
}

function createChromeExtensionV3ViolationPlugin(): RspackPluginInstance {
  return new ChromeExtensionV3ViolationPlugin([
    {
      regexToFind: /https:\/\/browser\.sentry-cdn\.com/g,
      replacement: '',
    },
    {
      regexToFind: /https:\/\/svelte-stripe-js\.vercel\.app/g,
      replacement: '',
    },
    {
      regexToFind: /r\.src=`\$\{n\}\/js\/telegram-login\.js`/g,
      replacement: 'r.src=``',
    },
    {
      regexToFind: /g\.src=`\$\{v\}\/js\/telegram-login\.js`/g,
      replacement: 'g.src=``',
    },
    {
      regexToFind: /https:\/\/maps\.googleapis\.com\/maps\/api\/js/g,
      replacement: '',
    },
    {
      regexToFind: /https:\/\/js\.stripe\.com\/v3\//g,
      replacement: '',
    },
  ]);
}

function createHtmlPlugin({
  name,
  chunks,
  basePath,
}: {
  name: string;
  chunks?: string[];
  basePath: string;
}): RspackPluginInstance {
  const filename = `${name}.html`;
  const htmlHeadPreloadCode = fs.readFileSync(
    path.resolve(basePath, 'src/assets/preload-html-head.js'),
    { encoding: 'utf-8' },
  );

  return new HtmlWebpackPlugin({
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
    minify: !isDev,
  }) as unknown as RspackPluginInstance;
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

function getCompilerOutputPath({
  basePath,
  compilerName,
}: {
  basePath: string;
  compilerName: string;
}): string {
  const outputFolder = getOutputFolder();
  return isDev
    ? path.resolve(basePath, 'build', outputFolder)
    : path.resolve(basePath, 'build', '.rspack', outputFolder, compilerName);
}

function createOutputConfig({
  basePath,
  compilerName,
}: {
  basePath: string;
  compilerName: string;
}): RspackOptions {
  return {
    output: {
      clean: false,
      path: getCompilerOutputPath({ basePath, compilerName }),
      filename: '[name].bundle.js',
      chunkFilename: isDev
        ? `${compilerName}.[name].chunk.js`
        : `${compilerName}.[name]-[contenthash:8].chunk.js`,
      publicPath: '/',
      globalObject: 'this',
      uniqueName: `onekey-ext-${compilerName}`,
    },
  };
}

function removeDefaultHtmlPlugin(config: RspackOptions): void {
  config.plugins = (config.plugins || []).filter(
    (plugin) =>
      !(plugin as { constructor?: { name?: string } })?.constructor?.name
        ?.toLowerCase()
        .includes('html'),
  );
}

function getSwcTargets(): Record<string, string> {
  return targetBrowser === 'firefox' ? { firefox: '115' } : { chrome: '111' };
}

function createCompilerConfig({
  basePath,
  compilerName,
  configName,
  entry,
  plugins = [],
}: {
  basePath: string;
  compilerName: string;
  configName: string;
  entry: NonNullable<RspackOptions['entry']>;
  plugins?: RspackPluginInstance[];
}): RspackOptions {
  const baseConfig = createBaseConfig({
    platform,
    basePath,
    configName,
    target: ['web', 'es2022'],
    swcTargets: getSwcTargets(),
    enableImportMetaCompat: true,
    enableSentryMinimalCompat: true,
  });
  removeDefaultHtmlPlugin(baseConfig);

  const environmentConfig =
    nodeEnv === 'production'
      ? createProductionConfig({ platform, basePath })
      : createDevelopmentConfig({ basePath });

  const config = merge(
    baseConfig,
    environmentConfig,
    createOutputConfig({ basePath, compilerName }),
  );
  config.name = compilerName;
  config.entry = entry;
  config.plugins = [
    ...(config.plugins || []),
    ...plugins,
    createChromeExtensionV3ViolationPlugin(),
  ];
  return config;
}

function enablePagesCodeSplitting(config: RspackOptions): void {
  config.optimization = config.optimization || {};
  const currentSplitChunks =
    typeof config.optimization.splitChunks === 'object'
      ? config.optimization.splitChunks
      : {};
  const currentCacheGroups =
    typeof currentSplitChunks.cacheGroups === 'object'
      ? currentSplitChunks.cacheGroups
      : {};

  config.optimization.chunkIds = 'deterministic';
  config.optimization.moduleIds = 'deterministic';
  config.optimization.runtimeChunk = { name: 'ext-pages-runtime' };
  config.optimization.splitChunks = {
    ...currentSplitChunks,
    chunks: 'all',
    minSize: 100 * 1024,
    maxSize: targetBrowser === 'firefox' ? 1024 * 1024 : 4 * 1024 * 1024,
    hidePathInfo: true,
    automaticNameDelimiter: '.',
    name: false,
    maxInitialRequests: 20,
    maxAsyncRequests: 40,
    cacheGroups: {
      ...currentCacheGroups,
      defaultVendors: {
        test: /[\\/]node_modules[\\/]/,
        priority: -10,
        reuseExistingChunk: true,
      },
      default: {
        minChunks: 2,
        priority: -20,
        reuseExistingChunk: true,
      },
    },
  };
}

function disableCodeSplitting(config: RspackOptions): void {
  config.optimization = config.optimization || {};
  config.optimization.runtimeChunk = false;
  config.optimization.splitChunks = false;
  config.output = config.output || {};
  config.output.asyncChunks = false;
  config.output.chunkLoading = false;
}

function createPagesConfig(basePath: string): RspackOptions {
  const uiHtmlPlugins = [
    'ui-popup',
    'ui-expand-tab',
    'ui-side-panel',
    'ui-standalone-window',
    'ui-content-script-iframe',
  ].map((name) =>
    createHtmlPlugin({ name, chunks: [entries.uiPopup], basePath }),
  );

  const config = createCompilerConfig({
    basePath,
    compilerName: compilerNames.pages,
    configName: compilerNames.pages,
    entry: {
      [entries.uiPopup]: path.join(basePath, 'src/entry/ui-popup.tsx'),
      [entries.uiPasskey]: path.join(basePath, 'src/entry/ui-passkey.tsx'),
      [entries.offscreen]: path.join(basePath, 'src/entry/offscreen.ts'),
    },
    plugins: [
      ...uiHtmlPlugins,
      createHtmlPlugin({ name: entries.uiPasskey, basePath }),
      createHtmlPlugin({ name: entries.offscreen, basePath }),
      createCopyPlugin(basePath),
    ],
  });

  enablePagesCodeSplitting(config);
  const currentDevServer =
    config.devServer && typeof config.devServer === 'object'
      ? config.devServer
      : {};
  const currentDevServerClient =
    currentDevServer.client && typeof currentDevServer.client === 'object'
      ? currentDevServer.client
      : {};
  config.devServer = {
    ...currentDevServer,
    open: false,
    devMiddleware: {
      publicPath: `http://localhost:${webPort}/`,
      writeToDisk: true,
    },
    client: {
      ...currentDevServerClient,
      overlay: false,
      webSocketURL: {
        hostname: 'localhost',
        pathname: '/ws',
        port: parseInt(webPort, 10),
        protocol: 'ws',
      },
    },
  } as RspackOptions['devServer'];
  return config;
}

function createBackgroundConfig(basePath: string): RspackOptions {
  const config = createCompilerConfig({
    basePath,
    compilerName: compilerNames.background,
    configName: 'bg',
    entry: {
      [entries.background]: {
        import: path.join(basePath, 'src/entry/background.ts'),
        filename: 'background.bundle.js',
        runtime: false,
        chunkLoading: false,
        asyncChunks: false,
      },
    },
    plugins: [createHtmlPlugin({ name: entries.background, basePath })],
  });

  disableCodeSplitting(config);
  if (process.env.PERF_MONITOR_ENABLED === '1') {
    config.optimization = config.optimization || {};
    config.optimization.minimize = false;
    config.optimization.minimizer = [];
  }
  delete config.devServer;
  return config;
}

function createContentScriptConfig(basePath: string): RspackOptions {
  const config = createCompilerConfig({
    basePath,
    compilerName: compilerNames.contentScript,
    configName: 'cs',
    entry: {
      [entries.contentScript]: {
        import: path.join(basePath, 'src/entry/content-script.ts'),
        filename: 'content-script.bundle.js',
        runtime: false,
        chunkLoading: false,
        asyncChunks: false,
      },
    },
  });

  disableCodeSplitting(config);
  delete config.devServer;
  return config;
}

interface IExtConfigOptions {
  basePath: string;
}

export function createExtConfig({
  basePath,
}: IExtConfigOptions): RspackOptions[] {
  if (!isManifestV3) {
    // Build configuration errors are not application-domain errors.
    // eslint-disable-next-line no-restricted-syntax, onekey/no-raw-error
    throw new Error('The Rspack extension build supports Manifest V3 only.');
  }

  return [
    createPagesConfig(basePath),
    createBackgroundConfig(basePath),
    createContentScriptConfig(basePath),
  ];
}

export default createExtConfig;
