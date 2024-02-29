import { useEffect } from 'react';

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

  // // Due to the high number of renderings of `activeAccount`, we are using debounce handling.
  const debouncedActiveAccount = useDebounce(activeAccount, 200);
  const debouncedSelectedAccount = useDebounce(selectedAccount, 200);

  useEffect(() => {
    if (handleAccountChanged) {
      handleAccountChanged(
        {
          activeAccount: debouncedActiveAccount,
          selectedAccount: debouncedSelectedAccount,
        },
        num,
      );
    }
  }, [
    debouncedActiveAccount,
    debouncedSelectedAccount,
    handleAccountChanged,
    num,
  ]);
}
