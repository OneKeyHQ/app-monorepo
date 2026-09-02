import { useEffect, useRef } from 'react';

import { useThrottledCallback } from 'use-debounce';

import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  defaultSelectedAccount,
  selectedAccountsAtom,
  useAccountSelectorContextData,
  useActiveAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';

export type IHandleAccountChangedParams = {
  activeAccount: IAccountSelectorActiveAccountInfo;
  selectedAccount: IAccountSelectorSelectedAccount;
  num?: number;
};
// A handler may reject the change (e.g. backup gate). `revertTo` is the
// selection the account selector should be rolled back to so the UI does not
// keep showing an account the dApp session never received.
export type IHandleAccountChangedResult =
  | {
      revertTo?: IAccountSelectorSelectedAccount;
    }
  | undefined
  | void;
export type IHandleAccountChanged = (
  params: IHandleAccountChangedParams,
  num?: number,
) => IHandleAccountChangedResult | Promise<IHandleAccountChangedResult>;

export function useHandleDiscoveryAccountChanged({
  num,
  handleAccountChanged,
}: {
  num: number;
  handleAccountChanged?: IHandleAccountChanged;
}) {
  const actions = useAccountSelectorActions();
  const { store } = useAccountSelectorContextData();
  const { activeAccount } = useActiveAccount({ num });

  const accountAddress = activeAccount?.account?.address;

  const activeAccountDepsId = [
    accountAddress || '',
    activeAccount?.wallet?.id ?? '',
    activeAccount?.account?.id ?? '',
    activeAccount?.indexedAccount?.id ?? '',
    activeAccount?.dbAccount?.id ?? '',
    activeAccount?.network?.id ?? '',
    activeAccount?.deriveType ?? '',
  ].join('-');

  const activeAccountRef = useRef(activeAccount);
  const accountAddressRef = useRef(accountAddress);
  const activeAccountDepsIdRef = useRef(activeAccountDepsId);
  const storeRef = useRef(store);
  activeAccountRef.current = activeAccount;
  accountAddressRef.current = accountAddress;
  activeAccountDepsIdRef.current = activeAccountDepsId;
  storeRef.current = store;

  const handleAccountChangedThrottle = useThrottledCallback(
    () => {
      const currentStore = storeRef.current;
      if (
        handleAccountChanged &&
        activeAccountDepsId &&
        activeAccountRef.current &&
        currentStore
      ) {
        const selectedAccount =
          currentStore.get(selectedAccountsAtom())[num] ??
          defaultSelectedAccount();
        const latestActiveAccount = activeAccountRef.current;
        let activeIdentityMatchesSelection: boolean;
        if (selectedAccount.indexedAccountId) {
          activeIdentityMatchesSelection =
            latestActiveAccount.indexedAccount?.id ===
            selectedAccount.indexedAccountId;
        } else if (selectedAccount.othersWalletAccountId) {
          // Mirrors how othersWalletAccountId is derived from the active account
          // (account?.id || dbAccount?.id): an others account that is not
          // compatible with the current network resolves to dbAccount only, so
          // comparing account?.id alone would never match and the dapp would
          // stop receiving account changes entirely.
          activeIdentityMatchesSelection =
            latestActiveAccount.account?.id ===
              selectedAccount.othersWalletAccountId ||
            latestActiveAccount.dbAccount?.id ===
              selectedAccount.othersWalletAccountId;
        } else {
          // The selection carries no account identity at all - a wallet whose
          // accounts were all deleted still offers creating the first one.
          // Require the active account to be equally empty so a leftover account
          // from the previous selection is never reported, and let the wallet /
          // network / deriveType checks below carry the guard.
          activeIdentityMatchesSelection =
            !latestActiveAccount.indexedAccount?.id &&
            !latestActiveAccount.account?.id;
        }
        if (
          !activeIdentityMatchesSelection ||
          latestActiveAccount.wallet?.id !== selectedAccount.walletId ||
          latestActiveAccount.network?.id !== selectedAccount.networkId ||
          latestActiveAccount.deriveType !== selectedAccount.deriveType
        ) {
          return;
        }
        const depsIdAtCall = activeAccountDepsIdRef.current;
        void (async () => {
          const result = await handleAccountChanged(
            {
              activeAccount: latestActiveAccount,
              selectedAccount,
            },
            num,
          );
          const revertTo = result?.revertTo;
          // Only roll back if the selector still points at the rejected
          // selection; a newer user choice must not be clobbered.
          if (!revertTo || activeAccountDepsIdRef.current !== depsIdAtCall) {
            return;
          }
          await actions.current.updateSelectedAccount({
            num,
            expectedSelection: selectedAccount,
            builder: (v) => ({
              ...v,
              walletId: revertTo.walletId,
              indexedAccountId: revertTo.indexedAccountId,
              othersWalletAccountId: revertTo.othersWalletAccountId,
              networkId: revertTo.networkId,
              deriveType: revertTo.deriveType,
              // Persisted sessions may carry `focusedWallet: ''`, which the
              // selector treats as "not ready". Prefer the session wallet so
              // the picker does not stay focused on the rejected wallet.
              focusedWallet:
                revertTo.focusedWallet || revertTo.walletId || v.focusedWallet,
            }),
          });
        })().catch((error) => {
          console.error(
            'useHandleDiscoveryAccountChanged: account change handler failed',
            error,
          );
        });
      }
    },
    200,
    {
      leading: false,
      trailing: true,
    },
  );

  useEffect(() => {
    if (activeAccountDepsId && activeAccountRef.current) {
      handleAccountChangedThrottle();
    }
  }, [activeAccountDepsId, handleAccountChangedThrottle]);
}
