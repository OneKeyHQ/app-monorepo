import { useEffect } from 'react';

import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { jotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/jotaiContextStore';
import PreSwapDialogContent from '@onekeyhq/kit/src/views/Swap/pages/components/PreSwapDialogContent';
import { SwapProviderMirror } from '@onekeyhq/kit/src/views/Swap/pages/SwapProviderMirror';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useMarketSwapReviewActions } from './hooks/useMarketSwapReviewActions';
import { MarketSwapReviewInitializer } from './MarketSwapReviewInitializer';

import type { IMarketSwapReviewAdapter } from './hooks/useSpeedSwapActions';
import type { IMarketSwapReviewState } from './MarketSwapReviewInitializer';

function MarketSwapReviewDialogContent({
  adapter,
  onDone,
}: {
  adapter: IMarketSwapReviewAdapter;
  onDone: () => void;
}) {
  const { onConfirm, preSwapBeforeStepActions, preSwapStepsStart } =
    useMarketSwapReviewActions({
      adapter,
    });

  return (
    <PreSwapDialogContent
      disableGlobalApproveSync
      onConfirm={onConfirm}
      onDone={onDone}
      preSwapBeforeStepActions={preSwapBeforeStepActions}
      preSwapStepsStart={preSwapStepsStart}
    />
  );
}

type IMarketSwapReviewDialogProps = {
  onDone: () => void;
  adapter: IMarketSwapReviewAdapter;
  reviewState: IMarketSwapReviewState;
};

export function MarketSwapReviewDialog({
  onDone,
  adapter,
  reviewState,
}: IMarketSwapReviewDialogProps) {
  useEffect(() => {
    return () => {
      jotaiContextStore.removeStore({
        storeName: EJotaiContextStoreNames.marketSwapReview,
      });
    };
  }, []);

  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.swap,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <SwapProviderMirror storeName={EJotaiContextStoreNames.marketSwapReview}>
        <MarketSwapReviewInitializer reviewState={reviewState}>
          <MarketSwapReviewDialogContent adapter={adapter} onDone={onDone} />
        </MarketSwapReviewInitializer>
      </SwapProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
