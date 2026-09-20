import { memo, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Empty,
  ScrollView,
  SizableText,
  Spinner,
  YStack,
} from '@onekeyhq/components';
import { MobileMarketStockListItem } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/MobileMarketStockListItem';
import SwapProSearchTokenListItem from '@onekeyhq/kit/src/views/Swap/pages/components/SwapProSearchTokenListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import {
  type IMarketTokenSelectorSearchTab,
  MarketTokenSelectorSearchTabs,
} from './MarketTokenSelectorSearchTabs';
import { useMarketStockSelectorList } from './useMarketStockSelectorList';

const SEARCH_SECTION_PREVIEW_LIMIT = 3;

type IMarketSearchToken = IMarketSearchV2Token & {
  networkLogoURI: string;
};

function SearchSectionTitle({ title }: { title: string }) {
  return (
    <SizableText px="$5" py="$2" size="$headingSm">
      {title}
    </SizableText>
  );
}

function SearchMoreButton({
  testID,
  onPress,
}: {
  testID: string;
  onPress: () => void;
}) {
  const intl = useIntl();
  return (
    <Button
      testID={testID}
      alignSelf="flex-start"
      ml="$3"
      size="small"
      variant="tertiary"
      onPress={onPress}
    >
      {intl.formatMessage({ id: ETranslations.global_show_more })}
    </Button>
  );
}

function MobileMarketTokenSelectorSearchResults({
  query,
  marketItems,
  isMarketLoading,
  onStockPress,
  onMarketPress,
}: {
  query: string;
  marketItems: IMarketSearchToken[];
  isMarketLoading?: boolean;
  onStockPress: (item: IMarketStockPublicItem) => void;
  onMarketPress: (item: IMarketSearchToken) => void;
}) {
  const intl = useIntl();
  const [activeTab, setActiveTab] =
    useState<IMarketTokenSelectorSearchTab>('all');
  const [showAllStocks, setShowAllStocks] = useState(false);
  const [showAllMarkets, setShowAllMarkets] = useState(false);
  const stockResult = useMarketStockSelectorList({ query });

  useEffect(() => {
    setActiveTab('all');
    setShowAllStocks(false);
    setShowAllMarkets(false);
  }, [query]);

  const isShowingAllStocks = activeTab === 'stocks' || showAllStocks;
  const visibleStocks = isShowingAllStocks
    ? stockResult.items
    : stockResult.items.slice(0, SEARCH_SECTION_PREVIEW_LIMIT);
  const visibleMarkets =
    activeTab === 'market' || showAllMarkets
      ? marketItems
      : marketItems.slice(0, SEARCH_SECTION_PREVIEW_LIMIT);
  const showStockSection =
    activeTab !== 'market' &&
    (stockResult.isLoading ||
      stockResult.isError ||
      stockResult.items.length > 0);
  const showMarketSection =
    activeTab !== 'stocks' &&
    (Boolean(isMarketLoading) || marketItems.length > 0);

  return (
    <YStack flex={1}>
      <MarketTokenSelectorSearchTabs
        value={activeTab}
        onChange={setActiveTab}
      />
      {!showStockSection && !showMarketSection ? (
        <YStack flex={1} alignItems="center" justifyContent="center">
          <Empty
            illustration="QuestionMark"
            title={intl.formatMessage({ id: ETranslations.global_no_results })}
          />
        </YStack>
      ) : (
        <ScrollView flex={1}>
          {showStockSection ? (
            <YStack>
              <SearchSectionTitle
                title={intl.formatMessage({
                  id: ETranslations.perps_token_selector_stocks,
                })}
              />
              {stockResult.isLoading && stockResult.items.length === 0 ? (
                <YStack py="$6" alignItems="center">
                  <Spinner size="large" />
                </YStack>
              ) : null}
              {stockResult.isError && stockResult.items.length === 0 ? (
                <YStack py="$4" alignItems="center" gap="$2">
                  <SizableText color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.global_connet_error_try_again,
                    })}
                  </SizableText>
                  <Button
                    testID="mobile-market-token-selector-stock-search-retry"
                    size="small"
                    variant="tertiary"
                    onPress={() => void stockResult.refresh()}
                  >
                    {intl.formatMessage({ id: ETranslations.global_retry })}
                  </Button>
                </YStack>
              ) : null}
              {visibleStocks.map((item) => (
                <MobileMarketStockListItem
                  key={item.stockId}
                  item={item}
                  onPress={onStockPress}
                />
              ))}
              {activeTab !== 'stocks' &&
              !showAllStocks &&
              (stockResult.items.length > SEARCH_SECTION_PREVIEW_LIMIT ||
                stockResult.canLoadMore) ? (
                <SearchMoreButton
                  testID="mobile-market-token-selector-stock-search-show-more"
                  onPress={() => setShowAllStocks(true)}
                />
              ) : null}
              {isShowingAllStocks && stockResult.isLoadingMore ? (
                <YStack py="$4" alignItems="center">
                  <Spinner size="small" />
                </YStack>
              ) : null}
              {isShowingAllStocks && stockResult.isLoadMoreError ? (
                <Button
                  testID="mobile-market-token-selector-stock-search-load-more-retry"
                  alignSelf="flex-start"
                  ml="$3"
                  size="small"
                  variant="tertiary"
                  onPress={() => void stockResult.loadMore()}
                >
                  {intl.formatMessage({ id: ETranslations.global_retry })}
                </Button>
              ) : null}
              {isShowingAllStocks &&
              stockResult.canLoadMore &&
              !stockResult.isLoadingMore &&
              !stockResult.isLoadMoreError ? (
                <SearchMoreButton
                  testID="mobile-market-token-selector-stock-search-load-more"
                  onPress={() => void stockResult.loadMore()}
                />
              ) : null}
            </YStack>
          ) : null}

          {showMarketSection ? (
            <YStack>
              <SearchSectionTitle
                title={intl.formatMessage({ id: ETranslations.global_market })}
              />
              {isMarketLoading && marketItems.length === 0 ? (
                <YStack py="$6" alignItems="center">
                  <Spinner size="large" />
                </YStack>
              ) : null}
              {visibleMarkets.map((item) => (
                <SwapProSearchTokenListItem
                  key={`${item.network}:${item.address}`}
                  item={item}
                  onPress={onMarketPress}
                />
              ))}
              {activeTab !== 'market' &&
              !showAllMarkets &&
              marketItems.length > SEARCH_SECTION_PREVIEW_LIMIT ? (
                <SearchMoreButton
                  testID="mobile-market-token-selector-market-search-show-more"
                  onPress={() => setShowAllMarkets(true)}
                />
              ) : null}
            </YStack>
          ) : null}
        </ScrollView>
      )}
    </YStack>
  );
}

const MemoMobileMarketTokenSelectorSearchResults = memo(
  MobileMarketTokenSelectorSearchResults,
);

export { MemoMobileMarketTokenSelectorSearchResults as MobileMarketTokenSelectorSearchResults };
