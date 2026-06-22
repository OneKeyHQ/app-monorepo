import { useMemo } from 'react';

import {
  getPerpsAccountDisplaySnapshotEntry,
  usePerpsAccountDisplaySnapshotAtom,
  usePerpsActiveAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector/atoms';

export function usePerpsAccountScopedCacheAddress() {
  const [activeAccount] = usePerpsActiveAccountAtom();
  const [displaySnapshot] = usePerpsAccountDisplaySnapshotAtom();
  const { activeAccount: selectedWalletAccount } = useActiveAccount({ num: 0 });

  return useMemo(() => {
    if (activeAccount?.accountAddress) {
      return activeAccount.accountAddress;
    }

    if (!selectedWalletAccount.ready) {
      return null;
    }

    return (
      getPerpsAccountDisplaySnapshotEntry({
        snapshot: displaySnapshot,
        indexedAccountId: selectedWalletAccount.indexedAccount?.id,
        accountId: selectedWalletAccount.account?.id,
        deriveType: selectedWalletAccount.deriveType,
      })?.account.accountAddress ?? null
    );
  }, [
    activeAccount?.accountAddress,
    displaySnapshot,
    selectedWalletAccount.account?.id,
    selectedWalletAccount.deriveType,
    selectedWalletAccount.indexedAccount?.id,
    selectedWalletAccount.ready,
  ]);
}
