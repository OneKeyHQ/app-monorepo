import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  markMarketReactPerf,
  useMarketRenderCommitProbe,
} from '../../../utils/marketReactPerf';

import { useMarketTokenList } from './hooks/useMarketTokenList';
import { type IMarketToken } from './MarketTokenData';
import { MarketTokenListBase } from './MarketTokenListBase';
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
  useApiDefaultSort?: boolean;
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
  centerDesktopPortalContent?: boolean;
  desktopColumnVariant?: 'default' | 'trending';
};

function MarketNormalTokenList({
  networkId = 'sol--101',
  selectedCategory,
  forceStockMetadataColumns,
  stockCategory,
  timeRange,
  sortBy: initialSortBy,
  sortType: initialSortType,
  useApiDefaultSort,
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
  centerDesktopPortalContent,
  desktopColumnVariant,
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
    useApiDefaultSort,
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
      result={normalResult}
      isWatchlistMode={false}
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
      centerDesktopPortalContent={centerDesktopPortalContent}
      marketTokenCategory={selectedCategory}
      desktopColumnVariant={desktopColumnVariant}
      timeRange={timeRange}
    />
  );
}

export { MarketNormalTokenList };
