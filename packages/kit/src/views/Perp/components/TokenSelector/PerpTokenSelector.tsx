import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  DebugRenderTracker,
  type IListViewRef,
  Icon,
  ListView,
  Popover,
  SearchBar,
  SizableText,
  Spinner,
  Tabs,
  XStack,
  YStack,
  usePopoverContext,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAllAssetCtxsAtom,
  usePerpsAllAssetsFilteredAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  usePerpTokenSelectorConfigPersistAtom,
  usePerpsActiveAssetAtom,
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

import { usePerpTokenSelector } from '../../hooks';

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
      cursor="pointer"
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

  const tabNames = useMemo(
    () => ({
      all: 'PERPS',
      hip3: 'HIP3',
    }),
    [],
  );
  const activeTab = selectorConfig?.activeTab ?? DEFAULT_PERP_TOKEN_ACTIVE_TAB;
  const setActiveTab = useCallback(
    (tab: 'all' | 'hip3') => {
      setSelectorConfig((prev) => ({
        field: prev?.field ?? DEFAULT_PERP_TOKEN_SORT_FIELD,
        direction: prev?.direction ?? DEFAULT_PERP_TOKEN_SORT_DIRECTION,
        activeTab: tab,
      }));
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

  const listRefAll = useRef<IListViewRef<ITokenSelectorListItem> | null>(null);
  const listRefHip3 = useRef<IListViewRef<ITokenSelectorListItem> | null>(null);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const lastSortRef = useRef<{ field?: string; direction?: string } | null>(
    null,
  );

  useEffect(() => {
    const field = selectorConfig?.field;
    const direction = selectorConfig?.direction;
    const last = lastSortRef.current;
    if (last?.field === field && last?.direction === direction) {
      return;
    }
    lastSortRef.current = { field, direction };

    const ref =
      activeTabRef.current === 'hip3'
        ? listRefHip3.current
        : listRefAll.current;
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

  const buildListData = useCallback(
    ({
      assets,
      assetCtxs,
      dexIndex,
    }: {
      assets: IPerpsUniverse[];
      assetCtxs: IPerpsAssetCtx[];
      dexIndex: number;
    }) => {
      const sortField = selectorConfig?.field ?? '';
      if (!assets?.length) {
        return [];
      }

      if (!sortField) {
        return assets.map((_, index) => ({
          index,
          dexIndex,
          sortHelper: 0,
        }));
      }

      const entries = assets.map((asset, index) => {
        // Normalize assetId to array index: HIP3 assets have offset, Perps don't
        const normalizedAssetId =
          dexIndex === 1 ? asset.assetId - XYZ_ASSET_ID_OFFSET : asset.assetId;
        const sortValues = computeSortValues(assetCtxs?.[normalizedAssetId]);
        return {
          index,
          dexIndex,
          asset,
          sortValues,
        };
      });

      entries.sort((a, b) =>
        sortCompare(
          { asset: a.asset, sortValues: a.sortValues },
          { asset: b.asset, sortValues: b.sortValues },
        ),
      );

      return entries.map((entry) => ({
        index: entry.index,
        dexIndex: entry.dexIndex,
      }));
    },
    [computeSortValues, sortCompare, selectorConfig?.field],
  );

  const listDataByTab = useMemo(() => {
    const assetsByDexTyped: IPerpsUniverse[][] = assetsByDex || [];
    const assetCtxsByDexTyped: IPerpsAssetCtx[][] = assetCtxsByDex || [];

    // const perpsAssets: IPerpsUniverse[] = assetsByDexTyped[0] || [];
    const hip3Assets: IPerpsUniverse[] = assetsByDexTyped[1] || [];
    // const perpsCtxs: IPerpsAssetCtx[] = assetCtxsByDexTyped[0] || [];
    const hip3Ctxs: IPerpsAssetCtx[] = assetCtxsByDexTyped[1] || [];

    const listHip3 = buildListData({
      assets: hip3Assets,
      assetCtxs: hip3Ctxs,
      dexIndex: 1,
    });

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
      const sorted = [...combinedEntries].sort((a, b) =>
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

    return {
      all: listAll,
      hip3: listHip3,
    };
  }, [
    assetCtxsByDex,
    assetsByDex,
    buildListData,
    computeSortValues,
    sortCompare,
    selectorConfig?.field,
  ]);

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
    ) => (
      <Tabs.ScrollView>
        <YStack>
          <TokenListHeader />
          <YStack height={350}>
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
          </YStack>
        </YStack>
      </Tabs.ScrollView>
    ),
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
          initialTabName={activeTab === 'hip3' ? tabNames.hip3 : tabNames.all}
          onTabChange={({ tabName }) => {
            if (tabName === tabNames.hip3) {
              setActiveTab('hip3');
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
          <Tabs.Tab name={tabNames.all}>
            {activeTab === 'all'
              ? renderTokenList(listDataByTab.all, listRefAll)
              : null}
          </Tabs.Tab>
          <Tabs.Tab name={tabNames.hip3}>
            {activeTab === 'hip3'
              ? renderTokenList(listDataByTab.hip3, listRefHip3)
              : null}
          </Tabs.Tab>
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
  const [isOpen, setIsOpen] = useState(false);
  const [currentToken] = usePerpsActiveAssetAtom();
  const { coin } = currentToken;
  const parsedActive = useMemo(() => parseDexCoin(coin), [coin]);
  const [isLoading, setIsLoading] = useState(false);
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
          <Badge gap="$3" bg="$bgApp" cursor="pointer" p="$2">
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
    [isOpen, isLoading, parsedActive.displayName],
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
  }: {
    onPressTokenSelector: () => void;
    coin: string;
  }) => {
    const intl = useIntl();
    const parsedCoin = useMemo(() => parseDexCoin(coin), [coin]);
    const displayCoin = parsedCoin.displayName || coin;

    return (
      <DebugRenderTracker name="BasePerpTokenSelectorMobileView">
        <XStack
          gap="$1"
          bg="$bgApp"
          onPress={onPressTokenSelector}
          justifyContent="center"
          alignItems="center"
        >
          <SizableText size="$headingXl">{displayCoin}USDC</SizableText>
          <Badge radius="$1" bg="$bgSubdued" px="$1" py={0}>
            <SizableText color="$textSubdued" fontSize={11}>
              {intl.formatMessage({
                id: ETranslations.perp_label_perp,
              })}
            </SizableText>
          </Badge>
          <Icon name="ChevronTriangleDownSmallOutline" size="$5" />
        </XStack>
      </DebugRenderTracker>
    );
  },
);
BasePerpTokenSelectorMobileView.displayName = 'BasePerpTokenSelectorMobileView';
function BasePerpTokenSelectorMobile() {
  const navigation = useAppNavigation();

  const [asset] = usePerpsActiveAssetAtom();
  const coin = asset?.coin || '';
  const onPressTokenSelector = useCallback(() => {
    navigation.pushModal(EModalRoutes.PerpModal, {
      screen: EModalPerpRoutes.MobileTokenSelector,
    });
  }, [navigation]);

  return (
    <BasePerpTokenSelectorMobileView
      onPressTokenSelector={onPressTokenSelector}
      coin={coin}
    />
  );
}

export const PerpTokenSelectorMobile = memo(BasePerpTokenSelectorMobile);
