import { useMemo } from 'react';

import { usePerpsActiveOpenOrdersAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { getPerpsAccountScopedListData } from '../utils/accountScopedData';

import { usePerpsAccountScopedCacheAddress } from './usePerpsAccountScopedCacheAddress';

// Scope in the React layer (like active positions): the global
// perpsActiveAccountAtom reads null inside a PerpsProviderMirror store, so
// scoping it from a derived atom would drop every order. (OK-56510)
export function usePerpsAccountScopedOpenOrdersByCoin(
  coin: string,
): IPerpsFrontendOrder[] {
  const accountScopedAddress = usePerpsAccountScopedCacheAddress();
  const [{ accountAddress, openOrdersByCoin }] = usePerpsActiveOpenOrdersAtom();

  return useMemo(
    () =>
      getPerpsAccountScopedListData({
        activeAccountAddress: accountScopedAddress,
        dataAccountAddress: accountAddress,
        data: openOrdersByCoin?.[coin] ?? [],
      }),
    [accountScopedAddress, accountAddress, openOrdersByCoin, coin],
  );
}
