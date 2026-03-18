import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, Tabs, Toast } from '@onekeyhq/components';
import { Portal } from '@onekeyhq/components/src/hocs';
import type { IPortalManager } from '@onekeyhq/components/src/hocs/Portal';
import type { IDragEndParamsWithItem } from '@onekeyhq/components/src/layouts/SortableListView/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useMarketWatchListV2Atom,
  useWatchListV2Actions,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import { MarketRecommendList } from '../MarketRecommendList';

import { InlineActionBar } from './components/InlineActionBar';
import { useMarketWatchlistTokenList } from './hooks/useMarketWatchlistTokenList';
import { useWatchlistFilteredGroups } from './hooks/useWatchlistFilteredGroups';
import { type IMarketToken } from './MarketTokenData';
import { MarketTokenListBase } from './MarketTokenListBase';
import {
  type IWatchlistFilterType,
  MarketWatchlistCategorySelector,
} from './MarketWatchlistCategorySelector';

type IMarketWatchlistTokenListProps = {
  onItemPress?: (item: IMarketToken) => void;
  watchlist?: IMarketWatchListItemV2[];
  toolbar?: ReactNode;
  hideNativeToken?: boolean;
  tabIntegrated?: boolean;
  tabName?: string;
  listContainerProps?: {
    paddingBottom: number;
  };
  hidePerps?: boolean;
};

