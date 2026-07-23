import { useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useHomeInteraction } from '@onekeyhq/kit/src/states/jotai/contexts/home';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getTokenSubtitle } from '@onekeyhq/shared/src/utils/perpsUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';
import type {
  IMarketBasicConfigData,
  IMarketPerpsTokenFromServer,
  IMarketTokenListItem,
} from '@onekeyhq/shared/types/marketV2';

import { getNativeTokenInfo } from '../../../Market/MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers';
import {
  DEFAULT_MARKET_CATEGORY_ID,
  DEFAULT_SPOT_CATEGORIES,
  FAVORITES_CATEGORY_ID,
  HOME_MARKET_CATEGORY_REQUEST_LIMIT,
  HOME_PERPS_HOT_CATEGORY_ID,
  HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
  HOME_WATCHLIST_TAB_TYPE,
} from '../../components/PopularTrading/constants';
import {
  createHomeMarketCategoryTokensCache,
  getMarketTokenDisplayMarketCap,
  getMarketTokenDisplayPrice,
  getMarketTokenDisplayPriceChange24h,
  getMarketTokenDisplayVolume24h,
  getTokenKey,
  mapMarketPerpsTokenToDisplay,
  mapMarketTokenToDisplay,
} from '../../components/PopularTrading/utils';
import {
  getSelectedHomeMarketCategory,
  runHomeMarketStoreRequest,
} from '../sections/market/homeMarketControllerUtils';
import { HOME_MARKET_SELECTED_CATEGORY_CONTROL_ID } from '../sections/market/homeMarketControls';
import { HOME_MARKET_DATA_SCHEMA_VERSION } from '../sections/market/homeMarketSourceAdapter';

import {
  useHomeSectionPayload,
  useStableHomeFactsOwner,
} from './homeStoreHooks';
import { useHomeStoreSourcePublisher } from './useHomeStoreSourcePublisher';

import type { IMarketCategoryItem } from '../../../Market/MarketHomeV2/types';
import type {
  IFavoriteTokenDisplay,
  IHomePopularTradingPayload,
} from '../../components/PopularTrading/types';

const HOME_MARKET_POLLING_INTERVAL = timerUtils.getTimeDurationMs({
  seconds: 30,
});
const HOME_MARKET_CATEGORY_TIME_FRAME = '4' as const;
const HOME_MARKET_RECOMMENDATION_COUNT = 4;
const HOME_MARKET_FAVORITES_DISPLAY_COUNT = 3;

const homeMarketSourceApi = {
  fetchBasicConfig: () =>
    backgroundApiProxy.serviceMarketV2.fetchMarketBasicConfig(),
  fetchEarnAssets: () =>
    backgroundApiProxy.serviceStaking.fetchAllNetworkAssetsV2(),
  fetchPerpsTokens: (category: string) =>
    backgroundApiProxy.serviceMarketV2.fetchMarketPerpsTokenList({ category }),
  fetchSpotCategoryTokens: ({
    categoryId,
    minLiquidity,
  }: {
    categoryId: string;
    minLiquidity: number;
  }) =>
    backgroundApiProxy.serviceMarketV2.fetchMarketTokenList({
      networkId: '',
      sortBy: 'v24hUSD',
      sortType: 'desc',
      page: 1,
      limit: HOME_MARKET_CATEGORY_REQUEST_LIMIT,
      minLiquidity,
      type: categoryId,
      timeFrame: HOME_MARKET_CATEGORY_TIME_FRAME,
    }),
  fetchTokenAliases: () =>
    backgroundApiProxy.serviceHyperliquid.getTokenSearchAliases(),
  fetchTokenListBatch: (
    tokenAddressList: {
      chainId: string;
      contractAddress: string;
      isNative: boolean;
    }[],
  ) =>
    backgroundApiProxy.serviceMarketV2.fetchMarketTokenListBatch({
      tokenAddressList,
    }),
  getWatchList: () => backgroundApiProxy.serviceMarketV2.getMarketWatchListV2(),
};

