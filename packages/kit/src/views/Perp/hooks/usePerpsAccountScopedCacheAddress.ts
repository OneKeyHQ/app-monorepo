import { useMemo } from 'react';

import {
  getPerpsAccountDisplaySnapshotEntry,
  usePerpsAccountDisplaySnapshotAtom,
  usePerpsActiveAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector/atoms';
import { isPerpsAccountSelectionResolved } from '../utils/accountScopedData';

export function usePerpsAccountScopedCacheAddress() {
  const [activeAccount] = usePerpsActiveAccountAtom();
  const [displaySnapshot] = usePerpsAccountDisplaySnapshotAtom();
  const { activeAccount: selectedWalletAccount } = useActiveAccount({ num: 0 });

  return useMemo(() => {
    if (!selectedWalletAccount.ready) {
      return null;
    }

    if (
      activeAccount.accountAddress &&
      isPerpsAccountSelectionResolved({
        selectedWalletReady: selectedWalletAccount.ready,
        selectAccountLoading: false,
        selectedAccountId: selectedWalletAccount.account?.id,
        selectedIndexedAccountId: selectedWalletAccount.indexedAccount?.id,
        activeAccountId: activeAccount.accountId,
        activeIndexedAccountId: activeAccount.indexedAccountId,
      })
    ) {
      return activeAccount.accountAddress;
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
    activeAccount.accountAddress,
    activeAccount.accountId,
    activeAccount.indexedAccountId,
    displaySnapshot,
    selectedWalletAccount.account?.id,
    selectedWalletAccount.deriveType,
    selectedWalletAccount.indexedAccount?.id,
    selectedWalletAccount.ready,
  ]);
}
