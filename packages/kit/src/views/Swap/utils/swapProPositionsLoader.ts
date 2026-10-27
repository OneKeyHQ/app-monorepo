import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IJotaiGetter,
  IJotaiSetter,
} from '@onekeyhq/kit-bg/src/states/jotai/types';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapProPositionsOwnerKey,
  swapProPositionsCacheAtom,
  swapProPositionsRequestIdAtom,
  swapProPositionsRequestIdsAtom,
  swapProPositionsRuntimeDataAtom,
} from '../../../states/jotai/contexts/swap/atoms';

import {
  SWAP_PRO_POSITIONS_RUNTIME_TTL_MS,
  getValidSwapProPositionsCache,
  upsertSwapProPositionsCacheEntry,
  upsertSwapProPositionsRuntimeEntry,
} from './swapProPositionsCacheUtils';
import {
  buildSwapProPositionsNetworkIdsKey,
  compareSwapProPositionNetworkIds,
} from './swapProPositionsKeyUtils';
import { buildStockPositionTokens } from './swapStockPositionsUtils';
import { hasTradePositionBalance } from './tradePositionUtils';

export type ISwapProPositionsLoadOptions = {
  forceRefresh?: boolean;
  stockOnly?: boolean;
  accountScope?: string;
  networkAccount?: {
    networkId: string;
    accountId: string;
    apiAddress: string;
  };
  additionalSupportNetworkScopes?: {
    stockOnly?: boolean;
    supportNetworks: ISwapNetwork[];
  }[];
};

type IExecuteBatched = <T>(
  tasks: (() => Promise<T>)[],
  batchSize: number,
) => Promise<PromiseSettledResult<T>[]>;

export type ISwapProPositionsLoader = (
  get: IJotaiGetter,
  set: IJotaiSetter,
  executeBatched: IExecuteBatched,
  supportNetworks: ISwapNetwork[],
  indexedAccountId?: string,
  otherWalletTypeAccountId?: string,
  currencyId?: string,
  options?: ISwapProPositionsLoadOptions,
) => Promise<void>;

