import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  IconButton,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
  getSharedButtonStyles,
  rootNavigationRef,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListLoading } from '@onekeyhq/kit/src/components/Loading';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import { EPerpPageEnterSource } from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { getTokenSubtitle } from '@onekeyhq/shared/src/utils/perpsUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';
import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';

import {
  useMarketBasicConfig,
  useNavigateToMarketTab,
  usePerpsNavigation,
} from '../../../Market/hooks';
import { CategorySelector } from '../../../Market/MarketHomeV2/components/CategorySelector';
import { getNativeTokenInfo } from '../../../Market/MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers';
import { EMarketHomeTab } from '../../../Market/MarketHomeV2/types';
import { RichBlock } from '../RichBlock/RichBlock';
import { RichTable } from '../RichTable';

import {
  DEFAULT_MARKET_CATEGORY_ID,
  DEFAULT_SPOT_CATEGORIES,
  FAVORITES_CATEGORY_ID,
  HOME_PERPS_HOT_CATEGORY_ID,
  HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
  HOME_WATCHLIST_TAB_TYPE,
} from './constants';
import { MarketCategoryTokenList } from './MarketCategoryTokenList';
import {
  getPopularTradingColumns,
  renderPopularTradingCommunityBadge,
  renderPopularTradingStockBadges,
} from './metricColumns';
import { useHomeMarketCategoryTokens } from './useHomeMarketCategoryTokens';
import {
  getMarketTokenDisplayMarketCap,
  getMarketTokenDisplayPrice,
  getMarketTokenDisplayPriceChange24h,
  getMarketTokenDisplayVolume24h,
  getTokenKey,
} from './utils';

import type { IFavoriteTokenDisplay } from './types';
import type { IMarketCategoryItem } from '../../../Market/MarketHomeV2/types';

function RecommendCardItem({
  token,
  checked,
  onChange,
}: {
  token: IFavoriteTokenDisplay;
  checked: boolean;
  onChange: (checked: boolean, tokenKey: string) => void;
}) {
  const { sharedFrameStyles } = useMemo(
    () =>
      getSharedButtonStyles({
        disabled: false,
        loading: false,
      }),
    [],
  );

  return (
    <XStack
      userSelect="none"
      flexGrow={1}
      flexBasis={0}
      justifyContent="space-between"
      px="$4"
      py="$2"
      {...sharedFrameStyles}
      bg="$bgSubdued"
      borderRadius="$3"
      borderWidth={1}
      borderColor="$neutral3"
      onPress={() => onChange(!checked, getTokenKey(token))}
      ai="center"
      $sm={{
        px: '$2.5',
        py: '$2.5',
      }}
    >
      <XStack gap="$3" ai="center" flexShrink={1}>
        <Token
          size="md"
          tokenImageUri={token.logoUrl}
          tokenImageUris={token.logoUrls}
          networkId={token.chainId}
          showNetworkIcon
        />
        <YStack
          flexShrink={1}
          minWidth={0}
          {...(platformEnv.isNativeAndroid
            ? {
                width: '$20',
                height: '$9',
                justifyContent: 'center',
              }
            : {})}
        >
          <XStack alignItems="center" gap="$1" minWidth={0}>
            <SizableText
              size="$bodyLgMedium"
              numberOfLines={1}
              flexShrink={1}
              $sm={{
                size: '$bodyMdMedium',
              }}
            >
              {token.symbol}
            </SizableText>
            {renderPopularTradingStockBadges(token)}
            {renderPopularTradingCommunityBadge(token)}
          </XStack>
          <XStack>
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              flexShrink={1}
              numberOfLines={1}
              maxWidth={120}
              $sm={{
                maxWidth: 70,
              }}
            >
              {token.name}
            </SizableText>
          </XStack>
        </YStack>
      </XStack>
      {checked ? (
        <Stack flexShrink={0}>
          <Icon
            name="CheckRadioSolid"
            size="$6"
            color="$iconActive"
            $sm={{ size: '$5' }}
          />
        </Stack>
      ) : (
        <Stack w="$6" h="$6" $sm={{ w: '$5', h: '$5' }} />
      )}
    </XStack>
  );
}

