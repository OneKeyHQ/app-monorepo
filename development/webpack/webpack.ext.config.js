// cspell:ignore LavaMoat lavamoat noncharacter noncharacters

const fs = require('fs');
const path = require('path');

const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');
const { merge } = require('webpack-merge');
const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');

const { LavaMoatError } = require('../lavamoat/error.cjs');
const { createBaseResolveOptions } = require('../rspack/rspack.resolve.config');

const {
  createLavaMoatWebpackOptimization,
  createLavaMoatWebpackPlugin,
  createLavaMoatWebpackRules,
  createLavaMoatWebpackValidationPlugin,
  isLavaMoatEnabled,
  isLavaMoatPolicyGeneration,
} = require('./lavamoat');
const {
  createExtensionKaspaRules,
} = require('./lavamoat-ext-kaspa-loader.cjs');
const {
  createExtensionLocaleRule,
} = require('./lavamoat-ext-locales-loader.cjs');
const createBaseConfig = require('./webpack.base.config');
const createProductionConfig = require('./webpack.prod.config');

const trustedCopyScript = /^(?:injected|preload-html-head|ui-popup-boot)\.js$/;

const svgRuntimeCacheGroup = {
  // Popup provides these modules initially, but passkey reaches the same icon
  // imports without them. Share their runtime in one chunk.
  test: /[\\/]node_modules[\\/](react-native-svg[\\/]|@react-native[\\/]assets-registry[\\/]|react-native-web[\\/]dist[\\/](exports[\\/]Touchable[\\/]|vendor[\\/]react-native[\\/]PooledClass[\\/]))/,
  name: 'shared-svg-runtime',
  chunks: 'all',
  minChunks: 2,
  enforce: true,
  priority: 30,
  reuseExistingChunk: true,
};

