import { useCallback, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useStockDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext';
import {
  fetchStockPortfolioData,
  getStockPortfolioVariantKey,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useStockPortfolioData';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { IMarketAccountPortfolioDisplayItem } from '@onekeyhq/shared/types/marketV2';

import { isTradePositionVisible } from '../utils/tradePositionUtils';

import {
  resolveSwapBalanceAccount,
  resolveSwapTargetNetworkAccount,
} from './useSwapAccount.utils';
import { useSwapProPositionAccountIdentity } from './useSwapPro';

function buildPortfolioOwnerKey({
  accountId,
  indexedAccountId,
  deriveType,
}: {
  accountId?: string;
  indexedAccountId?: string;
  deriveType?: string;
}) {
  let owner = '';
  if (indexedAccountId) {
    owner = `indexed:${indexedAccountId}`;
  } else if (accountId) {
    owner = `account:${accountId}`;
  }
  return owner ? `${owner}:derive:${deriveType ?? 'network-default'}` : '';
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
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { portfolioNetworkId, stockId, tokenVariants } = useStockDetail();
  const portfolioOwnerKey = `${buildPortfolioOwnerKey({
    accountId,
    indexedAccountId,
    deriveType: activeAccount.deriveType,
  })}:${activeAccount.network?.id ?? ''}:${activeAccount.account?.id ?? ''}:${activeAccount.account?.address ?? ''}:${activeAccount.ready}`;
  const successfulPortfolioCacheRef = useRef(
    new Map<string, IMarketAccountPortfolioDisplayItem[]>(),
  );
  // Cache network accounts by Swap identity and the resolved global derive type.
  // Read that type on each poll so changes cannot reuse another address.
  const networkAccountCacheRef = useRef(
    new Map<string, Promise<INetworkAccount | undefined>>(),
  );
  // Selection can advance before the active account finishes synchronizing.
  const hasAccount = Boolean(
    activeAccount.ready &&
    (indexedAccountId
      ? indexedAccountId === activeAccount.indexedAccount?.id
      : accountId &&
        (accountId === activeAccount.account?.id ||
          accountId === activeAccount.dbAccount?.id)),
  );
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
      if (!hasAccount) return undefined;
      const networkAccount = await resolveSwapBalanceAccount({
        activeAccount,
        networkId,
        resolveNetworkAccount: () =>
          resolveSwapTargetNetworkAccount({
            getDeriveType: () =>
              backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
                networkId,
              }),
            getNetworkAccount: async (deriveType) => {
              const cacheKey = `${portfolioOwnerKey}:${networkId}:${deriveType}`;
              const cached = networkAccountCacheRef.current.get(cacheKey);
              if (cached) return cached;
              const lookup = (async () => {
                const resolvedAccount =
                  await backgroundApiProxy.serviceAccount.getNetworkAccount({
                    accountId: indexedAccountId ? undefined : accountId,
                    indexedAccountId,
                    dbAccount: activeAccount.dbAccount,
                    networkId,
                    deriveType,
                  });
                if (!resolvedAccount.address) return undefined;
                return resolvedAccount;
              })();
              networkAccountCacheRef.current.set(cacheKey, lookup);
              // A failed lookup (no address on that network yet, for example) must not
              // be pinned: the next poll retries it.
              void lookup.then(
                (result) => {
                  if (
                    !result &&
                    networkAccountCacheRef.current.get(cacheKey) === lookup
                  ) {
                    networkAccountCacheRef.current.delete(cacheKey);
                  }
                },
                () => {
                  if (networkAccountCacheRef.current.get(cacheKey) === lookup) {
                    networkAccountCacheRef.current.delete(cacheKey);
                  }
                },
              );
              return lookup;
            },
          }).then(({ account }) => account),
      });
      if (!networkAccount?.address) return undefined;
      return {
        id: networkAccount.id,
        address: networkAccount.address,
        xpub: getNetworkAccountXpub(networkAccount),
      };
    },
    [accountId, activeAccount, hasAccount, indexedAccountId, portfolioOwnerKey],
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
      portfolioNetworkId,
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
    hasAccount &&
    portfolioResult?.stockId === stockId &&
    portfolioResult?.portfolioOwnerKey === portfolioOwnerKey
      ? portfolioResult
      : undefined;
  const portfolioData = useMemo(
    () => currentPortfolioResult?.items ?? [],
    [currentPortfolioResult],
  );
  // Keep every held variant, largest holding first.
  const positionListData = useMemo(
    () =>
      portfolioData
        .filter((item) =>
          isTradePositionVisible({ balance: item.amount, isStock: true }),
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
