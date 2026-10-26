import { SwapReviewDialog } from '@onekeyhq/kit/src/views/Swap/pages/components/SwapReviewDialog';
import type { ISwapReviewAnalytics } from '@onekeyhq/kit/src/views/Swap/utils/swapReviewAnalytics';
import { ESwapReviewApproveTransactionSource } from '@onekeyhq/kit/src/views/Swap/utils/swapReviewState';
import type {
  ISwapReviewAdapter,
  ISwapReviewState,
} from '@onekeyhq/kit/src/views/Swap/utils/swapReviewState';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ICustomPriorityFeeOverride } from '@onekeyhq/shared/src/utils/marketPresetFeeUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { ESwapNetworkFeeLevel } from '@onekeyhq/shared/types/swap/types';

type IMarketSwapReviewDialogProps = {
  reviewAnalytics?: ISwapReviewAnalytics;
  onDone: () => void;
  onConfirmStart?: () => void;
  adapter: ISwapReviewAdapter;
  reviewState: ISwapReviewState;
  defaultNetworkFeeLevel?: ESwapNetworkFeeLevel;
  defaultCustomPriorityFee?: ICustomPriorityFeeOverride;
  showCustomNetworkFeeOption?: boolean;
  disableSaveSlippageForFutureOrders?: boolean;
};

export function MarketSwapReviewDialog({
  reviewAnalytics,
  onDone,
  onConfirmStart,
  adapter,
  reviewState,
  defaultNetworkFeeLevel,
  defaultCustomPriorityFee,
  showCustomNetworkFeeOption,
  disableSaveSlippageForFutureOrders,
}: IMarketSwapReviewDialogProps) {
  return (
    <SwapReviewDialog
      reviewAnalytics={reviewAnalytics}
      onDone={onDone}
      onConfirmStart={onConfirmStart}
      adapter={adapter}
      reviewState={reviewState}
      defaultNetworkFeeLevel={defaultNetworkFeeLevel}
      defaultCustomPriorityFee={defaultCustomPriorityFee}
      showCustomNetworkFeeOption={showCustomNetworkFeeOption}
      disableSaveSlippageForFutureOrders={disableSaveSlippageForFutureOrders}
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
