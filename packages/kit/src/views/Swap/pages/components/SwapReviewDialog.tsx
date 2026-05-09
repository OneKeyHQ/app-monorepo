import { useEffect } from 'react';

import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { jotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/jotaiContextStore';
import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ICustomPriorityFeeOverride } from '@onekeyhq/shared/src/utils/marketPresetFeeUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { ESwapNetworkFeeLevel } from '@onekeyhq/shared/types/swap/types';

import { useSwapReviewActions } from '../../hooks/useSwapReviewActions';
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
  adapter: ISwapReviewAdapter;
  reviewState: ISwapReviewState;
  storeName: EJotaiContextStoreNames;
  defaultNetworkFeeLevel?: ESwapNetworkFeeLevel;
  defaultCustomPriorityFee?: ICustomPriorityFeeOverride;
  disableGlobalApproveSync?: boolean;
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
  onDone,
}: {
  adapter: ISwapReviewAdapter;
  approveTransactionSource: ESwapReviewApproveTransactionSource;
  disableGlobalApproveSync?: boolean;
  onDone: () => void;
}) {
  const { onConfirm, preSwapBeforeStepActions, preSwapStepsStart } =
    useSwapReviewActions({
      adapter,
      approveTransactionSource,
    });

  return (
    <PreSwapDialogContent
      disableGlobalApproveSync={disableGlobalApproveSync}
      onConfirm={onConfirm}
      onDone={onDone}
      preSwapBeforeStepActions={preSwapBeforeStepActions}
      preSwapStepsStart={preSwapStepsStart}
    />
  );
}

export function SwapReviewDialog({
  onDone,
  adapter,
  reviewState,
  storeName,
  defaultNetworkFeeLevel,
  defaultCustomPriorityFee,
  disableGlobalApproveSync,
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
            onDone={onDone}
          />
        </SwapReviewInitializer>
      </SwapProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