type IHomeMarketSourceApi = typeof homeMarketSourceApi;
type IHomeMarketCategoryCache = ReturnType<
  typeof createHomeMarketCategoryTokensCache<IFavoriteTokenDisplay>
>;
type IHomeMarketControllerCache = {
  cache: IHomeMarketCategoryCache;
  ownerKey?: string;
  payloadByCategoryId: Map<string, IHomePopularTradingPayload>;
};

function buildHomeMarketCategories({
  config,
  favoritesLabel,
  perpsLabel,
}: {
  config: IMarketBasicConfigData;
  favoritesLabel: string;
  perpsLabel: string;
}): IMarketCategoryItem[] {
  const favoritesCategory: IMarketCategoryItem = {
    id: FAVORITES_CATEGORY_ID,
    name: favoritesLabel,
    iconName: 'StarOutline',
    iconOnly: true,
  };
  const spotCategories: IMarketCategoryItem[] =
    config.spotCategories && config.spotCategories.length > 0
      ? config.spotCategories.map((category) => ({
          id: category.type,
          name: category.name,
          icon: category.icon,
        }))
      : DEFAULT_SPOT_CATEGORIES;
  const categories: IMarketCategoryItem[] =
    config.homeTab && config.homeTab.length > 0
      ? config.homeTab.map((tab) =>
          tab.type === HOME_WATCHLIST_TAB_TYPE
            ? { ...favoritesCategory, name: tab.name }
            : { id: tab.type, name: tab.name, icon: tab.icon },
        )
      : [favoritesCategory, ...spotCategories];
  const hasPerpsHotCategory = config.perpsCategories?.some(
    (category) => category.categoryId === HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
  );
  return hasPerpsHotCategory
    ? [...categories, { id: HOME_PERPS_HOT_CATEGORY_ID, name: perpsLabel }]
    : categories;
}

async function fetchHomeMarketCategoryRows({
  api,
  categoryId,
  minLiquidity,
}: {
  api: IHomeMarketSourceApi;
  categoryId: string;
  minLiquidity: number;
}): Promise<IFavoriteTokenDisplay[]> {
  if (categoryId === HOME_PERPS_HOT_CATEGORY_ID) {
    const [response, tokenSearchAliases] = await Promise.all([
      api.fetchPerpsTokens(HOME_PERPS_HOT_REQUEST_CATEGORY_ID),
      api.fetchTokenAliases(),
    ]);
    return response.tokens
      .map((token) =>
        mapMarketPerpsTokenToDisplay({
          token,
          subtitle: getTokenSubtitle(token.name, tokenSearchAliases),
        }),
      )
      .slice(0, HOME_MARKET_CATEGORY_REQUEST_LIMIT);
  }

  const response = await api.fetchSpotCategoryTokens({
    categoryId,
    minLiquidity,
  });
  return response.list
    .map(mapMarketTokenToDisplay)
    .filter((item): item is IFavoriteTokenDisplay => item !== null)
    .slice(0, HOME_MARKET_CATEGORY_REQUEST_LIMIT);
}

async function fetchAndCacheHomeMarketCategoryRows({
  api,
  cache,
  categoryId,
  minLiquidity,
}: {
  api: IHomeMarketSourceApi;
  cache: IHomeMarketCategoryCache;
  categoryId: string;
  minLiquidity: number;
}): Promise<IFavoriteTokenDisplay[]> {
  const requestId = cache.beginRequest({
    categoryIds: [categoryId],
    minLiquidity,
  });
  const rows = await fetchHomeMarketCategoryRows({
    api,
    categoryId,
    minLiquidity,
  });
  cache.commitCategory({
    categoryId,
    minLiquidity,
    requestId,
    tokens: rows,
  });
  return (
    cache.getTokens({
      minLiquidity,
      selectedMarketCategoryId: categoryId,
    }) ?? []
  );
}

