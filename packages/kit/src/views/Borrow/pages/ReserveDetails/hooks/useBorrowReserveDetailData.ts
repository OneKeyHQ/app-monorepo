import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useEarnAccount } from '@onekeyhq/kit/src/views/Staking/hooks/useEarnAccount';
import type { IBorrowReserveDetail } from '@onekeyhq/shared/types/staking';

export function useBorrowReserveDetailData({
  accountId,
  networkId,
  indexedAccountId,
  provider,
  marketAddress,
  reserveAddress,
}: {
  accountId?: string;
  networkId: string;
  indexedAccountId?: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
}) {
  const normalizedAccountId = accountId?.trim() || undefined;
  const {
    earnAccount,
    refreshAccount,
    isLoading: isAccountLoading,
  } = useEarnAccount({
    networkId,
    accountId: normalizedAccountId,
    indexedAccountId,
  });

  const {
    result: details,
    isLoading: isDetailLoading,
    run,
  } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceStaking.getBorrowReserveDetails({
        networkId,
        provider,
        marketAddress,
        reserveAddress,
        ...(normalizedAccountId ? { accountId: normalizedAccountId } : {}),
      }),
    [networkId, provider, marketAddress, reserveAddress, normalizedAccountId],
    { watchLoading: true, revalidateOnFocus: true },
  );

  const userInfo = useMemo<IBorrowReserveDetail['userInfo'] | undefined>(
    () => details?.userInfo,
    [details],
  );

  return {
    earnAccount,
    details,
    userInfo,
    isLoading:
      (normalizedAccountId || indexedAccountId ? isAccountLoading : false) ||
      isDetailLoading,
    refreshData: run,
    refreshAccount,
  };
}
