import { Spinner, YStack } from '@onekeyhq/components';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

import type { ISwapStockDesktopContainerProps } from './SwapStockDesktopContainer';

const stockContainerLoadingFallback = (
  <YStack
    testID="SwapStockContainerLoading"
    flex={1}
    alignItems="center"
    justifyContent="center"
  >
    <Spinner size="large" />
  </YStack>
);

const loadSwapStockContainerModule = () =>
  import('./SwapStockDesktopContainer');

export const SwapStockDesktopContainer =
  LazyLoad<ISwapStockDesktopContainerProps>(
    async () => ({
      default: (await loadSwapStockContainerModule()).SwapStockDesktopContainer,
    }),
    undefined,
    stockContainerLoadingFallback,
  );

export const SwapStockMobileContainer =
  LazyLoad<ISwapStockDesktopContainerProps>(
    async () => ({
      default: (await loadSwapStockContainerModule()).SwapStockMobileContainer,
    }),
    undefined,
    stockContainerLoadingFallback,
  );
