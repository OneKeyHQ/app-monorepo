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
  const [, setStoredBalance] = useSwapStockSelectedFromTokenBalanceAtom();

  useLayoutEffect(() => {
    const nextBalance = enabled ? (balance ?? '') : '';
    setStoredBalance((storedBalance) =>
      storedBalance === nextBalance ? storedBalance : nextBalance,
    );
  }, [balance, enabled, ownerScope, setStoredBalance]);
}
