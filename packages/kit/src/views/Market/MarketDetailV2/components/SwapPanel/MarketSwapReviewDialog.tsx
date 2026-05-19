import { SwapReviewDialog } from '@onekeyhq/kit/src/views/Swap/pages/components/SwapReviewDialog';
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
  onDone: () => void;
  adapter: ISwapReviewAdapter;
  reviewState: ISwapReviewState;
  defaultNetworkFeeLevel?: ESwapNetworkFeeLevel;
  defaultCustomPriorityFee?: ICustomPriorityFeeOverride;
  showCustomNetworkFeeOption?: boolean;
};

export function MarketSwapReviewDialog({
  onDone,
  adapter,
  reviewState,
  defaultNetworkFeeLevel,
  defaultCustomPriorityFee,
  showCustomNetworkFeeOption,
}: IMarketSwapReviewDialogProps) {
  return (
    <SwapReviewDialog
      onDone={onDone}
      adapter={adapter}
      reviewState={reviewState}
      defaultNetworkFeeLevel={defaultNetworkFeeLevel}
      defaultCustomPriorityFee={defaultCustomPriorityFee}
      showCustomNetworkFeeOption={showCustomNetworkFeeOption}
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
