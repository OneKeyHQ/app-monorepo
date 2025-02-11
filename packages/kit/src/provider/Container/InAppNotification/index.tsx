import { useEffect } from 'react';

import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

const InAppNotification = () => {
  const [{ swapHistoryPendingList, swapLimitOrders }] =
    useInAppNotificationAtom();

  useEffect(() => {
    void backgroundApiProxy.serviceSwap.swapHistoryStatusFetchLoop();
  }, [swapHistoryPendingList]);

  const { activeAccount } = useActiveAccount({ num: 0 });
  usePromiseResult(async () => {
    if (activeAccount) {
      // void backgroundApiProxy.serviceSwap.swapLimitOrdersFetchLoop(
      //   activeAccount.address,
      //   activeAccount.networkId,
      // );
    }
  }, [activeAccount]);

  useEffect(() => {
    // void backgroundApiProxy.serviceSwap.swapLimitOrdersFetchLoop();
  }, [swapLimitOrders]);

  return null;
};

export default function InAppNotificationWithAccount() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <InAppNotification />
    </AccountSelectorProviderMirror>
  );
}
