import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  NumberSizeableText,
  ScrollView,
  SearchBar,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { PriceChangePercentage } from '@onekeyhq/kit/src/views/Market/components/PriceChangePercentage';
import { StockSelectorPopover } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/StockSelectorPopover';
import { useMarketStockSelectorList } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/useMarketStockSelectorList';
import { useStockDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SwapTestIDs } from '../../testIDs';

import { useSwapStockSelection } from './SwapStockMarketProvider';

function StockTickerList({ closePopover }: { closePopover: () => void }) {
  const intl = useIntl();
  const { md } = useMedia();
  const [query, setQuery] = useState('');
  const { getClipboard, supportPaste } = useClipboard();
  const debouncedQuery = useDebounce(query, 200);
  const { stockId } = useStockDetail();
  const selection = useSwapStockSelection();
  const {
    items,
    isLoading,
    isError,
    canLoadMore,
    isLoadingMore,
    isLoadMoreError,
    loadMore,
    refresh,
  } = useMarketStockSelectorList({ query: debouncedQuery });
  return (
    <YStack
      testID="swap-stock-ticker-list"
      width={md ? '100%' : 360}
      maxHeight={md ? undefined : 674}
      flex={md ? 1 : undefined}
      $platform-native={{ px: '$4' }}
    >
      <Stack px="$4" pt="$4" pb="$4">
        <SearchBar
          testID="swap-stock-ticker-search"
          placeholder={intl.formatMessage({
            id: ETranslations.placeholder_stock_search,
          })}
          value={query}
          onChangeText={setQuery}
          containerProps={{ borderRadius: '$3' }}
          addOns={
            !query && platformEnv.isNative && supportPaste
              ? [
                  {
                    iconName: 'ClipboardOutline',
                    testID: 'swap-stock-ticker-paste',
                    onPress: async () => setQuery(await getClipboard()),
                  },
                ]
              : undefined
          }
        />
      </Stack>
      <ScrollView
        flex={md ? 1 : undefined}
        maxHeight={md ? undefined : 604}
        keyboardShouldPersistTaps="handled"
      >
        <YStack px="$3" pb="$4">
          {isLoading && !items.length ? (
            <Stack h={180} justifyContent="center" alignItems="center">
              <Spinner />
            </Stack>
          ) : null}
          {isError ? (
            <Button
              testID="swap-stock-ticker-retry"
              variant="tertiary"
              onPress={() => void refresh()}
            >
              {intl.formatMessage({ id: ETranslations.global_retry })}
            </Button>
          ) : null}
          {!isLoading && !isError && !items.length ? (
            <YStack
              testID="swap-stock-ticker-empty"
              h={174}
              pt="$5"
              alignItems="center"
              justifyContent="flex-start"
              gap="$2"
            >
              <Icon
                name="SearchOutline"
                color="$iconSubdued"
                size="$8"
                mb="$1"
              />
              <SizableText size="$bodyLgMedium">
                {intl.formatMessage({ id: ETranslations.global_no_results })}
              </SizableText>
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                textAlign="center"
                maxWidth={280}
              >
                {intl.formatMessage({
                  id: ETranslations.empty_stock_search_description,
                })}
              </SizableText>
            </YStack>
          ) : (
            items.map((stock) => (
              <XStack
                key={stock.stockId}
                testID={`swap-stock-ticker-${stock.stockId}`}
                h={60}
                px="$2.5"
                gap="$2.5"
                alignItems="center"
                borderRadius="$3"
                bg={stock.stockId === stockId ? '$bgActive' : undefined}
                hoverStyle={{ bg: '$bgHover' }}
                cursor="pointer"
                onPress={() => {
                  void selection?.selectStock(stock, query).then((selected) => {
                    if (selected) closePopover();
                  });
                }}
              >
                <Token size="md" tokenImageUri={stock.logoUrl} />
                <YStack flex={1} minWidth={0}>
                  <SizableText size="$bodyLgMedium" numberOfLines={1}>
                    {stock.name}
                  </SizableText>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {stock.symbol}
                  </SizableText>
                </YStack>
                <YStack alignItems="flex-end">
                  <NumberSizeableText
                    size="$bodyLgMedium"
                    formatter="price"
                    formatterOptions={{ currency: '$' }}
                  >
                    {stock.price ?? '--'}
                  </NumberSizeableText>
                  <PriceChangePercentage size="$bodySm">
                    {stock.priceChange24hPercent ?? '--'}
                  </PriceChangePercentage>
                </YStack>
              </XStack>
            ))
          )}
          {selection?.selecting ? <Spinner size="small" /> : null}
          {selection?.selectionError ? (
            <SizableText color="$textCritical" size="$bodyMd">
              {intl.formatMessage({
                id: ETranslations.global_unknown_error_retry_message,
              })}
            </SizableText>
          ) : null}
          {canLoadMore || isLoadMoreError ? (
            <Button
              testID="swap-stock-ticker-load-more"
              size="small"
              variant="tertiary"
              loading={isLoadingMore}
              onPress={() => void loadMore()}
            >
              {intl.formatMessage({
                id: isLoadMoreError
                  ? ETranslations.global_retry
                  : ETranslations.global_view_more,
              })}
            </Button>
          ) : null}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

export function SwapStockTickerSelector() {
  const intl = useIntl();
  const { md } = useMedia();
  const selection = useSwapStockSelection();
  const { stockDetail, stockPreview, stockId } = useStockDetail();
  const stock = stockDetail ?? stockPreview;
  return (
    <StockSelectorPopover
      onOpenChange={(open) => {
        if (!open) selection?.cancelSelection();
      }}
      title={intl.formatMessage({
        id: ETranslations.placeholder_stock_search,
      })}
      showHeader={false}
      placement="bottom-start"
      floatingPanelProps={{ width: 360, borderRadius: '$4' }}
      sheetProps={{ snapPoints: [86], snapPointsMode: 'percent' }}
      renderContent={StockTickerList}
      renderTrigger={
        // eslint-disable-next-line props-checker/validator -- Popover supplies the trigger handlers.
        <XStack
          testID={SwapTestIDs.stockMarketTokenHeader}
          alignSelf={md ? undefined : 'flex-start'}
          alignItems="center"
          gap="$3.5"
          minWidth={0}
          flexShrink={1}
          px="$2"
          py="$1"
          mx="$-2"
          my="$-1"
          borderRadius="$full"
          cursor="pointer"
          hoverStyle={{ bg: '$bgHover' }}
        >
          <Token size="xl" tokenImageUri={stock?.logoUrl} />
          <YStack minWidth={0} flexShrink={1}>
            <SizableText
              size={md ? '$headingLg' : '$headingXl'}
              numberOfLines={1}
            >
              {stock?.symbol ?? stockId ?? '--'}
            </SizableText>
            <SizableText
              size={md ? '$bodyMd' : '$bodyMdMedium'}
              color="$textSubdued"
              numberOfLines={1}
            >
              {stock?.name ?? '--'}
            </SizableText>
          </YStack>
          <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
        </XStack>
      }
    />
  );
}
