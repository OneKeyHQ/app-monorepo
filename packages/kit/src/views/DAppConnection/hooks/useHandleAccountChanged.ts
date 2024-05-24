import { useEffect, useRef } from 'react';

import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';

import { useDebounce } from '../../../hooks/useDebounce';

export type IHandleAccountChangedParams = {
  activeAccount: IAccountSelectorActiveAccountInfo;
  selectedAccount: IAccountSelectorSelectedAccount;
  num?: number;
};
export type IHandleAccountChanged = (
  params: IHandleAccountChangedParams,
  num?: number,
) => void;

export function useHandleDiscoveryAccountChanged({
  num,
  handleAccountChanged,
}: {
  num: number;
  handleAccountChanged?: IHandleAccountChanged;
}) {
  const { activeAccount } = useActiveAccount({ num });
  const { selectedAccount } = useSelectedAccount({ num });

  // Due to the high number of renderings of `activeAccount`, we are using debounce handling.
  const debouncedActiveAccount = useDebounce(activeAccount, 200);
  const debouncedSelectedAccount = useDebounce(selectedAccount, 200);

  const activeAccountRef = useRef(activeAccount);
  const selectedAccountRef = useRef(selectedAccount);
  useEffect(() => {
    activeAccountRef.current = activeAccount;
    selectedAccountRef.current = selectedAccount;
  }, [activeAccount, selectedAccount]);

  useEffect(() => {
    if (handleAccountChanged) {
      // ensure the selected account is the same as the active account
      if (
        (debouncedActiveAccount.isOthersWallet &&
          debouncedActiveAccount.account?.id ===
            debouncedSelectedAccount.othersWalletAccountId) ||
        debouncedActiveAccount.indexedAccount?.id ===
          debouncedSelectedAccount.indexedAccountId
      ) {
        handleAccountChanged(
          {
            activeAccount: activeAccountRef.current,
            selectedAccount: selectedAccountRef.current,
          },
          num,
        );
      }
    }
  }, [
    debouncedActiveAccount,
    debouncedSelectedAccount,
    handleAccountChanged,
    num,
  ]);
}