// Keep the existing extension remote-code removals and final output checks.
// This adapter uses webpack's asset APIs; the normal Rspack build is unchanged.
class ExtensionRemoteCodePlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap(
      'ExtensionRemoteCodePlugin',
      (compilation) => {
        compilation.hooks.processAssets.tap(
          {
            name: 'ExtensionRemoteCodePlugin',
            stage: webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
          },
          (assets) => {
            for (const [filename, asset] of Object.entries(assets)) {
              if (
                filename.endsWith('.js') &&
                !trustedCopyScript.test(filename)
              ) {
                const source = asset.source().toString();
                let updated = source
                  .replaceAll('https://browser.sentry-cdn.com', '')
                  .replaceAll('https://svelte-stripe-js.vercel.app', '')
                  .replaceAll('https://maps.googleapis.com/maps/api/js', '')
                  .replace(
                    /r\.src=`\$\{n\}\/js\/telegram-login\.js`/g,
                    'r.src=``',
                  )
                  .replace(
                    /g\.src=`\$\{v\}\/js\/telegram-login\.js`/g,
                    'g.src=``',
                  );
                if (source.includes('webpackChunkStripeJSouter')) {
                  updated = updated.replace(
                    /(\.p\s*=\s*)(["'])https:\/\/js\.stripe\.com\/v3\/\2/g,
                    '$1$2$2',
                  );
                }
                if (updated !== source) {
                  compilation.updateAsset(
                    filename,
                    new webpack.sources.RawSource(updated),
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

function createHtmlPlugin(basePath, browser, filename, entry) {
  return new HtmlWebpackPlugin({
    filename: `${filename}.html`,
    template: `!!ejs-loader?esModule=false!${path.join(__dirname, '../../packages/shared/src/web/index.html.ejs')}`,
    templateParameters: {
      filename: `${filename}.html`,
      platform: 'ext',
      browser,
      htmlHeadPreloadCode: fs.readFileSync(
        path.join(basePath, 'src/assets/preload-html-head.js'),
        'utf8',
      ),
      currentVersion: process.env.VERSION,
      isDev: false,
    },
    chunks: [entry],
    cache: false,
    minify: true,
  });
}

function createCopyPlugin(basePath) {
  return new CopyWebpackPlugin({
    patterns: [
      {
        from: path.join(basePath, 'src/manifest/index.js'),
        to: 'manifest.json',
        transform() {
          // The manifest is trusted repository code, shared with the Rspack build.
          // eslint-disable-next-line import/no-dynamic-require
          const manifest = require(path.join(basePath, 'src/manifest'));
          return Buffer.from(JSON.stringify(manifest, null, 2));
        },
      },
      // The provider runs in the site's MAIN world. Copy it unchanged; it is
      // outside these extension-realm policies and must never receive SES.
      { from: path.join(basePath, 'src/entry/injected.js') },
      ...[
        'img/icon-48.png',
        'img/icon-128.png',
        'img/icon-128-disable.png',
        'ui-popup-boot.html',
        'ui-popup-boot.js',
        'preload-html-head.js',
        'ui-oauth-callback.html',
      ].map((file) => ({ from: path.join(basePath, 'src/assets', file) })),
    ],
  });
}

function createCompiler({
  basePath,
  browser,
  name,
  resolverName,
  entry,
  plugins = [],
}) {
  const base = createBaseConfig({
    platform: 'ext',
    basePath,
    configName: resolverName,
  });
  // These application defaults assume a single main HTML entry. Extension
  // pages are emitted explicitly and background/content scripts have no HTML.
  base.plugins = base.plugins.filter(
    (plugin) =>
      !['HtmlWebpackPlugin', 'WebpackManifestPlugin'].includes(
        plugin.constructor.name,
      ),
  );
  const config = merge(
    base,
    createProductionConfig({ platform: 'ext', basePath }),
  );
  const inlineRuntime = name === 'pages' ? undefined : name;
  // Match the shipping extension graph, including native component mocks,
  // Sentry compatibility, and the single ESM algosdk entry.
  config.resolve = createBaseResolveOptions({
    basePath,
    enableSentryMinimalCompat: true,
    extensions: base.resolve.extensions,
  });
  config.name = name;
  config.entry = entry;
  config.target =
    name === 'background' ? ['webworker', 'es2022'] : ['web', 'es2022'];
  config.output = {
    ...config.output,
    path: path.join(basePath, 'build/.lavamoat', `${browser}_v3`, name),
    clean: true,
    publicPath: '/',
    globalObject: 'globalThis',
    uniqueName: `onekey-ext-lavamoat-${name}`,
    filename: inlineRuntime
      ? `${name}.bundle.js`
      : '[name].[contenthash:10].bundle.js',
    chunkFilename: `${name}.[name].[contenthash:10].chunk.js`,
  };
  config.devtool = false;
  config.optimization.minimize = !isLavaMoatPolicyGeneration();
  config.optimization.minimizer = [
    new TerserPlugin({
      // A single worker keeps Terser ASTs out of webpack's retained graph heap
      // and limits minification to one asset at a time. False uses the main heap.
      parallel: 1,
      // Preserve trusted copied scripts byte-for-byte, including the MAIN-world
      // provider. Final remote-code checks still inspect these exact files.
      exclude: trustedCopyScript,
      terserOptions: {
        // Match the shipping background's additional compression passes.
        compress: { passes: name === 'background' ? 3 : 2 },
        keep_classnames: true,
        keep_fnames: true,
        // Chromium rejects Unicode noncharacters in extension script sources.
        // Preserve their string values using escapes rather than raw U+FFFE.
        format: { ascii_only: true },
      },
    }),
  ];
  if (inlineRuntime) {
    config.optimization.runtimeChunk = false;
    config.optimization.splitChunks = false;
    config.output.chunkLoading = false;
    config.output.asyncChunks = false;
  } else {
    Object.assign(config.optimization, createLavaMoatWebpackOptimization());
    config.output.crossOriginLoading = 'anonymous';
    config.plugins.push(
      new SubresourceIntegrityPlugin({ hashFuncNames: ['sha384'] }),
    );
    // Remove only definitions available on every parent path. Each HTML page
    // still starts an independent runtime; module owners are unchanged.
    config.optimization.removeAvailableModules = true;
    // Share smaller modules without increasing the shipping async request limit.
    config.optimization.splitChunks = {
      ...config.optimization.splitChunks,
      minSize: 20_000,
      maxAsyncRequests: 40,
      cacheGroups: {
        ...config.optimization.splitChunks.cacheGroups,
        svgRuntime: svgRuntimeCacheGroup,
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
  for (const rule of config.module.rules) {
    if (rule.oneOf) {
      rule.oneOf.unshift({ test: /\.text-js$/, type: 'asset/source' });
    }
    if (rule.use?.loader === 'worker-loader') {
      // MV3 loads packaged workers under the existing self-only script CSP.
      // Do not introduce blob URLs or relax worker/script source directives.
      rule.use.options = { filename: `${name}.[contenthash:10].worker.js` };
    }
  }
  config.module.rules.push(...createLavaMoatWebpackRules());
  if (name === 'pages') {
    // Verify the existing private binary instead of bundling its base64 copy.
    config.module.rules.push(...createExtensionKaspaRules());
  }
  if (name === 'background' || name === 'pages') {
    // Both compilers emit identical verified data, deduplicated at finalization.
    // Content scripts retain their original imports and receive no resource access.
    config.module.rules.push(createExtensionLocaleRule());
  }
  config.plugins.push(
    ...plugins,
    new ExtensionRemoteCodePlugin(),
    createLavaMoatWebpackValidationPlugin({ inlineRuntime }),
    createLavaMoatWebpackPlugin({
      basePath,
      target: 'ext',
      configName: `mv3/${name}`,
      inlineRuntime,
      readableResourceIds: false,
    }),
  );
  config.plugins = config.plugins.filter(Boolean);
  return config;
}

module.exports = function createExtensionConfig({ basePath }) {
  const browser = process.env.EXT_CHANNEL || 'chrome';
  if (
    process.env.NODE_ENV !== 'production' ||
    !process.env.EXT_MANIFEST_V3 ||
    !isLavaMoatEnabled()
  ) {
    throw new LavaMoatError(
      'The extension LavaMoat entry requires a production MV3 build with ONEKEY_LAVAMOAT enabled.',
    );
  }
  if (!['chrome', 'edge'].includes(browser)) {
    throw new LavaMoatError(
      'The protected extension entry currently supports Chromium MV3 only.',
    );
  }
  const pages = createCompiler({
    basePath,
    browser,
    name: 'pages',
    resolverName: 'pages',
    entry: {
      'ui-popup': path.join(basePath, 'src/entry/ui-popup.tsx'),
      'ui-passkey': path.join(basePath, 'src/entry/ui-passkey.tsx'),
      offscreen: path.join(basePath, 'src/entry/offscreen.ts'),
    },
    plugins: [
      ...[
        'ui-popup',
        'ui-expand-tab',
        'ui-side-panel',
        'ui-standalone-window',
        'ui-content-script-iframe',
      ].map((name) => createHtmlPlugin(basePath, browser, name, 'ui-popup')),
      createHtmlPlugin(basePath, browser, 'ui-passkey', 'ui-passkey'),
      createHtmlPlugin(basePath, browser, 'offscreen', 'offscreen'),
      createCopyPlugin(basePath),
    ],
  });
  const background = createCompiler({
    basePath,
    browser,
    name: 'background',
    resolverName: 'bg',
    entry: { background: path.join(basePath, 'src/entry/background.ts') },
  });
  const contentScript = createCompiler({
    basePath,
    browser,
    name: 'content-script',
    resolverName: 'cs',
    entry: {
      'content-script': path.join(basePath, 'src/entry/content-script.ts'),
    },
  });
  return [pages, background, contentScript];
};

module.exports.svgRuntimeCacheGroup = svgRuntimeCacheGroup;
