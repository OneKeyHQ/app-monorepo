import { useCallback, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import {
  getBorrowAssetByReserveAddress,
  hasPositiveBorrowBalance,
} from '../../../components/borrowRepayPosition.utils';

/**
 * What the account holds of the reserve, from the market's own list (the
 * Borrow page's My Supply and My Borrow): whether it supplies it and whether
 * it borrows it. A failed read keeps the last one for the same account
 */
export function useReserveAccountPosition({
  accountId,
  networkId,
  provider,
  marketAddress,
  reserveAddress,
}: {
  accountId?: string;
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
}) {
  const scopeKey = JSON.stringify([
    accountId ?? '',
    networkId,
    provider,
    marketAddress,
  ]);
  const lastReadRef = useRef<{
    scopeKey: string;
    reserves: IBorrowReserveItem | undefined;
  }>(undefined);

  const { result, run } = usePromiseResult(
    async () => {
      if (!accountId) {
        return { scopeKey, reserves: undefined };
      }
      try {
        const reserves =
          await backgroundApiProxy.serviceStaking.getBorrowReserves({
            networkId,
            provider,
            marketAddress,
            accountId,
          });
        lastReadRef.current = { scopeKey, reserves };
        return { scopeKey, reserves };
      } catch {
        const kept =
          lastReadRef.current?.scopeKey === scopeKey
            ? lastReadRef.current.reserves
            : undefined;
        return { scopeKey, reserves: kept };
      }
    },
    [accountId, marketAddress, networkId, provider, scopeKey],
    { revalidateOnFocus: true },
  );

  const isReady = result?.scopeKey === scopeKey;
  const reserves = isReady ? result.reserves : undefined;

  const position = useMemo(() => {
    const supplied = getBorrowAssetByReserveAddress({
      assets: reserves?.supplied?.assets,
      reserveAddress,
    });
    const borrowed = getBorrowAssetByReserveAddress({
      assets: reserves?.borrowed?.assets,
      reserveAddress,
    });
    return {
      hasSupplied: hasPositiveBorrowBalance(supplied?.suppliedAmount),
      hasBorrowed: hasPositiveBorrowBalance(borrowed?.borrowedAmount),
    };
  }, [reserveAddress, reserves]);

  const refresh = useCallback(() => run({ alwaysSetState: true }), [run]);

  return { ...position, isReady, scopeKey, refresh };
}
