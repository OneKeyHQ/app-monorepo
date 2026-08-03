import { useLayoutEffect } from 'react';

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
  const [storedBalance, setStoredBalance] =
    useSwapStockSelectedFromTokenBalanceAtom();

  useLayoutEffect(() => {
    const nextBalance = enabled ? (balance ?? '') : '';
    if (storedBalance !== nextBalance) {
      setStoredBalance(nextBalance);
    }
  }, [balance, enabled, ownerScope, setStoredBalance, storedBalance]);
}
