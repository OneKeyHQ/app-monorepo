import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  markMarketReactPerf,
  useMarketRenderCommitProbe,
} from '../../../utils/marketReactPerf';
import { applyMarketListLocalFilter } from '../MarketFilterChipsBar/applyMarketListLocalFilter';
import {
  buildHotTokenFilterParams,
  pickLocalOnlyConditions,
} from '../MarketFilterChipsBar/marketListFilterConfig';
import { useMarketListFilter } from '../MarketFilterChipsBar/MarketListFilterContext';

import { useClientSortResult } from './hooks/useClientSortResult';
import { useMarketTokenList } from './hooks/useMarketTokenList';
import { type IMarketToken } from './MarketTokenData';
import { MarketTokenListBase } from './MarketTokenListBase';
import { getTokenAgeSortValue } from './utils/marketListClientSort';
import { shouldUseStockMetadataColumnsForTokens } from './utils/tokenListHelpers';

import type { IMarketTokenListLiveOverride } from './MarketTokenListBase';
import type { IMarketTimeRangeValue } from '../../types';

type IMarketNormalTokenListProps = {
  networkId?: string;
  selectedCategory?: string;
  forceStockMetadataColumns?: boolean;
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
};

function MarketNormalTokenList({
  networkId = 'sol--101',
  selectedCategory,
  forceStockMetadataColumns,
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
}: IMarketNormalTokenListProps) {
  useMarketRenderCommitProbe('MarketNormalTokenList', {
    networkId,
    selectedCategory,
    stockCategory,
    timeRange,
  });
  const { filterState, sortState, setSortState } = useMarketListFilter();

  // Filters, the chip-driven sort and the fixed column roster are trending
  // features; stocks keep their own columns and server-driven behavior.
  const isTrendingList = selectedCategory === 'trending' && !stockCategory;

  // Server-side passthrough for every dimension the API supports; the local
  // pass below only handles what it cannot (token age).
  const filterParams = useMemo(
    () =>
      isTrendingList
        ? buildHotTokenFilterParams(filterState.conditions)
        : undefined,
    [isTrendingList, filterState.conditions],
  );

  const normalResult = useMarketTokenList({
    networkId,
    initialSortBy,
    initialSortType,
    pageSize: 20,
    type: selectedCategory,
    category: stockCategory,
    timeRange,
    filterParams,
    pollingInterval,
  });

  const isStockData = useMemo(
    () => shouldUseStockMetadataColumnsForTokens(normalResult.data),
    [normalResult.data],
  );

  const filteredData = useMemo(() => {
    if (!isTrendingList) {
      return normalResult.data;
    }
    // Only the conditions the server cannot express — the rest already
    // narrowed the pool upstream, before it was sliced.
    return applyMarketListLocalFilter(
      normalResult.data,
      pickLocalOnlyConditions(filterState.conditions),
    );
  }, [isTrendingList, normalResult.data, filterState.conditions]);

  // Only the trending view has a chip row to stay in sync with; everywhere
  // else the hook keeps its own private sort state.
  const externalSort = useMemo(
    () =>
      isTrendingList ? { ...sortState, onChange: setSortState } : undefined,
    [isTrendingList, sortState, setSortState],
  );
  const clientSortResult = useClientSortResult(
    useMemo(
      () => ({ ...normalResult, data: filteredData }),
      [normalResult, filteredData],
    ),
    { externalSort },
  );
  const listResult = clientSortResult;

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
      clientSort
      clientSortFieldMapOverride={
        // Trending merges Token Age into the Name column, so pressing that
        // header sorts by age — the same reader the standalone column uses.
        isTrendingList ? { name: getTokenAgeSortValue } : undefined
      }
      redesignColumnOrderEnabled={isTrendingList}
      volumeTimeRange={timeRange}
      showEndReachedIndicator
      tabIntegrated={tabIntegrated}
      tabName={tabName}
      listContainerProps={listContainerProps}
      showStockSubtitle="auto"
      forceStockMetadataColumns={forceStockMetadataColumns}
      hiddenDesktopColumns={hiddenDesktopColumns}
      liveTokenOverride={liveTokenOverride}
      enableWebSocket={enableWebSocket}
      rowBg={rowBg}
    />
  );
}

export { MarketNormalTokenList };
