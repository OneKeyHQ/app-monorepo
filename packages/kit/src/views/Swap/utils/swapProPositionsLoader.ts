import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IJotaiGetter,
  IJotaiSetter,
} from '@onekeyhq/kit-bg/src/states/jotai/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { swapProStockPositionsListMinValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
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

export type ISwapProPositionsLoadOptions = {
  forceRefresh?: boolean;
  stockOnly?: boolean;
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
    if (!options?.forceRefresh && activeRequestIds[scope.ownerKey]) {
      return false;
    }
    const runtimeEntry = runtimeEntries[scope.ownerKey];
    return !(
      !options?.forceRefresh &&
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
      nextEntries = upsertSwapProPositionsRuntimeEntry({
        entries: nextEntries,
        entry: {
          status: 'loading',
          tokens: [],
          updatedAt: requestStartedAt,
        },
        ownerKey: scope.ownerKey,
      });
    }
    return nextEntries;
  });
  const isLatestScopeRequest = (ownerKey: string) =>
    get(swapProPositionsRequestIdsAtom())[ownerKey] === requestId;
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
    set(swapProPositionsRuntimeDataAtom(), (currentEntries) => {
      const currentEntry = currentEntries[scope.ownerKey];
      if (!currentEntry) {
        return currentEntries;
      }
      return upsertSwapProPositionsRuntimeEntry({
        entries: currentEntries,
        entry: {
          status: 'loading',
          tokens: sortPositionTokens([
            ...currentEntry.tokens.filter(
              (token) => token.networkId !== networkId,
            ),
            ...tokens,
          ]),
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
            const currentEntry = nextEntries[scope.ownerKey];
            nextEntries = upsertSwapProPositionsRuntimeEntry({
              entries: nextEntries,
              entry: {
                status: 'error',
                tokens: currentEntry?.tokens ?? [],
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
    const accountAddressList = swapProSupportAccounts
      .filter((item) => item.apiAddress)
      .filter(
        (item) => !networkUtils.isAllNetwork({ networkId: item.networkId }),
      )
      .toSorted((left, right) => {
        const primaryNetworkIds = scopesToLoad[0]?.networkIds;
        return (
          Number(Boolean(primaryNetworkIds?.has(right.networkId))) -
          Number(Boolean(primaryNetworkIds?.has(left.networkId)))
        );
      });
    const stockNetworkIds = new Set(
      scopesToLoad
        .filter((scope) => scope.stockOnly)
        .flatMap((scope) => [...scope.networkIds]),
    );
    const requestLocale = stockNetworkIds.size
      ? appLocale.getLocale()
      : undefined;
    const tasks = accountAddressList.map((networkDataString) => {
      const {
        apiAddress,
        networkId: accountNetworkId,
        accountId,
      } = networkDataString;
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
        for (const scope of scopesToLoad) {
          if (!scope.stockOnly && scope.networkIds.has(accountNetworkId)) {
            publishNetworkPositions({
              networkId: accountNetworkId,
              scope,
              tokens,
            });
          }
        }

        let stockMetadataFailed = false;
        let stockTokens: ISwapToken[] | undefined;
        if (stockNetworkIds.has(accountNetworkId)) {
          try {
            const stockCandidateTokens = tokens.filter((token) =>
              new BigNumber(token.fiatValue ?? '0').gt(
                swapProStockPositionsListMinValue,
              ),
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
              if (!stockTokens) {
                throw new OneKeyLocalError(
                  'Incomplete market metadata response for Stock positions',
                );
              }
            }
            for (const scope of scopesToLoad) {
              if (scope.stockOnly && scope.networkIds.has(accountNetworkId)) {
                publishNetworkPositions({
                  networkId: accountNetworkId,
                  scope,
                  tokens: stockTokens,
                });
              }
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
          scope.networkIds.has(accountAddressList[index]?.networkId ?? ''),
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
          nextEntries = upsertSwapProPositionsRuntimeEntry({
            entries: nextEntries,
            entry: {
              status: 'error',
              tokens: currentEntry?.tokens ?? [],
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