function PopularTrading({ tableLayout }: { tableLayout?: boolean }) {
  const intl = useIntl();
  const { md } = useMedia();
  const shouldUseTableLayout = Boolean(tableLayout && !md);
  const navigation = useAppNavigation();
  const navigateToMarketTab = useNavigateToMarketTab();
  const { navigateToPerps } = usePerpsNavigation(
    EPerpPageEnterSource.PopularTrading,
  );
  const {
    isLoading: isMarketBasicConfigLoading,
    minLiquidity,
    homeTab: apiHomeTabs,
    perpsCategories,
    spotCategories: apiSpotCategories,
  } = useMarketBasicConfig();
  const [favoriteTokens, setFavoriteTokens] = useState<IFavoriteTokenDisplay[]>(
    [],
  );
  const [hasUserFavorites, setHasUserFavorites] = useState(false);
  const [totalFavoritesCount, setTotalFavoritesCount] = useState(0);
  const [selectedTokens, setSelectedTokens] = useState<IFavoriteTokenDisplay[]>(
    [],
  );
  const [watchListItems, setWatchListItems] = useState<
    IMarketWatchListItemV2[]
  >([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    FAVORITES_CATEGORY_ID,
  );

  const initializedRef = useRef(false);
  const hasShownCategorySelectorRef = useRef(false);
  const refreshDataRef = useRef<() => Promise<void>>(async () => {});
  const handleRemoveFromWatchlistRef = useRef<
    (record: IFavoriteTokenDisplay) => void
  >(() => {});

  // Always show 4 tokens in empty state
  const displayCount = 4;

  // Market tab differs by platform
  const marketTab = platformEnv.isNative
    ? ETabRoutes.Discovery
    : ETabRoutes.Market;

  const marketCategories = useMemo<IMarketCategoryItem[]>(() => {
    if (apiSpotCategories.length > 0) {
      return apiSpotCategories.map((category) => ({
        id: category.type,
        name: category.name,
        icon: category.icon,
      }));
    }
    return DEFAULT_SPOT_CATEGORIES;
  }, [apiSpotCategories]);

  const favoritesCategory = useMemo<IMarketCategoryItem>(
    () => ({
      id: FAVORITES_CATEGORY_ID,
      name: intl.formatMessage({ id: ETranslations.global_favorites }),
      iconName: 'StarOutline',
      iconOnly: true,
    }),
    [intl],
  );

  const homePerpsHotCategory = useMemo<IMarketCategoryItem | undefined>(() => {
    const apiHotCategory = perpsCategories.find(
      (category) => category.categoryId === HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
    );
    if (!apiHotCategory) {
      return undefined;
    }
    return {
      id: HOME_PERPS_HOT_CATEGORY_ID,
      name: intl.formatMessage({ id: ETranslations.global_perp }),
    };
  }, [intl, perpsCategories]);

  const homeCategories = useMemo<IMarketCategoryItem[]>(() => {
    const buildWithPerpsHotCategory = (categories: IMarketCategoryItem[]) => {
      if (!homePerpsHotCategory) {
        return categories;
      }

      return [...categories, homePerpsHotCategory];
    };

    if (apiHomeTabs.length > 0) {
      const categories = apiHomeTabs.map((tab) => {
        if (tab.type === HOME_WATCHLIST_TAB_TYPE) {
          return {
            ...favoritesCategory,
            name: tab.name,
          };
        }

        return {
          id: tab.type,
          name: tab.name,
          icon: tab.icon,
        };
      });

      return buildWithPerpsHotCategory(categories);
    }

    return buildWithPerpsHotCategory([favoritesCategory, ...marketCategories]);
  }, [apiHomeTabs, favoritesCategory, homePerpsHotCategory, marketCategories]);

  const resolvedSelectedCategoryId = useMemo(() => {
    if (homeCategories.some((category) => category.id === selectedCategoryId)) {
      return selectedCategoryId;
    }

    return homeCategories[0]?.id ?? FAVORITES_CATEGORY_ID;
  }, [homeCategories, selectedCategoryId]);

  const selectedMarketCategoryId =
    resolvedSelectedCategoryId === FAVORITES_CATEGORY_ID
      ? undefined
      : resolvedSelectedCategoryId || DEFAULT_MARKET_CATEGORY_ID;

  const { categoryTokens, isCategoryLoading } = useHomeMarketCategoryTokens({
    minLiquidity,
    selectedMarketCategoryId,
  });

  const isTokenInWatchList = useCallback(
    (record: IFavoriteTokenDisplay) => {
      if (record.perpsCoin) {
        return watchListItems.some(
          (item) => item.perpsCoin === record.perpsCoin,
        );
      }

      return watchListItems.some((item) =>
        equalTokenNoCaseSensitive({
          token1: {
            networkId: record.chainId,
            contractAddress: record.contractAddress,
          },
          token2: {
            networkId: item.chainId,
            contractAddress: item.contractAddress,
          },
        }),
      );
    },
    [watchListItems],
  );

  const handleMarketCategoryStarPress = useCallback(
    async (record: IFavoriteTokenDisplay) => {
      const checked = isTokenInWatchList(record);

      try {
        const firstSortIndex =
          watchListItems.length > 0
            ? (watchListItems[0].sortIndex ?? 1000)
            : 1000;

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
              callerName: 'PopularTrading',
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
              callerName: 'PopularTrading',
            });
            void backgroundApiProxy.serviceMarketV2.syncToPerpsAtom({
              coin: record.perpsCoin,
              action: 'add',
            });
          }

          appEventBus.emit(EAppEventBusNames.RefreshMarketWatchList, undefined);
          await refreshDataRef.current();
          return;
        }

        if (checked) {
          await backgroundApiProxy.serviceMarketV2.removeMarketWatchListV2({
            items: [
              {
                chainId: record.chainId,
                contractAddress: record.contractAddress,
              },
            ],
            callerName: 'PopularTrading',
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
            callerName: 'PopularTrading',
          });

          defaultLogger.dex.watchlist.dexAddToWatchlist({
            network: record.chainId,
            tokenSymbol: record.symbol || '',
            tokenContract: record.contractAddress,
            addFrom: EWatchlistFrom.Homepage,
          });
        }

        appEventBus.emit(EAppEventBusNames.RefreshMarketWatchList, undefined);
        await refreshDataRef.current();
      } catch (_error) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          }),
        });
      }
    },
    [intl, isTokenInWatchList, watchListItems],
  );

  // Columns for table layout (only used when user has favorites)
  const columns = useMemo(() => {
    // Favorites are already in the watchlist, so the star always removes.
    const renderStarButton = (record: IFavoriteTokenDisplay) => (
      <IconButton
        testID={
          shouldUseTableLayout ? 'home-columns-icon-btn' : 'home-icon-btn'
        }
        icon="StarSolid"
        size="small"
        variant="tertiary"
        iconProps={{ color: '$iconActive' }}
        title={intl.formatMessage({
          id: ETranslations.market_remove_from_favorites,
        })}
        m="$0"
        onPress={() => handleRemoveFromWatchlistRef.current(record)}
        {...(shouldUseTableLayout
          ? undefined
          : {
              hoverStyle: { bg: 'transparent' },
              pressStyle: { bg: 'transparent' },
            })}
      />
    );

    return getPopularTradingColumns({
      intl,
      shouldUseTableLayout,
      renderStarButton,
    });
  }, [intl, shouldUseTableLayout]);

  const { isLoading, run: refreshData } = usePromiseResult(
    async () => {
      // Get user's favorites from local storage (synced via Prime Cloud Sync)
      const watchList =
        await backgroundApiProxy.serviceMarketV2.getMarketWatchListV2();
      setWatchListItems(watchList.data);

      // Check if user has any favorites
      const userHasFavorites = watchList.data.length > 0;

      // Clear favoriteTokens when switching from has favorites to no favorites
      // to avoid showing stale data during the transition
      if (!userHasFavorites && hasUserFavorites) {
        setFavoriteTokens([]);
      }

      setHasUserFavorites(userHasFavorites);
      setTotalFavoritesCount(watchList.data.length);

      if (userHasFavorites) {
        // Use user's favorites (up to 3 for display)
        const userDisplayCount = 3;
        const targetItems = watchList.data.slice(0, userDisplayCount);

        // Split into spot and perps items
        const spotTargets = targetItems.filter(
          (item) => !item.perpsCoin && item.chainId,
        );
        const perpsTargets = targetItems.filter((item) => !!item.perpsCoin);

        // Fetch spot and perps data in parallel, isolated so one failure doesn't block the other.
        // Perps localized subtitles (e.g. "美光科技") live in a separate aliases map.
        const [spotResult, perpsResult, perpsAliasesResult] =
          await Promise.allSettled([
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
        const spotResponse =
          spotResult.status === 'fulfilled'
            ? spotResult.value
            : { list: [] as IMarketTokenListItem[] };
        const perpsResponse =
          perpsResult.status === 'fulfilled' ? perpsResult.value : null;
        const perpsAliases =
          perpsAliasesResult.status === 'fulfilled'
            ? (perpsAliasesResult.value ?? undefined)
            : undefined;

        // Build spot token lookup map
        const spotTokenMap = new Map<string, IMarketTokenListItem>();
        spotResponse.list.forEach((item: IMarketTokenListItem) => {
          const networkId = item.networkId ?? item.chainId ?? '';
          const { normalizedAddress } = getNativeTokenInfo(
            item.isNative,
            item.address,
          );
          const key = `${networkId}:${normalizedAddress}`;
          spotTokenMap.set(key, item);
        });

        // Build perps token lookup map
        const perpsTokenMap = new Map<
          string,
          NonNullable<typeof perpsResponse>['tokens'][number]
        >();
        if (perpsResponse?.tokens) {
          for (const t of perpsResponse.tokens) {
            perpsTokenMap.set(t.name, t);
          }
        }

        // Merge in original watchlist order
        const displayTokens = targetItems
          .map((targetItem): IFavoriteTokenDisplay | null => {
            if (targetItem.perpsCoin) {
              // Perps item
              const perpsToken = perpsTokenMap.get(targetItem.perpsCoin);
              if (!perpsToken) return null;
              return {
                chainId: '',
                contractAddress: '',
                isNative: false,
                symbol: perpsToken.displayName,
                name: perpsToken.displayName,
                logoUrl: perpsToken.tokenImageUrl ?? '',
                price: parseFloat(perpsToken.markPrice ?? '0'),
                priceChange24h: perpsToken.change24hPercent ?? 0,
                marketCap: 0,
                perpsCoin: targetItem.perpsCoin,
                maxLeverage: perpsToken.maxLeverage,
                perpsSubtitle: getTokenSubtitle(perpsToken.name, perpsAliases),
                volume24h: parseFloat(perpsToken.volume24h ?? '0'),
              };
            }

            // Spot item
            const { normalizedAddress } = getNativeTokenInfo(
              targetItem.isNative,
              targetItem.contractAddress,
            );
            const key = `${targetItem.chainId}:${normalizedAddress}`;
            const item = spotTokenMap.get(key);
            if (!item) return null;

            return {
              chainId: targetItem.chainId,
              contractAddress: targetItem.contractAddress,
              isNative: targetItem.isNative ?? false,
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
          })
          .filter((item): item is IFavoriteTokenDisplay => item !== null);

        setFavoriteTokens(displayTokens);
        initializedRef.current = true;
      } else {
        // Use server-side recommended tokens (always 4 for card layout)
        const config =
          await backgroundApiProxy.serviceMarketV2.fetchMarketBasicConfig();
        const recommendedTokens = config?.data?.recommendTokens ?? [];

        if (recommendedTokens.length === 0) {
          setFavoriteTokens([]);
          initializedRef.current = true;
          return;
        }

        const seen = new Set<string>();
        const uniqueTokens = recommendedTokens.filter((token) => {
          const key = getTokenKey(token);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        const targetList = uniqueTokens.slice(0, displayCount).map((token) => ({
          chainId: token.chainId,
          contractAddress: token.contractAddress,
          isNative: token.isNative ?? false,
        }));

        const response =
          await backgroundApiProxy.serviceMarketV2.fetchMarketTokenListBatch({
            tokenAddressList: targetList,
          });

        if (response.list.length === 0) {
          return;
        }

        const tokenMap = new Map<string, IMarketTokenListItem>();
        response.list.forEach((item: IMarketTokenListItem) => {
          const networkId = item.networkId ?? item.chainId ?? '';
          const { normalizedAddress } = getNativeTokenInfo(
            item.isNative,
            item.address,
          );
          const key = `${networkId}:${normalizedAddress}`;
          tokenMap.set(key, item);
        });

        const displayTokens: IFavoriteTokenDisplay[] = targetList
          .map((targetItem): IFavoriteTokenDisplay | null => {
            const { normalizedAddress } = getNativeTokenInfo(
              targetItem.isNative,
              targetItem.contractAddress,
            );
            const key = `${targetItem.chainId}:${normalizedAddress}`;
            const item = tokenMap.get(key);
            if (!item) return null;

            return {
              chainId: targetItem.chainId,
              contractAddress: targetItem.contractAddress,
              isNative: targetItem.isNative,
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
          })
          .filter((item): item is IFavoriteTokenDisplay => item !== null);

        setFavoriteTokens(displayTokens);
        initializedRef.current = true;
      }
    },
    [hasUserFavorites],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 30 }),
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );
  refreshDataRef.current = refreshData;

  const isMarketConfigInitialLoading =
    isMarketBasicConfigLoading !== false &&
    apiHomeTabs.length === 0 &&
    apiSpotCategories.length === 0 &&
    perpsCategories.length === 0;
  const isFavoritesInitialLoading =
    !selectedMarketCategoryId && !initializedRef.current && isLoading !== false;
  const isCategoryInitialLoading =
    Boolean(selectedMarketCategoryId) &&
    categoryTokens.length === 0 &&
    isCategoryLoading;
  const shouldHideCategorySelector =
    !hasShownCategorySelectorRef.current &&
    (isMarketConfigInitialLoading ||
      isFavoritesInitialLoading ||
      isCategoryInitialLoading);

  useEffect(() => {
    if (!shouldHideCategorySelector) {
      hasShownCategorySelectorRef.current = true;
    }
  }, [shouldHideCategorySelector]);

  // Initialize selected tokens when favorites load (for empty state)
  useEffect(() => {
    if (!hasUserFavorites && favoriteTokens.length > 0) {
      setSelectedTokens(favoriteTokens);
    }
  }, [hasUserFavorites, favoriteTokens]);

  const handleRecommendItemChange = useCallback(
    (checked: boolean, tokenKey: string) => {
      const token = favoriteTokens.find((t) => getTokenKey(t) === tokenKey);
      if (!token) return;

      setSelectedTokens((prev) =>
        checked
          ? [...prev, token]
          : prev.filter((t) => getTokenKey(t) !== tokenKey),
      );
    },
    [favoriteTokens],
  );

  // Handle add tokens button press
  const handleAddTokens = useCallback(async () => {
    if (selectedTokens.length === 0) return;

    try {
      const nextWatchListItems = selectedTokens.map((token, index) => ({
        chainId: token.chainId,
        contractAddress: token.contractAddress,
        isNative: token.isNative,
        sortIndex: 1000 - (index + 1),
      }));

      await backgroundApiProxy.serviceMarketV2.addMarketWatchListV2({
        watchList: nextWatchListItems,
        callerName: 'PopularTrading',
      });

      // Log analytics for each token added to watchlist
      selectedTokens.forEach((token) => {
        defaultLogger.dex.watchlist.dexAddToWatchlist({
          network: token.chainId,
          tokenSymbol: token.symbol || '',
          tokenContract: token.contractAddress,
          addFrom: EWatchlistFrom.Recommend,
        });
      });

      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.market_added_to_watchlist,
        }),
      });

      // Immediately update hasUserFavorites and refresh data to switch to table view
      setHasUserFavorites(true);
      // Notify Market page to refresh watchlist
      appEventBus.emit(EAppEventBusNames.RefreshMarketWatchList, undefined);
      await refreshData();
    } catch (_error) {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.global_an_error_occurred,
        }),
      });
    }
  }, [selectedTokens, intl, refreshData]);

  // Handle remove token from watchlist
  const handleRemoveFromWatchlist = useCallback(
    async (record: IFavoriteTokenDisplay) => {
      try {
        await backgroundApiProxy.serviceMarketV2.removeMarketWatchListV2({
          items: [
            record.perpsCoin
              ? {
                  chainId: '',
                  contractAddress: '',
                  perpsCoin: record.perpsCoin,
                }
              : {
                  chainId: record.chainId,
                  contractAddress: record.contractAddress,
                },
          ],
          callerName: 'PopularTrading',
        });

        // Sync perps favorites atom to keep bidirectional consistency
        if (record.perpsCoin) {
          void backgroundApiProxy.serviceMarketV2.syncToPerpsAtom({
            coin: record.perpsCoin,
            action: 'remove',
          });
        }

        // Notify Market page to refresh watchlist
        appEventBus.emit(EAppEventBusNames.RefreshMarketWatchList, undefined);
        await refreshData();
      } catch (_error) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          }),
        });
      }
    },
    [intl, refreshData],
  );
  handleRemoveFromWatchlistRef.current = handleRemoveFromWatchlist;

  // Navigate to Market Detail page or Perps trading page
  const handleTokenPress = useCallback(
    (record: IFavoriteTokenDisplay) => {
      if (record.perpsCoin) {
        if (
          platformEnv.isExtensionUiPopup ||
          platformEnv.isExtensionUiSidePanel
        ) {
          void backgroundApiProxy.serviceApp.openExtensionExpandTab({
            path: '/perp',
            params: {
              coin: record.perpsCoin,
            },
          });
          return;
        }
        navigateToPerps(record.perpsCoin);
        return;
      }

      const shortCode = networkUtils.getNetworkShortCode({
        networkId: record.chainId,
      });

      if (
        platformEnv.isExtensionUiPopup ||
        platformEnv.isExtensionUiSidePanel
      ) {
        void backgroundApiProxy.serviceApp.openExtensionMarketTokenDetail({
          tokenAddress: record.contractAddress,
          network: shortCode || record.chainId,
          isNative: record.isNative,
        });
        return;
      }

      navigation.switchTab(marketTab);

      setTimeout(() => {
        rootNavigationRef.current?.navigate(ERootRoutes.Main, {
          screen: marketTab,
          params: {
            screen: ETabMarketRoutes.MarketDetailV2,
            params: {
              tokenAddress: record.contractAddress,
              network: shortCode || record.chainId,
              isNative: record.isNative,
            },
          },
        });
      }, 300);
    },
    [marketTab, navigateToPerps, navigation],
  );

  const renderEmptyStateCards = useCallback(() => {
    const isTokenSelected = (token: IFavoriteTokenDisplay) =>
      selectedTokens.some((t) => getTokenKey(t) === getTokenKey(token));

    const renderCardItem = (token: IFavoriteTokenDisplay) => (
      <RecommendCardItem
        key={`${token.chainId}-${token.contractAddress}`}
        token={token}
        checked={isTokenSelected(token)}
        onChange={handleRecommendItemChange}
      />
    );

    if (!shouldUseTableLayout) {
      return (
        <YStack gap="$2.5" width="100%">
          {[0, 1].map((rowIndex) => (
            <XStack gap="$2.5" key={rowIndex}>
              {favoriteTokens
                .slice(rowIndex * 2, rowIndex * 2 + 2)
                .map(renderCardItem)}
            </XStack>
          ))}
        </YStack>
      );
    }

    return (
      <XStack gap="$3" width="100%">
        {favoriteTokens.map(renderCardItem)}
      </XStack>
    );
  }, [
    favoriteTokens,
    selectedTokens,
    handleRecommendItemChange,
    shouldUseTableLayout,
  ]);

  // Navigate to Market favorites tab
  const handleViewMore = useCallback(() => {
    if (selectedMarketCategoryId === HOME_PERPS_HOT_CATEGORY_ID) {
      navigateToMarketTab({
        tabToSelect: EMarketHomeTab.Perps,
        perpsCategoryToSelect: HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
      });
      return;
    }

    if (selectedMarketCategoryId) {
      navigateToMarketTab({ spotCategoryToSelect: selectedMarketCategoryId });
      return;
    }

    navigateToMarketTab({ tabToSelect: EMarketHomeTab.Watchlist });
  }, [navigateToMarketTab, selectedMarketCategoryId]);

  // Render table/list layout for user favorites
  const renderUserFavoritesList = useCallback(() => {
    // Only show "View more" button when there are more than 3 favorites
    const showViewMoreButton = totalFavoritesCount > 3;

    return (
      <YStack>
        <RichTable<IFavoriteTokenDisplay>
          showHeader={shouldUseTableLayout}
          dataSource={favoriteTokens}
          columns={columns}
          keyExtractor={(item) =>
            item.perpsCoin
              ? `perps-${item.perpsCoin}`
              : `${item.chainId}-${item.contractAddress}`
          }
          estimatedItemSize={56}
          rowProps={{
            mx: '$2',
            px: '$3',
          }}
          headerRowProps={{
            px: '$3',
            mx: '$2',
          }}
          onRow={(record) => ({
            onPress: () => handleTokenPress(record),
          })}
        />
        {showViewMoreButton ? (
          <XStack pt="$3" px="$pagePadding" jc="center" ai="center">
            <Button
              testID="home-show-view-more-button-btn"
              variant="secondary"
              iconAfter="ChevronRightSmallOutline"
              onPress={handleViewMore}
              flexGrow={1}
              flexBasis={0}
              $md={
                {
                  borderRadius: '$full',
                  hoverStyle: { bg: 'transparent' },
                  pressStyle: { bg: 'transparent' },
                } as any
              }
            >
              {intl.formatMessage({ id: ETranslations.global_view_more })}
            </Button>
          </XStack>
        ) : null}
      </YStack>
    );
  }, [
    columns,
    favoriteTokens,
    handleTokenPress,
    handleViewMore,
    intl,
    shouldUseTableLayout,
    totalFavoritesCount,
  ]);

  // Header action button (only show "Add tokens" button in empty state)
  const headerActions = useMemo(() => {
    if (selectedMarketCategoryId) {
      return null;
    }

    // No header action when user has favorites (View more is shown in footer)
    if (hasUserFavorites) {
      return null;
    }

    // Show "Add tokens" button in empty state
    return (
      <Button
        testID="home-header-actions-btn"
        size="small"
        variant="tertiary"
        icon="PlusSmallOutline"
        disabled={selectedTokens.length === 0}
        onPress={handleAddTokens}
      >
        {intl.formatMessage(
          { id: ETranslations.market_add_number_tokens },
          { number: selectedTokens.length || 0 },
        )}
      </Button>
    );
  }, [
    hasUserFavorites,
    selectedMarketCategoryId,
    selectedTokens.length,
    handleAddTokens,
    intl,
  ]);

  const renderContent = useCallback(() => {
    const listContent = (() => {
      if (selectedMarketCategoryId) {
        return (
          <MarketCategoryTokenList
            tokens={categoryTokens}
            isLoading={isCategoryLoading}
            tableLayout={shouldUseTableLayout}
            isTokenInWatchList={isTokenInWatchList}
            onStarPress={handleMarketCategoryStarPress}
            onTokenPress={handleTokenPress}
            onViewMore={handleViewMore}
          />
        );
      }

      // Author intent (#12008 / OK-56230): show the <ListLoading> skeleton for
      // the ENTIRE initial loading window — including the very first render,
      // where usePromiseResult's `isLoading` is still `undefined` (which is why
      // the original code used `isLoading !== false`).
      //
      // Bug it triggers (iOS, RN 0.81.5, Fabric/New Arch): rendering the
      // skeleton on that first `undefined` frame and then swapping it for the
      // real <RichTable> subtree happens WHILE the enclosing
      // react-native-collapsible-tab-view <Tabs.ScrollView> is running its async
      // Yoga measurement pass. That extra ListLoading→RichTable subtree swap
      // mid-measure moves a shadow node to a new parent and trips the assertion
      // `react_native_assert(YGNodeGetOwner(child) == &yogaNode_)` →
      // hard crash on Home startup. (Confirmed via git bisect to #12008.)
      //
      // `react_native_assert` is a DEBUG-ONLY check (compiled out in Release),
      // so production never hits this crash. Therefore we only soften the gate
      // in dev: `isLoading` (truthy → skip the skeleton on the `undefined`
      // frame, avoiding the extra swap) for dev, and keep the author's original
      // `isLoading !== false` (full skeleton UX) in production.
      const shouldShowInitialSkeleton = platformEnv.isDev
        ? isLoading
        : isLoading !== false;
      if (!initializedRef.current && shouldShowInitialSkeleton) {
        return (
          <ListLoading
            listCount={displayCount}
            listContainerProps={{ py: '$0' }}
            listHeaderProps={{ px: '$3' }}
          />
        );
      }

      // Empty state: show card layout
      if (!hasUserFavorites) {
        if (favoriteTokens.length === 0) {
          return (
            <Stack alignItems="center" justifyContent="center" p="$8">
              <SizableText size="$bodyLg" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.global_no_data,
                })}
              </SizableText>
            </Stack>
          );
        }

        return <YStack px="$pagePadding">{renderEmptyStateCards()}</YStack>;
      }

      // User has favorites: show table/list layout
      return renderUserFavoritesList();
    })();

    return (
      <YStack>
        <YStack px={shouldUseTableLayout ? '$pagePadding' : undefined}>
          {shouldHideCategorySelector ? (
            <Stack h="$10" />
          ) : (
            <CategorySelector
              categories={homeCategories}
              selectedCategoryId={resolvedSelectedCategoryId}
              onSelectCategory={setSelectedCategoryId}
              showBorder={false}
              showHorizontalPadding={false}
            />
          )}
        </YStack>
        {listContent}
      </YStack>
    );
  }, [
    categoryTokens,
    displayCount,
    favoriteTokens.length,
    handleMarketCategoryStarPress,
    handleTokenPress,
    handleViewMore,
    hasUserFavorites,
    homeCategories,
    intl,
    isCategoryLoading,
    isTokenInWatchList,
    isLoading,
    renderEmptyStateCards,
    renderUserFavoritesList,
    selectedMarketCategoryId,
    resolvedSelectedCategoryId,
    shouldHideCategorySelector,
    shouldUseTableLayout,
  ]);

  return (
    <RichBlock
      title={intl.formatMessage({ id: ETranslations.global_market })}
      headerActions={headerActions}
      headerContainerProps={{ px: '$pagePadding' }}
      content={renderContent()}
      plainContentContainer
    />
  );
}

export { PopularTrading };
