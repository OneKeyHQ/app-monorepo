/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  DebugRenderTracker,
  type IListViewRef,
  Icon,
  ListView,
  NumberSizeableText,
  Popover,
  SearchBar,
  SizableText,
  Spinner,
  Tabs,
  Tooltip,
  XStack,
  YStack,
  usePopoverContext,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAllAssetCtxsAtom,
  usePerpsAllAssetsFilteredAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import type { IPerpDynamicTab } from '@onekeyhq/kit-bg/src/services/ServiceWebviewPerp/ServiceWebviewPerp';
import {
  usePerpTokenSelectorConfigPersistAtom,
  usePerpTokenSelectorTabsAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import {
  getHyperliquidTokenImageUrl,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IPerpsAssetCtx,
  IPerpsUniverse,
} from '@onekeyhq/shared/types/hyperliquid';
import {
  DEFAULT_PERP_TOKEN_ACTIVE_TAB,
  DEFAULT_PERP_TOKEN_SORT_DIRECTION,
  DEFAULT_PERP_TOKEN_SORT_FIELD,
  XYZ_ASSET_ID_OFFSET,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import {
  type IFavoriteItem,
  usePerpActiveTabValidation,
  usePerpTokenSelector,
  usePerpsFavorites,
} from '../../hooks';

import { FavoritesEmptyState } from './FavoritesEmptyState';
import { PerpTokenSelectorRow } from './PerpTokenSelectorRow';
import { SortableHeaderCell } from './SortableHeaderCell';

export type ITokenSelectorListItem = {
  dexIndex: number;
  index: number;
  assetId?: number;
};

function TabItem({
  name,
  isFocused,
  onPress,
}: {
  name: string;
  isFocused: boolean;
  onPress: (name: string) => void;
}) {
  return (
    <XStack
      py="$3"
      ml="$4"
      mr="$2"
      borderBottomWidth={isFocused ? '$0.5' : '$0'}
      borderBottomColor="$borderActive"
      onPress={() => onPress(name)}
      cursor="default"
    >
      <SizableText
        size="$headingXs"
        color={isFocused ? '$text' : '$textSubdued'}
      >
        {name}
      </SizableText>
    </XStack>
  );
}

function TokenListHeader() {
  const intl = useIntl();
  return (
    <XStack
      px="$4"
      py="$3"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
    >
      <SortableHeaderCell
        field="name"
        label={intl.formatMessage({
          id: ETranslations.perp_token_selector_asset,
        })}
        width={180}
      />
      <SortableHeaderCell
        field="markPrice"
        label={intl.formatMessage({
          id: ETranslations.perp_token_selector_last_price,
        })}
        width={110}
      />
      <SortableHeaderCell
        field="change24hPercent"
        label={intl.formatMessage({
          id: ETranslations.perp_token_selector_24h_change,
        })}
        width={150}
      />
      <SortableHeaderCell
        field="fundingRate"
        label={intl.formatMessage({
          id: ETranslations.perp_position_funding,
        })}
        width={110}
      />
      <SortableHeaderCell
        field="volume24h"
        label={intl.formatMessage({
          id: ETranslations.perp_token_selector_volume,
        })}
        width={110}
      />
      <SortableHeaderCell
        field="openInterest"
        label={intl.formatMessage({
          id: ETranslations.perp_token_bar_open_Interest,
        })}
        width={120}
      />
    </XStack>
  );
}

function BasePerpTokenSelectorContent({
  onLoadingChange,
}: {
  onLoadingChange: (isLoading: boolean) => void;
}) {
  const intl = useIntl();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { searchQuery, setSearchQuery, refreshAllAssets } =
    usePerpTokenSelector();
  const { closePopover } = usePopoverContext();
  const actions = useHyperliquidActions();

  const [{ assetsByDex }] = usePerpsAllAssetsFilteredAtom();
  const [{ assetCtxsByDex }] = usePerpsAllAssetCtxsAtom();
  const [selectorConfig, setSelectorConfig] =
    usePerpTokenSelectorConfigPersistAtom();
  const [dynamicTabsRaw] = usePerpTokenSelectorTabsAtom();
  const dynamicTabs: IPerpDynamicTab[] = useMemo(
    () => dynamicTabsRaw ?? [],
    [dynamicTabsRaw],
  );

  const tabNames = useMemo(
    () => ({
      favorites: intl.formatMessage({ id: ETranslations.perp_tab_favs }),
      all: 'PERPS',
    }),
    [intl],
  );
  const activeTab = selectorConfig?.activeTab ?? DEFAULT_PERP_TOKEN_ACTIVE_TAB;
  const setActiveTab = useCallback(
    (tab: string) => {
      setSelectorConfig(
        (prev) =>
          ({
            field: prev?.field ?? DEFAULT_PERP_TOKEN_SORT_FIELD,
            direction: prev?.direction ?? DEFAULT_PERP_TOKEN_SORT_DIRECTION,
            activeTab: tab,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
      );
    },
    [setSelectorConfig],
  );

  const handleSelectToken = useCallback(
    async (symbol: string) => {
      try {
        onLoadingChange(true);
        void closePopover?.();
        await actions.current.changeActiveAsset({
          coin: symbol,
        });
      } catch (error) {
        console.error('Failed to switch token:', error);
      } finally {
        onLoadingChange(false);
      }
    },
    [closePopover, actions, onLoadingChange],
  );

  const { favoriteItems } = usePerpsFavorites();

  const listRefFavorites = useRef<IListViewRef<ITokenSelectorListItem> | null>(
    null,
  );
  const listRefAll = useRef<IListViewRef<ITokenSelectorListItem> | null>(null);
  const dynamicListRefsRef = useRef<
    Record<string, IListViewRef<ITokenSelectorListItem> | null>
  >({});
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const lastSortRef = useRef<{ field?: string; direction?: string } | null>(
    null,
  );

  // Get dynamic list ref by tabId
  const getDynamicListRef = useCallback(
    (tabId: string) => ({
      current: dynamicListRefsRef.current[tabId] ?? null,
    }),
    [],
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _setDynamicListRef = useCallback(
    (tabId: string, ref: IListViewRef<ITokenSelectorListItem> | null) => {
      dynamicListRefsRef.current[tabId] = ref;
    },
    [],
  );

  useEffect(() => {
    const field = selectorConfig?.field;
    const direction = selectorConfig?.direction;
    const last = lastSortRef.current;
    if (last?.field === field && last?.direction === direction) {
      return;
    }
    lastSortRef.current = { field, direction };

    let ref = listRefAll.current;
    if (activeTabRef.current === 'favorites') {
      ref = listRefFavorites.current;
    } else {
      const dynamicRef = dynamicListRefsRef.current[activeTabRef.current];
      if (dynamicRef) ref = dynamicRef;
    }
    ref?.scrollToOffset?.({ offset: 0, animated: false });
  }, [selectorConfig?.direction, selectorConfig?.field]);

  const computeSortValues = useCallback(
    (assetCtx: IPerpsAssetCtx | undefined) => {
      const markPrice = Number(assetCtx?.markPx || 0);
      const fundingRate = Number(assetCtx?.funding || 0);
      const volume24h = Number(assetCtx?.dayNtlVlm || 0);
      const openInterest = Number(assetCtx?.openInterest || 0);
      const prevDayPx = Number(assetCtx?.prevDayPx || 0);
      const change24hPercent =
        prevDayPx > 0 ? ((markPrice - prevDayPx) / prevDayPx) * 100 : 0;
      const openInterestValue = openInterest * markPrice;
      return {
        markPrice,
        fundingRate,
        volume24h,
        openInterest,
        openInterestValue,
        change24hPercent,
      };
    },
    [],
  );

  const sortCompare = useCallback(
    (
      a: {
        asset: IPerpsUniverse;
        sortValues: ReturnType<typeof computeSortValues>;
      },
      b: {
        asset: IPerpsUniverse;
        sortValues: ReturnType<typeof computeSortValues>;
      },
    ) => {
      const sortField = selectorConfig?.field ?? '';
      const sortDirection = selectorConfig?.direction ?? 'desc';
      if (!sortField) {
        return 0;
      }
      let compareResult = 0;
      switch (sortField) {
        case 'name':
          compareResult = a.asset.name.localeCompare(b.asset.name, undefined, {
            sensitivity: 'base',
          });
          break;
        case 'markPrice':
          compareResult = a.sortValues.markPrice - b.sortValues.markPrice;
          break;
        case 'change24hPercent':
          compareResult =
            a.sortValues.change24hPercent - b.sortValues.change24hPercent;
          break;
        case 'fundingRate':
          compareResult = a.sortValues.fundingRate - b.sortValues.fundingRate;
          break;
        case 'volume24h':
          compareResult = a.sortValues.volume24h - b.sortValues.volume24h;
          break;
        case 'openInterest':
          compareResult =
            a.sortValues.openInterestValue - b.sortValues.openInterestValue;
          break;
        default:
          break;
      }
      return sortDirection === 'asc' ? compareResult : -compareResult;
    },
    [selectorConfig?.direction, selectorConfig?.field],
  );

  const listDataByTab = useMemo(() => {
    const assetsByDexTyped: IPerpsUniverse[][] = assetsByDex || [];
    const assetCtxsByDexTyped: IPerpsAssetCtx[][] = assetCtxsByDex || [];

    const combinedEntries = assetsByDexTyped.flatMap(
      (assets: IPerpsUniverse[], dexIndex: number) => {
        const ctxs = assetCtxsByDexTyped[dexIndex] || [];
        return assets.map((asset, index) => {
          const normalizedAssetId =
            dexIndex === 1
              ? asset.assetId - XYZ_ASSET_ID_OFFSET
              : asset.assetId;
          const sortValues = computeSortValues(ctxs?.[normalizedAssetId]);
          return {
            dexIndex,
            index,
            asset,
            assetId: asset.assetId,
            sortValues,
          };
        });
      },
    );

    const sortField = selectorConfig?.field ?? '';
    const listAll = (() => {
      if (!sortField) {
        return combinedEntries.map((entry) => ({
          dexIndex: entry.dexIndex,
          index: entry.index,
          assetId: entry.assetId,
        }));
      }
      const sorted = combinedEntries.toSorted((a, b) =>
        sortCompare(
          { asset: a.asset, sortValues: a.sortValues },
          { asset: b.asset, sortValues: b.sortValues },
        ),
      );
      return sorted.map((entry) => ({
        dexIndex: entry.dexIndex,
        index: entry.index,
        assetId: entry.assetId,
      }));
    })();

    const favoriteAssetIds = new Set(
      favoriteItems.map((f: IFavoriteItem) => `${f.dexIndex}-${f.assetId}`),
    );
    const listFavorites = listAll.filter((item) =>
      favoriteAssetIds.has(`${item.dexIndex}-${item.assetId}`),
    );

    // Build data for dynamic tabs (filter from sorted listAll to preserve sort order)
    const dynamicTabsData: Record<string, ITokenSelectorListItem[]> = {};
    for (const tab of dynamicTabs) {
      const tokenSet = new Set(tab.tokens);
      const matchingIds = new Set(
        combinedEntries
          .filter((entry) => tokenSet.has(entry.asset.name))
          .map((entry) => `${entry.dexIndex}-${entry.assetId}`),
      );
      dynamicTabsData[tab.tabId] = listAll.filter((item) =>
        matchingIds.has(`${item.dexIndex}-${item.assetId}`),
      );
    }

    return {
      favorites: listFavorites,
      all: listAll,
      dynamic: dynamicTabsData,
    };
  }, [
    assetCtxsByDex,
    assetsByDex,
    computeSortValues,
    dynamicTabs,
    favoriteItems,
    sortCompare,
    selectorConfig?.field,
  ]);

  // Show all server-configured dynamic tabs regardless of search results.
  // Filtering by search-filtered assetsByDex would hide tabs during search
  // and break tab persistence (assetsByDex resets to [] on unmount).
  const visibleDynamicTabs = dynamicTabs;

  usePerpActiveTabValidation({
    activeTab,
    setActiveTab,
    assetsByDex,
    dynamicTabs: dynamicTabsRaw,
    visibleDynamicTabs,
  });

  const keyExtractor = useCallback(
    (item: { dexIndex: number; index: number; assetId?: number }) => {
      const assetId = item.assetId ?? item.index;
      return `${item.dexIndex}-${assetId}`;
    },
    [],
  );

  const renderTokenList = useCallback(
    (
      data: ITokenSelectorListItem[],
      listRef: React.MutableRefObject<IListViewRef<ITokenSelectorListItem> | null>,
      isFavoritesTab = false,
    ) => {
      const showFavoritesEmpty =
        isFavoritesTab && data.length === 0 && !searchQuery;

      return (
        <Tabs.ScrollView showsVerticalScrollIndicator={false}>
          <YStack>
            {!isFavoritesTab || data.length > 0 ? <TokenListHeader /> : null}
            <YStack height={350}>
              {showFavoritesEmpty ? (
                <FavoritesEmptyState />
              ) : (
                <ListView
                  useFlashList
                  ref={listRef}
                  keyExtractor={keyExtractor}
                  data={data}
                  renderItem={({ item: mockedToken }) => (
                    <PerpTokenSelectorRow
                      mockedToken={mockedToken}
                      onPress={(name) => handleSelectToken(name)}
                    />
                  )}
                  ListEmptyComponent={
                    <XStack p="$4" justifyContent="center">
                      <SizableText size="$bodySm" color="$textSubdued">
                        {searchQuery
                          ? intl.formatMessage({
                              id: ETranslations.perp_token_selector_empty,
                            })
                          : intl.formatMessage({
                              id: ETranslations.perp_token_selector_loading,
                            })}
                      </SizableText>
                    </XStack>
                  }
                  contentContainerStyle={{
                    paddingBottom: 10,
                  }}
                />
              )}
            </YStack>
          </YStack>
        </Tabs.ScrollView>
      );
    },
    [handleSelectToken, intl, keyExtractor, searchQuery],
  );

  const content = (
    <YStack>
      <YStack gap="$1">
        <XStack px="$2" pt="$2">
          <SearchBar
            containerProps={{
              borderRadius: '$2',
              mx: '$2',
              mt: '$2',
              flex: 1,
            }}
            autoFocus
            placeholder={intl.formatMessage({
              id: ETranslations.global_search_asset,
            })}
            onChangeText={setSearchQuery}
            // value={searchQuery} // keep value undefined to make debounce works
          />
        </XStack>
        <Tabs.Container
          initialTabName={(() => {
            if (activeTab === 'favorites') return tabNames.favorites;
            // Check if activeTab is a dynamic tab
            const dynamicTab = visibleDynamicTabs.find(
              (t: IPerpDynamicTab) => t.tabId === activeTab,
            );
            if (dynamicTab) return dynamicTab.name;
            return tabNames.all;
          })()}
          onTabChange={({ tabName }) => {
            if (tabName === tabNames.favorites) {
              setActiveTab('favorites');
              return;
            }
            if (tabName === tabNames.all) {
              setActiveTab('all');
              return;
            }
            // Check if it's a dynamic tab
            const dynamicTab = visibleDynamicTabs.find(
              (t: IPerpDynamicTab) => t.name === tabName,
            );
            if (dynamicTab) {
              setActiveTab(dynamicTab.tabId);
              return;
            }
            setActiveTab('all');
          }}
          renderTabBar={(tabBarProps) => (
            <Tabs.TabBar
              {...tabBarProps}
              renderItem={({ name, isFocused, onPress }) => (
                <TabItem name={name} isFocused={isFocused} onPress={onPress} />
              )}
              containerStyle={{
                borderRadius: 0,
                backgroundColor: '$bg',
                paddingHorizontal: 0,
                cursor: 'default',
              }}
            />
          )}
        >
          <Tabs.Tab name={tabNames.favorites}>
            {renderTokenList(listDataByTab.favorites, listRefFavorites, true)}
          </Tabs.Tab>
          <Tabs.Tab name={tabNames.all}>
            {renderTokenList(listDataByTab.all, listRefAll, false)}
          </Tabs.Tab>
          {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            visibleDynamicTabs.map((tab: IPerpDynamicTab) => (
              <Tabs.Tab key={tab.tabId} name={tab.name}>
                {renderTokenList(
                  listDataByTab.dynamic[tab.tabId] ?? [],
                  getDynamicListRef(tab.tabId),
                  false,
                )}
              </Tabs.Tab>
            )) as any
          }
        </Tabs.Container>
      </YStack>
    </YStack>
  );
  return (
    <DebugRenderTracker position="top-right" name="PerpTokenSelectorContent">
      {content}
    </DebugRenderTracker>
  );
}

function PerpTokenSelectorContent({
  isOpen,
  onLoadingChange,
}: {
  isOpen: boolean;
  onLoadingChange: (isLoading: boolean) => void;
}) {
  return isOpen ? (
    <BasePerpTokenSelectorContent onLoadingChange={onLoadingChange} />
  ) : null;
}

const PerpTokenSelectorContentMemo = memo(PerpTokenSelectorContent);

function BasePerpTokenSelector() {
  const intl = useIntl();
  const [isOpen, setIsOpen] = useState(false);
  const [currentToken] = usePerpsActiveAssetAtom();
  const { coin } = currentToken;
  const parsedActive = useMemo(() => parseDexCoin(coin), [coin]);
  const [isLoading, setIsLoading] = useState(false);
  const [builderFeeRate, setBuilderFeeRate] = useState<number | undefined>();

  useEffect(() => {
    void backgroundApiProxy.simpleDb.perp
      .getExpectMaxBuilderFee()
      .then((fee) => {
        setBuilderFeeRate(fee);
      });
  }, []);
  const content = useMemo(
    () => (
      <Popover
        title="Select Token"
        floatingPanelProps={{
          width: 800,
        }}
        open={isOpen}
        onOpenChange={setIsOpen}
        placement="bottom-start"
        renderTrigger={
          <Badge
            gap="$3"
            bg="$bgApp"
            px="$2"
            py="$1.5"
            borderRadius="$full"
            cursor="default"
            hoverStyle={{
              bg: '$bgHover',
            }}
            pressStyle={{
              bg: '$bgActive',
            }}
          >
            <Token
              size="md"
              borderRadius="$full"
              tokenImageUri={getHyperliquidTokenImageUrl(
                parsedActive.displayName,
              )}
              fallbackIcon="CryptoCoinOutline"
            />

            {/* Token Name */}
            <SizableText size="$heading2xl">
              {parsedActive.displayName}USDC
            </SizableText>
            {builderFeeRate === 0 ? (
              <Tooltip
                placement="bottom"
                renderTrigger={
                  <Badge badgeType="success" badgeSize="sm">
                    {intl.formatMessage({
                      id: ETranslations.perp_0_fee,
                    })}
                  </Badge>
                }
                renderContent={
                  <SizableText size="$bodySm">
                    {intl.formatMessage({
                      id: ETranslations.perps_fee_desc,
                    })}
                  </SizableText>
                }
              />
            ) : null}
            <Icon name="ChevronBottomOutline" size="$4" />
            {isLoading ? <Spinner size="small" /> : null}
          </Badge>
        }
        renderContent={({ isOpen: isOpenProp }) => (
          <PerpTokenSelectorContentMemo
            isOpen={isOpenProp ?? false}
            onLoadingChange={setIsLoading}
          />
        )}
      />
    ),
    [isOpen, isLoading, parsedActive.displayName, builderFeeRate, intl],
  );
  return (
    <DebugRenderTracker name="PerpTokenSelector">{content}</DebugRenderTracker>
  );
}

export const PerpTokenSelector = memo(BasePerpTokenSelector);

const BasePerpTokenSelectorMobileView = memo(
  ({
    onPressTokenSelector,
    coin,
    change24hPercent,
  }: {
    onPressTokenSelector: () => void;
    coin: string;
    change24hPercent: number;
  }) => {
    const parsedCoin = useMemo(() => parseDexCoin(coin), [coin]);
    const displayCoin = parsedCoin.displayName || coin;

    return (
      <DebugRenderTracker name="BasePerpTokenSelectorMobileView">
        <XStack
          gap="$1"
          bg="$bgApp"
          justifyContent="center"
          alignItems="center"
          onPress={onPressTokenSelector}
        >
          <SizableText size="$headingLg">{displayCoin}USDC</SizableText>
          <NumberSizeableText
            style={{ fontSize: 10 }}
            fontFamily="$monoRegular"
            fontVariant={['tabular-nums']}
            alignSelf="center"
            color={change24hPercent >= 0 ? '$green11' : '$red11'}
            formatter="priceChange"
            formatterOptions={{
              showPlusMinusSigns: true,
            }}
          >
            {change24hPercent}
          </NumberSizeableText>
          <Icon name="ChevronTriangleDownSmallSolid" size="$5" />
        </XStack>
      </DebugRenderTracker>
    );
  },
);
BasePerpTokenSelectorMobileView.displayName = 'BasePerpTokenSelectorMobileView';
function BasePerpTokenSelectorMobile() {
  const navigation = useAppNavigation();

  const [asset] = usePerpsActiveAssetAtom();
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const coin = asset?.coin || '';
  const change24hPercent = assetCtx?.ctx?.change24hPercent || 0;
  const onPressTokenSelector = useCallback(() => {
    navigation.pushModal(EModalRoutes.PerpModal, {
      screen: EModalPerpRoutes.MobileTokenSelector,
    });
  }, [navigation]);

  return (
    <BasePerpTokenSelectorMobileView
      onPressTokenSelector={onPressTokenSelector}
      coin={coin}
      change24hPercent={change24hPercent}
    />
  );
}

export const PerpTokenSelectorMobile = memo(BasePerpTokenSelectorMobile);
