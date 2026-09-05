import path from 'path';

import { rspack } from '@rspack/core';

import { RetryChunkLoadRspackPlugin } from './plugins/RetryChunkLoadRspackPlugin';
import { getOutputFolder } from './utils';

import type { RspackOptions, RspackPluginInstance } from '@rspack/core';

// Shared platform constants (single source of truth) instead of re-declaring a
// partial copy here — see development/developmentConsts.js.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const developmentConsts = require('../developmentConsts') as {
  platforms: {
    all: string;
    app: string;
    desktop: string;
    ext: string;
    web: string;
    webEmbed: string;
  };
};

const WEB_RETRY_CHUNK_LOAD_DELAY_CODE =
  'function() { return 1000 + Math.floor(Math.random() * 2001); }';

interface IProdConfigOptions {
  platform: string;
  basePath: string;
  dropConsole?: boolean;
}

export function createProductionConfig({
  platform,
  basePath,
  dropConsole,
}: IProdConfigOptions): RspackOptions {
  const isExt = platform === developmentConsts.platforms.ext;
  const isWeb = platform === developmentConsts.platforms.web;
  const shouldDropConsole = dropConsole ?? false;
  const rootPath = isExt
    ? path.join(basePath, 'build', getOutputFolder())
    : path.join(basePath, 'web-build');

  console.log('Production build root path:', rootPath);

  return {
    mode: 'production',
    devtool: isExt ? false : 'source-map',
    output: {
      clean: true,
    },
    plugins: [
      new rspack.DefinePlugin({
        __CURRENT_FILE_PATH__: JSON.stringify(
          '__CURRENT_FILE_PATH__--not-available-in-production',
        ),
      }),
      // web-only: rspack-native equivalent of webpack-retry-chunk-load-plugin
      // (the npm plugin is incompatible with rspack's Compilation). ext keeps
      // its own code-splitting and is unaffected (guard drops to `false`).
      isWeb &&
        new RetryChunkLoadRspackPlugin({
          retryDelay: WEB_RETRY_CHUNK_LOAD_DELAY_CODE,
          maxRetries: 5,
        }),
    ].filter(Boolean) as RspackPluginInstance[],
    optimization: {
      minimizer: [
        new rspack.SwcJsMinimizerRspackPlugin({
          minimizerOptions: {
            compress: {
              // Preserve dependency runtime logging; first-party console calls
              // are stripped earlier by the scoped Babel rule.
              drop_console: shouldDropConsole,
            },
            mangle: {
              keep_classnames: true,
              keep_fnames: true,
            },
          },
        }),
      ],
      splitChunks: {
        chunks: 'all',
        minSize: isWeb ? 153_600 : 102_400,
        maxSize: isWeb ? 614_400 : 4_194_304,
        hidePathInfo: true,
        automaticNameDelimiter: '.',
        name: false,
        maxInitialRequests: 20,
        maxAsyncRequests: 50_000,
        // Vendor cache groups for long-term caching (web/desktop only).
        // Extension compiler domains add their cache groups after this shared
        // production config is merged.
        cacheGroups: isExt
          ? {}
          : {
              reactVendor: {
                test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                name: 'vendor-react',
                chunks: 'all' as const,
                priority: 40,
                reuseExistingChunk: true,
              },
              lodashVendor: {
                // 'initial' (not 'all'): only group lodash reachable from the
                // initial graph. With 'all', lodash methods used solely by async
                // route/SDK chunks are merged into this named chunk and dragged
                // onto first paint. Keep parity with webpack.prod.config.js.
                test: /[\\/]node_modules[\\/]lodash/,
                name: 'vendor-lodash',
                chunks: 'initial' as const,
                priority: 30,
                reuseExistingChunk: true,
              },
              supabaseVendor: {
                test: /[\\/]node_modules[\\/]@supabase[\\/]/,
                name: 'vendor-supabase',
                chunks: 'async' as const,
                priority: 35,
                reuseExistingChunk: true,
              },
              reactHookFormVendor: {
                test: /[\\/]node_modules[\\/]react-hook-form[\\/]/,
                name: 'vendor-react-hook-form',
                chunks: 'all' as const,
                enforce: true,
                priority: 35,
                reuseExistingChunk: true,
              },
              networkVendor: {
                test: /[\\/]node_modules[\\/]axios[\\/]/,
                name: 'vendor-network',
                chunks: 'all' as const,
                priority: 30,
                reuseExistingChunk: true,
              },
              cryptoVendor: {
                // 'initial' for the same reason as lodashVendor: with 'all',
                // crypto copies used solely by async SDK chunks (e.g. the
                // nested @noble/hashes and @scure/base bundled under
                // @walletconnect/utils and @alephium/web3) are merged into
                // this named chunk and dragged onto first paint.
                test: /[\\/]node_modules[\\/](@noble|@scure|ethers|bn\.js|elliptic|hash\.js|browserify)[\\/]/,
                name: 'vendor-crypto',
                chunks: 'initial' as const,
                priority: 20,
                reuseExistingChunk: true,
              },
              // These UI primitives sit below splitChunks.minSize, so once no
              // initial module imports them they get re-inlined into every
              // async chunk that uses them (dozens of copies). Pin them to one
              // shared chunk; `enforce` bypasses the minSize floor.
              sharedUiPrimitives: {
                test: /[\\/]packages[\\/]components[\\/]src[\\/](actions[\\/](Popover|Tooltip|SegmentControl)|forms[\\/]Select|content[\\/]DashText)[\\/]/,
                name: 'shared-ui-primitives',
                chunks: 'all' as const,
                enforce: true,
                priority: 25,
                reuseExistingChunk: true,
              },
            },
      },
    },
  };
}
