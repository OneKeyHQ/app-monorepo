import { useEffect } from 'react';

import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

const InAppNotification = () => {
  const [{ swapHistoryPendingList }] = useInAppNotificationAtom();

  useEffect(() => {
    void backgroundApiProxy.serviceSwap.swapHistoryStatusFetchLoop();
  }, [swapHistoryPendingList]);

  const { activeAccount } = useActiveAccount({ num: 0 });

  useEffect(() => {
    if (!activeAccount?.ready) {
      return;
    }
    void backgroundApiProxy.serviceSwap.swapLimitOrdersFetchLoop(
      activeAccount?.indexedAccount?.id,
      !activeAccount?.indexedAccount?.id
        ? activeAccount?.account?.id ?? activeAccount?.dbAccount?.id
        : undefined,
    );
  }, [
    activeAccount?.indexedAccount?.id,
    activeAccount?.account?.id,
    activeAccount?.dbAccount?.id,
    activeAccount?.ready,
  ]);

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