async function prefetchHomeMarketCategoryRows({
  api,
  cache,
  categoryIds,
  minLiquidity,
}: {
  api: IHomeMarketSourceApi;
  cache: IHomeMarketCategoryCache;
  categoryIds: string[];
  minLiquidity: number;
}): Promise<void> {
  await Promise.allSettled(
    categoryIds.map((categoryId) =>
      fetchAndCacheHomeMarketCategoryRows({
        api,
        cache,
        categoryId,
        minLiquidity,
      }),
    ),
  );
}

function getCachedHomeMarketCategoryRows({
  categoryId,
  prefetchedRowsByRequestKey,
}: {
  categoryId: string;
  prefetchedRowsByRequestKey: Readonly<
    Record<string, readonly IFavoriteTokenDisplay[]>
  >;
}): IFavoriteTokenDisplay[] | undefined {
  const requestKeyPrefix = `${categoryId}:`;
  const entry = Object.entries(prefetchedRowsByRequestKey).find(
    ([requestKey]) => requestKey.startsWith(requestKeyPrefix),
  );
  return entry ? [...entry[1]] : undefined;
}

function buildHomeMarketCachedCategoryPayload({
  cachedCategoryPayload,
  currentPayload,
  prefetchedRowsByRequestKey,
  selectedCategoryId,
}: {
  cachedCategoryPayload?: IHomePopularTradingPayload;
  currentPayload?: IHomePopularTradingPayload;
  prefetchedRowsByRequestKey: Readonly<
    Record<string, readonly IFavoriteTokenDisplay[]>
  >;
  selectedCategoryId: string;
}): IHomePopularTradingPayload | undefined {
  if (
    !currentPayload ||
    currentPayload.resolvedCategoryId === selectedCategoryId ||
    !currentPayload.categories.some(
      (category) => category.id === selectedCategoryId,
    )
  ) {
    return undefined;
  }

  if (selectedCategoryId === FAVORITES_CATEGORY_ID) {
    if (
      !cachedCategoryPayload ||
      cachedCategoryPayload.watchListContentKey !==
        currentPayload.watchListContentKey
    ) {
      return undefined;
    }
    return {
      ...currentPayload,
      favoriteMode: cachedCategoryPayload.favoriteMode,
      prefetchedRowsByRequestKey,
      resolvedCategoryId: selectedCategoryId,
      rows: cachedCategoryPayload.rows,
      selectedCategoryId,
      totalFavorites: cachedCategoryPayload.totalFavorites,
      watchListContentKey: cachedCategoryPayload.watchListContentKey,
      watchListItems: cachedCategoryPayload.watchListItems,
    };
  }

  const rows = getCachedHomeMarketCategoryRows({
    categoryId: selectedCategoryId,
    prefetchedRowsByRequestKey,
  });
  if (!rows) {
    return undefined;
  }
  return {
    ...currentPayload,
    prefetchedRowsByRequestKey,
    resolvedCategoryId: selectedCategoryId,
    rows,
    selectedCategoryId,
  };
}

function mapFavoritePerpsToken({
  aliases,
  target,
  token,
}: {
  aliases: Awaited<ReturnType<IHomeMarketSourceApi['fetchTokenAliases']>>;
  target: IMarketWatchListItemV2;
  token: IMarketPerpsTokenFromServer;
}): IFavoriteTokenDisplay {
  return {
    ...mapMarketPerpsTokenToDisplay({
      token,
      subtitle: getTokenSubtitle(token.name, aliases),
    }),
    perpsCoin: target.perpsCoin,
  };
}

function mapFavoriteSpotToken({
  item,
  target,
}: {
  item: IMarketTokenListItem;
  target: IMarketWatchListItemV2;
}): IFavoriteTokenDisplay {
  return {
    chainId: target.chainId,
    contractAddress: target.contractAddress,
    isNative: target.isNative ?? false,
    symbol: item.symbol,
    name: item.name,
    logoUrl: item.logoUrl ?? '',
    logoUrls: item.logoUrls,
    price: getMarketTokenDisplayPrice(item),
    priceChange24h: getMarketTokenDisplayPriceChange24h(item),
    marketCap: getMarketTokenDisplayMarketCap(item),
    volume24h: getMarketTokenDisplayVolume24h(item),
    communityRecognized: item.communityRecognized,
    stock: item.stock,
  };
}

