import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useHomeActions } from '@onekeyhq/kit/src/states/jotai/contexts/home';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import { getTokenSubtitle } from '@onekeyhq/shared/src/utils/perpsUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';
import type {
  IMarketPerpsTokenFromServer,
  IMarketTokenListItem,
} from '@onekeyhq/shared/types/marketV2';
import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

import { useMarketBasicConfig } from '../Market/hooks';
import { getNativeTokenInfo } from '../Market/MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers';

import {
  DEFAULT_SPOT_CATEGORIES,
  FAVORITES_CATEGORY_ID,
  HOME_PERPS_HOT_CATEGORY_ID,
  HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
  HOME_WATCHLIST_TAB_TYPE,
} from './components/PopularTrading/constants';
import { useHomeMarketCategoryTokens } from './components/PopularTrading/useHomeMarketCategoryTokens';
import {
  EMPTY_DISPLAY_TOKENS,
  mapMarketPerpsTokenToDisplay,
  mapMarketTokenToDisplay,
} from './components/PopularTrading/utils';
import { adaptHomeLegacyMarketSection } from './model/compatibility/homeLegacyMarketSectionAdapter';
import { HomeSectionCoordinator } from './model/sections/homeSectionCoordinator';
import {
  buildHomeMarketCoverage,
  projectHomeMarketSectionSource,
} from './model/sections/market/homeMarketSectionPolicy';
import {
  adaptHomeMarketSourceSnapshot,
  createHomeMarketSourceIdentity,
  getHomeMarketRowIds,
} from './model/sections/market/homeMarketSourceAdapter';
import {
  HOME_MARKET_FAVORITES_CACHE_COUNT,
  HOME_MARKET_VISIBLE_FAVORITES_COUNT,
  buildNativeHomeFavoriteTokensResult,
  getNativeHomeWatchListContentKey,
  isNativeHomeWatchListItemForToken,
  setNativeHomeWatchListTokenFavorite,
} from './nativeHomeMarketFavorites';

import type { IFavoriteTokenDisplay } from './components/PopularTrading/types';
import type { IHomeSectionCoordinatorResolution } from './model/sections/homeSectionCoordinator';
import type { IHomeMarketEvidence } from './model/sections/market/homeMarketSectionPolicy';
import type { IHomeMarketLegacyPayload } from './model/sections/market/homeMarketSourceAdapter';
import type { IFavoriteTokensResult } from './nativeHomeMarketFavorites';

const DEFERRED_FETCH_DELAY_MS = 1200;
const REFRESH_INTERVAL = timerUtils.getTimeDurationMs({ seconds: 30 });
const EMPTY_WATCH_LIST_ITEMS: IMarketWatchListItemV2[] = [];
const NATIVE_HOME_MARKET_OWNER = {
  scopeKey: 'native-home-market',
  sessionId: 'native-home-market',
};
const NATIVE_HOME_MARKET_PRODUCER_INSTANCE_ID = 'native-home-market';

function getNativeHomeMarketTokenKey(token: IFavoriteTokenDisplay): string {
  return token.perpsCoin
    ? `perps:${token.perpsCoin}`
    : `${token.chainId}:${token.contractAddress}`;
}

export interface INativeHomeMarketCategory {
  id: string;
  name: string;
  icon?: string;
  iconOnly?: boolean;
  leadingIcon?: 'star';
}

type IWatchListResult = {
  requestKey: string;
  items: IMarketWatchListItemV2[];
};

