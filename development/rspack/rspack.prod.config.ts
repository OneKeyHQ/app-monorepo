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

interface IProdConfigOptions {
  platform: string;
  basePath: string;
}

export function createProductionConfig({
  platform,
  basePath,
}: IProdConfigOptions): RspackOptions {
  const isExt = platform === developmentConsts.platforms.ext;
  const isWeb = platform === developmentConsts.platforms.web;
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
        new RetryChunkLoadRspackPlugin({ retryDelay: 3000, maxRetries: 5 }),
    ].filter(Boolean) as RspackPluginInstance[],
    optimization: {
      minimizer: [
        new rspack.SwcJsMinimizerRspackPlugin({
          minimizerOptions: {
            compress: {
              // web prod parity with babel-plugin-transform-remove-console.
              // ext console output is preserved (guard is web-only).
              drop_console: isWeb,
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
        minSize: 102_400,
        maxSize: 4_194_304,
        hidePathInfo: true,
        automaticNameDelimiter: '.',
        name: false,
        maxInitialRequests: 20,
        maxAsyncRequests: 50_000,
        // Vendor cache groups for long-term caching (web/desktop only).
        // Extension uses its own code splitting via HtmlWebpackPlugin chunks,
        // and named vendor chunks would NOT be included in ext HTML files,
        // breaking the extension UI in production.
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
                test: /[\\/]node_modules[\\/]lodash/,
                name: 'vendor-lodash',
                chunks: 'all' as const,
                priority: 30,
                reuseExistingChunk: true,
              },
              networkVendor: {
                test: /[\\/]node_modules[\\/](axios|@supabase)[\\/]/,
                name: 'vendor-network',
                chunks: 'all' as const,
                priority: 30,
                reuseExistingChunk: true,
              },
              cryptoVendor: {
                test: /[\\/]node_modules[\\/](@noble|@scure|ethers|bn\.js|elliptic|hash\.js|browserify)[\\/]/,
                name: 'vendor-crypto',
                chunks: 'all' as const,
                priority: 20,
                reuseExistingChunk: true,
              },
            },
      },
    },
  };
}
