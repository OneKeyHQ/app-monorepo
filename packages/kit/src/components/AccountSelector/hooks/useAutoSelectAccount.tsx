import { useEffect } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import {
  useAccountSelectorActions,
  useAccountSelectorStorageReadyAtom,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';

export function useAutoSelectAccount({ num }: { num: number }) {
  const {
    activeAccount: { ready: activeAccountReady, account },
  } = useActiveAccount({ num });
  const [storageReady] = useAccountSelectorStorageReadyAtom();

  const actions = useAccountSelectorActions();

  useEffect(() => {
    if (!storageReady || !activeAccountReady) {
      return;
    }
    void actions.current.autoSelectAccount({ num });
  }, [actions, activeAccountReady, num, storageReady]);

  useEffect(() => {
    const fn = () => {
      if (!account) {
        void actions.current.autoSelectAccount({ num });
      }
    };
    appEventBus.on(EAppEventBusNames.WalletUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, fn);
    };
  }, [account, actions, num]);
}
