import type { ReactNode } from 'react';

import { SwapReviewInitializer } from '@onekeyhq/kit/src/views/Swap/pages/components/SwapReviewInitializer';
import type { ISwapReviewState } from '@onekeyhq/kit/src/views/Swap/utils/swapReviewState';

export type IMarketSwapReviewState = ISwapReviewState;

type IMarketSwapReviewInitializerProps = {
  children?: ReactNode;
  reviewState: IMarketSwapReviewState;
};

export function MarketSwapReviewInitializer(
  props: IMarketSwapReviewInitializerProps,
) {
  return <SwapReviewInitializer {...props} />;
}