async function fetchHomeMarketFavoriteRows({
  api,
  config,
  watchListItems,
}: {
  api: IHomeMarketSourceApi;
  config: IMarketBasicConfigData;
  watchListItems: IMarketWatchListItemV2[];
}): Promise<IFavoriteTokenDisplay[]> {
  if (watchListItems.length === 0) {
    const seen = new Set<string>();
    const targetList = config.recommendTokens
      .filter((token) => {
        const key = getTokenKey(token);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .slice(0, HOME_MARKET_RECOMMENDATION_COUNT)
      .map((token) => ({
        chainId: token.chainId,
        contractAddress: token.contractAddress,
        isNative: token.isNative ?? false,
      }));
    if (targetList.length === 0) {
      return [];
    }
    const response = await api.fetchTokenListBatch(targetList);
    const tokenMap = new Map<string, IMarketTokenListItem>();
    response.list.forEach((item) => {
      const networkId = item.networkId ?? item.chainId ?? '';
      const { normalizedAddress } = getNativeTokenInfo(
        item.isNative,
        item.address,
      );
      tokenMap.set(`${networkId}:${normalizedAddress}`, item);
    });
    return targetList
      .map((target): IFavoriteTokenDisplay | null => {
        const { normalizedAddress } = getNativeTokenInfo(
          target.isNative,
          target.contractAddress,
        );
        const item = tokenMap.get(`${target.chainId}:${normalizedAddress}`);
        return item ? mapFavoriteSpotToken({ item, target }) : null;
      })
      .filter((item): item is IFavoriteTokenDisplay => item !== null);
  }

  const targets = watchListItems.slice(0, HOME_MARKET_FAVORITES_DISPLAY_COUNT);
  const spotTargets = targets.filter((item) => !item.perpsCoin && item.chainId);
  const perpsTargets = targets.filter((item) => Boolean(item.perpsCoin));
  const [spotResult, perpsResult, aliasesResult] = await Promise.allSettled([
    spotTargets.length > 0
      ? api.fetchTokenListBatch(
          spotTargets.map((item) => ({
            chainId: item.chainId,
            contractAddress: item.contractAddress,
            isNative: item.isNative ?? false,
          })),
        )
      : { list: [] as IMarketTokenListItem[] },
    perpsTargets.length > 0 ? api.fetchPerpsTokens('all') : null,
    perpsTargets.length > 0 ? api.fetchTokenAliases() : null,
  ]);
  const spotTokens =
    spotResult.status === 'fulfilled'
      ? spotResult.value.list
      : ([] as IMarketTokenListItem[]);
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
  const perpsTokenMap = new Map(
    perpsTokens.map((token) => [token.name, token] as const),
  );

  return targets
    .map((target): IFavoriteTokenDisplay | null => {
      if (target.perpsCoin) {
        const token = perpsTokenMap.get(target.perpsCoin);
        return token ? mapFavoritePerpsToken({ aliases, target, token }) : null;
      }
      const { normalizedAddress } = getNativeTokenInfo(
        target.isNative,
        target.contractAddress,
      );
      const item = spotTokenMap.get(`${target.chainId}:${normalizedAddress}`);
      return item ? mapFavoriteSpotToken({ item, target }) : null;
    })
    .filter((item): item is IFavoriteTokenDisplay => item !== null);
}

async function loadHomeMarketPayload({
  api = homeMarketSourceApi,
  cache,
  favoritesLabel,
  perpsLabel,
  selectedCategoryId,
}: {
  api?: IHomeMarketSourceApi;
  cache: IHomeMarketCategoryCache;
  favoritesLabel: string;
  perpsLabel: string;
  selectedCategoryId: string;
}): Promise<IHomePopularTradingPayload> {
  const earnRowsPromise = api
    .fetchEarnAssets()
    .then((response) => response?.tokens?.slice(0, 6) ?? [])
    .catch(() => []);
  const [configResponse, watchList] = await Promise.all([
    api.fetchBasicConfig(),
    api.getWatchList(),
  ]);
  const config = configResponse.data;
  const categories = buildHomeMarketCategories({
    config,
    favoritesLabel,
    perpsLabel,
  });
  const resolvedCategoryId = categories.some(
    (category) => category.id === selectedCategoryId,
  )
    ? selectedCategoryId
    : (categories[0]?.id ?? FAVORITES_CATEGORY_ID);
  const selectedMarketCategoryId =
    resolvedCategoryId === FAVORITES_CATEGORY_ID
      ? undefined
      : resolvedCategoryId || DEFAULT_MARKET_CATEGORY_ID;
  const minLiquidity = config.minLiquidity || 5000;
  const hasPerpsHotCategory = categories.some(
    (category) => category.id === HOME_PERPS_HOT_CATEGORY_ID,
  );
  const prefetchCategoryIds = categories
    .map((category) => category.id)
    .filter((categoryId) => categoryId !== FAVORITES_CATEGORY_ID);
  const foregroundCategoryIds = new Set(
    [
      selectedMarketCategoryId,
      hasPerpsHotCategory ? HOME_PERPS_HOT_CATEGORY_ID : undefined,
    ].filter((categoryId): categoryId is string => Boolean(categoryId)),
  );
  void prefetchHomeMarketCategoryRows({
    api,
    cache,
    categoryIds: prefetchCategoryIds.filter(
      (categoryId) => !foregroundCategoryIds.has(categoryId),
    ),
    minLiquidity,
  });
  const rowsPromise = selectedMarketCategoryId
    ? fetchAndCacheHomeMarketCategoryRows({
        api,
        cache,
        categoryId: selectedMarketCategoryId,
        minLiquidity,
      })
    : fetchHomeMarketFavoriteRows({
        api,
        config,
        watchListItems: watchList.data,
      });
  const independentPerpsHotRowsPromise =
    hasPerpsHotCategory &&
    selectedMarketCategoryId !== HOME_PERPS_HOT_CATEGORY_ID
      ? fetchAndCacheHomeMarketCategoryRows({
          api,
          cache,
          categoryId: HOME_PERPS_HOT_CATEGORY_ID,
          minLiquidity,
        })
      : Promise.resolve<IFavoriteTokenDisplay[]>([]);
  const [rows, independentPerpsHotRows, earnRows] = await Promise.all([
    rowsPromise,
    independentPerpsHotRowsPromise,
    earnRowsPromise,
  ]);
  const perpsHotRows =
    selectedMarketCategoryId === HOME_PERPS_HOT_CATEGORY_ID
      ? rows
      : independentPerpsHotRows;
  return {
    categories,
    earnRows,
    favoriteMode: watchList.data.length > 0 ? 'favorites' : 'recommendation',
    perpsHotRows,
    prefetchCategoryIds,
    prefetchedRowsByRequestKey: cache.getSnapshot(),
    resolvedCategoryId,
    rows,
    selectedCategoryId,
    totalFavorites: watchList.data.length,
    watchListContentKey: stringUtils.stableStringify(watchList.data),
    watchListItems: watchList.data,
  };
}

export function HomeMarketStoreController() {
  const intl = useIntl();
  const stableOwner = useStableHomeFactsOwner();
  const interaction = useHomeInteraction();
  const currentMarketPayload = useHomeSectionPayload('market');
  const currentMarketPayloadRef = useRef(currentMarketPayload);
  currentMarketPayloadRef.current = currentMarketPayload;
  const { beginHomeSectionRequest, completeHomeSectionRequest } =
    useHomeStoreSourcePublisher();
  const selectedCategoryId = getSelectedHomeMarketCategory(
    interaction.sectionControls.market?.[
      HOME_MARKET_SELECTED_CATEGORY_CONTROL_ID
    ],
    FAVORITES_CATEGORY_ID,
  );
  const ownerKey = stableOwner
    ? `${stableOwner.ownerToken.scopeKey}:${stableOwner.ownerToken.sessionId}`
    : undefined;
  const cacheRef = useRef<IHomeMarketControllerCache>({
    cache: createHomeMarketCategoryTokensCache<IFavoriteTokenDisplay>(),
    payloadByCategoryId: new Map(),
  });
  if (cacheRef.current.ownerKey !== ownerKey) {
    cacheRef.current = {
      cache: createHomeMarketCategoryTokensCache<IFavoriteTokenDisplay>(),
      ownerKey,
      payloadByCategoryId: new Map(),
    };
  }
  useEffect(() => {
    if (currentMarketPayload) {
      cacheRef.current.payloadByCategoryId.set(
        currentMarketPayload.resolvedCategoryId,
        currentMarketPayload,
      );
    }
  }, [currentMarketPayload]);
  const favoritesLabel = intl.formatMessage({
    id: ETranslations.global_favorites,
  });
  const perpsLabel = intl.formatMessage({ id: ETranslations.global_perp });
  const { run: refreshMarket } = usePromiseResult(
    async () => {
      if (!stableOwner) {
        return;
      }
      const controllerCache = cacheRef.current;
      const prefetchedRowsByRequestKey = controllerCache.cache.getSnapshot();
      const cachedPayload = buildHomeMarketCachedCategoryPayload({
        cachedCategoryPayload:
          controllerCache.payloadByCategoryId.get(selectedCategoryId),
        currentPayload: currentMarketPayloadRef.current,
        prefetchedRowsByRequestKey,
        selectedCategoryId,
      });
      if (cachedPayload) {
        await runHomeMarketStoreRequest({
          gateway: {
            begin: () =>
              beginHomeSectionRequest({
                dataSchemaVersion: HOME_MARKET_DATA_SCHEMA_VERSION,
                ownerToken: stableOwner.ownerToken,
                paramsFingerprint: stringUtils.stableStringify({
                  selectedCategoryId,
                }),
                quoteBasis: { currency: USD_CURRENCY_ID },
                sectionId: 'market',
              }),
            complete: completeHomeSectionRequest,
          },
          load: async () => cachedPayload,
        });
        controllerCache.payloadByCategoryId.set(
          cachedPayload.resolvedCategoryId,
          cachedPayload,
        );
      }
      await runHomeMarketStoreRequest({
        gateway: {
          begin: () =>
            beginHomeSectionRequest({
              dataSchemaVersion: HOME_MARKET_DATA_SCHEMA_VERSION,
              ownerToken: stableOwner.ownerToken,
              paramsFingerprint: stringUtils.stableStringify({
                selectedCategoryId,
              }),
              quoteBasis: { currency: USD_CURRENCY_ID },
              sectionId: 'market',
            }),
          complete: completeHomeSectionRequest,
        },
        load: async () => {
          const payload = await loadHomeMarketPayload({
            cache: controllerCache.cache,
            favoritesLabel,
            perpsLabel,
            selectedCategoryId,
          });
          controllerCache.payloadByCategoryId.set(
            payload.resolvedCategoryId,
            payload,
          );
          return payload;
        },
      });
    },
    [
      favoritesLabel,
      beginHomeSectionRequest,
      completeHomeSectionRequest,
      perpsLabel,
      selectedCategoryId,
      stableOwner,
    ],
    {
      pollingInterval: HOME_MARKET_POLLING_INTERVAL,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      watchLoading: true,
    },
  );

  useEffect(() => {
    const refresh = () => {
      void refreshMarket();
    };
    appEventBus.on(EAppEventBusNames.RefreshMarketWatchList, refresh);
    return () => {
      appEventBus.off(EAppEventBusNames.RefreshMarketWatchList, refresh);
    };
  }, [refreshMarket]);

  return null;
}

export {
  buildHomeMarketCachedCategoryPayload,
  buildHomeMarketCategories,
  loadHomeMarketPayload,
  prefetchHomeMarketCategoryRows,
};
export type { IHomeMarketSourceApi };
