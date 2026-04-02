import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  IconButton,
  NumberSizeableText,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
  getSharedButtonStyles,
  rootNavigationRef,
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
import {
  EPerpPageEnterSource,
  setPerpPageEnterSource,
} from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';

import { LeverageBadge } from '../../../Market/components/PerpsBadges';
import { useNavigateToMarketTab } from '../../../Market/hooks';
import { getNativeTokenInfo } from '../../../Market/MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers';
import { EMarketHomeTab } from '../../../Market/MarketHomeV2/types';
import { RichBlock } from '../RichBlock/RichBlock';
import { RichTable } from '../RichTable';

function getTokenKey(token: {
  chainId: string;
  contractAddress: string;
  perpsCoin?: string;
}) {
  if (token.perpsCoin) {
    return `perps:${token.perpsCoin}`;
  }
  return `${token.chainId}:${token.contractAddress}`;
}

interface IFavoriteTokenDisplay {
  chainId: string;
  contractAddress: string;
  isNative: boolean;
  symbol: string;
  name: string;
  logoUrl: string;
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  // Perps fields — present when perpsCoin is set
  perpsCoin?: string;
  maxLeverage?: number;
}

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
          networkId={token.chainId}
          showNetworkIcon
        />
        <YStack
          flexShrink={1}
          {...(platformEnv.isNativeAndroid
            ? {
                width: '$20',
                height: '$9',
                justifyContent: 'center',
              }
            : {})}
        >
          <XStack>
            <SizableText
              size="$bodyLgMedium"
              numberOfLines={1}
              $sm={{
                size: '$bodyMdMedium',
              }}
            >
              {token.symbol}
            </SizableText>
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
  const navigation = useAppNavigation();
  const navigateToMarketTab = useNavigateToMarketTab();
  const [favoriteTokens, setFavoriteTokens] = useState<IFavoriteTokenDisplay[]>(
    [],
  );
  const [hasUserFavorites, setHasUserFavorites] = useState(false);
  const [totalFavoritesCount, setTotalFavoritesCount] = useState(0);
  const [selectedTokens, setSelectedTokens] = useState<IFavoriteTokenDisplay[]>(
    [],
  );

  const initializedRef = useRef(false);
  const handleRemoveFromWatchlistRef = useRef<
    (record: IFavoriteTokenDisplay) => void
  >(() => {});

  // Always show 4 tokens in empty state
  const displayCount = 4;

  // Market tab differs by platform
  const marketTab = platformEnv.isNative
    ? ETabRoutes.Discovery
    : ETabRoutes.Market;

  // Columns for table layout (only used when user has favorites)
  const columns = useMemo(() => {
    if (tableLayout) {
      return [
        {
          dataIndex: 'symbol',
          title: intl.formatMessage({ id: ETranslations.global_name }),
          render: (
            _: unknown,
            record: IFavoriteTokenDisplay,
            _index: number,
          ) => (
            <XStack alignItems="center" gap="$2">
              <IconButton
                icon="StarSolid"
                size="small"
                variant="tertiary"
                iconProps={{ color: '$iconActive' }}
                title={intl.formatMessage({
                  id: ETranslations.market_remove_from_favorites,
                })}
                onPress={() => handleRemoveFromWatchlistRef.current(record)}
              />
              <XStack alignItems="center" gap="$2">
                <Token
                  size="md"
                  tokenImageUri={record.logoUrl}
                  networkId={record.perpsCoin ? undefined : record.chainId}
                  showNetworkIcon={!record.perpsCoin}
                />
                <YStack>
                  <XStack alignItems="center" gap="$1">
                    <SizableText size="$bodyLgMedium">
                      {record.symbol}
                    </SizableText>
                    {record.maxLeverage ? (
                      <LeverageBadge leverage={record.maxLeverage} />
                    ) : null}
                  </XStack>
                  <SizableText
                    size="$bodyMd"
                    color="$textSubdued"
                    numberOfLines={1}
                    maxWidth={200}
                  >
                    {record.name}
                  </SizableText>
                </YStack>
              </XStack>
            </XStack>
          ),
        },
        {
          dataIndex: 'price',
          title: intl.formatMessage({ id: ETranslations.global_price }),
          render: (_: unknown, record: IFavoriteTokenDisplay) => (
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="price"
              formatterOptions={{
                currency: '$',
              }}
            >
              {record.price ?? '-'}
            </NumberSizeableText>
          ),
        },
        {
          dataIndex: 'priceChange24h',
          title: intl.formatMessage({ id: ETranslations.market_change_24h }),
          render: (_: unknown, record: IFavoriteTokenDisplay) => {
            const { changeColor, showPlusMinusSigns } =
              getTokenPriceChangeStyle({
                priceChange: record.priceChange24h ?? 0,
              });
            return (
              <NumberSizeableText
                formatter="priceChange"
                formatterOptions={{ showPlusMinusSigns }}
                color={changeColor}
                size="$bodyLgMedium"
              >
                {record.priceChange24h ?? '-'}
              </NumberSizeableText>
            );
          },
        },
        {
          dataIndex: 'volume24h',
          title: intl.formatMessage({ id: ETranslations.market_24h_turnover }),
          render: (_: unknown, record: IFavoriteTokenDisplay) => (
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="marketCap"
              formatterOptions={{
                currency: '$',
              }}
            >
              {!record.volume24h ? '--' : record.volume24h}
            </NumberSizeableText>
          ),
        },
      ];
    }

    return [
      {
        dataIndex: 'symbol',
        title: intl.formatMessage({ id: ETranslations.global_name }),
        render: (_: unknown, record: IFavoriteTokenDisplay, _index: number) => (
          <XStack alignItems="center" gap="$2" justifyContent="flex-end">
            <IconButton
              icon="StarSolid"
              size="small"
              variant="tertiary"
              iconProps={{ color: '$iconActive' }}
              title={intl.formatMessage({
                id: ETranslations.market_remove_from_favorites,
              })}
              onPress={() => handleRemoveFromWatchlistRef.current(record)}
              hoverStyle={{ bg: 'transparent' }}
              pressStyle={{ bg: 'transparent' }}
            />
            <XStack alignItems="center" gap="$2">
              <Token
                size="lg"
                tokenImageUri={record.logoUrl}
                networkId={record.perpsCoin ? undefined : record.chainId}
                showNetworkIcon={!record.perpsCoin}
              />
              <YStack>
                <XStack alignItems="center" gap="$1">
                  <SizableText size="$bodyLgMedium">
                    {record.symbol}
                  </SizableText>
                  {record.maxLeverage ? (
                    <LeverageBadge leverage={record.maxLeverage} />
                  ) : null}
                </XStack>
                <NumberSizeableText
                  size="$bodyMd"
                  formatter="marketCap"
                  formatterOptions={{
                    currency: '$',
                  }}
                >
                  {!record.volume24h ? '--' : record.volume24h}
                </NumberSizeableText>
              </YStack>
            </XStack>
          </XStack>
        ),
      },
      {
        dataIndex: 'price',
        title: intl.formatMessage({ id: ETranslations.global_price }),
        render: (_: unknown, record: IFavoriteTokenDisplay) => {
          const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
            priceChange: record.priceChange24h ?? 0,
          });
          return (
            <YStack alignItems="flex-end">
              <NumberSizeableText
                size="$bodyLgMedium"
                formatter="price"
                formatterOptions={{
                  currency: '$',
                }}
              >
                {record.price ?? '-'}
              </NumberSizeableText>
              <NumberSizeableText
                formatter="priceChange"
                formatterOptions={{ showPlusMinusSigns }}
                color={changeColor}
                size="$bodyMd"
              >
                {record.priceChange24h ?? '-'}
              </NumberSizeableText>
            </YStack>
          );
        },
      },
    ];
  }, [intl, tableLayout]);

  const { isLoading, run: refreshData } = usePromiseResult(
    async () => {
      // Get user's favorites from local storage (synced via Prime Cloud Sync)
      const watchList =
        await backgroundApiProxy.serviceMarketV2.getMarketWatchListV2();

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

        // Fetch spot and perps data in parallel, isolated so one failure doesn't block the other
        const [spotResult, perpsResult] = await Promise.allSettled([
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
        ]);
        const spotResponse =
          spotResult.status === 'fulfilled'
            ? spotResult.value
            : { list: [] as IMarketTokenListItem[] };
        const perpsResponse =
          perpsResult.status === 'fulfilled' ? perpsResult.value : null;

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
              price: parseFloat(item.price ?? '0'),
              priceChange24h: parseFloat(item.priceChange24hPercent ?? '0'),
              marketCap: parseFloat(item.marketCap ?? '0'),
              volume24h: parseFloat(item.volume24h ?? '0'),
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
          .map((targetItem) => {
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
              price: parseFloat(item.price ?? '0'),
              priceChange24h: parseFloat(item.priceChange24hPercent ?? '0'),
              marketCap: parseFloat(item.marketCap ?? '0'),
              volume24h: parseFloat(item.volume24h ?? '0'),
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
      const watchListItems = selectedTokens.map((token, index) => ({
        chainId: token.chainId,
        contractAddress: token.contractAddress,
        isNative: token.isNative,
        sortIndex: 1000 - (index + 1),
      }));

      await backgroundApiProxy.serviceMarketV2.addMarketWatchListV2({
        watchList: watchListItems,
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
        setPerpPageEnterSource(EPerpPageEnterSource.PopularTrading);
        navigation.switchTab(ETabRoutes.Perp);
        void backgroundApiProxy.serviceHyperliquid.changeActiveAsset({
          coin: record.perpsCoin,
        });
        return;
      }

      const shortCode = networkUtils.getNetworkShortCode({
        networkId: record.chainId,
      });

      if (
        platformEnv.isExtensionUiPopup ||
        platformEnv.isExtensionUiSidePanel
      ) {
        void backgroundApiProxy.serviceApp.openExtensionExpandTab({
          path: `/market/token/${shortCode || record.chainId}/${record.contractAddress}`,
          params: {
            isNative: record.isNative,
          },
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
    [navigation, marketTab],
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

    if (!tableLayout) {
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
  }, [favoriteTokens, selectedTokens, handleRecommendItemChange, tableLayout]);

  // Navigate to Market favorites tab
  const handleViewMore = useCallback(() => {
    navigateToMarketTab({ tabToSelect: EMarketHomeTab.Watchlist });
  }, [navigateToMarketTab]);

  // Render table/list layout for user favorites
  const renderUserFavoritesList = useCallback(() => {
    // Only show "View more" button when there are more than 3 favorites
    const showViewMoreButton = totalFavoritesCount > 3;

    return (
      <YStack>
        <RichTable<IFavoriteTokenDisplay>
          showHeader={!!tableLayout}
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
    tableLayout,
    totalFavoritesCount,
  ]);

  // Header action button (only show "Add tokens" button in empty state)
  const headerActions = useMemo(() => {
    // No header action when user has favorites (View more is shown in footer)
    if (hasUserFavorites) {
      return null;
    }

    // Show "Add tokens" button in empty state
    return (
      <Button
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
  }, [hasUserFavorites, selectedTokens.length, handleAddTokens, intl]);

  const renderContent = useCallback(() => {
    if (!initializedRef.current && isLoading) {
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
      return renderEmptyStateCards();
    }

    // User has favorites: show table/list layout
    return renderUserFavoritesList();
  }, [
    displayCount,
    hasUserFavorites,
    isLoading,
    renderEmptyStateCards,
    renderUserFavoritesList,
  ]);

  if (initializedRef.current && isEmpty(favoriteTokens)) {
    return null;
  }

  return (
    <RichBlock
      title={intl.formatMessage({ id: ETranslations.global_favorites })}
      headerActions={headerActions}
      headerContainerProps={{ px: '$pagePadding' }}
      contentContainerProps={
        !hasUserFavorites ? { px: '$pagePadding' } : undefined
      }
      content={renderContent()}
      plainContentContainer
    />
  );
}

export { PopularTrading };
