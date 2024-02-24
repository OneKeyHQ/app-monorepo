import { useEffect, useRef } from 'react';

import { debounce } from 'lodash';

import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';

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
  const debouncedHandleAccountChanged = useRef(
    debounce(
      (params: IHandleAccountChangedParams, accountSelectorNum: number) =>
        handleAccountChanged?.(params, accountSelectorNum),
      200,
    ),
  );
  // Use `useEffect` to listen for changes to `handleAccountChanged` and reset the debounced function.
  useEffect(() => {
    debouncedHandleAccountChanged.current = debounce(
      (params: IHandleAccountChangedParams) =>
        handleAccountChanged?.(params, num),
      200,
    );
    return () => {
      debouncedHandleAccountChanged.current.cancel();
    };
  }, [handleAccountChanged, num]);

  useEffect(() => {
    debouncedHandleAccountChanged.current(
      {
        activeAccount,
        selectedAccount,
      },
      num,
    );
  }, [activeAccount, handleAccountChanged, selectedAccount, num]);
}