export const loadSwapProPositions: ISwapProPositionsLoader = async (
  get,
  set,
  executeBatched,
  supportNetworks,
  indexedAccountId,
  otherWalletTypeAccountId,
  currencyId,
  options,
) => {
  const positionCurrencyId = currencyId?.toLowerCase() ?? '';
  const positionAccountId = indexedAccountId ?? otherWalletTypeAccountId;
  const requestedScopes = [
    {
      stockOnly: options?.stockOnly,
      supportNetworks,
    },
    ...(options?.additionalSupportNetworkScopes ?? []),
  ]
    .map((scope) => {
      const scopeNetworks = Array.from(
        new Map(
          scope.supportNetworks
            .filter((network) => Boolean(network.networkId))
            .map((network) => [network.networkId, network]),
        ).values(),
      ).toSorted((left, right) =>
        compareSwapProPositionNetworkIds(left.networkId, right.networkId),
      );
      const networkIdsKey = buildSwapProPositionsNetworkIdsKey(
        scopeNetworks.map((network) => network.networkId),
      );
      return {
        networkIds: new Set(scopeNetworks.map((network) => network.networkId)),
        networkIdsKey,
        ownerKey: buildSwapProPositionsOwnerKey({
          accountId: positionAccountId,
          networkIdsKey,
          currencyId: positionCurrencyId,
          stockOnly: scope.stockOnly,
        }),
        stockOnly: Boolean(scope.stockOnly),
        supportNetworks: scopeNetworks,
      };
    })
    .filter((scope) => Boolean(scope.ownerKey));
  const uniqueScopes = Array.from(
    new Map(requestedScopes.map((scope) => [scope.ownerKey, scope])).values(),
  );
  if (uniqueScopes.length === 0) {
    return;
  }
  const requestStartedAt = Date.now();
  const runtimeEntries = get(swapProPositionsRuntimeDataAtom());
  const activeRequestIds = get(swapProPositionsRequestIdsAtom());
  const scopesToLoad = uniqueScopes.filter((scope) => {
    const runtimeEntry = runtimeEntries[scope.ownerKey];
    const sameAccountScope =
      runtimeEntry?.accountScope === options?.accountScope;
    if (
      !options?.forceRefresh &&
      sameAccountScope &&
      activeRequestIds[scope.ownerKey]
    ) {
      return false;
    }
    return !(
      !options?.forceRefresh &&
      sameAccountScope &&
      runtimeEntry?.status === 'success' &&
      requestStartedAt - runtimeEntry.updatedAt <
        SWAP_PRO_POSITIONS_RUNTIME_TTL_MS
    );
  });
  if (scopesToLoad.length === 0) {
    return;
  }

  const requestId = get(swapProPositionsRequestIdAtom()) + 1;
  set(swapProPositionsRequestIdAtom(), requestId);
  set(swapProPositionsRequestIdsAtom(), (previousRequestIds) => ({
    ...previousRequestIds,
    ...Object.fromEntries(
      scopesToLoad.map((scope) => [scope.ownerKey, requestId]),
    ),
  }));
  set(swapProPositionsRuntimeDataAtom(), (currentEntries) => {
    let nextEntries = currentEntries;
    for (const scope of scopesToLoad) {
      const previousEntry = nextEntries[scope.ownerKey];
      const currentEntry =
        previousEntry?.accountScope === options?.accountScope
          ? previousEntry
          : undefined;
      const isBackgroundRefresh = Boolean(
        currentEntry?.status === 'success' ||
        currentEntry?.status === 'refreshing' ||
        currentEntry?.tokens.length,
      );
      nextEntries = upsertSwapProPositionsRuntimeEntry({
        entries: nextEntries,
        entry: {
          status: isBackgroundRefresh ? 'refreshing' : 'loading',
          tokens: currentEntry?.tokens ?? [],
          resolvedNetworkIds: currentEntry?.resolvedNetworkIds,
          accountScope: options?.accountScope,
          updatedAt: requestStartedAt,
        },
        ownerKey: scope.ownerKey,
      });
    }
    return nextEntries;
  });
  const isLatestScopeRequest = (ownerKey: string) =>
    get(swapProPositionsRequestIdsAtom())[ownerKey] === requestId;
  const refreshedNetworkIdsByOwner = new Map<string, Set<string>>();
  const sortPositionTokens = (tokens: ISwapToken[]) =>
    tokens.toSorted((left, right) =>
      new BigNumber(right.fiatValue ?? '0').comparedTo(
        new BigNumber(left.fiatValue ?? '0'),
      ),
    );
  const publishNetworkPositions = ({
    networkId,
    scope,
    tokens,
  }: {
    networkId: string;
    scope: (typeof scopesToLoad)[number];
    tokens: ISwapToken[];
  }) => {
    if (!isLatestScopeRequest(scope.ownerKey)) {
      return;
    }
    const refreshedNetworkIds =
      refreshedNetworkIdsByOwner.get(scope.ownerKey) ?? new Set<string>();
    refreshedNetworkIds.add(networkId);
    refreshedNetworkIdsByOwner.set(scope.ownerKey, refreshedNetworkIds);
    set(swapProPositionsRuntimeDataAtom(), (currentEntries) => {
      const currentEntry = currentEntries[scope.ownerKey];
      if (!currentEntry) {
        return currentEntries;
      }
      return upsertSwapProPositionsRuntimeEntry({
        entries: currentEntries,
        entry: {
          status:
            currentEntry.status === 'refreshing' ? 'refreshing' : 'loading',
          tokens: sortPositionTokens([
            ...currentEntry.tokens.filter(
              (token) => token.networkId !== networkId,
            ),
            ...tokens,
          ]),
          resolvedNetworkIds: Array.from(refreshedNetworkIds),
          accountScope: options?.accountScope,
          updatedAt: Date.now(),
        },
        ownerKey: scope.ownerKey,
      });
    });
  };
  try {
    const unionSupportNetworks = Array.from(
      new Map(
        scopesToLoad
          .flatMap((scope) => scope.supportNetworks)
          .map((network) => [network.networkId, network]),
      ).values(),
    );
    const {
      supportAccountsFetchFailed,
      swapSupportAccounts: swapProSupportAccounts,
    } = await backgroundApiProxy.serviceSwap.getSupportSwapAllAccounts({
      indexedAccountId,
      otherWalletTypeAccountId,
      swapSupportNetworks: unionSupportNetworks,
    });
    if (supportAccountsFetchFailed) {
      set(swapProPositionsRuntimeDataAtom(), (currentEntries) => {
        let nextEntries = currentEntries;
        for (const scope of scopesToLoad) {
          if (isLatestScopeRequest(scope.ownerKey)) {
            nextEntries = upsertSwapProPositionsRuntimeEntry({
              entries: nextEntries,
              entry: {
                status: 'error',
                tokens: [],
                accountScope: options?.accountScope,
                updatedAt: Date.now(),
              },
              ownerKey: scope.ownerKey,
            });
          }
        }
        return nextEntries;
      });
      return;
    }
    const networkAccount = options?.networkAccount;
    const defaultAccounts = swapProSupportAccounts.map(
      ({ networkId, accountId, apiAddress }) => ({
        networkId,
        accountId,
        apiAddress,
      }),
    );
    const requestsByAccount = new Map<
      string,
      {
        account: NonNullable<ISwapProPositionsLoadOptions['networkAccount']>;
        scopes: typeof scopesToLoad;
      }
    >();
    for (const scope of scopesToLoad) {
      // Resolve each scope's account before sharing requests across scopes.
      const selectedAccount =
        scope.stockOnly &&
        networkAccount &&
        scope.networkIds.has(networkAccount.networkId)
          ? networkAccount
          : undefined;
      const accounts = (
        selectedAccount
          ? [
              ...defaultAccounts.filter(
                (account) => account.networkId !== selectedAccount.networkId,
              ),
              selectedAccount,
            ]
          : defaultAccounts
      ).filter(
        (account) =>
          scope.networkIds.has(account.networkId) &&
          account.apiAddress &&
          !networkUtils.isAllNetwork({ networkId: account.networkId }),
      );
      for (const account of accounts) {
        const key = JSON.stringify([
          account.networkId,
          account.accountId,
          account.apiAddress,
        ]);
        const request = requestsByAccount.get(key);
        if (request) {
          if (!request.scopes.includes(scope)) request.scopes.push(scope);
        } else {
          requestsByAccount.set(key, { account, scopes: [scope] });
        }
      }
    }
    const accountRequests = [...requestsByAccount.values()];
    const requestLocale = scopesToLoad.some((scope) => scope.stockOnly)
      ? appLocale.getLocale()
      : undefined;
    const tasks = accountRequests.map(({ account, scopes }) => {
      const { apiAddress, networkId: accountNetworkId, accountId } = account;
      return async () => {
        const tokens = await backgroundApiProxy.serviceSwap.fetchSwapTokens({
          networkId: accountNetworkId,
          accountNetworkId,
          accountAddress: apiAddress,
          accountId,
          onlyAccountTokens: true,
          isAllNetworkFetchAccountTokens: true,
          throwOnError: true,
          currency: positionCurrencyId,
          protocol: ESwapTabSwitchType.SWAP,
        });
        for (const scope of scopes) {
          if (!scope.stockOnly) {
            publishNetworkPositions({
              networkId: accountNetworkId,
              scope,
              tokens,
            });
          }
        }

        let stockMetadataFailed = false;
        let stockTokens: ISwapToken[] | undefined;
        const stockScopes = scopes.filter((scope) => scope.stockOnly);
        if (stockScopes.length) {
          try {
            const stockCandidateTokens = tokens.filter((token) =>
              hasTradePositionBalance(token.balanceParsed),
            );
            if (stockCandidateTokens.length === 0) {
              stockTokens = [];
            } else {
              const response =
                await backgroundApiProxy.serviceMarketV2.fetchMarketTokenListBatch(
                  {
                    requestLocale,
                    tokenAddressList: stockCandidateTokens.map((token) => ({
                      contractAddress: token.contractAddress ?? '',
                      chainId: token.networkId,
                      isNative: !!token.isNative,
                    })),
                  },
                );
              stockTokens = buildStockPositionTokens({
                marketItems: response.list ?? [],
                tokens: stockCandidateTokens,
              });
            }
            for (const scope of stockScopes) {
              publishNetworkPositions({
                networkId: accountNetworkId,
                scope,
                tokens: stockTokens,
              });
            }
          } catch (error) {
            stockMetadataFailed = true;
            console.error('swapStock__loadPositionMetadata error', error);
          }
        }
        return {
          stockMetadataFailed,
          stockTokens,
          tokens,
        };
      };
    });

    // One union queue keeps each load generation at three in-flight requests.
    const results = await executeBatched(tasks, 3);
    for (const scope of scopesToLoad) {
      if (isLatestScopeRequest(scope.ownerKey)) {
        const scopeResults = results.filter((_, index) =>
          accountRequests[index]?.scopes.includes(scope),
        );
        const hasFailure = scopeResults.some(
          (result) =>
            result.status === 'rejected' ||
            (scope.stockOnly && result.value.stockMetadataFailed),
        );
        const scopeTokens = sortPositionTokens(
          scopeResults.flatMap((result) => {
            if (result.status !== 'fulfilled') {
              return [];
            }
            return scope.stockOnly
              ? (result.value.stockTokens ?? [])
              : result.value.tokens;
          }),
        );
        const completedAt = Date.now();
        set(swapProPositionsRuntimeDataAtom(), (currentEntries) =>
          upsertSwapProPositionsRuntimeEntry({
            entries: currentEntries,
            entry: {
              status: hasFailure ? 'error' : 'success',
              tokens: scopeTokens,
              resolvedNetworkIds: Array.from(
                refreshedNetworkIdsByOwner.get(scope.ownerKey) ?? [],
              ),
              accountScope: options?.accountScope,
              updatedAt: completedAt,
            },
            ownerKey: scope.ownerKey,
          }),
        );
        if (!hasFailure) {
          set(swapProPositionsCacheAtom(), (previousCache) =>
            upsertSwapProPositionsCacheEntry({
              cache: getValidSwapProPositionsCache(previousCache),
              entry: {
                ownerKey: scope.ownerKey,
                networkIdsKey: scope.networkIdsKey,
                currencyId: positionCurrencyId,
                tokens: scopeTokens,
                updatedAt: completedAt,
              },
            }),
          );
        }
      }
    }
  } catch (error) {
    set(swapProPositionsRuntimeDataAtom(), (currentEntries) => {
      let nextEntries = currentEntries;
      for (const scope of scopesToLoad) {
        if (isLatestScopeRequest(scope.ownerKey)) {
          const currentEntry = nextEntries[scope.ownerKey];
          const refreshedNetworkIds =
            refreshedNetworkIdsByOwner.get(scope.ownerKey) ?? new Set<string>();
          nextEntries = upsertSwapProPositionsRuntimeEntry({
            entries: nextEntries,
            entry: {
              status: 'error',
              tokens: (currentEntry?.tokens ?? []).filter((token) =>
                refreshedNetworkIds.has(token.networkId),
              ),
              resolvedNetworkIds: Array.from(refreshedNetworkIds),
              accountScope: options?.accountScope,
              updatedAt: Date.now(),
            },
            ownerKey: scope.ownerKey,
          });
        }
      }
      return nextEntries;
    });
    console.error('swapPro__loadPositions error', error);
  } finally {
    set(swapProPositionsRequestIdsAtom(), (previousRequestIds) =>
      Object.fromEntries(
        Object.entries(previousRequestIds).filter(
          ([ownerKey, activeRequestId]) =>
            !scopesToLoad.some(
              (scope) =>
                scope.ownerKey === ownerKey && activeRequestId === requestId,
            ),
        ),
      ),
    );
  }
};
