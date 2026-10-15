import type { ComponentProps } from 'react';

import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

import type { WalletActionBulkSend } from './WalletActionBulkSend';

// Loaded when the more menu opens: keeps the Prime free-trial gate and the
// bulk send mode dialog out of the startup bundle.
export const LazyWalletActionBulkSend = LazyLoad<
  ComponentProps<typeof WalletActionBulkSend>
>(
  () =>
    import('./WalletActionBulkSend').then((module) => ({
      default: module.WalletActionBulkSend,
    })),
  undefined,
  null,
);
