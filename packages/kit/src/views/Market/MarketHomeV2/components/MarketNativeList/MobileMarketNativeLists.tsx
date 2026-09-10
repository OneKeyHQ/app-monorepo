import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { NativeList } from '@onekeyfe/react-native-native-list';
import { useIntl } from 'react-intl';
import { Dimensions, PixelRatio, ScrollView, StyleSheet } from 'react-native';

import {
  Haptics,
  Icon,
  Image,
  ImpactFeedbackStyle,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { LazyPopover } from '@onekeyhq/components/src/actions/LazyPopover';
import { Portal } from '@onekeyhq/components/src/hocs';
import type { IPortalManager } from '@onekeyhq/components/src/hocs/Portal';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import {
  useMarketWatchListV2Atom,
  useWatchListV2Actions,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { StockIsOpenBadge } from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import { prewarmMarketTokenImages } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailImagePreload';
import { preloadMarketDetailV2Page } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPagePreload';
import { resolveMarketStockId } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveIsStockToken';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IMarketAssetListItem,
  IMarketWatchListItemV2,
} from '@onekeyhq/shared/types/market';
import type { IMarketStockInfo } from '@onekeyhq/shared/types/marketV2';

import { usePerpsNavigation } from '../../../hooks/usePerpsNavigation';
import { MarketTestIDs } from '../../../testIDs';
import { useMarketPerpsTokenList } from '../MarketPerpsList/hooks/useMarketPerpsTokenList';
import { MarketRecommendList } from '../MarketRecommendList';
import { useMarketStockList } from '../MarketStockList/hooks/useMarketStockList';
import { useToMarketStockDetailPage } from '../MarketStockList/hooks/useToMarketStockDetailPage';
import { InlineActionBar } from '../MarketTokenList/components/InlineActionBar';
import { useMarketTokenList } from '../MarketTokenList/hooks/useMarketTokenList';
import {
  type IMarketWatchlistDataCache,
  useMarketWatchlistTokenList,
} from '../MarketTokenList/hooks/useMarketWatchlistTokenList';
import { useToDetailPage } from '../MarketTokenList/hooks/useToMarketDetailPage';
import { useWatchlistFilteredGroups } from '../MarketTokenList/hooks/useWatchlistFilteredGroups';
import { shouldUseStockMetadataColumnsForTokens } from '../MarketTokenList/utils/tokenListHelpers';
import { useMarketTopCoins } from '../MarketTopCoinsList/hooks/useMarketTopCoins';

import {
  buildMarketNativeRowPatches,
  buildMarketNativeSnapshot,
  buildPerpsMarketRow,
  buildStockMarketRow,
  buildTokenMarketRow,
  buildTopCoinMarketRow,
  marketTokenKey,
} from './marketNativeListRows';

import type { IMarketNativeListPresentation } from './marketNativeListRows';
import type { IMarketTimeRangeValue } from '../../types';
import type {
  IMarketPerpsDataCache,
  IMarketPerpsToken,
} from '../MarketPerpsList/hooks/useMarketPerpsTokenList';
import type { IMarketToken } from '../MarketTokenList/MarketTokenData';
import type { IWatchlistFilterType } from '../MarketTokenList/MarketWatchlistCategorySelector';
import type {
  ActionAnchorInvalidatedEvent,
  MarketRow,
  NativeListActionAnchor,
  NativeListRef,
  NativeListSnapshot,
  RowActionEvent,
} from '@onekeyfe/react-native-native-list';
import type { View } from 'react-native';

const NATIVE_LIST_STYLE = StyleSheet.create({
  fill: { flex: 1 },
});

function useMarketNativeListPresentation(): IMarketNativeListPresentation {
  const intl = useIntl();
  const theme = useTheme();
  const themeVariant = useThemeVariant();
  return useMemo(
    () => ({
      androidPixelRatio: platformEnv.isNativeAndroid
        ? PixelRatio.get()
        : undefined,
      theme: {
        background: theme.bgApp.val,
        rowBackground: theme.bgApp.val,
        rowSelectedBackground: theme.bgActive.val,
        rowPressedBackground: theme.bgActive.val,
        subduedBackground: theme.bgSubdued.val,
        strongBackground: theme.bgStrong.val,
        primaryText: theme.text.val,
        secondaryText: theme.textSubdued.val,
        disabledText: theme.textDisabled.val,
        icon: theme.icon.val,
        iconSubdued: theme.iconSubdued.val,
        separator: theme.borderSubdued.val,
        accent: theme.iconActive.val,
        positive: theme.textSuccess.val,
        negative: theme.textCritical.val,
        criticalBackground: theme.bgCritical.val,
        inverseBackground: theme.bgInverse.val,
        inverseText: theme.textInverse.val,
        info: theme.textInfo.val,
        caution: theme.textCaution.val,
      },
      communityRecognizedAccessibilityLabel: intl.formatMessage({
        id: ETranslations.dexmarket_communityRecognized,
      }),
      leverageAccessibilityLabel: intl.formatMessage({
        id: ETranslations.perp_leverage,
      }),
      providerAccessibilityLabel: intl.formatMessage({
        id: ETranslations.swap_history_detail_provider,
      }),
      positiveBackground: theme.bgSuccessStrong.val,
      negativeBackground: theme.bgCriticalStrong.val,
      neutralBackground: theme.neutral9.val,
      infoBackground: theme.bgInfo.val,
      infoText: theme.textInfo.val,
      tokenBackground:
        themeVariant === 'dark' ? theme.neutral6.val : theme.bgApp.val,
      tokenBorderColor:
        themeVariant === 'dark' ? theme.neutral2.val : undefined,
    }),
    [intl, theme, themeVariant],
  );
}

function useSnapshotGeneration(identity: string) {
  const identityRef = useRef(identity);
  const generationRef = useRef(1);
  if (identityRef.current !== identity) {
    identityRef.current = identity;
    generationRef.current += 1;
  }
  return generationRef.current;
}

function usePatchedMarketSnapshot({
  snapshot,
  listRef,
}: {
  snapshot: NativeListSnapshot;
  listRef: RefObject<NativeListRef | null>;
}) {
  const [nativeSnapshot, setNativeSnapshot] = useState(snapshot);
  const appliedSnapshotRef = useRef<
    { base: NativeListSnapshot; latest: NativeListSnapshot } | undefined
  >(undefined);
  const previousSnapshot =
    appliedSnapshotRef.current?.base === nativeSnapshot
      ? appliedSnapshotRef.current.latest
      : nativeSnapshot;
  const rowPatches = useMemo(
    () => buildMarketNativeRowPatches(previousSnapshot, snapshot),
    [previousSnapshot, snapshot],
  );
  if (rowPatches === undefined && nativeSnapshot !== snapshot) {
    setNativeSnapshot(snapshot);
  }
  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      appliedSnapshotRef.current = undefined;
      return;
    }
    if (rowPatches?.length) {
      list.applyPatches(rowPatches);
    }
    appliedSnapshotRef.current = { base: nativeSnapshot, latest: snapshot };
  }, [listRef, nativeSnapshot, rowPatches, snapshot]);
  return nativeSnapshot;
}

