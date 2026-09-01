import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
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
  const currencyInfo = useCurrency();
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
    result: detailResult,
    isLoading: isDetailLoading,
    run,
  } = usePromiseResult(
    async () => ({
      details: await backgroundApiProxy.serviceStaking.getBorrowReserveDetails({
        networkId,
        provider,
        marketAddress,
        reserveAddress,
        ...(normalizedAccountId ? { accountId: normalizedAccountId } : {}),
      }),
      currencyId: currencyInfo.id,
    }),
    [
      networkId,
      provider,
      marketAddress,
      reserveAddress,
      normalizedAccountId,
      currencyInfo.id,
    ],
    { watchLoading: true, revalidateOnFocus: true },
  );

  const isCurrencyStale =
    detailResult !== undefined && detailResult.currencyId !== currencyInfo.id;
  const details = isCurrencyStale ? undefined : detailResult?.details;

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
      isDetailLoading ||
      isCurrencyStale,
    refreshData: run,
    refreshAccount,
  };
}
