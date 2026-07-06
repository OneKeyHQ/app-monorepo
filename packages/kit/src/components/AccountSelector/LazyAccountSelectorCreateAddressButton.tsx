import type { ComponentProps } from 'react';

import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

import type { AccountSelectorCreateAddressButton } from './AccountSelectorCreateAddressButton';

export const LazyAccountSelectorCreateAddressButton = LazyLoad<
  ComponentProps<typeof AccountSelectorCreateAddressButton>
>(
  () =>
    import('./AccountSelectorCreateAddressButton').then((module) => ({
      default: module.AccountSelectorCreateAddressButton,
    })),
  undefined,
  null,
);