type INativeMarketListProps = {
  listRef: RefObject<NativeListRef | null>;
  rows: readonly MarketRow[];
  loading: boolean;
  loadingMore?: boolean;
  loadMoreError?: boolean;
  errorMessage?: string;
  canLoadMore?: boolean;
  showEnd?: boolean;
  contentPaddingBottom: number;
  emptyContentHeight?: number;
  emptyContentTopSpacing?: number;
  testID?: string;
  onRowAction: (event: RowActionEvent) => void;
  onActionAnchorInvalidated?: (event: ActionAnchorInvalidatedEvent) => void;
  onEndReached?: () => void;
  onRefresh?: () => Promise<unknown> | void;
};

function NativeMarketList({
  listRef,
  rows,
  loading,
  loadingMore,
  loadMoreError,
  errorMessage,
  canLoadMore,
  showEnd,
  contentPaddingBottom,
  emptyContentHeight,
  emptyContentTopSpacing,
  testID,
  onRowAction,
  onActionAnchorInvalidated,
  onEndReached,
  onRefresh,
}: INativeMarketListProps) {
  const intl = useIntl();
  const presentation = useMarketNativeListPresentation();
  const refreshingRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(
    () => () => {
      refreshingRef.current = false;
    },
    [],
  );
  const handleRefresh = useCallback(async () => {
    if (!onRefresh || refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      if (platformEnv.isNativeIOS && refreshingRef.current) {
        // A batched true/false render can leave UIKit's gesture-started spinner active.
        listRef.current?.setRefreshing(false);
      }
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [listRef, onRefresh]);
  const structuralIdentity = `${rows.map((row) => row.key).join('|')}:${
    loading && rows.length === 0
  }:${Boolean(errorMessage && rows.length === 0)}:${Boolean(
    loadingMore,
  )}:${Boolean(loadMoreError)}:${Boolean(canLoadMore)}:${Boolean(showEnd)}:${
    rows.length === 0 ? (emptyContentHeight ?? 0) : 0
  }`;
  const generation = useSnapshotGeneration(structuralIdentity);
  const snapshot = useMemo(
    () =>
      buildMarketNativeSnapshot({
        rows,
        generation,
        presentation,
        loading,
        refreshing,
        loadingMore,
        loadMoreError,
        errorMessage,
        noDataMessage: intl.formatMessage({
          id: ETranslations.global_no_data,
        }),
        retryMessage: intl.formatMessage({ id: ETranslations.global_retry }),
        canLoadMore,
        canRefresh: Boolean(onRefresh),
        showEnd,
        contentPaddingBottom,
        emptyContentHeight,
        emptyContentTopSpacing,
      }),
    [
      canLoadMore,
      contentPaddingBottom,
      emptyContentHeight,
      emptyContentTopSpacing,
      errorMessage,
      generation,
      intl,
      loadMoreError,
      loading,
      loadingMore,
      onRefresh,
      presentation,
      refreshing,
      rows,
      showEnd,
    ],
  );
  const nativeSnapshot = usePatchedMarketSnapshot({ snapshot, listRef });
  return (
    <NativeList
      ref={listRef}
      style={NATIVE_LIST_STYLE.fill}
      snapshot={nativeSnapshot}
      testID={testID}
      onRowAction={onRowAction}
      onActionAnchorInvalidated={onActionAnchorInvalidated}
      onEndReached={onEndReached}
      onRefresh={
        onRefresh
          ? () => void handleRefresh().catch(() => undefined)
          : undefined
      }
    />
  );
}

type IMarketBadgeInfo =
  | {
      kind: 'token-tags';
      communityRecognized?: boolean;
      stock?: IMarketStockInfo;
      anchor: NativeListActionAnchor;
      left: number;
      top: number;
    }
  | {
      kind: 'perps-dex';
      dexLabel: string;
      anchor: NativeListActionAnchor;
      left: number;
      top: number;
    };

function getPerpsDexDescriptionId(dexLabel: string) {
  if (dexLabel === 'xyz') return ETranslations.perp_xyz_market__desc;
  if (dexLabel === 'para') return ETranslations.perp_para_market__desc;
  return ETranslations.perp_io_market__desc;
}

function getStockLabelId(stock: IMarketStockInfo | undefined) {
  if (stock?.source === 'ondo') {
    return ETranslations.dexmarket_tokenized_ondo;
  }
  if (stock?.source === 'xstock') {
    return ETranslations.dexmarket_tokenized_xstock;
  }
  return undefined;
}

function NativeMarketBadgeInfo({
  info,
  onClose,
}: {
  info: IMarketBadgeInfo | undefined;
  onClose: () => void;
}) {
  const intl = useIntl();
  if (!info) return null;

  const anchorElement = (
    <Stack
      width={info.anchor.windowRect.width}
      height={info.anchor.windowRect.height}
      pointerEvents="none"
    />
  );

  let popover;
  if (info.kind === 'perps-dex') {
    const descriptionId = getPerpsDexDescriptionId(info.dexLabel);
    popover = (
      <LazyPopover
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={info.dexLabel}
        placement="top"
        renderTrigger={anchorElement}
        renderContent={
          <YStack px="$5" pb="$4" maxWidth={360}>
            <SizableText size="$bodyLg">
              {intl.formatMessage({ id: descriptionId })}
            </SizableText>
          </YStack>
        }
      />
    );
  } else {
    const { communityRecognized, stock } = info;
    const stockLabelId = getStockLabelId(stock);
    popover = (
      <LazyPopover
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={intl.formatMessage({ id: ETranslations.send_tag })}
        placement="bottom"
        renderTrigger={anchorElement}
        renderContent={
          <YStack px="$5" pb="$5" pt="$1" gap="$4">
            {communityRecognized ? (
              <XStack alignItems="center" gap="$3">
                <Icon
                  name="BadgeRecognizedSolid"
                  size="$6"
                  color="$iconSuccess"
                />
                <SizableText size="$bodyLgMedium" flex={1} flexWrap="wrap">
                  {intl.formatMessage({
                    id: ETranslations.dexmarket_communityRecognized,
                  })}
                </SizableText>
              </XStack>
            ) : null}
            {stock?.sourceLogoUri ? (
              <XStack alignItems="center" gap="$3">
                <Stack
                  width="$6"
                  height="$6"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Image
                    width={20}
                    height={20}
                    borderRadius="$full"
                    source={{ uri: stock.sourceLogoUri }}
                  />
                </Stack>
                <SizableText size="$bodyLgMedium" flex={1} flexWrap="wrap">
                  {stockLabelId
                    ? intl.formatMessage({ id: stockLabelId })
                    : stock.title}
                </SizableText>
              </XStack>
            ) : null}
            {stock ? (
              <YStack gap="$2">
                <XStack>
                  <StockIsOpenBadge stock={stock} />
                </XStack>
                {stock.description ? (
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {stock.description}
                  </SizableText>
                ) : null}
              </YStack>
            ) : null}
          </YStack>
        }
      />
    );
  }

  return (
    <Stack
      position="absolute"
      left={info.left}
      top={info.top}
      width={info.anchor.windowRect.width}
      height={info.anchor.windowRect.height}
      pointerEvents="box-none"
    >
      {popover}
    </Stack>
  );
}

function useNativeMarketBadgeInfo(listRef: RefObject<NativeListRef | null>) {
  const containerRef = useRef<View>(null);
  const [info, setInfo] = useState<IMarketBadgeInfo>();

  const close = useCallback(() => {
    setInfo((current) => {
      if (current?.anchor) {
        listRef.current?.setActionAnchorState({
          token: current.anchor.token,
          open: false,
          restoreFocus: true,
        });
      }
      return undefined;
    });
  }, [listRef]);

  const openTokenTags = useCallback(
    (item: IMarketToken, anchor?: NativeListActionAnchor) => {
      if (!anchor) return;
      listRef.current?.setActionAnchorState({
        token: anchor.token,
        open: true,
      });
      containerRef.current?.measureInWindow((x, y) => {
        setInfo({
          kind: 'token-tags',
          communityRecognized: item.communityRecognized,
          stock: item.stock,
          anchor,
          left: anchor.windowRect.x - x,
          top: anchor.windowRect.y - y,
        });
      });
    },
    [listRef],
  );

  const openPerpsDex = useCallback(
    (dexLabel: string | undefined, anchor?: NativeListActionAnchor) => {
      const normalizedDexLabel = dexLabel?.toLowerCase();
      if (
        normalizedDexLabel !== 'xyz' &&
        normalizedDexLabel !== 'para' &&
        normalizedDexLabel !== 'io'
      ) {
        return;
      }
      if (!anchor) return;
      listRef.current?.setActionAnchorState({
        token: anchor.token,
        open: true,
      });
      containerRef.current?.measureInWindow((x, y) => {
        setInfo({
          kind: 'perps-dex',
          dexLabel: normalizedDexLabel,
          anchor,
          left: anchor.windowRect.x - x,
          top: anchor.windowRect.y - y,
        });
      });
    },
    [listRef],
  );

  const onActionAnchorInvalidated = useCallback(
    (event: ActionAnchorInvalidatedEvent) => {
      if (event.token === info?.anchor?.token) close();
    },
    [close, info?.anchor?.token],
  );

  return {
    containerRef,
    info,
    close,
    openTokenTags,
    openPerpsDex,
    onActionAnchorInvalidated,
  };
}

function prewarmTokenDetail(item: IMarketToken) {
  void preloadMarketDetailV2Page({
    includeBodyModules: true,
    includeHeavyModules: true,
    isStockRoute: Boolean(resolveMarketStockId(item)),
    layout: 'mobile',
  });
  prewarmMarketTokenImages(item);
}

type ISharedListProps = {
  listContainerProps: {
    emptyContentPaddingTop?: number;
    emptyContentHeight?: number;
    paddingBottom: number;
  };
  shouldSuppressItemPress?: () => boolean;
};

export type IMobileMarketNativeTokenListProps = ISharedListProps & {
  networkId: string;
  selectedCategory?: string;
  stockCategory?: string;
  timeRange?: IMarketTimeRangeValue;
  onStockDataChange?: (categoryId: string, isStockData: boolean) => void;
};

function MobileMarketNativeTokenListImpl({
  networkId,
  selectedCategory,
  stockCategory,
  timeRange,
  onStockDataChange,
  listContainerProps,
  shouldSuppressItemPress,
}: IMobileMarketNativeTokenListProps) {
  const intl = useIntl();
  const listRef = useRef<NativeListRef>(null);
  const presentation = useMarketNativeListPresentation();
  const toMarketDetailPage = useToDetailPage({
    marketTokenCategory: selectedCategory,
  });
  const result = useMarketTokenList({
    networkId,
    initialSortBy: 'v24hUSD',
    initialSortType: 'desc',
    pageSize: 20,
    type: selectedCategory,
    category: stockCategory,
    timeRange,
  });
  const isStockData = useMemo(
    () => shouldUseStockMetadataColumnsForTokens(result.data),
    [result.data],
  );
  useEffect(() => {
    if (selectedCategory) {
      onStockDataChange?.(selectedCategory, isStockData);
    }
  }, [isStockData, onStockDataChange, selectedCategory]);
  const rows = useMemo(
    () =>
      result.data.map((item) => buildTokenMarketRow({ item, presentation })),
    [presentation, result.data],
  );
  const itemsByKey = useMemo(
    () => new Map(result.data.map((item) => [marketTokenKey(item), item])),
    [result.data],
  );
  const badgeInfo = useNativeMarketBadgeInfo(listRef);
  const handleRowAction = useCallback(
    (event: RowActionEvent) => {
      if (event.actionKey === 'retry') {
        void result.refetch().catch(() => undefined);
        return;
      }
      const item = event.rowKey ? itemsByKey.get(event.rowKey) : undefined;
      if (!item) return;
      if (event.actionKey === 'prewarm-detail') {
        prewarmTokenDetail(item);
      } else if (event.actionKey === 'token-tags') {
        badgeInfo.openTokenTags(item, event.anchor);
      } else if (
        event.actionKey === 'open-detail' &&
        !shouldSuppressItemPress?.()
      ) {
        void toMarketDetailPage({
          ...item,
          tokenAddress: item.address,
          networkId: item.networkId,
          symbol: item.symbol,
          isNative: item.isNative,
        });
      }
    },
    [
      badgeInfo,
      itemsByKey,
      result,
      shouldSuppressItemPress,
      toMarketDetailPage,
    ],
  );
  const showSkeleton =
    (Boolean(result.isLoading) && result.data.length === 0) ||
    Boolean(result.isNetworkSwitching);
  return (
    <Stack ref={badgeInfo.containerRef} flex={1}>
      <NativeMarketList
        listRef={listRef}
        rows={rows}
        loading={showSkeleton}
        errorMessage={
          result.isError
            ? intl.formatMessage({ id: ETranslations.global_an_error_occurred })
            : undefined
        }
        loadingMore={result.isLoadingMore}
        canLoadMore={result.canLoadMore}
        contentPaddingBottom={listContainerProps.paddingBottom}
        emptyContentHeight={listContainerProps.emptyContentHeight}
        onRowAction={handleRowAction}
        onActionAnchorInvalidated={badgeInfo.onActionAnchorInvalidated}
        onEndReached={() => {
          if (
            result.canLoadMore &&
            !result.isLoadingMore &&
            !result.isProvisionalFirstPageResult
          ) {
            void result.loadMore();
          }
        }}
        onRefresh={() => result.refetch()}
      />
      <NativeMarketBadgeInfo info={badgeInfo.info} onClose={badgeInfo.close} />
    </Stack>
  );
}

export const MobileMarketNativeTokenList = memo(
  MobileMarketNativeTokenListImpl,
);

export type IMobileMarketNativeWatchlistProps = ISharedListProps & {
  selectedFilter?: IWatchlistFilterType;
  dataCacheRef?: RefObject<IMarketWatchlistDataCache | undefined>;
};

function MobileMarketNativeWatchlistImpl({
  selectedFilter = 'all',
  dataCacheRef,
  listContainerProps,
  shouldSuppressItemPress,
}: IMobileMarketNativeWatchlistProps) {
  const intl = useIntl();
  const listRef = useRef<NativeListRef>(null);
  const presentation = useMarketNativeListPresentation();
  const toMarketDetailPage = useToDetailPage();
  const { navigateToPerps } = usePerpsNavigation();
  const [watchlistState] = useMarketWatchListV2Atom();
  const { recommendedTokens } = useMarketBasicConfig();
  const actions = useWatchListV2Actions();
  const portalRef = useRef<IPortalManager | null>(null);
  const menuAnchorRef = useRef<NativeListActionAnchor | undefined>(undefined);

  useEffect(() => {
    const refresh = async () => {
      await actions.current.refreshWatchListV2();
    };
    appEventBus.on(EAppEventBusNames.RefreshMarketWatchList, refresh);
    appEventBus.on(EAppEventBusNames.MarketWatchListV2Changed, refresh);
    return () => {
      appEventBus.off(EAppEventBusNames.RefreshMarketWatchList, refresh);
      appEventBus.off(EAppEventBusNames.MarketWatchListV2Changed, refresh);
    };
  }, [actions]);

  useEffect(() => {
    void backgroundApiProxy.serviceMarketV2.reconcilePerpsFavorites();
  }, []);

  const watchlist = useMemo(
    () => watchlistState.data || [],
    [watchlistState.data],
  );
  const result = useMarketWatchlistTokenList({
    watchlist,
    pageSize: 999,
    dataCacheRef,
  });
  const filteredGroups = useWatchlistFilteredGroups(result.data);
  const filteredData = filteredGroups[selectedFilter];
  const rows = useMemo(
    () =>
      filteredData.map((item) =>
        buildTokenMarketRow({ item, presentation, watchlist: true }),
      ),
    [filteredData, presentation],
  );
  const itemsByKey = useMemo(
    () => new Map(filteredData.map((item) => [marketTokenKey(item), item])),
    [filteredData],
  );
  const badgeInfo = useNativeMarketBadgeInfo(listRef);

  const tokenToWatchListItem = useCallback(
    (token: IMarketToken): IMarketWatchListItemV2 => ({
      chainId: token.networkId,
      contractAddress: token.address,
      sortIndex: token.sortIndex,
      isNative: token.isNative,
      perpsCoin: token.perpsCoin,
    }),
    [],
  );

  const closeMenu = useCallback((restoreFocus = true) => {
    const anchor = menuAnchorRef.current;
    if (anchor) {
      listRef.current?.setActionAnchorState({
        token: anchor.token,
        open: false,
        restoreFocus,
      });
    }
    menuAnchorRef.current = undefined;
    portalRef.current?.destroy();
    portalRef.current = null;
  }, []);

  const showContextMenu = useCallback(
    (item: IMarketToken, index: number, anchor?: NativeListActionAnchor) => {
      closeMenu(false);
      menuAnchorRef.current = anchor;
      if (anchor) {
        listRef.current?.setActionAnchorState({
          token: anchor.token,
          open: true,
        });
      }
      Haptics.impact(ImpactFeedbackStyle.Medium);
      portalRef.current = Portal.Render(
        Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL,
        <InlineActionBar
          isFirstItem={index === 0}
          anchor={
            anchor
              ? {
                  x: Dimensions.get('window').width * 0.48,
                  y:
                    (anchor.windowPoint?.y ??
                      anchor.windowRect.y + anchor.windowRect.height / 2) - 4,
                }
              : undefined
          }
          onMoveToTop={async () => {
            closeMenu();
            try {
              await actions.current.moveToTopV2(tokenToWatchListItem(item));
              Toast.success({
                title: intl.formatMessage({
                  id: ETranslations.market_move_to_top,
                }),
              });
            } catch {
              // Errors are handled by the watchlist service.
            }
          }}
          onToggleWatchlist={async () => {
            closeMenu();
            try {
              if (item.perpsCoin) {
                await actions.current.removePerpsFromWatchListV2(
                  item.perpsCoin,
                );
              } else {
                await actions.current.removeFromWatchListV2(
                  item.networkId,
                  item.address,
                );
              }
              Toast.success({
                title: intl.formatMessage({
                  id: ETranslations.market_remove_from_watchlist,
                }),
              });
            } catch {
              // Errors are handled by the watchlist service.
            }
          }}
          onDismiss={() => closeMenu()}
        />,
      );
    },
    [actions, closeMenu, intl, tokenToWatchListItem],
  );

  useEffect(() => () => closeMenu(false), [closeMenu]);

  const handleRowAction = useCallback(
    (event: RowActionEvent) => {
      if (event.actionKey === 'retry') {
        void result.refetch();
        return;
      }
      const item = event.rowKey ? itemsByKey.get(event.rowKey) : undefined;
      if (!item) return;
      if (event.actionKey === 'prewarm-detail') {
        prewarmTokenDetail(item);
      } else if (event.actionKey === 'token-tags') {
        badgeInfo.openTokenTags(item, event.anchor);
      } else if (event.actionKey === 'perps-dex-info') {
        badgeInfo.openPerpsDex(
          item.perpsCoin ? parseDexCoin(item.perpsCoin).dexLabel : undefined,
          event.anchor,
        );
      } else if (event.actionKey === 'watchlist-menu') {
        showContextMenu(item, filteredData.indexOf(item), event.anchor);
      } else if (
        event.actionKey === 'open-detail' &&
        !shouldSuppressItemPress?.()
      ) {
        if (item.perpsCoin) {
          navigateToPerps(item.perpsCoin);
        } else {
          void toMarketDetailPage({
            ...item,
            tokenAddress: item.address,
            networkId: item.networkId,
            symbol: item.symbol,
            isNative: item.isNative,
          });
        }
      }
    },
    [
      badgeInfo,
      filteredData,
      itemsByKey,
      navigateToPerps,
      result,
      shouldSuppressItemPress,
      showContextMenu,
      toMarketDetailPage,
    ],
  );

  const onActionAnchorInvalidated = useCallback(
    (event: ActionAnchorInvalidatedEvent) => {
      if (event.token === menuAnchorRef.current?.token) closeMenu(false);
      badgeInfo.onActionAnchorInvalidated(event);
    },
    [badgeInfo, closeMenu],
  );

  const showSkeleton = Boolean(result.isLoading) && result.data.length === 0;
  if (!watchlistState.isMounted) {
    return <ScrollView style={NATIVE_LIST_STYLE.fill} />;
  }
  if (watchlist.length === 0 && !showSkeleton) {
    return (
      <ScrollView
        style={NATIVE_LIST_STYLE.fill}
        nestedScrollEnabled
        contentInsetAdjustmentBehavior="never"
        testID="market-favorites-empty-scroll"
        contentContainerStyle={{
          paddingTop: listContainerProps.emptyContentPaddingTop ?? 16,
        }}
      >
        <Stack alignItems="center">
          <MarketRecommendList
            maxSize={8}
            recommendedTokens={recommendedTokens}
          />
        </Stack>
      </ScrollView>
    );
  }

  return (
    <Stack ref={badgeInfo.containerRef} flex={1}>
      <NativeMarketList
        listRef={listRef}
        rows={rows}
        loading={showSkeleton}
        errorMessage={
          result.isError
            ? intl.formatMessage({ id: ETranslations.global_an_error_occurred })
            : undefined
        }
        showEnd={false}
        contentPaddingBottom={listContainerProps.paddingBottom}
        emptyContentTopSpacing={40}
        testID={MarketTestIDs.watchList}
        onRowAction={handleRowAction}
        onActionAnchorInvalidated={onActionAnchorInvalidated}
        onRefresh={async () => {
          await actions.current.refreshWatchListV2();
          await result.refetch();
        }}
      />
      <NativeMarketBadgeInfo info={badgeInfo.info} onClose={badgeInfo.close} />
    </Stack>
  );
}

export const MobileMarketNativeWatchlist = memo(
  MobileMarketNativeWatchlistImpl,
);

export type IMobileMarketNativeStockListProps = ISharedListProps & {
  selectedCategoryId: string;
};

function MobileMarketNativeStockListImpl({
  selectedCategoryId,
  listContainerProps,
  shouldSuppressItemPress,
}: IMobileMarketNativeStockListProps) {
  const intl = useIntl();
  const listRef = useRef<NativeListRef>(null);
  const presentation = useMarketNativeListPresentation();
  const toMarketStockDetailPage = useToMarketStockDetailPage();
  const result = useMarketStockList({
    category: selectedCategoryId === 'all' ? undefined : selectedCategoryId,
  });
  const rows = useMemo(
    () =>
      result.items.map((item) => buildStockMarketRow({ item, presentation })),
    [presentation, result.items],
  );
  const itemsByKey = useMemo(
    () => new Map(result.items.map((item) => [item.stockId, item])),
    [result.items],
  );
  const handleRowAction = useCallback(
    (event: RowActionEvent) => {
      if (event.actionKey === 'retry') {
        void result.refresh();
        return;
      }
      if (event.actionKey === 'load-more-retry') {
        void result.loadMore();
        return;
      }
      const item = event.rowKey ? itemsByKey.get(event.rowKey) : undefined;
      if (!item) return;
      if (event.actionKey === 'prewarm-stock-detail') {
        void preloadMarketDetailV2Page({
          includeBodyModules: true,
          includeHeavyModules: true,
          isStockRoute: true,
          layout: 'mobile',
        });
      } else if (
        event.actionKey === 'open-detail' &&
        !shouldSuppressItemPress?.()
      ) {
        void toMarketStockDetailPage(item);
      }
    },
    [itemsByKey, result, shouldSuppressItemPress, toMarketStockDetailPage],
  );
  return (
    <NativeMarketList
      listRef={listRef}
      rows={rows}
      loading={result.isLoading}
      loadingMore={result.isLoadingMore}
      loadMoreError={result.isLoadMoreError}
      errorMessage={
        result.isError
          ? intl.formatMessage({ id: ETranslations.global_no_data })
          : undefined
      }
      canLoadMore={result.canLoadMore}
      contentPaddingBottom={listContainerProps.paddingBottom}
      emptyContentHeight={listContainerProps.emptyContentHeight}
      testID={MarketTestIDs.stockList}
      onRowAction={handleRowAction}
      onEndReached={() => {
        if (
          result.canLoadMore &&
          !result.isLoadingMore &&
          !result.isLoadMoreError
        ) {
          void result.loadMore();
        }
      }}
      onRefresh={() => result.refresh()}
    />
  );
}

export const MobileMarketNativeStockList = memo(
  MobileMarketNativeStockListImpl,
);

export type IMobileMarketNativeTopCoinsListProps = ISharedListProps & {
  dataCacheRef: RefObject<IMarketAssetListItem[] | undefined>;
};

function MobileMarketNativeTopCoinsListImpl({
  dataCacheRef,
  listContainerProps,
  shouldSuppressItemPress,
}: IMobileMarketNativeTopCoinsListProps) {
  const intl = useIntl();
  const listRef = useRef<NativeListRef>(null);
  const presentation = useMarketNativeListPresentation();
  const { data, handleItemPress, isLoading, isError, refresh } =
    useMarketTopCoins({ dataCacheRef });
  const rows = useMemo(
    () => data.map((item) => buildTopCoinMarketRow({ item, presentation })),
    [data, presentation],
  );
  const itemsByKey = useMemo(
    () => new Map(data.map((item) => [item.assetId, item])),
    [data],
  );
  const handleRowAction = useCallback(
    (event: RowActionEvent) => {
      if (event.actionKey === 'retry') {
        void refresh();
        return;
      }
      const item = event.rowKey ? itemsByKey.get(event.rowKey) : undefined;
      if (
        item &&
        event.actionKey === 'open-detail' &&
        !shouldSuppressItemPress?.()
      ) {
        void handleItemPress(item);
      }
    },
    [handleItemPress, itemsByKey, refresh, shouldSuppressItemPress],
  );
  return (
    <NativeMarketList
      listRef={listRef}
      rows={rows}
      loading={isLoading !== false && data.length === 0}
      errorMessage={
        isError
          ? intl.formatMessage({ id: ETranslations.global_an_error_occurred })
          : undefined
      }
      showEnd={false}
      contentPaddingBottom={listContainerProps.paddingBottom}
      emptyContentHeight={listContainerProps.emptyContentHeight}
      onRowAction={handleRowAction}
      onRefresh={() => refresh()}
    />
  );
}

export const MobileMarketNativeTopCoinsList = memo(
  MobileMarketNativeTopCoinsListImpl,
);

export type IMobileMarketNativePerpsListProps = ISharedListProps & {
  dataCacheRef: RefObject<IMarketPerpsDataCache | undefined>;
  selectedCategoryId: string;
};

function MobileMarketNativePerpsListImpl({
  dataCacheRef,
  selectedCategoryId,
  listContainerProps,
  shouldSuppressItemPress,
}: IMobileMarketNativePerpsListProps) {
  const intl = useIntl();
  const listRef = useRef<NativeListRef>(null);
  const presentation = useMarketNativeListPresentation();
  const { navigateToPerps } = usePerpsNavigation();
  const { tokens, isLoading, isError, refresh } = useMarketPerpsTokenList({
    dataCacheRef,
    selectedCategoryId,
  });
  const rows = useMemo(
    () => tokens.map((item) => buildPerpsMarketRow({ item, presentation })),
    [presentation, tokens],
  );
  const itemsByKey = useMemo(
    () =>
      new Map<string, IMarketPerpsToken>(
        tokens.map((item) => [item.name, item]),
      ),
    [tokens],
  );
  const badgeInfo = useNativeMarketBadgeInfo(listRef);
  const handleRowAction = useCallback(
    (event: RowActionEvent) => {
      if (event.actionKey === 'retry') {
        void refresh();
        return;
      }
      const item = event.rowKey ? itemsByKey.get(event.rowKey) : undefined;
      if (!item) return;
      if (event.actionKey === 'perps-dex-info') {
        badgeInfo.openPerpsDex(item.dexLabel, event.anchor);
      } else if (
        event.actionKey === 'open-detail' &&
        !shouldSuppressItemPress?.()
      ) {
        navigateToPerps(item.name);
      }
    },
    [badgeInfo, itemsByKey, navigateToPerps, refresh, shouldSuppressItemPress],
  );
  return (
    <Stack ref={badgeInfo.containerRef} flex={1}>
      <NativeMarketList
        listRef={listRef}
        rows={rows}
        loading={Boolean(isLoading) && tokens.length === 0}
        errorMessage={
          isError
            ? intl.formatMessage({ id: ETranslations.global_an_error_occurred })
            : undefined
        }
        contentPaddingBottom={listContainerProps.paddingBottom}
        emptyContentHeight={listContainerProps.emptyContentHeight}
        testID={MarketTestIDs.perpsList}
        onRowAction={handleRowAction}
        onActionAnchorInvalidated={badgeInfo.onActionAnchorInvalidated}
        onRefresh={() => refresh()}
      />
      <NativeMarketBadgeInfo info={badgeInfo.info} onClose={badgeInfo.close} />
    </Stack>
  );
}

export const MobileMarketNativePerpsList = memo(
  MobileMarketNativePerpsListImpl,
);
