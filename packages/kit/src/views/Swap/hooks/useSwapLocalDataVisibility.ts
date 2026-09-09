import { useMemo } from 'react';

import {
  useAccountSelectorStorageInitDoneAtom,
  useActiveAccount,
  useIsAccountSelectorActiveAccountInitDone,
} from '../../../states/jotai/contexts/accountSelector';
import {
  buildSwapLimitOrdersAccountIdKey,
  shouldShowSwapLimitOrders,
  shouldShowSwapLocalData,
} from '../utils/swapNoWalletWarningGuard';

export function useShouldShowSwapLocalData() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [accountSelectorStorageInitDone] =
    useAccountSelectorStorageInitDoneAtom();
  const accountSelectorActiveAccountInitDone =
    useIsAccountSelectorActiveAccountInitDone(0);

  return useMemo(
    () =>
      shouldShowSwapLocalData({
        accountInfoReady: activeAccount.ready,
        accountSelectorActiveAccountInitDone,
        accountSelectorStorageInitDone,
        hasAccount: Boolean(activeAccount.account),
        hasDbAccount: Boolean(activeAccount.dbAccount),
        hasAccountWallet: Boolean(activeAccount.wallet),
        hasIndexedAccount: Boolean(activeAccount.indexedAccount),
      }),
    [
      accountSelectorActiveAccountInitDone,
      accountSelectorStorageInitDone,
      activeAccount.account,
      activeAccount.dbAccount,
      activeAccount.indexedAccount,
      activeAccount.ready,
      activeAccount.wallet,
    ],
  );
}

export function useSwapLimitOrdersLocalDataVisibility(
  limitOrdersAccountIdKey: string | undefined,
) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const canShowSwapLocalData = useShouldShowSwapLocalData();
  const currentAccountIdKey = useMemo(
    () =>
      buildSwapLimitOrdersAccountIdKey({
        indexedAccountId: activeAccount.indexedAccount?.id,
        otherWalletTypeAccountId:
          activeAccount.account?.id ?? activeAccount.dbAccount?.id,
      }),
    [
      activeAccount.account?.id,
      activeAccount.dbAccount?.id,
      activeAccount.indexedAccount?.id,
    ],
  );

  return useMemo(
    () => ({
      shouldShowSwapLocalData: canShowSwapLocalData,
      shouldShowSwapLimitOrders: shouldShowSwapLimitOrders({
        shouldShowLocalData: canShowSwapLocalData,
        currentAccountIdKey,
        limitOrdersAccountIdKey,
      }),
    }),
    [canShowSwapLocalData, currentAccountIdKey, limitOrdersAccountIdKey],
  );
}
