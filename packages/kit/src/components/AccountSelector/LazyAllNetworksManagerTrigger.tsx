import type { ComponentProps } from 'react';

import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

import type { AllNetworksManagerTrigger } from './AllNetworksManagerTrigger';

export const LazyAllNetworksManagerTrigger = LazyLoad<
  ComponentProps<typeof AllNetworksManagerTrigger>
>(
  () =>
    import('./AllNetworksManagerTrigger').then((module) => ({
      default: module.AllNetworksManagerTrigger,
    })),
  undefined,
  null,
);
