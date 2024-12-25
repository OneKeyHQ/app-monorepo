import { useEffect, useRef } from 'react';

import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
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

  const accountAddress = activeAccount?.account?.address;

  const activeAccountDepsId = `${accountAddress || ''}-${
    activeAccount?.wallet?.id ?? ''
  }-${activeAccount?.account?.id ?? ''}-${
    activeAccount?.indexedAccount?.id ?? ''
  }-${activeAccount?.dbAccount?.id ?? ''}`;
  const debouncedActiveAccountDepsId = useDebounce(activeAccountDepsId, 200);

  const activeAccountRef = useRef(activeAccount);
  const selectedAccountRef = useRef(selectedAccount);
  const accountAddressRef = useRef(accountAddress);
  activeAccountRef.current = activeAccount;
  selectedAccountRef.current = selectedAccount;
  accountAddressRef.current = accountAddress;

  useEffect(() => {
    if (
      handleAccountChanged &&
      debouncedActiveAccountDepsId &&
      activeAccountRef.current
    ) {
      handleAccountChanged(
        {
          activeAccount: activeAccountRef.current,
          selectedAccount: selectedAccountRef.current,
        },
        num,
      );
    }
  }, [debouncedActiveAccountDepsId, handleAccountChanged, num]);
}
