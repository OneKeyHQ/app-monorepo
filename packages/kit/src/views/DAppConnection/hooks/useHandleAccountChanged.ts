import { useEffect, useRef } from 'react';

import { useThrottledCallback } from 'use-debounce';

import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useActiveAccount,
  useSelectedAccount,
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
  const { activeAccount } = useActiveAccount({ num });
  const { selectedAccount } = useSelectedAccount({ num });

  const accountAddress = activeAccount?.account?.address;

  const activeAccountDepsId = [
    accountAddress || '',
    activeAccount?.wallet?.id ?? '',
    activeAccount?.account?.id ?? '',
    activeAccount?.indexedAccount?.id ?? '',
    activeAccount?.dbAccount?.id ?? '',
    activeAccount?.network?.id ?? '',
  ].join('-');

  const activeAccountRef = useRef(activeAccount);
  const selectedAccountRef = useRef(selectedAccount);
  const accountAddressRef = useRef(accountAddress);
  const activeAccountDepsIdRef = useRef(activeAccountDepsId);
  activeAccountRef.current = activeAccount;
  selectedAccountRef.current = selectedAccount;
  accountAddressRef.current = accountAddress;
  activeAccountDepsIdRef.current = activeAccountDepsId;

  const handleAccountChangedThrottle = useThrottledCallback(
    () => {
      if (
        handleAccountChanged &&
        activeAccountDepsId &&
        activeAccountRef.current
      ) {
        const depsIdAtCall = activeAccountDepsIdRef.current;
        void (async () => {
          const result = await handleAccountChanged(
            {
              activeAccount: activeAccountRef.current,
              selectedAccount: selectedAccountRef.current,
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
            builder: (v) => ({
              ...v,
              walletId: revertTo.walletId,
              indexedAccountId: revertTo.indexedAccountId,
              othersWalletAccountId: revertTo.othersWalletAccountId,
              networkId: revertTo.networkId,
              deriveType: revertTo.deriveType,
              // Persisted sessions may carry `focusedWallet: ''`, which the
              // selector treats as "not ready"; fall back on any falsy value.
              focusedWallet: revertTo.focusedWallet || v.focusedWallet,
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
