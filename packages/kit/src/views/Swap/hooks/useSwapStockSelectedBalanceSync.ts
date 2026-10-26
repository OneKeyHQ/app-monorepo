import { useLayoutEffect } from 'react';

import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSwapStockSelectedFromTokenBalanceAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms';

export function useSwapStockSelectedBalanceSync({
  balance,
  balanceVerified = true,
  enabled,
  ownerScope,
}: {
  balance?: string;
  balanceVerified?: boolean;
  enabled: boolean;
  ownerScope: string;
}) {
  const [, setStoredBalance] = useSwapStockSelectedFromTokenBalanceAtom();
  const isFocused = useRouteIsFocused();

  useLayoutEffect(() => {
    if (!isFocused) {
      return;
    }
    const nextBalance = enabled && balanceVerified ? (balance ?? '') : '';
    setStoredBalance((storedBalance) =>
      storedBalance === nextBalance ? storedBalance : nextBalance,
    );
  }, [
    balance,
    balanceVerified,
    enabled,
    isFocused,
    ownerScope,
    setStoredBalance,
  ]);
}
