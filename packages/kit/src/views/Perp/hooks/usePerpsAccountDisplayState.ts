import { useMemo } from 'react';

import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  getPerpsAccountDisplaySnapshotEntry,
  usePerpsAccountDisplayReadyAtom,
  usePerpsAccountDisplaySnapshotAtom,
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountStatusAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { isPerpsAccountSelectionResolved } from '../utils/accountScopedData';

export function usePerpsAccountDisplayState() {
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const [displayReady] = usePerpsAccountDisplayReadyAtom();
  const [displaySnapshot] = usePerpsAccountDisplaySnapshotAtom();
  const [perpsActiveAccount] = usePerpsActiveAccountAtom();
  const [perpsAccountStatus] = usePerpsActiveAccountStatusAtom();
  const { activeAccount: selectedWalletAccount } = useActiveAccount({ num: 0 });

  const snapshotLookupIndexedAccountId = selectedWalletAccount.ready
    ? selectedWalletAccount.indexedAccount?.id
    : perpsActiveAccount.indexedAccountId;
  const snapshotLookupAccountId = selectedWalletAccount.ready
    ? selectedWalletAccount.account?.id
    : perpsActiveAccount.accountId;
  const snapshotLookupAccountAddress =
    !selectedWalletAccount.ready ||
    snapshotLookupIndexedAccountId ||
    snapshotLookupAccountId
      ? perpsActiveAccount.accountAddress
      : undefined;
  const snapshotEntry = useMemo(
    () =>
      getPerpsAccountDisplaySnapshotEntry({
        snapshot: displaySnapshot,
        accountAddress: snapshotLookupAccountAddress,
        indexedAccountId: snapshotLookupIndexedAccountId,
        accountId: snapshotLookupAccountId,
        deriveType:
          selectedWalletAccount.deriveType ?? perpsActiveAccount.deriveType,
      }),
    [
      displaySnapshot,
      perpsActiveAccount.deriveType,
      selectedWalletAccount.deriveType,
      snapshotLookupAccountAddress,
      snapshotLookupAccountId,
      snapshotLookupIndexedAccountId,
    ],
  );
  const isLiveStatusPending = Boolean(
    !displayReady.statusReady && snapshotEntry?.account.accountAddress,
  );
  const isAccountSelectionResolved = isPerpsAccountSelectionResolved({
    selectedWalletReady: selectedWalletAccount.ready,
    selectAccountLoading: perpsAccountLoading.selectAccountLoading,
    selectedAccountId: selectedWalletAccount.account?.id,
    selectedIndexedAccountId: selectedWalletAccount.indexedAccount?.id,
    activeAccountId: perpsActiveAccount.accountId,
    activeIndexedAccountId: perpsActiveAccount.indexedAccountId,
  });
  const shouldShowConnectWalletPrompt =
    (platformEnv.isWeb || platformEnv.isDesktop) &&
    isAccountSelectionResolved &&
    (!perpsActiveAccount.accountAddress ||
      perpsAccountStatus.accountNotSupport) &&
    !perpsAccountStatus.canCreateAddress;

  return {
    displayReady,
    displaySnapshot,
    isLiveStatusPending,
    perpsAccountLoading,
    perpsAccountStatus,
    selectedWalletAccount,
    shouldShowConnectWalletPrompt,
    snapshotEntry,
    snapshotLookupAccountAddress,
    snapshotLookupAccountId,
    snapshotLookupIndexedAccountId,
  };
}
