import type { RspackOptions } from '@rspack/core';
import { merge } from 'webpack-merge';

import { createBaseConfig } from './rspack.base.config';
import { createDevelopmentConfig } from './rspack.development.config';
import { createProductionConfig } from './rspack.prod.config';
import { nodeEnv } from './constant';

interface WebConfigOptions {
  basePath: string;
  platform?: string;
}

export function createWebConfig({
  basePath,
  platform = 'web',
}: WebConfigOptions): RspackOptions {
  const baseConfig = createBaseConfig({ platform, basePath });

  switch (nodeEnv) {
    case 'production':
      return merge(
        baseConfig,
        createProductionConfig({ platform, basePath }),
        {
          output: {
            crossOriginLoading: 'anonymous',
          },
        },
      ) as RspackOptions;
    case 'development':
    default:
      return merge(
        baseConfig,
        createDevelopmentConfig({ basePath }),
      ) as RspackOptions;
  }
}

export default createWebConfig;
