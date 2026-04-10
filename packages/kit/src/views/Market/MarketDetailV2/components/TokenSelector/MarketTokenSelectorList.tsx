import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  ListView,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useMarketWatchListV2Atom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';

import { useMarketTokenList } from '../../../MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenList';
import { useMarketWatchlistTokenList } from '../../../MarketHomeV2/components/MarketTokenList/hooks/useMarketWatchlistTokenList';

import {
  COLUMN_WIDTH_CHANGE,
  COLUMN_WIDTH_LIQUIDITY,
  COLUMN_WIDTH_MARKET_CAP,
  COLUMN_WIDTH_NAME,
  COLUMN_WIDTH_PRICE,
  COLUMN_WIDTH_TURNOVER,
  TOKEN_SELECTOR_POLLING_INTERVAL,
  convertSearchTokenToMarketToken,
} from './constants';
import { MarketTokenSelectorRow } from './MarketTokenSelectorRow';

import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';
import type { IMarketTimeRangeValue } from '../../../MarketHomeV2/types';

interface IMarketTokenSelectorListProps {
  networkId: string;
  selectedCategory?: string;
  timeRange?: IMarketTimeRangeValue;
  onItemPress: (item: IMarketToken) => void;
  pollingInterval?: number;
  isWatchlistMode?: boolean;
  searchQuery?: string;
  searchLoading?: boolean;
  searchResults?: (IMarketSearchV2Token & { networkLogoURI: string })[];
}

// Shared ListView renderer to eliminate duplication across list variants
function TokenSelectorListView({
  data,
  isLoading,
  networkId,
  onItemPress,
  emptyMessage,
}: {
  data: IMarketToken[];
  isLoading?: boolean;
  networkId: string;
  onItemPress: (item: IMarketToken) => void;
  emptyMessage?: string;
}) {
  if (isLoading && data.length === 0) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center">
        <Spinner size="large" />
      </YStack>
    );
  }

  if (!isLoading && data.length === 0 && emptyMessage) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center">
        <Empty illustration="QuestionMark" title={emptyMessage} />
      </YStack>
    );
  }

  return (
    <ListView
      estimatedItemSize={40}
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <MarketTokenSelectorRow
          item={item}
          networkId={networkId}
          onPress={onItemPress}
          showAddress
        />
      )}
      contentContainerStyle={{ paddingBottom: 10 }}
    />
  );
}

const WatchlistTokenSelectorList = memo(
  ({
    networkId,
    onItemPress,
    pollingInterval,
  }: {
    networkId: string;
    onItemPress: (item: IMarketToken) => void;
    pollingInterval?: number;
  }) => {
    const intl = useIntl();
    const [{ data: watchListData }] = useMarketWatchListV2Atom();

    const { data, isLoading } = useMarketWatchlistTokenList({
      watchlist: watchListData ?? [],
      pollingInterval: pollingInterval ?? TOKEN_SELECTOR_POLLING_INTERVAL,
    });

    const filteredData = useMemo(
      () => data.filter((item) => !item.perpsCoin),
      [data],
    );

    return (
      <TokenSelectorListView
        data={filteredData}
        isLoading={isLoading}
        networkId={networkId}
        onItemPress={onItemPress}
        emptyMessage={intl.formatMessage({
          id: ETranslations.market_favorites_empty,
        })}
      />
    );
  },
);

WatchlistTokenSelectorList.displayName = 'WatchlistTokenSelectorList';

const CategoryTokenSelectorList = memo(
  ({
    networkId,
    selectedCategory,
    timeRange,
    onItemPress,
    pollingInterval,
  }: {
    networkId: string;
    selectedCategory?: string;
    timeRange?: IMarketTimeRangeValue;
    onItemPress: (item: IMarketToken) => void;
    pollingInterval?: number;
  }) => {
    const { data, isLoading } = useMarketTokenList({
      networkId,
      type: selectedCategory,
      timeRange,
      pollingInterval: pollingInterval ?? TOKEN_SELECTOR_POLLING_INTERVAL,
    });

    return (
      <TokenSelectorListView
        data={data}
        isLoading={isLoading}
        networkId={networkId}
        onItemPress={onItemPress}
      />
    );
  },
);

CategoryTokenSelectorList.displayName = 'CategoryTokenSelectorList';