function MarketWatchlistTokenList({
  onItemPress,
  watchlist: externalWatchlist,
  toolbar,
  hideNativeToken,
  tabIntegrated,
  tabName,
  listContainerProps,
  hidePerps,
}: IMarketWatchlistTokenListProps) {
  const intl = useIntl();

  // Get watchlist from atom if not provided externally
  const [watchlistState] = useMarketWatchListV2Atom();
  const { recommendedTokens } = useMarketBasicConfig();

  const actions = useWatchListV2Actions();

  // Watchlist category filter: all / spot / perps
  const [selectedFilter, setSelectedFilter] =
    useState<IWatchlistFilterType>('all');
  const handleSelectFilter = useCallback(
    (filter: IWatchlistFilterType) => setSelectedFilter(filter),
    [],
  );

  // State for mobile inline action bar
  const [activeActionItem, setActiveActionItem] = useState<{
    item: IMarketToken;
    index: number;
  } | null>(null);
  const portalRef = useRef<IPortalManager | null>(null);

  useEffect(() => {
    const fn = async () => {
      await actions.current.refreshWatchListV2();
    };
    appEventBus.on(EAppEventBusNames.RefreshMarketWatchList, fn);
    appEventBus.on(EAppEventBusNames.MarketWatchListV2Changed, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.RefreshMarketWatchList, fn);
      appEventBus.off(EAppEventBusNames.MarketWatchListV2Changed, fn);
    };
  }, [actions]);

  // Reconcile Perps favorites on mount (bidirectional diff sync)
  useEffect(() => {
    void backgroundApiProxy.serviceMarketV2.reconcilePerpsFavorites();
  }, []);

  const internalWatchlist = useMemo(
    () => watchlistState.data || [],
    [watchlistState.data],
  );

  // Use external watchlist if provided, otherwise use internal
  const watchlist = externalWatchlist || internalWatchlist;

  const watchlistResult = useMarketWatchlistTokenList({
    watchlist,
    pageSize: 999,
  });

  const filteredGroups = useWatchlistFilteredGroups(watchlistResult.data, {
    hideNativeToken,
    hidePerps,
  });

  const filteredResult = useMemo(() => {
    const filtered = filteredGroups[selectedFilter];
    if (filtered === watchlistResult.data) return watchlistResult;
    return {
      ...watchlistResult,
      data: filtered,
      // Suppress loading when raw data exists but filter produces empty results,
      // so MarketTokenListBase shows "no data" instead of flashing skeleton.
      isLoading:
        watchlistResult.data.length > 0 ? false : watchlistResult.isLoading,
    };
  }, [watchlistResult, filteredGroups, selectedFilter]);

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

  const handleDragEnd = useCallback(
    (params: IDragEndParamsWithItem<IMarketToken>) => {
      const { dragItem, prevItem, nextItem } = params;
      void actions.current.sortWatchListV2Items({
        target: tokenToWatchListItem(dragItem),
        prev: prevItem ? tokenToWatchListItem(prevItem) : undefined,
        next: nextItem ? tokenToWatchListItem(nextItem) : undefined,
      });
    },
    [actions, tokenToWatchListItem],
  );

  const dismissInlineActionBar = useCallback(() => {
    setActiveActionItem(null);
    if (portalRef.current) {
      portalRef.current.destroy();
      portalRef.current = null;
    }
  }, []);

  const handleShowContextMenu = useCallback(
    (
      item: IMarketToken,
      index: number,
      position?: { x: number; y: number },
    ) => {
      // Mobile native: show inline action bar
      if (platformEnv.isNative) {
        // Dismiss any existing action bar first
        if (portalRef.current) {
          portalRef.current.destroy();
          portalRef.current = null;
        }
        setActiveActionItem({ item, index });
        portalRef.current = Portal.Render(
          Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL,
          <InlineActionBar
            isFirstItem={index === 0}
            onMoveToTop={async () => {
              setActiveActionItem(null);
              portalRef.current?.destroy();
              portalRef.current = null;
              try {
                await actions.current.moveToTopV2(tokenToWatchListItem(item));
                Toast.success({
                  title: intl.formatMessage({
                    id: ETranslations.market_move_to_top,
                  }),
                });
              } catch {
                // error handled internally
              }
            }}
            onToggleWatchlist={async () => {
              setActiveActionItem(null);
              portalRef.current?.destroy();
              portalRef.current = null;
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
                // error handled internally
              }
            }}
            onDismiss={() => {
              setActiveActionItem(null);
              portalRef.current?.destroy();
              portalRef.current = null;
            }}
          />,
        );
        return;
      }

      // Desktop/Web: show existing ActionList context menu
      const title = item.symbol.toUpperCase();
      ActionList.show({
        title,
        triggerPosition: position,
        sections: [
          {
            items: [
              {
                icon: 'ArrowTopOutline' as const,
                label: intl.formatMessage({
                  id: ETranslations.market_move_to_top,
                }),
                disabled: index === 0,
                onPress: () => {
                  void actions.current.moveToTopV2(tokenToWatchListItem(item));
                },
              },
              {
                destructive: true,
                icon: 'DeleteOutline' as const,
                label: intl.formatMessage({
                  id: ETranslations.market_remove_from_watchlist,
                }),
                onPress: () => {
                  if (item.perpsCoin) {
                    void actions.current.removePerpsFromWatchListV2(
                      item.perpsCoin,
                    );
                  } else {
                    void actions.current.removeFromWatchListV2(
                      item.networkId,
                      item.address,
                    );
                  }
                },
              },
            ],
          },
        ],
      });
    },
    [actions, intl, tokenToWatchListItem],
  );

  // Cleanup portal on unmount
  useEffect(
    () => () => {
      if (portalRef.current) {
        portalRef.current.destroy();
        portalRef.current = null;
      }
    },
    [],
  );

  const categorySelector = useMemo(
    () => (
      <MarketWatchlistCategorySelector
        selectedFilter={selectedFilter}
        onSelectFilter={handleSelectFilter}
      />
    ),
    [selectedFilter, handleSelectFilter],
  );
  // Wait for data to be loaded before rendering anything
  // This prevents flashing the recommend list while data is still loading
  if (!watchlistState.isMounted) {
    // When tab-integrated on native, register a scroll view with collapsible tabs
    // even during loading, so the tab system has a valid scroll ref.
    if (tabIntegrated && platformEnv.isNative) {
      return <Tabs.ScrollView />;
    }
    return null;
  }

  // Show recommend list when watchlist is empty
  if (watchlist.length === 0) {
    // When tab-integrated on native, wrap in Tabs.ScrollView so the collapsible
    // tab system has a registered scroll view for this tab.
    if (tabIntegrated && platformEnv.isNative) {
      return (
        <Tabs.ScrollView>
          <MarketRecommendList recommendedTokens={recommendedTokens} />
        </Tabs.ScrollView>
      );
    }
    return <MarketRecommendList recommendedTokens={recommendedTokens} />;
  }

  return (
    <MarketTokenListBase
      onItemPress={onItemPress}
      toolbar={toolbar || (hidePerps ? undefined : categorySelector)}
      result={filteredResult}
      isWatchlistMode
      showEndReachedIndicator
      draggable
      tabIntegrated={tabIntegrated}
      tabName={tabName}
      listContainerProps={listContainerProps}
      onDragEnd={handleDragEnd}
      onItemLongPress={handleShowContextMenu}
      onItemContextMenu={handleShowContextMenu}
      onScrollBegin={activeActionItem ? dismissInlineActionBar : undefined}
    />
  );
}

export { MarketWatchlistTokenList };
