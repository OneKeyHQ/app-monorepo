import { useCallback, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useEarnAccount } from '@onekeyhq/kit/src/views/Staking/hooks/useEarnAccount';
import type { IBorrowReserveDetail } from '@onekeyhq/shared/types/staking';

import { getBorrowReserveTokenByAddress } from '../../../components/borrowRepayPosition.utils';

export function useBorrowReserveDetailData({
  accountId,
  networkId,
  indexedAccountId,
  provider,
  marketAddress,
  reserveAddress,
  resolveTokenMetadata = false,
}: {
  accountId?: string;
  networkId: string;
  indexedAccountId?: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  resolveTokenMetadata?: boolean;
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

  const reserveTokenScopeKey = resolveTokenMetadata
    ? JSON.stringify([
        networkId,
        provider,
        marketAddress,
        reserveAddress,
        normalizedAccountId,
      ])
    : undefined;

  const { result: reserveTokenResult, run: refreshReserveToken } =
    usePromiseResult(
      async () => {
        if (!reserveTokenScopeKey) {
          return undefined;
        }

        const reserves =
          await backgroundApiProxy.serviceStaking.getBorrowReserves({
            networkId,
            provider,
            marketAddress,
            ...(normalizedAccountId ? { accountId: normalizedAccountId } : {}),
          });

        return {
          scopeKey: reserveTokenScopeKey,
          token: getBorrowReserveTokenByAddress({
            reserves,
            reserveAddress,
          }),
        };
      },
      [
        reserveTokenScopeKey,
        networkId,
        provider,
        marketAddress,
        reserveAddress,
        normalizedAccountId,
      ],
      { revalidateOnFocus: true },
    );
  const reserveToken =
    reserveTokenScopeKey &&
    reserveTokenResult?.scopeKey === reserveTokenScopeKey
      ? reserveTokenResult.token
      : undefined;

  const refreshData = useCallback(async () => {
    await Promise.all([run(), refreshReserveToken()]);
  }, [refreshReserveToken, run]);

  const userInfo = useMemo<IBorrowReserveDetail['userInfo'] | undefined>(
    () => details?.userInfo,
    [details],
  );

  return {
    earnAccount,
    details,
    reserveToken,
    userInfo,
    isLoading:
      (normalizedAccountId || indexedAccountId ? isAccountLoading : false) ||
      isDetailLoading ||
      isCurrencyStale,
    refreshData,
    refreshAccount,
  };
}
