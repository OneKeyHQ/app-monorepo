import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useMarketTokenList } from './hooks/useMarketTokenList';
import { type IMarketToken } from './MarketTokenData';
import { MarketTokenListBase } from './MarketTokenListBase';
import { shouldUseStockMetadataColumnsForTokens } from './utils/tokenListHelpers';

import type { IMarketTokenListLiveOverride } from './MarketTokenListBase';
import type { IMarketTimeRangeValue } from '../../types';

type IMarketNormalTokenListProps = {
  networkId?: string;
  selectedCategory?: string;
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
  pollingInterval?: number;
  rowBg?: string;
  onStockDataChange?: (categoryId: string, isStockData: boolean) => void;
};

function MarketNormalTokenList({
  networkId = 'sol--101',
  selectedCategory,
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
  pollingInterval,
  rowBg,
  onStockDataChange,
}: IMarketNormalTokenListProps) {
  const normalResult = useMarketTokenList({
    networkId,
    initialSortBy,
    initialSortType,
    pageSize: 20,
    type: selectedCategory,
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

  return (
    <MarketTokenListBase
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
      hiddenDesktopColumns={hiddenDesktopColumns}
      liveTokenOverride={liveTokenOverride}
      rowBg={rowBg}
    />
  );
}

export { MarketNormalTokenList };