const SearchTokenSelectorList = memo(
  ({
    searchResults,
    searchLoading,
    onItemPress,
    networkId,
  }: {
    searchResults: (IMarketSearchV2Token & { networkLogoURI: string })[];
    searchLoading?: boolean;
    onItemPress: (item: IMarketToken) => void;
    networkId: string;
  }) => {
    const intl = useIntl();
    const data = useMemo(
      () => searchResults.map(convertSearchTokenToMarketToken),
      [searchResults],
    );

    return (
      <TokenSelectorListView
        data={data}
        isLoading={searchLoading}
        networkId={networkId}
        onItemPress={onItemPress}
        emptyMessage={intl.formatMessage({
          id: ETranslations.global_no_results,
        })}
      />
    );
  },
);

SearchTokenSelectorList.displayName = 'SearchTokenSelectorList';

function ListContent({
  searchQuery,
  searchResults,
  searchLoading,
  isWatchlistMode,
  networkId,
  onItemPress,
  pollingInterval,
  selectedCategory,
  timeRange,
}: IMarketTokenSelectorListProps) {
  if (searchQuery) {
    return (
      <SearchTokenSelectorList
        searchResults={searchResults ?? []}
        searchLoading={searchLoading}
        onItemPress={onItemPress}
        networkId={networkId}
      />
    );
  }
  if (isWatchlistMode) {
    return (
      <WatchlistTokenSelectorList
        networkId={networkId}
        onItemPress={onItemPress}
        pollingInterval={pollingInterval}
      />
    );
  }
  return (
    <CategoryTokenSelectorList
      networkId={networkId}
      selectedCategory={selectedCategory}
      timeRange={timeRange}
      onItemPress={onItemPress}
      pollingInterval={pollingInterval}
    />
  );
}

const MarketTokenSelectorList = memo(
  ({
    networkId,
    selectedCategory,
    timeRange,
    onItemPress,
    pollingInterval,
    isWatchlistMode,
    searchQuery,
    searchLoading,
    searchResults,
  }: IMarketTokenSelectorListProps) => {
    const intl = useIntl();

    return (
      <YStack flex={1}>
        {/* Fixed header */}
        <XStack
          px="$4"
          py="$3"
          borderBottomWidth="$px"
          borderBottomColor="$borderSubdued"
        >
          <SizableText
            width={COLUMN_WIDTH_NAME}
            size="$bodySm"
            color="$textSubdued"
          >
            {intl.formatMessage({ id: ETranslations.global_name })}
          </SizableText>
          <SizableText
            width={COLUMN_WIDTH_PRICE}
            size="$bodySm"
            color="$textSubdued"
          >
            {intl.formatMessage({ id: ETranslations.global_price })}
          </SizableText>
          <SizableText
            width={COLUMN_WIDTH_CHANGE}
            size="$bodySm"
            color="$textSubdued"
          >
            {`${intl.formatMessage({
              id: ETranslations.dexmarket_token_change,
            })}(%)`}
          </SizableText>
          <SizableText
            width={COLUMN_WIDTH_MARKET_CAP}
            size="$bodySm"
            color="$textSubdued"
          >
            {intl.formatMessage({ id: ETranslations.global_market_cap })}
          </SizableText>
          <SizableText
            width={COLUMN_WIDTH_LIQUIDITY}
            size="$bodySm"
            color="$textSubdued"
          >
            {intl.formatMessage({ id: ETranslations.global_liquidity })}
          </SizableText>
          <SizableText
            width={COLUMN_WIDTH_TURNOVER}
            size="$bodySm"
            color="$textSubdued"
          >
            {intl.formatMessage({ id: ETranslations.dexmarket_turnover })}
          </SizableText>
        </XStack>

        {/* Scrollable list */}
        <YStack height={350}>
          <ListContent
            searchQuery={searchQuery}
            searchResults={searchResults}
            searchLoading={searchLoading}
            isWatchlistMode={isWatchlistMode}
            networkId={networkId}
            onItemPress={onItemPress}
            pollingInterval={pollingInterval}
            selectedCategory={selectedCategory}
            timeRange={timeRange}
          />
        </YStack>
      </YStack>
    );
  },
);

MarketTokenSelectorList.displayName = 'MarketTokenSelectorList';

export { MarketTokenSelectorList };
export type { IMarketTokenSelectorListProps };
