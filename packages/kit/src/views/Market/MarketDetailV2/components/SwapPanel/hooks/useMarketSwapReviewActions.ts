import { useSwapReviewActions } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapReviewActions';
import { ESwapReviewApproveTransactionSource } from '@onekeyhq/kit/src/views/Swap/utils/swapReviewState';
import type { ISwapReviewAdapter } from '@onekeyhq/kit/src/views/Swap/utils/swapReviewState';

export function useMarketSwapReviewActions({
  adapter,
}: {
  adapter: ISwapReviewAdapter;
}) {
  return useSwapReviewActions({
    adapter,
    approveTransactionSource: ESwapReviewApproveTransactionSource.SpeedSwap,
  });
}
