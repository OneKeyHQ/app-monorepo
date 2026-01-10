import path from 'path';

import { rspack } from '@rspack/core';

import { getOutputFolder } from './utils';

import type { RspackOptions, RspackPluginInstance } from '@rspack/core';

const developmentConsts = {
  platforms: {
    ext: 'ext',
    web: 'web',
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
        cacheGroups: {},
      },
    },
  };
}
