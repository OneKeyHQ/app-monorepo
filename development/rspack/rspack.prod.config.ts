import path from 'path';

import { rspack } from '@rspack/core';

import { getOutputFolder } from './utils';

import type { RspackOptions, RspackPluginInstance } from '@rspack/core';

const developmentConsts = {
  platforms: {
    ext: 'ext',
    web: 'web',
    desktop: 'desktop',
  },
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
  const _isWeb = platform === developmentConsts.platforms.web;
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
    ].filter(Boolean) as RspackPluginInstance[],
    optimization: {
      minimizer: [
        new rspack.SwcJsMinimizerRspackPlugin({
          minimizerOptions: {
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
