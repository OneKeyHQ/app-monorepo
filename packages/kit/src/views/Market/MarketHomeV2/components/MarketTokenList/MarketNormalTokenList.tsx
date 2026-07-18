import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  markMarketReactPerf,
  useMarketRenderCommitProbe,
} from '../../../utils/marketReactPerf';
import { applyMarketListLocalFilter } from '../MarketFilterChipsBar/applyMarketListLocalFilter';
import { useMarketListFilter } from '../MarketFilterChipsBar/MarketListFilterContext';

import { useClientSortResult } from './hooks/useClientSortResult';
import { useMarketTokenList } from './hooks/useMarketTokenList';
import { type IMarketToken } from './MarketTokenData';
import { MarketTokenListBase } from './MarketTokenListBase';
import { sortMarketTokensClient } from './utils/marketListClientSort';
import { shouldUseStockMetadataColumnsForTokens } from './utils/tokenListHelpers';

import type { IMarketTokenListLiveOverride } from './MarketTokenListBase';
import type { IMarketTimeRangeValue } from '../../types';

type IMarketNormalTokenListProps = {
  networkId?: string;
  selectedCategory?: string;
  stockCategory?: string;
  timeRange?: IMarketTimeRangeValue;
  sortBy?: string;
  sortType?: 'asc' | 'desc';
  onItemPress?: (item: IMarketToken) => void;
  toolbar?: ReactNode;
  tabIntegrated?: boolean;
  tabName?: string;
  listContainerProps?: {
    paddingBottom: number;
  };
  hiddenDesktopColumns?: readonly string[];
  liveTokenOverride?: IMarketTokenListLiveOverride;
  enableWebSocket?: boolean;
  pollingInterval?: number;
  rowBg?: string;
  onStockDataChange?: (categoryId: string, isStockData: boolean) => void;
  marketListRedesignEnabled?: boolean;
};

function MarketNormalTokenList({
  networkId = 'sol--101',
  selectedCategory,
  stockCategory,
  timeRange,
  sortBy: initialSortBy,
  sortType: initialSortType,
  onItemPress,
  toolbar,
  tabIntegrated,
  tabName,
  listContainerProps,
  hiddenDesktopColumns,
  liveTokenOverride,
  enableWebSocket,
  pollingInterval,
  rowBg,
  onStockDataChange,
  marketListRedesignEnabled,
}: IMarketNormalTokenListProps) {
  useMarketRenderCommitProbe('MarketNormalTokenList', {
    networkId,
    selectedCategory,
    stockCategory,
    timeRange,
  });
  const normalResult = useMarketTokenList({
    networkId,
    initialSortBy,
    initialSortType,
    pageSize: 20,
    type: selectedCategory,
    category: stockCategory,
    timeRange,
    pollingInterval,
  });

  const isStockData = useMemo(
    () => shouldUseStockMetadataColumnsForTokens(normalResult.data),
    [normalResult.data],
  );

  const { filterState, filterRevision } = useMarketListFilter();
  const filteredData = useMemo(() => {
    if (!marketListRedesignEnabled) {
      return normalResult.data;
    }
    let next = applyMarketListLocalFilter(
      normalResult.data,
      filterState.conditions,
    );
    // Local simulation of the rankBy-passthrough "Top turnover" view (P2-2
    // scope, PM decides keep/drop at handoff).
    if (filterState.activePresetId === 'topTurnover') {
      next = sortMarketTokensClient(next, 'turnover', 'desc');
    }
    return next;
  }, [
    marketListRedesignEnabled,
    normalResult.data,
    filterState.conditions,
    filterState.activePresetId,
  ]);

  // Stocks keep server-driven behavior; trending gets full-pool client sort.
  const clientSortEnabled = selectedCategory === 'trending' && !stockCategory;
  const clientSortResult = useClientSortResult(
    useMemo(
      () => ({ ...normalResult, data: filteredData }),
      [normalResult, filteredData],
    ),
    { resetKey: filterRevision },
  );
  const listResult = clientSortEnabled ? clientSortResult : normalResult;

  useEffect(() => {
    if (selectedCategory) {
      onStockDataChange?.(selectedCategory, isStockData);
    }
  }, [isStockData, onStockDataChange, selectedCategory]);

  useEffect(() => {
    if (!platformEnv.isWeb || normalResult.data.length === 0) {
      return;
    }
    const perfGlobal = globalThis as typeof globalThis & {
      __onekeyMarketListReadyAt?: number;
      __onekeyMarketListReadyCount?: number;
    };
    perfGlobal.__onekeyMarketListReadyAt ??= performance.now();
    perfGlobal.__onekeyMarketListReadyCount = normalResult.data.length;
    markMarketReactPerf({
      name: 'MarketNormalTokenList.readyEffect',
      phase: 'measure',
      detail: {
        count: normalResult.data.length,
        selectedCategory,
      },
    });
  }, [normalResult.data.length, selectedCategory]);

  return (
    <MarketTokenListBase
      testID="market-normal-token-list"
      networkId={networkId}
      onItemPress={onItemPress}
      toolbar={toolbar}
      result={listResult}
      isWatchlistMode={false}
      clientSort={clientSortEnabled}
      clientSortFieldMapOverride={
        marketListRedesignEnabled ? { name: 'firstTradeTime' } : undefined
      }
      redesignEnabled={marketListRedesignEnabled}
      showEndReachedIndicator
      tabIntegrated={tabIntegrated}
      tabName={tabName}
      listContainerProps={listContainerProps}
      showStockSubtitle="auto"
      hiddenDesktopColumns={hiddenDesktopColumns}
      liveTokenOverride={liveTokenOverride}
      enableWebSocket={enableWebSocket}
      rowBg={rowBg}
    />
  );
}

export { MarketNormalTokenList };
