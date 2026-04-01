import { SwapReviewDialog } from '@onekeyhq/kit/src/views/Swap/pages/components/SwapReviewDialog';
import { ESwapReviewApproveTransactionSource } from '@onekeyhq/kit/src/views/Swap/utils/swapReviewState';
import type {
  ISwapReviewAdapter,
  ISwapReviewState,
} from '@onekeyhq/kit/src/views/Swap/utils/swapReviewState';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

type IMarketSwapReviewDialogProps = {
  onDone: () => void;
  adapter: ISwapReviewAdapter;
  reviewState: ISwapReviewState;
};

export function MarketSwapReviewDialog({
  onDone,
  adapter,
  reviewState,
}: IMarketSwapReviewDialogProps) {
  return (
    <SwapReviewDialog
      onDone={onDone}
      adapter={adapter}
      reviewState={reviewState}
      storeName={EJotaiContextStoreNames.marketSwapReview}
      disableGlobalApproveSync
      approveTransactionSource={ESwapReviewApproveTransactionSource.SpeedSwap}
      accountSelectorConfig={{
        config: {
          sceneName: EAccountSelectorSceneName.swap,
          sceneUrl: '',
        },
        enabledNum: [0],
      }}
    />
  );
}
