import { useSwapReviewActions } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapReviewActions';
import { ESwapReviewApproveTransactionSource } from '@onekeyhq/kit/src/views/Swap/utils/swapReviewState';
import type { ISwapReviewAdapter } from '@onekeyhq/kit/src/views/Swap/utils/swapReviewState';

export function useMarketSwapReviewActions({
  adapter,
  reviewRevision,
}: {
  adapter: ISwapReviewAdapter;
  reviewRevision?: string;
}) {
  return useSwapReviewActions({
    adapter,
    approveTransactionSource: ESwapReviewApproveTransactionSource.SpeedSwap,
    reviewRevision,
  });
}
