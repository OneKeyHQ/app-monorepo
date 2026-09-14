import { useEffect } from 'react';

import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { jotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/jotaiContextStore';
import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ICustomPriorityFeeOverride } from '@onekeyhq/shared/src/utils/marketPresetFeeUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { ESwapNetworkFeeLevel } from '@onekeyhq/shared/types/swap/types';

import { useSwapReviewActions } from '../../hooks/useSwapReviewActions';
import { isSwapReviewConfirmBlocked } from '../../utils/swapReviewRebuildStateMachine';
import {
  ESwapReviewApproveTransactionSource,
  type ISwapReviewAdapter,
  type ISwapReviewState,
} from '../../utils/swapReviewState';
import { SwapProviderMirror } from '../SwapProviderMirror';

import PreSwapDialogContent from './PreSwapDialogContent';
import { SwapReviewInitializer } from './SwapReviewInitializer';

type ISwapReviewDialogProps = {
  onDone: () => void;
  onConfirmStart?: () => void;
  adapter: ISwapReviewAdapter;
  reviewState: ISwapReviewState;
  storeName: EJotaiContextStoreNames;
  defaultNetworkFeeLevel?: ESwapNetworkFeeLevel;
  defaultCustomPriorityFee?: ICustomPriorityFeeOverride;
  showCustomNetworkFeeOption?: boolean;
  disableGlobalApproveSync?: boolean;
  disableSaveSlippageForFutureOrders?: boolean;
  approveTransactionSource?: ESwapReviewApproveTransactionSource;
  accountSelectorConfig?: {
    config: {
      sceneName: EAccountSelectorSceneName;
      sceneUrl: string;
    };
    enabledNum: number[];
  };
};

function SwapReviewDialogContent({
  adapter,
  approveTransactionSource,
  disableGlobalApproveSync,
  disableSaveSlippageForFutureOrders,
  defaultCustomPriorityFee,
  defaultNetworkFeeLevel,
  showCustomNetworkFeeOption,
  onDone,
  onConfirmStart,
}: {
  adapter: ISwapReviewAdapter;
  approveTransactionSource: ESwapReviewApproveTransactionSource;
  disableGlobalApproveSync?: boolean;
  disableSaveSlippageForFutureOrders?: boolean;
  defaultNetworkFeeLevel?: ESwapNetworkFeeLevel;
  defaultCustomPriorityFee?: ICustomPriorityFeeOverride;
  showCustomNetworkFeeOption?: boolean;
  onDone: () => void;
  onConfirmStart?: () => void;
}) {
  const {
    onConfirm,
    preSwapBeforeStepActions,
    preSwapStepsStart,
    rebuildReviewWithSlippage,
    reviewRebuildState,
    resetUncommittedReviewRebuildError,
  } = useSwapReviewActions({
    adapter,
    approveTransactionSource,
  });

  return (
    <PreSwapDialogContent
      disableGlobalApproveSync={disableGlobalApproveSync}
      disableSaveSlippageForFutureOrders={disableSaveSlippageForFutureOrders}
      onConfirm={() => {
        if (isSwapReviewConfirmBlocked(reviewRebuildState.phase)) {
          return;
        }
        onConfirm(onConfirmStart);
      }}
      onDone={onDone}
      preSwapBeforeStepActions={preSwapBeforeStepActions}
      preSwapStepsStart={preSwapStepsStart}
      rebuildReviewWithSlippage={rebuildReviewWithSlippage}
      reviewRebuildState={reviewRebuildState}
      resetUncommittedReviewRebuildError={resetUncommittedReviewRebuildError}
      saveSlippageForFutureOrders={adapter.saveSlippageForFutureOrders}
      defaultNetworkFeeLevel={defaultNetworkFeeLevel}
      defaultCustomPriorityFee={defaultCustomPriorityFee}
      showCustomNetworkFeeOption={showCustomNetworkFeeOption}
    />
  );
}

export function SwapReviewDialog({
  onDone,
  onConfirmStart,
  adapter,
  reviewState,
  storeName,
  defaultNetworkFeeLevel,
  defaultCustomPriorityFee,
  showCustomNetworkFeeOption,
  disableGlobalApproveSync,
  disableSaveSlippageForFutureOrders,
  approveTransactionSource = ESwapReviewApproveTransactionSource.None,
  accountSelectorConfig = {
    config: {
      sceneName: EAccountSelectorSceneName.swap,
      sceneUrl: '',
    },
    enabledNum: [0],
  },
}: ISwapReviewDialogProps) {
  useEffect(() => {
    return () => {
      jotaiContextStore.removeStore({
        storeName,
      });
    };
  }, [storeName]);

  return (
    <AccountSelectorProviderMirror
      config={accountSelectorConfig.config}
      enabledNum={accountSelectorConfig.enabledNum}
    >
      <SwapProviderMirror storeName={storeName}>
        <SwapReviewInitializer
          defaultNetworkFeeLevel={defaultNetworkFeeLevel}
          defaultCustomPriorityFee={defaultCustomPriorityFee}
          reviewState={reviewState}
        >
          <SwapReviewDialogContent
            adapter={adapter}
            approveTransactionSource={approveTransactionSource}
            disableGlobalApproveSync={disableGlobalApproveSync}
            disableSaveSlippageForFutureOrders={
              disableSaveSlippageForFutureOrders
            }
            defaultNetworkFeeLevel={defaultNetworkFeeLevel}
            defaultCustomPriorityFee={defaultCustomPriorityFee}
            showCustomNetworkFeeOption={showCustomNetworkFeeOption}
            onDone={onDone}
            onConfirmStart={onConfirmStart}
          />
        </SwapReviewInitializer>
      </SwapProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
