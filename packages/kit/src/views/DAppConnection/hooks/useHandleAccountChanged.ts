import { useEffect, useRef } from 'react';

import { debounce } from 'lodash';

import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';

export type IHandleAccountChanged = (
  activeAccount: IAccountSelectorActiveAccountInfo,
) => void;

export function useHandleDiscoveryAccountChanged({
  num,
  handleAccountChanged,
}: {
  num: number;
  handleAccountChanged?: IHandleAccountChanged;
}) {
  const { activeAccount } = useActiveAccount({ num });
  // Due to the high number of renderings of `activeAccount`, we are using debounce handling.
  const debouncedHandleAccountChanged = useRef(
    debounce(
      (account: IAccountSelectorActiveAccountInfo) =>
        handleAccountChanged?.(account),
      200,
    ),
  );
  useEffect(() => {
    debouncedHandleAccountChanged.current(activeAccount);
  }, [activeAccount, handleAccountChanged]);
}