async function fetchNativeHomeFavoriteTokens(
  watchList: IMarketWatchListItemV2[],
): Promise<{
  isRecommendation: boolean;
  total: number;
  tokens: IFavoriteTokenDisplay[];
}> {
  if (watchList.length === 0) {
    const config =
      await backgroundApiProxy.serviceMarketV2.fetchMarketBasicConfig();
    const targets = (config?.data?.recommendTokens ?? []).slice(0, 4);
    if (targets.length === 0) {
      return { isRecommendation: true, total: 0, tokens: [] };
    }
    const response =
      await backgroundApiProxy.serviceMarketV2.fetchMarketTokenListBatch({
        tokenAddressList: targets.map((item) => ({
          chainId: item.chainId,
          contractAddress: item.contractAddress,
          isNative: item.isNative ?? false,
        })),
      });
    const tokenMap = new Map<string, IMarketTokenListItem>();
    response.list.forEach((item) => {
      const networkId = item.networkId ?? item.chainId ?? '';
      const { normalizedAddress } = getNativeTokenInfo(
        item.isNative,
        item.address,
      );
      tokenMap.set(`${networkId}:${normalizedAddress}`, item);
    });
    return {
      isRecommendation: true,
      total: 0,
      tokens: targets
        .map((target): IFavoriteTokenDisplay | null => {
          const { normalizedAddress } = getNativeTokenInfo(
            target.isNative,
            target.contractAddress,
          );
          const token = tokenMap.get(`${target.chainId}:${normalizedAddress}`);
          return token ? mapMarketTokenToDisplay(token) : null;
        })
        .filter((item): item is IFavoriteTokenDisplay => item !== null),
    };
  }

  const targetItems = watchList.slice(0, HOME_MARKET_FAVORITES_CACHE_COUNT);
  const spotTargets = targetItems.filter(
    (item) => !item.perpsCoin && item.chainId,
  );
  const perpsTargets = targetItems.filter((item) => Boolean(item.perpsCoin));

  const [spotResult, perpsResult, aliasesResult] = await Promise.allSettled([
    spotTargets.length > 0
      ? backgroundApiProxy.serviceMarketV2.fetchMarketTokenListBatch({
          tokenAddressList: spotTargets.map((item) => ({
            chainId: item.chainId,
            contractAddress: item.contractAddress,
            isNative: item.isNative ?? false,
          })),
        })
      : { list: [] as IMarketTokenListItem[] },
    perpsTargets.length > 0
      ? backgroundApiProxy.serviceMarketV2.fetchMarketPerpsTokenList({
          category: 'all',
        })
      : null,
    perpsTargets.length > 0
      ? backgroundApiProxy.serviceHyperliquid.getTokenSearchAliases()
      : null,
  ]);

  const spotTokens =
    spotResult.status === 'fulfilled' ? spotResult.value.list : [];
  const perpsTokens =
    perpsResult.status === 'fulfilled' ? (perpsResult.value?.tokens ?? []) : [];
  const aliases =
    aliasesResult.status === 'fulfilled'
      ? (aliasesResult.value ?? undefined)
      : undefined;
  const spotTokenMap = new Map<string, IMarketTokenListItem>();
  spotTokens.forEach((item) => {
    const networkId = item.networkId ?? item.chainId ?? '';
    const { normalizedAddress } = getNativeTokenInfo(
      item.isNative,
      item.address,
    );
    spotTokenMap.set(`${networkId}:${normalizedAddress}`, item);
  });
  const perpsTokenMap = new Map(perpsTokens.map((item) => [item.name, item]));

  return {
    isRecommendation: false,
    total: watchList.length,
    tokens: targetItems
      .map((target): IFavoriteTokenDisplay | null => {
        if (target.perpsCoin) {
          const token = perpsTokenMap.get(target.perpsCoin);
          return token
            ? mapMarketPerpsTokenToDisplay({
                token,
                subtitle: getTokenSubtitle(token.name, aliases),
              })
            : null;
        }
        const { normalizedAddress } = getNativeTokenInfo(
          target.isNative,
          target.contractAddress,
        );
        const token = spotTokenMap.get(
          `${target.chainId}:${normalizedAddress}`,
        );
        return token ? mapMarketTokenToDisplay(token) : null;
      })
      .filter((item): item is IFavoriteTokenDisplay => item !== null),
  };
}

