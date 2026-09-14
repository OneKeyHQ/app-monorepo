import { useCallback, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSelectedDeriveTypeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms';
import { getSelectedDeriveTypeForNetwork } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/marketDeriveType';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  equalTokenNoCaseSensitive,
  normalizeTokenContractAddress,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type {
  IMarketAccountPortfolioDisplayItem,
  IMarketAccountPortfolioResponse,
  IMarketStockTokenVariant,
} from '@onekeyhq/shared/types/marketV2';

import { useStockDetail } from './StockDetailContext';

type IStockPortfolioNetworkAccount = {
  id: string;
  address: string;
  xpub?: string;
};

type IFetchStockPortfolioDataParams = {
  stockId: string;
  tokenVariants: IMarketStockTokenVariant[];
  successfulPortfolioCache: Map<string, IMarketAccountPortfolioDisplayItem[]>;
  resolveNetworkAccount: (
    networkId: string,
  ) => Promise<IStockPortfolioNetworkAccount | undefined>;
  fetchPortfolio: (params: {
    networkId: string;
    accountAddress: string;
    tokenAddress: string;
    xpub?: string;
  }) => Promise<IMarketAccountPortfolioResponse>;
};

/**
 * Identity a balance lookup is keyed on. Exported so a consumer can ask whether
 * a given variant's balance was actually established this run.
 */
export function getStockPortfolioVariantKey(variant: IMarketStockTokenVariant) {
  const contractAddress =
    normalizeTokenContractAddress({
      networkId: variant.networkId,
      contractAddress: variant.contractAddress,
    }) ?? variant.contractAddress;
  return `${variant.networkId}:${contractAddress}`;
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

export function resolveStockPortfolioDeriveType({
  activeDeriveType,
  networkDefaultDeriveType,
  networkId,
  portfolioNetworkId,
  selectedDeriveType,
}: {
  activeDeriveType?: IAccountDeriveTypes;
  networkDefaultDeriveType?: IAccountDeriveTypes;
  networkId: string;
  portfolioNetworkId?: string;
  selectedDeriveType?: IAccountDeriveTypes;
}): IAccountDeriveTypes {
  if (networkId !== portfolioNetworkId) {
    return networkDefaultDeriveType ?? 'default';
  }

  return (
    selectedDeriveType ??
    networkDefaultDeriveType ??
    activeDeriveType ??
    'default'
  );
}

export async function fetchStockPortfolioData({
  stockId,
  tokenVariants,
  successfulPortfolioCache,
  resolveNetworkAccount,
  fetchPortfolio,
}: IFetchStockPortfolioDataParams) {
  const uniqueVariants = tokenVariants.filter(
    (variant, index, variants) =>
      variants.findIndex(
        (candidate) =>
          getStockPortfolioVariantKey(candidate) ===
          getStockPortfolioVariantKey(variant),
      ) === index,
  );
  const networkIds = Array.from(
    new Set(uniqueVariants.map((variant) => variant.networkId)),
  );
  const networkAccounts = new Map<
    string,
    IStockPortfolioNetworkAccount | undefined
  >(
    await Promise.all(
      networkIds.map(async (networkId) => {
        try {
          return [networkId, await resolveNetworkAccount(networkId)] as const;
        } catch (_error) {
          return [networkId, undefined] as const;
        }
      }),
    ),
  );

  const portfolioGroups = await Promise.all(
    uniqueVariants.map(async (variant) => {
      const variantKey = getStockPortfolioVariantKey(variant);
      const networkAccount = networkAccounts.get(variant.networkId);
      // No account for the variant's network means its balance was never
      // looked up, which is not the same as holding none of it.
      if (!networkAccount?.address) {
        return { variantKey, items: [], resolved: false };
      }

      const cacheKey = [stockId, networkAccount.id, variantKey].join(':');

      try {
        const response = await fetchPortfolio({
          networkId: variant.networkId,
          accountAddress: networkAccount.address,
          tokenAddress: variant.contractAddress,
          xpub: networkAccount.xpub,
        });
        const items = response.list
          .filter(
            (item) =>
              equalTokenNoCaseSensitive({
                token1: {
                  networkId: variant.networkId,
                  contractAddress: item.tokenAddress,
                },
                token2: {
                  networkId: variant.networkId,
                  contractAddress: variant.contractAddress,
                },
              }) && new BigNumber(item.amount).gt(0),
          )
          .map<IMarketAccountPortfolioDisplayItem>((item) => ({
            ...item,
            networkId: variant.networkId,
            tokenId: variant.tokenId,
            issuer: variant.issuer,
            tokenLogoUrl: variant.logoUrl,
            networkLogoUrl: variant.networkLogoUrl,
          }));
        successfulPortfolioCache.set(cacheKey, items);
        return { variantKey, items, resolved: true };
      } catch (_error) {
        // A cached hit still describes a real holding; without one the request
        // simply failed and the balance stays unknown.
        const cached = successfulPortfolioCache.get(cacheKey);
        return {
          variantKey,
          items: cached ?? [],
          resolved: cached !== undefined,
        };
      }
    }),
  );

  return {
    items: portfolioGroups.flatMap((group) => group.items),
    // Reported as what the run did establish rather than what it missed, so a
    // variant this payload never covered at all — the previous stock's result
    // still standing while the new one loads — reads as unknown too.
    resolvedVariantKeys: portfolioGroups
      .filter((group) => group.resolved)
      .map((group) => group.variantKey),
  };
}

export function useStockPortfolioData() {
  const {
    activeAccount: { account, indexedAccount, deriveType, ready },
  } = useActiveAccount({ num: 0 });
  const [selectedDeriveType] = useSelectedDeriveTypeAtom();
  const { portfolioNetworkId, stockId, tokenVariants } = useStockDetail();
  const successfulPortfolioCacheRef = useRef(
    new Map<string, IMarketAccountPortfolioDisplayItem[]>(),
  );
  const hasAccount = Boolean(ready && (account?.id || indexedAccount?.id));
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
      const networkDefaultDeriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId,
        });
      const networkAccount =
        await backgroundApiProxy.serviceAccount.getNetworkAccount({
          accountId: indexedAccount?.id ? undefined : account?.id,
          indexedAccountId: indexedAccount?.id,
          networkId,
          deriveType: resolveStockPortfolioDeriveType({
            activeDeriveType: deriveType,
            networkDefaultDeriveType,
            networkId,
            portfolioNetworkId,
            selectedDeriveType: getSelectedDeriveTypeForNetwork(
              selectedDeriveType,
              networkId,
            ),
          }),
        });
      return {
        id: networkAccount.id,
        address: networkAccount.address,
        xpub: getNetworkAccountXpub(networkAccount),
      };
    },
    [
      account?.id,
      deriveType,
      indexedAccount?.id,
      portfolioNetworkId,
      selectedDeriveType,
    ],
  );

  const {
    result: portfolioResult,
    isLoading: isRefreshing,
    run: fetchPortfolio,
  } = usePromiseResult(
    async () => {
      // Undefined rather than an empty result: with no account there is
      // nothing to read a balance from, and an empty list would claim every
      // variant was checked and found empty.
      if (!stockId || !hasAccount) return undefined;
      return fetchStockPortfolioData({
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
    },
    // The request reads the latest variants from a ref so 6-second metadata
    // refreshes only restart this query when their asset identities change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasAccount, resolveNetworkAccount, stockId, tokenVariantsKey],
    {
      watchLoading: true,
      pollingInterval:
        stockId && hasAccount
          ? timerUtils.getTimeDurationMs({ seconds: 15 })
          : undefined,
      revalidateOnReconnect: true,
    },
  );

  const portfolioData = portfolioResult?.items ?? [];
  // Empty until a run settles, so nothing counts as established before then.
  const resolvedVariantKeys = useMemo(
    () => portfolioResult?.resolvedVariantKeys ?? [],
    [portfolioResult],
  );

  return {
    portfolioData,
    resolvedVariantKeys,
    isRefreshing: Boolean(isRefreshing),
    hasAccount,
    fetchPortfolio,
  };
}
