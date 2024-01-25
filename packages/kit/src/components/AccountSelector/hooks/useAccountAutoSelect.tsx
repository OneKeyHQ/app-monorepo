import { useEffect } from 'react';

import {
  useAccountSelectorActions,
  useAccountSelectorStorageReadyAtom,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';

export function useAccountAutoSelect({ num }: { num: number }) {
  const {
    activeAccount: { ready: activeAccountReady },
  } = useActiveAccount({ num });
  const [storageReady] = useAccountSelectorStorageReadyAtom();

  const actions = useAccountSelectorActions();

  useEffect(() => {
    if (!storageReady || !activeAccountReady) {
      return;
    }
    void actions.current.autoSelectAccount({ num });
  }, [actions, activeAccountReady, num, storageReady]);
}