export function useNativeHomeSupplementalData({
  favoritesLabel,
  perpsLabel,
  selectedMarketCategoryId,
}: {
  favoritesLabel: string;
  perpsLabel: string;
  selectedMarketCategoryId: string;
}) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setEnabled(true), DEFERRED_FETCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  const { clearSemanticSection, publishSemanticSection } =
    useHomeActions().current;

  const { homeTab, minLiquidity, perpsCategories, spotCategories } =
    useMarketBasicConfig();
  const marketCategories = useMemo<INativeHomeMarketCategory[]>(() => {
    const favoritesCategory: INativeHomeMarketCategory = {
      id: FAVORITES_CATEGORY_ID,
      name: favoritesLabel,
      iconOnly: true,
      leadingIcon: 'star',
    };
    const fallbackSpotCategories =
      spotCategories.length > 0
        ? spotCategories.map((category) => ({
            id: category.type,
            name: category.name,
            icon: category.icon,
          }))
        : DEFAULT_SPOT_CATEGORIES;
    const categories =
      homeTab.length > 0
        ? homeTab.map(
            (tab): INativeHomeMarketCategory =>
              tab.type === HOME_WATCHLIST_TAB_TYPE
                ? { ...favoritesCategory, name: tab.name }
                : { id: tab.type, name: tab.name, icon: tab.icon },
          )
        : [favoritesCategory, ...fallbackSpotCategories];
    const supportsPerpsHot = perpsCategories.some(
      (category) => category.categoryId === HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
    );
    return supportsPerpsHot
      ? [
          ...categories,
          {
            id: HOME_PERPS_HOT_CATEGORY_ID,
            name: perpsLabel,
          },
        ]
      : categories;
  }, [favoritesLabel, homeTab, perpsCategories, perpsLabel, spotCategories]);
  const resolvedMarketCategoryId = marketCategories.some(
    (category) => category.id === selectedMarketCategoryId,
  )
    ? selectedMarketCategoryId
    : (marketCategories[0]?.id ?? FAVORITES_CATEGORY_ID);
  const selectedServerCategoryId =
    resolvedMarketCategoryId === FAVORITES_CATEGORY_ID
      ? undefined
      : resolvedMarketCategoryId;
  const categoryMarket = useHomeMarketCategoryTokens({
    minLiquidity,
    prefetchMarketCategoryIds: marketCategories
      .map((category) => category.id)
      .filter((categoryId) => categoryId !== FAVORITES_CATEGORY_ID),
    selectedMarketCategoryId: selectedServerCategoryId,
  });
  const watchListRequestKey = 'market-watchlist';
  const watchList = usePromiseResult<IWatchListResult>(
    async () => {
      const response =
        await backgroundApiProxy.serviceMarketV2.getMarketWatchListV2();
      return { requestKey: watchListRequestKey, items: response.data };
    },
    [watchListRequestKey],
    {
      initResult: { requestKey: 'initial', items: [] },
      pollingInterval: REFRESH_INTERVAL,
      revalidateOnFocus: true,
      undefinedResultIfReRun: false,
    },
  );
  const hasCurrentWatchList =
    watchList.result?.requestKey === watchListRequestKey;
  const watchListItems = useMemo(
    () =>
      hasCurrentWatchList
        ? (watchList.result?.items ?? EMPTY_WATCH_LIST_ITEMS)
        : EMPTY_WATCH_LIST_ITEMS,
    [hasCurrentWatchList, watchList.result?.items],
  );
  const watchListContentKey = getNativeHomeWatchListContentKey(watchListItems);
  const favoriteRequestKey = `favorites:${
    hasCurrentWatchList ? watchListContentKey : 'loading'
  }`;
  const favoriteRecommendations = usePromiseResult<IFavoriteTokensResult>(
    async () => ({
      requestKey: 'recommendations',
      ...(await fetchNativeHomeFavoriteTokens([])),
    }),
    [],
    {
      revalidateOnFocus: true,
      undefinedResultIfReRun: false,
    },
  );
  const favoriteMarket = usePromiseResult<IFavoriteTokensResult>(
    async () => {
      const requestKey = `favorites:${
        hasCurrentWatchList ? watchListContentKey : 'loading'
      }`;
      if (!hasCurrentWatchList) {
        return {
          isRecommendation: false,
          requestKey,
          total: 0,
          tokens: [],
        };
      }
      const result =
        watchListItems.length === 0 && favoriteRecommendations.result
          ? favoriteRecommendations.result
          : await fetchNativeHomeFavoriteTokens(watchListItems);
      return { ...result, requestKey };
    },
    [
      favoriteRecommendations.result,
      hasCurrentWatchList,
      watchListContentKey,
      watchListItems,
    ],
    {
      initResult: {
        isRecommendation: false,
        requestKey: 'initial',
        total: 0,
        tokens: [],
      },
      pollingInterval: REFRESH_INTERVAL,
      revalidateOnFocus: true,
      undefinedResultIfReRun: false,
    },
  );

  const isCurrentFavoriteMarketResult =
    favoriteMarket.result?.requestKey === favoriteRequestKey;
  const hasSettledFavoriteMarketResult =
    Boolean(favoriteMarket.result) &&
    favoriteMarket.result?.requestKey !== 'initial';

  const market = useMemo(() => {
    if (resolvedMarketCategoryId !== FAVORITES_CATEGORY_ID) {
      return categoryMarket.categoryTokens;
    }
    if (
      !favoriteMarket.result ||
      (!isCurrentFavoriteMarketResult && !hasSettledFavoriteMarketResult)
    ) {
      return EMPTY_DISPLAY_TOKENS;
    }
    return favoriteMarket.result.isRecommendation
      ? favoriteMarket.result.tokens
      : favoriteMarket.result.tokens.slice(
          0,
          HOME_MARKET_VISIBLE_FAVORITES_COUNT,
        );
  }, [
    categoryMarket.categoryTokens,
    favoriteMarket.result,
    hasSettledFavoriteMarketResult,
    isCurrentFavoriteMarketResult,
    resolvedMarketCategoryId,
  ]);
  const marketLoading =
    !hasCurrentWatchList ||
    (resolvedMarketCategoryId === FAVORITES_CATEGORY_ID
      ? !isCurrentFavoriteMarketResult && !hasSettledFavoriteMarketResult
      : categoryMarket.isCategoryLoading);
  const marketSectionPayload = useMemo(
    () => ({
      favoriteMode:
        favoriteMarket.result?.isRecommendation === true
          ? ('recommendation' as const)
          : ('favorites' as const),
      prefetchCategoryIds: marketCategories
        .map((category) => category.id)
        .filter((categoryId) => categoryId !== FAVORITES_CATEGORY_ID),
      prefetchedRowsByRequestKey: categoryMarket.tokensByRequestKey,
      resolvedCategoryId: resolvedMarketCategoryId,
      rows: market,
      selectedCategoryId: selectedMarketCategoryId,
      totalFavorites:
        favoriteMarket.result &&
        (isCurrentFavoriteMarketResult || hasSettledFavoriteMarketResult)
          ? favoriteMarket.result.total
          : 0,
      watchListContentKey,
    }),
    [
      favoriteMarket.result,
      hasSettledFavoriteMarketResult,
      isCurrentFavoriteMarketResult,
      categoryMarket.tokensByRequestKey,
      market,
      marketCategories,
      resolvedMarketCategoryId,
      selectedMarketCategoryId,
      watchListContentKey,
    ],
  );
  const marketSectionRowIds = useMemo(
    () => getHomeMarketRowIds(marketSectionPayload),
    [marketSectionPayload],
  );
  const marketSectionIdentity = useMemo(
    () =>
      createHomeMarketSourceIdentity({
        owner: NATIVE_HOME_MARKET_OWNER,
        params: {
          favoriteMode: marketSectionPayload.favoriteMode,
          homeTabConfigKey: stringUtils.stableStringify({
            homeTab,
            perpsCategories,
            spotCategories,
          }),
          minLiquidity,
          perpsHotEnabled: marketCategories.some(
            (category) => category.id === HOME_PERPS_HOT_CATEGORY_ID,
          ),
          prefetchCategoryIds: marketSectionPayload.prefetchCategoryIds,
          resolvedCategoryId: resolvedMarketCategoryId,
          selectedCategoryId: selectedMarketCategoryId,
          watchListContentKey,
        },
        producerInstanceId: NATIVE_HOME_MARKET_PRODUCER_INSTANCE_ID,
      }),
    [
      homeTab,
      marketCategories,
      marketSectionPayload.favoriteMode,
      marketSectionPayload.prefetchCategoryIds,
      minLiquidity,
      perpsCategories,
      resolvedMarketCategoryId,
      selectedMarketCategoryId,
      spotCategories,
      watchListContentKey,
    ],
  );
  const marketSectionCoordinatorRef = useRef(
    new HomeSectionCoordinator<IHomeMarketLegacyPayload<IFavoriteTokenDisplay>>(
      marketSectionIdentity,
    ),
  );
  const marketSectionIdentityRef = useRef(marketSectionIdentity);
  const marketSectionRequestSeqRef = useRef(0);
  const marketSectionRequestKeyRef = useRef('');
  const marketSemanticRevisionRef = useRef(0);
  const [marketSectionResolution, setMarketSectionResolution] = useState<
    | IHomeSectionCoordinatorResolution<
        IHomeMarketLegacyPayload<IFavoriteTokenDisplay>
      >
    | undefined
  >();
  const marketSectionRequestKey = useMemo(
    () =>
      stringUtils.stableStringify({
        enabled,
        marketLoading,
        payload: marketSectionPayload,
        rowIds: marketSectionRowIds,
        sourceKeyIdentity: marketSectionIdentity.sourceKeyIdentity,
      }),
    [
      enabled,
      marketLoading,
      marketSectionIdentity.sourceKeyIdentity,
      marketSectionPayload,
      marketSectionRowIds,
    ],
  );
  useEffect(() => {
    const identityChanged =
      marketSectionIdentityRef.current.sourceKeyIdentity !==
        marketSectionIdentity.sourceKeyIdentity ||
      marketSectionIdentityRef.current.sourceRevision !==
        marketSectionIdentity.sourceRevision ||
      marketSectionIdentityRef.current.producerInstanceId !==
        marketSectionIdentity.producerInstanceId;
    const requestChanged =
      marketSectionRequestKeyRef.current !== marketSectionRequestKey;
    if (!identityChanged && !requestChanged) {
      return;
    }
    if (identityChanged) {
      marketSectionIdentityRef.current = marketSectionIdentity;
      marketSectionCoordinatorRef.current.setOwner(marketSectionIdentity);
    }
    if (requestChanged) {
      marketSectionRequestKeyRef.current = marketSectionRequestKey;
      marketSectionRequestSeqRef.current += 1;
    }
    const requestSeq = marketSectionRequestSeqRef.current;
    let evidence: IHomeMarketEvidence<IFavoriteTokenDisplay>;
    if (marketLoading && marketSectionRowIds.length > 0) {
      evidence = {
        kind: 'confirmedCache',
        data: marketSectionPayload,
        rowIds: marketSectionRowIds,
        refresh: 'refreshing',
      };
    } else if (marketLoading) {
      evidence = { kind: 'loading' };
    } else {
      evidence = {
        kind: 'complete',
        confirmedEmpty: marketSectionRowIds.length === 0,
        coverageFingerprint: buildHomeMarketCoverage({
          favoriteMode: marketSectionPayload.favoriteMode,
          requestSeq,
          resolvedCategoryId: resolvedMarketCategoryId,
          rowCount: marketSectionRowIds.length,
          selectedCategoryId: selectedMarketCategoryId,
        }),
        data: marketSectionPayload,
        rowIds: marketSectionRowIds,
      };
    }
    const snapshot = projectHomeMarketSectionSource({
      authorityReady: enabled,
      evidence,
      requestSeq,
      scopeMatches: true,
    });
    const resolution = marketSectionCoordinatorRef.current.dispatch(
      adaptHomeMarketSourceSnapshot({
        identity: marketSectionIdentity,
        snapshot,
      }),
    );
    setMarketSectionResolution(resolution);
    if (!resolution.accepted) {
      return;
    }
    marketSemanticRevisionRef.current += 1;
    publishSemanticSection({
      owner: marketSectionIdentity.owner,
      revision: marketSemanticRevisionRef.current,
      sectionId: 'market',
      value: resolution.semantic,
    });
  }, [
    enabled,
    marketLoading,
    marketSectionIdentity,
    marketSectionPayload,
    marketSectionRequestKey,
    marketSectionRowIds,
    publishSemanticSection,
    resolvedMarketCategoryId,
    selectedMarketCategoryId,
  ]);
  const marketSection = useMemo(
    () => adaptHomeLegacyMarketSection({ resolution: marketSectionResolution }),
    [marketSectionResolution],
  );
  useEffect(
    () => () => {
      marketSemanticRevisionRef.current += 1;
      clearSemanticSection({
        owner: NATIVE_HOME_MARKET_OWNER,
        revision: marketSemanticRevisionRef.current,
        sectionId: 'market',
      });
      marketSectionCoordinatorRef.current.dispose();
    },
    [clearSemanticSection],
  );
  const marketIsRecommendation =
    resolvedMarketCategoryId === FAVORITES_CATEGORY_ID &&
    isCurrentFavoriteMarketResult &&
    favoriteMarket.result?.isRecommendation === true;
  const marketRecommendationTokenIds = useMemo(
    () =>
      marketIsRecommendation
        ? market.map(getNativeHomeMarketTokenKey)
        : EMPTY_DISPLAY_TOKENS.map(getNativeHomeMarketTokenKey),
    [market, marketIsRecommendation],
  );
  const marketRecommendationContentKey = marketRecommendationTokenIds.join('|');
  const [marketRecommendationSelection, setMarketRecommendationSelection] =
    useState<{
      contentKey: string;
      selectedTokenIds: string[];
    }>({ contentKey: '', selectedTokenIds: [] });
  const selectedMarketRecommendationTokenIds = useMemo(
    () =>
      new Set(
        marketRecommendationSelection.contentKey ===
          marketRecommendationContentKey
          ? marketRecommendationSelection.selectedTokenIds
          : marketRecommendationTokenIds,
      ),
    [
      marketRecommendationContentKey,
      marketRecommendationSelection,
      marketRecommendationTokenIds,
    ],
  );
  useEffect(() => {
    setMarketRecommendationSelection((previous) => {
      if (previous.contentKey === marketRecommendationContentKey) {
        return previous;
      }
      return {
        contentKey: marketRecommendationContentKey,
        selectedTokenIds: marketRecommendationTokenIds,
      };
    });
  }, [marketRecommendationContentKey, marketRecommendationTokenIds]);
  const isMarketRecommendationSelected = useCallback(
    (token: IFavoriteTokenDisplay) =>
      selectedMarketRecommendationTokenIds.has(
        getNativeHomeMarketTokenKey(token),
      ),
    [selectedMarketRecommendationTokenIds],
  );
  const toggleMarketRecommendation = useCallback(
    (token: IFavoriteTokenDisplay) => {
      const tokenId = getNativeHomeMarketTokenKey(token);
      setMarketRecommendationSelection((previous) => {
        const currentSelection = new Set(
          previous.contentKey === marketRecommendationContentKey
            ? previous.selectedTokenIds
            : marketRecommendationTokenIds,
        );
        if (currentSelection.has(tokenId)) {
          currentSelection.delete(tokenId);
        } else {
          currentSelection.add(tokenId);
        }
        return {
          contentKey: marketRecommendationContentKey,
          selectedTokenIds: marketRecommendationTokenIds.filter((id) =>
            currentSelection.has(id),
          ),
        };
      });
    },
    [marketRecommendationContentKey, marketRecommendationTokenIds],
  );
  const selectedMarketRecommendationTokens = useMemo(
    () =>
      market.filter((token) =>
        selectedMarketRecommendationTokenIds.has(
          getNativeHomeMarketTokenKey(token),
        ),
      ),
    [market, selectedMarketRecommendationTokenIds],
  );
  const addRecommendedMarketTokensInFlightRef = useRef(false);
  const marketFavoriteToggleInFlightRef = useRef(new Set<string>());
  const marketFavoriteRevisionRef = useRef(0);
  const favoriteMarketResultRef = useRef(favoriteMarket.result);
  const watchListItemsRef = useRef(watchListItems);
  useEffect(() => {
    favoriteMarketResultRef.current = favoriteMarket.result;
    watchListItemsRef.current = watchListItems;
  }, [favoriteMarket.result, watchListItems]);
  const marketImageCacheTokens =
    resolvedMarketCategoryId === FAVORITES_CATEGORY_ID &&
    favoriteMarket.result?.isRecommendation === false
      ? favoriteMarket.result.tokens
      : market;
  const marketNetworkIds = useMemo(
    () =>
      Array.from(
        new Set(
          marketImageCacheTokens
            .filter((token) => !token.perpsCoin && token.chainId)
            .map((token) => token.chainId),
        ),
      ),
    [marketImageCacheTokens],
  );
  const marketNetworkImages = usePromiseResult<Record<string, string>>(
    async () => {
      const entries = await Promise.all(
        marketNetworkIds.map(async (networkId) => {
          const network =
            await backgroundApiProxy.serviceNetwork.getNetworkSafe({
              networkId,
            });
          return [networkId, network?.logoURI ?? ''] as const;
        }),
      );
      return Object.fromEntries(entries.filter(([, value]) => Boolean(value)));
    },
    [marketNetworkIds],
    {
      initResult: {},
      revalidateOnFocus: false,
      undefinedResultIfReRun: false,
    },
  );

  const isTokenFavorite = useCallback(
    (record: IFavoriteTokenDisplay) =>
      watchListItems.some((item) =>
        isNativeHomeWatchListItemForToken(item, record),
      ),
    [watchListItems],
  );

  const toggleMarketFavorite = useCallback(
    async (record: IFavoriteTokenDisplay) => {
      const tokenKey = getNativeHomeMarketTokenKey(record);
      if (marketFavoriteToggleInFlightRef.current.has(tokenKey)) return;

      const currentItems = watchListItemsRef.current;
      const previousIndex = currentItems.findIndex((item) =>
        isNativeHomeWatchListItemForToken(item, record),
      );
      const previousItem = currentItems[previousIndex];
      const checked = Boolean(previousItem);
      const optimisticItems = setNativeHomeWatchListTokenFavorite({
        favorite: !checked,
        items: currentItems,
        previousIndex,
        previousItem,
        token: record,
      });
      const currentFavoriteTokens =
        favoriteMarketResultRef.current?.tokens ?? EMPTY_DISPLAY_TOKENS;
      const optimisticFavoriteResult = buildNativeHomeFavoriteTokensResult({
        cachedTokens: checked
          ? currentFavoriteTokens
          : [record, ...currentFavoriteTokens],
        recommendationResult: favoriteRecommendations.result,
        watchListItems: optimisticItems,
      });
      marketFavoriteToggleInFlightRef.current.add(tokenKey);
      marketFavoriteRevisionRef.current += 1;
      watchListItemsRef.current = optimisticItems;
      watchList.setResult({
        requestKey: watchListRequestKey,
        items: optimisticItems,
      });
      if (optimisticFavoriteResult) {
        favoriteMarketResultRef.current = optimisticFavoriteResult;
        favoriteMarket.setResult(optimisticFavoriteResult);
      }

      try {
        const firstSortIndex = currentItems[0]?.sortIndex ?? 1000;
        if (record.perpsCoin) {
          if (checked) {
            await backgroundApiProxy.serviceMarketV2.removeMarketWatchListV2({
              items: [
                {
                  chainId: '',
                  contractAddress: '',
                  perpsCoin: record.perpsCoin,
                },
              ],
              callerName: 'NativeHomePage',
            });
            void backgroundApiProxy.serviceMarketV2.syncToPerpsAtom({
              coin: record.perpsCoin,
              action: 'remove',
            });
          } else {
            await backgroundApiProxy.serviceMarketV2.addMarketWatchListV2({
              watchList: [
                {
                  chainId: '',
                  contractAddress: '',
                  perpsCoin: record.perpsCoin,
                  sortIndex: firstSortIndex - 1,
                },
              ],
              callerName: 'NativeHomePage',
            });
            void backgroundApiProxy.serviceMarketV2.syncToPerpsAtom({
              coin: record.perpsCoin,
              action: 'add',
            });
          }
        } else if (checked) {
          await backgroundApiProxy.serviceMarketV2.removeMarketWatchListV2({
            items: [
              {
                chainId: record.chainId,
                contractAddress: record.contractAddress,
              },
            ],
            callerName: 'NativeHomePage',
          });
          defaultLogger.dex.watchlist.dexRemoveFromWatchlist({
            network: record.chainId,
            tokenSymbol: record.symbol || '',
            tokenContract: record.contractAddress,
            removeFrom: EWatchlistFrom.Homepage,
          });
        } else {
          await backgroundApiProxy.serviceMarketV2.addMarketWatchListV2({
            watchList: [
              {
                chainId: record.chainId,
                contractAddress: record.contractAddress,
                isNative: record.isNative,
                sortIndex: firstSortIndex - 1,
              },
            ],
            callerName: 'NativeHomePage',
          });
          defaultLogger.dex.watchlist.dexAddToWatchlist({
            network: record.chainId,
            tokenSymbol: record.symbol || '',
            tokenContract: record.contractAddress,
            addFrom: EWatchlistFrom.Homepage,
          });
        }
        appEventBus.emit(EAppEventBusNames.RefreshMarketWatchList, undefined);
      } catch (error) {
        const rollbackItems = setNativeHomeWatchListTokenFavorite({
          favorite: checked,
          items: watchListItemsRef.current,
          previousIndex,
          previousItem,
          token: record,
        });
        const rollbackFavoriteResult = buildNativeHomeFavoriteTokensResult({
          cachedTokens: checked
            ? [
                record,
                ...(favoriteMarketResultRef.current?.tokens ??
                  EMPTY_DISPLAY_TOKENS),
              ]
            : (favoriteMarketResultRef.current?.tokens ?? EMPTY_DISPLAY_TOKENS),
          recommendationResult: favoriteRecommendations.result,
          watchListItems: rollbackItems,
        });
        watchListItemsRef.current = rollbackItems;
        watchList.setResult({
          requestKey: watchListRequestKey,
          items: rollbackItems,
        });
        if (rollbackFavoriteResult) {
          favoriteMarketResultRef.current = rollbackFavoriteResult;
          favoriteMarket.setResult(rollbackFavoriteResult);
        }
        throw error;
      } finally {
        marketFavoriteToggleInFlightRef.current.delete(tokenKey);
        if (marketFavoriteToggleInFlightRef.current.size === 0) {
          const reconcileRevision = marketFavoriteRevisionRef.current;
          try {
            const refreshedWatchList =
              await backgroundApiProxy.serviceMarketV2.getMarketWatchListV2();
            if (
              marketFavoriteToggleInFlightRef.current.size === 0 &&
              marketFavoriteRevisionRef.current === reconcileRevision
            ) {
              const reconciledFavoriteResult =
                buildNativeHomeFavoriteTokensResult({
                  cachedTokens:
                    favoriteMarketResultRef.current?.tokens ??
                    EMPTY_DISPLAY_TOKENS,
                  recommendationResult: favoriteRecommendations.result,
                  watchListItems: refreshedWatchList.data,
                });
              watchListItemsRef.current = refreshedWatchList.data;
              watchList.setResult({
                requestKey: watchListRequestKey,
                items: refreshedWatchList.data,
              });
              if (reconciledFavoriteResult) {
                favoriteMarketResultRef.current = reconciledFavoriteResult;
                favoriteMarket.setResult(reconciledFavoriteResult);
              }
            }
          } catch {
            // Keep the optimistic or rolled-back main-runtime snapshot until polling retries.
          }
        }
      }
    },
    [favoriteMarket, favoriteRecommendations.result, watchList],
  );

  const addRecommendedMarketTokens = useCallback(async () => {
    if (addRecommendedMarketTokensInFlightRef.current) return false;
    if (!marketIsRecommendation || market.length === 0) return false;
    const recommendedTokens = selectedMarketRecommendationTokens.filter(
      (token) => !token.perpsCoin,
    );
    if (recommendedTokens.length === 0) return false;

    addRecommendedMarketTokensInFlightRef.current = true;
    try {
      await backgroundApiProxy.serviceMarketV2.addMarketWatchListV2({
        watchList: recommendedTokens.map((token, index) => ({
          chainId: token.chainId,
          contractAddress: token.contractAddress,
          isNative: token.isNative,
          sortIndex: 1000 - (index + 1),
        })),
        callerName: 'NativeHomePage',
      });
      recommendedTokens.forEach((token) => {
        defaultLogger.dex.watchlist.dexAddToWatchlist({
          network: token.chainId,
          tokenSymbol: token.symbol || '',
          tokenContract: token.contractAddress,
          addFrom: EWatchlistFrom.Recommend,
        });
      });

      const refreshedWatchList =
        await backgroundApiProxy.serviceMarketV2.getMarketWatchListV2();
      const refreshedContentKey = getNativeHomeWatchListContentKey(
        refreshedWatchList.data,
      );
      const optimisticTokens = refreshedWatchList.data
        .slice(0, HOME_MARKET_FAVORITES_CACHE_COUNT)
        .map((item) =>
          recommendedTokens.find((token) =>
            equalTokenNoCaseSensitive({
              token1: {
                networkId: item.chainId,
                contractAddress: item.contractAddress,
              },
              token2: {
                networkId: token.chainId,
                contractAddress: token.contractAddress,
              },
            }),
          ),
        )
        .filter((token): token is IFavoriteTokenDisplay => Boolean(token));

      const optimisticFavoriteResult: IFavoriteTokensResult = {
        isRecommendation: false,
        requestKey: `favorites:${refreshedContentKey}`,
        total: refreshedWatchList.data.length,
        tokens: optimisticTokens,
      };
      watchListItemsRef.current = refreshedWatchList.data;
      watchList.setResult({
        requestKey: watchListRequestKey,
        items: refreshedWatchList.data,
      });
      favoriteMarketResultRef.current = optimisticFavoriteResult;
      favoriteMarket.setResult(optimisticFavoriteResult);
      appEventBus.emit(EAppEventBusNames.RefreshMarketWatchList, undefined);
      return true;
    } finally {
      addRecommendedMarketTokensInFlightRef.current = false;
    }
  }, [
    favoriteMarket,
    market.length,
    marketIsRecommendation,
    selectedMarketRecommendationTokens,
    watchList,
  ]);

  const earn = usePromiseResult<IRecommendAsset[]>(
    async () => {
      if (!enabled) return [];
      const response =
        await backgroundApiProxy.serviceStaking.fetchAllNetworkAssetsV2();
      return response?.tokens?.slice(0, 6) ?? [];
    },
    [enabled],
    {
      initResult: [],
      revalidateOnFocus: true,
      undefinedResultIfReRun: false,
    },
  );

  const perpsMarket = usePromiseResult<IMarketPerpsTokenFromServer[]>(
    async () => {
      if (!enabled) return [];
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketPerpsTokenList({
          category: 'hot',
        });
      return response.tokens.slice(0, 5);
    },
    [enabled],
    {
      initResult: [],
      pollingInterval: REFRESH_INTERVAL,
      revalidateOnFocus: true,
      undefinedResultIfReRun: false,
    },
  );

  return {
    earn: earn.result ?? [],
    favoriteCount:
      favoriteMarket.result &&
      (isCurrentFavoriteMarketResult || hasSettledFavoriteMarketResult)
        ? favoriteMarket.result.total
        : 0,
    isTokenFavorite,
    isMarketRecommendationSelected,
    market,
    marketIsRecommendation,
    marketLoading,
    marketSection,
    marketRecommendationSelectedCount:
      selectedMarketRecommendationTokens.length,
    marketCategories,
    marketNetworkImageById: marketNetworkImages.result ?? {},
    resolvedMarketCategoryId,
    perpsMarket: perpsMarket.result ?? [],
    refresh: async () => {
      await Promise.all([
        resolvedMarketCategoryId === FAVORITES_CATEGORY_ID
          ? Promise.all([watchList.run(), favoriteMarket.run()])
          : categoryMarket.refresh(),
        earn.run(),
        perpsMarket.run(),
      ]);
    },
    addRecommendedMarketTokens,
    toggleMarketRecommendation,
    toggleMarketFavorite,
  };
}
