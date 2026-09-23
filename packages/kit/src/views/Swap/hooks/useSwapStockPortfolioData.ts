import { useCallback, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useStockDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext';
import {
  fetchStockPortfolioData,
  getStockPortfolioVariantKey,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useStockPortfolioData';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { IMarketAccountPortfolioDisplayItem } from '@onekeyhq/shared/types/marketV2';

import { useSwapProPositionAccountIdentity } from './useSwapPro';

// Dust floor for the My position table. The raw list still carries every
// holding so the token selector can report a real balance for each variant.
const SWAP_STOCK_POSITION_LIST_MIN_VALUE_USD = 0.01;

type IStockPortfolioNetworkAccount = {
  id: string;
  address: string;
  xpub?: string;
};

function buildPortfolioOwnerKey({
  accountId,
  indexedAccountId,
}: {
  accountId?: string;
  indexedAccountId?: string;
}) {
  if (indexedAccountId) return `indexed:${indexedAccountId}`;
  if (accountId) return `account:${accountId}`;
  return '';
}

function getNetworkAccountXpub(account: INetworkAccount) {
  if ('xpubSegwit' in account && account.xpubSegwit) {
    return account.xpubSegwit;
  }
  if ('xpub' in account && account.xpub) {
    return account.xpub;
  }
  return undefined;
}

/**
 * The Trade counterpart of the Market page's `useStockPortfolioData`: every
 * token variant of the current stock is looked up for the swap account, so
 * the panel lists all of the company's positions rather than only the token
 * being traded. `usePromiseResult` keeps the last result while a refresh is
 * in flight, so the list never blinks out between polls.
 */
export function useSwapStockPortfolioData() {
  const { accountId, indexedAccountId } = useSwapProPositionAccountIdentity();
  const { stockId, tokenVariants } = useStockDetail();
  const portfolioOwnerKey = buildPortfolioOwnerKey({
    accountId,
    indexedAccountId,
  });
  const successfulPortfolioCacheRef = useRef(
    new Map<string, IMarketAccountPortfolioDisplayItem[]>(),
  );
  // Account lookups are identity-bound and never change while the same
  // account stays selected, so every poll and stock switch reuses them
  // instead of paying two background round trips per network again.
  const networkAccountCacheRef = useRef(
    new Map<string, Promise<IStockPortfolioNetworkAccount | undefined>>(),
  );
  const hasAccount = Boolean(accountId || indexedAccountId);
  // Only the variant identities restart the query; the 6s variant metadata
  // refresh hands back a new array every tick and must not.
  const tokenVariantsKey = useMemo(
    () =>
      tokenVariants
        .map(
          (variant) =>
            `${getStockPortfolioVariantKey(variant)}:${variant.tokenId}:${
              variant.logoUrl ?? ''
            }:${variant.networkLogoUrl ?? ''}`,
        )
        .join('|'),
    [tokenVariants],
  );
  const tokenVariantsRef = useRef(tokenVariants);
  tokenVariantsRef.current = tokenVariants;

  const resolveNetworkAccount = useCallback(
    async (networkId: string) => {
      const cacheKey = `${indexedAccountId ?? ''}:${accountId ?? ''}:${networkId}`;
      const cached = networkAccountCacheRef.current.get(cacheKey);
      if (cached) return cached;
      const lookup = (async () => {
        const deriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId,
          });
        const networkAccount =
          await backgroundApiProxy.serviceAccount.getNetworkAccount({
            accountId: indexedAccountId ? undefined : accountId,
            indexedAccountId,
            networkId,
            deriveType,
          });
        return {
          id: networkAccount.id,
          address: networkAccount.address,
          xpub: getNetworkAccountXpub(networkAccount),
        };
      })();
      networkAccountCacheRef.current.set(cacheKey, lookup);
      // A failed lookup (no address on that network yet, for example) must not
      // be pinned: the next poll retries it.
      lookup.catch(() => networkAccountCacheRef.current.delete(cacheKey));
      return lookup;
    },
    [accountId, indexedAccountId],
  );

  const {
    result: portfolioResult,
    isLoading: isRefreshing,
    run: fetchPortfolio,
  } = usePromiseResult(
    async () => {
      // Undefined rather than empty: with no account nothing was checked.
      if (!stockId || !hasAccount) return undefined;
      const data = await fetchStockPortfolioData({
        stockId,
        tokenVariants: tokenVariantsRef.current,
        successfulPortfolioCache: successfulPortfolioCacheRef.current,
        resolveNetworkAccount,
        fetchPortfolio: (params) =>
          backgroundApiProxy.serviceMarketV2.fetchMarketAccountPortfolio({
            ...params,
            throwOnError: true,
          }),
      });
      return { ...data, stockId, portfolioOwnerKey };
    },
    // The request reads the latest variants from a ref; see tokenVariantsKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      hasAccount,
      portfolioOwnerKey,
      resolveNetworkAccount,
      stockId,
      tokenVariantsKey,
    ],
    {
      watchLoading: true,
      pollingInterval:
        stockId && hasAccount
          ? timerUtils.getTimeDurationMs({ seconds: 15 })
          : undefined,
      runImmediatelyOnPollingIntervalChange: true,
      revalidateOnReconnect: true,
    },
  );

  // usePromiseResult hands back the previous stock's rows until the new
  // request lands; those rows belong to another company, so they are not
  // shown under this one.
  const currentPortfolioResult =
    portfolioResult?.stockId === stockId &&
    portfolioResult?.portfolioOwnerKey === portfolioOwnerKey
      ? portfolioResult
      : undefined;
  const portfolioData = useMemo(
    () => currentPortfolioResult?.items ?? [],
    [currentPortfolioResult],
  );
  // What the table shows: dust dropped, largest holding first.
  const positionListData = useMemo(
    () =>
      portfolioData
        .filter((item) =>
          new BigNumber(item.totalPrice ?? '0').gte(
            SWAP_STOCK_POSITION_LIST_MIN_VALUE_USD,
          ),
        )
        .toSorted((left, right) =>
          new BigNumber(right.totalPrice ?? '0').comparedTo(
            new BigNumber(left.totalPrice ?? '0'),
          ),
        ),
    [portfolioData],
  );
  const resolvedVariantKeys = useMemo(
    () => currentPortfolioResult?.resolvedVariantKeys ?? [],
    [currentPortfolioResult],
  );

  return {
    portfolioData,
    positionListData,
    resolvedVariantKeys,
    isRefreshing: Boolean(isRefreshing),
    hasAccount,
    fetchPortfolio,
  };
}
