import { merge } from 'webpack-merge';

import { nodeEnv } from './constant';
import { createBaseConfig } from './rspack.base.config';
import { createDevelopmentConfig } from './rspack.development.config';
import { createProductionConfig } from './rspack.prod.config';

import type { RspackOptions } from '@rspack/core';

interface IWebConfigOptions {
  basePath: string;
  platform?: string;
}

export function createWebConfig({
  basePath,
  platform = 'web',
}: IWebConfigOptions): RspackOptions {
  const baseConfig = createBaseConfig({ platform, basePath });

  switch (nodeEnv) {
    case 'production':
      return merge(baseConfig, createProductionConfig({ platform, basePath }), {
        output: {
          crossOriginLoading: 'anonymous',
        },
      });
    case 'development':
    default:
      return merge(baseConfig, createDevelopmentConfig({ basePath }));
  }
}

export default createWebConfig;
