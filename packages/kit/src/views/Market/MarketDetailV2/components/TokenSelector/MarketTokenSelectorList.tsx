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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';

import { useMarketWatchListV2Atom } from '../../../../../states/jotai/contexts/marketV2';
import { useMarketTokenList } from '../../../MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenList';
import { useMarketWatchlistTokenList } from '../../../MarketHomeV2/components/MarketTokenList/hooks/useMarketWatchlistTokenList';

import { MarketTokenSelectorRow } from './MarketTokenSelectorRow';

import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';

interface IMarketTokenSelectorListProps {
  networkId: string;
  selectedCategory?: string;
  timeRange?: string;
  onItemPress: (item: IMarketToken) => void;
  pollingInterval?: number;
  isWatchlistMode?: boolean;
  searchQuery?: string;
  searchLoading?: boolean;
  searchResults?: (IMarketSearchV2Token & { networkLogoURI: string })[];
}

const DEFAULT_POLLING_INTERVAL = timerUtils.getTimeDurationMs({ seconds: 15 });

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
    const [{ data: watchListData }] = useMarketWatchListV2Atom();

    const watchlist: IMarketWatchListItemV2[] = useMemo(
      () => watchListData ?? [],
      [watchListData],
    );

    const { data, isLoading } = useMarketWatchlistTokenList({
      watchlist,
      pollingInterval: pollingInterval ?? DEFAULT_POLLING_INTERVAL,
    });

    // Filter out perps items for the market token selector
    const filteredData = useMemo(
      () => data.filter((item) => !item.perpsCoin),
      [data],
    );

    if (isLoading && filteredData.length === 0) {
      return (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" />
        </YStack>
      );
    }

    return (
      <ListView
        estimatedItemSize={40}
        data={filteredData}
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
    timeRange?: string;
    onItemPress: (item: IMarketToken) => void;
    pollingInterval?: number;
  }) => {
    const { data, isLoading } = useMarketTokenList({
      networkId,
      type: selectedCategory,
      timeRange: timeRange as any,
      pollingInterval: pollingInterval ?? DEFAULT_POLLING_INTERVAL,
    });

    if (isLoading && data.length === 0) {
      return (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" />
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
  },
);

CategoryTokenSelectorList.displayName = 'CategoryTokenSelectorList';

function convertSearchTokenToMarketToken(
  item: IMarketSearchV2Token & { networkLogoURI: string },
): IMarketToken {
  return {
    id: `${item.network}_${item.address}`,
    name: item.name,
    symbol: item.symbol,
    address: item.address,
    decimals: item.decimals,
    price: Number(item.price) || 0,
    change24h: Number(item.priceChange24hPercent) || 0,
    marketCap: Number(item.marketCap) || 0,
    liquidity: Number(item.liquidity) || 0,
    transactions: 0,
    uniqueTraders: 0,
    holders: 0,
    turnover: Number(item.volume_24h || item.volume24h) || 0,
    tokenImageUri: item.logoUrl,
    tokenImageUris: item.logoUrls,
    networkLogoUri: item.networkLogoURI,
    networkId: item.network,
    chainId: item.network,
    isNative: item.isNative,
    communityRecognized: item.communityRecognized,
    stock: item.stock,
  };
}

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

    if (searchLoading) {
      return (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" />
        </YStack>
      );
    }

    if (data.length === 0) {
      return (
        <YStack flex={1} alignItems="center" justifyContent="center">
          <Empty
            illustration="QuestionMark"
            title={intl.formatMessage({
              id: ETranslations.global_no_results,
            })}
          />
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
  },
);

SearchTokenSelectorList.displayName = 'SearchTokenSelectorList';

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
          <SizableText width={240} size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_name })}
          </SizableText>
          <SizableText width={110} size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_price })}
          </SizableText>
          <SizableText width={90} size="$bodySm" color="$textSubdued">
            {`${intl.formatMessage({
              id: ETranslations.dexmarket_token_change,
            })}(%)`}
          </SizableText>
          <SizableText width={100} size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_market_cap })}
          </SizableText>
          <SizableText width={100} size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_liquidity })}
          </SizableText>
          <SizableText width={100} size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.dexmarket_turnover })}
          </SizableText>
        </XStack>

        {/* Scrollable list */}
        <YStack height={350}>
          {searchQuery ? (
            <SearchTokenSelectorList
              searchResults={searchResults ?? []}
              searchLoading={searchLoading}
              onItemPress={onItemPress}
              networkId={networkId}
            />
          ) : isWatchlistMode ? (
            <WatchlistTokenSelectorList
              networkId={networkId}
              onItemPress={onItemPress}
              pollingInterval={pollingInterval}
            />
          ) : (
            <CategoryTokenSelectorList
              networkId={networkId}
              selectedCategory={selectedCategory}
              timeRange={timeRange}
              onItemPress={onItemPress}
              pollingInterval={pollingInterval}
            />
          )}
        </YStack>
      </YStack>
    );
  },
);

MarketTokenSelectorList.displayName = 'MarketTokenSelectorList';

export { MarketTokenSelectorList };
export type { IMarketTokenSelectorListProps };
