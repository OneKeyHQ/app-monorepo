import { useLayoutEffect } from 'react';

import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSwapStockSelectedFromTokenBalanceAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms';

export function useSwapStockSelectedBalanceSync({
  balance,
  enabled,
  ownerScope,
}: {
  balance?: string;
  enabled: boolean;
  ownerScope: string;
}) {
  const [, setStoredBalance] = useSwapStockSelectedFromTokenBalanceAtom();
  const isFocused = useRouteIsFocused();

  useLayoutEffect(() => {
    if (!isFocused) {
      return;
    }
    const nextBalance = enabled ? (balance ?? '') : '';
    setStoredBalance((storedBalance) =>
      storedBalance === nextBalance ? storedBalance : nextBalance,
    );
  }, [balance, enabled, isFocused, ownerScope, setStoredBalance]);
}
