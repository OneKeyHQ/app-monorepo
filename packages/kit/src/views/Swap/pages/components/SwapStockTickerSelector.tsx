import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
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
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { MarketStockSelectorList } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MarketStockSelectorList';
import { StockSelectorPopover } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/StockSelectorPopover';
import { useMarketStockSelectorList } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/useMarketStockSelectorList';
import { useStockDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext';
import { resolveMarketStockId } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveIsStockToken';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSwapRoutes } from '@onekeyhq/shared/src/routes';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { SwapTestIDs } from '../../testIDs';
import { getSwapStockTokenDisplayName } from '../modal/SwapTokenSelectModal.utils';

import { useSwapStockSelection } from './SwapStockMarketProvider';
import { useSwapStockTradeContext } from './SwapStockTradeProvider';

function StockTickerList({ closePopover }: { closePopover: () => void }) {
  const intl = useIntl();
  const { md } = useMedia();
  const [query, setQuery] = useState('');
  const { getClipboard, supportPaste } = useClipboard();
  const debouncedQuery = useDebounce(query, 500);
  const selection = useSwapStockSelection();

  return (
    <YStack
      testID="swap-stock-ticker-list"
      width={platformEnv.isNative ? 360 : '100%'}
      maxHeight={md ? undefined : 674}
      flex={md ? 1 : undefined}
      $platform-native={{ px: '$4' }}
    >
      <XStack px="$2" pt="$2" width="100%">
        <SearchBar
          testID="swap-stock-ticker-search"
          autoFocus
          placeholder={intl.formatMessage({
            id: ETranslations.global_search_asset,
          })}
          value={query}
          onChangeText={setQuery}
          containerProps={{
            borderRadius: '$2',
            mx: '$2',
            mt: '$2',
            flex: 1,
          }}
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
      </XStack>
      <YStack width="100%">
        <MarketStockSelectorList
          query={debouncedQuery}
          onItemPress={(stock) => {
            if (!selection) return;
            closePopover();
            void selection.selectStock(stock, debouncedQuery);
          }}
        />
      </YStack>
      {selection?.selecting ? (
        <Stack alignItems="center" py="$2">
          <Spinner size="small" />
        </Stack>
      ) : null}
      {selection?.selectionError ? (
        <SizableText color="$textCritical" size="$bodyMd" px="$4" pb="$2">
          {intl.formatMessage({
            id: ETranslations.global_unknown_error_retry_message,
          })}
        </SizableText>
      ) : null}
    </YStack>
  );
}

export function SwapStockTickerSelector() {
  const intl = useIntl();
  const { md } = useMedia();
  const navigation = useAppNavigation();
  const selection = useSwapStockSelection();
  // Warm the selector list as soon as the Stocks page mounts: the sheet reads
  // its first page from the SWR cache and shows a centered spinner on a miss,
  // and the Market Home list may be older than the cache window. Opening the
  // sheet then renders rows immediately instead of flashing a loading state.
  useMarketStockSelectorList({ query: '' });
  const { stockDetail, stockPreview, stockId } = useStockDetail();
  const { currentStockToken } = useSwapStockTradeContext();
  const openMobileSelector = useCallback(() => {
    if (!selection) return;
    selection.cancelSelection();
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapTokenSelect,
      params: {
        type: ESwapDirectionType.FROM,
        storeName: selection.storeName,
        autoSearch: true,
        selectTarget: 'swapStock',
        defaultNetworkId: currentStockToken?.networkId,
      },
    });
  }, [currentStockToken?.networkId, navigation, selection]);
  const stock = stockDetail ?? stockPreview;
  const selectedStockPreview = selection?.selectedStockPreview;
  const listPreview =
    selection?.pendingStock ??
    (selection?.stockSelectionPending ||
    selectedStockPreview?.stockId.toUpperCase() === stockId?.toUpperCase()
      ? selectedStockPreview
      : undefined);
  const stockTokenMatches = Boolean(
    currentStockToken &&
    (!stockId || resolveMarketStockId(currentStockToken) === stockId),
  );
  const fallbackStock = stockTokenMatches
    ? currentStockToken?.stock
    : undefined;
  // The list item already carries the underlying stock's brand icon. Keep it
  // through the token and stock-detail transition instead of showing the old
  // stock or the issuer token's artwork.
  const tokenImageUri = listPreview?.logoUrl ?? stock?.logoUrl;
  const tokenSymbol =
    listPreview?.symbol ??
    stock?.symbol ??
    fallbackStock?.underlyingAssetTicker ??
    stockId ??
    currentStockToken?.symbol;
  const tokenName =
    listPreview?.name ??
    stock?.name ??
    (fallbackStock || currentStockToken?.name
      ? getSwapStockTokenDisplayName({
          stock: fallbackStock,
          tokenName: currentStockToken?.name,
        })
      : undefined);
  const trigger = (
    // eslint-disable-next-line props-checker/validator -- Popover supplies the trigger handlers on desktop; native opens the selector route directly.
    <XStack
      testID={SwapTestIDs.stockMarketTokenHeader}
      onPress={platformEnv.isNative ? openMobileSelector : undefined}
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
      <Token size="xl" tokenImageUri={tokenImageUri} />
      <YStack minWidth={0} flexShrink={1}>
        <SizableText size={md ? '$headingLg' : '$headingXl'} numberOfLines={1}>
          {tokenSymbol ?? '--'}
        </SizableText>
        <SizableText
          size={md ? '$bodyMd' : '$bodyMdMedium'}
          color="$textSubdued"
          numberOfLines={1}
        >
          {tokenName ?? '--'}
        </SizableText>
      </YStack>
      <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
  if (platformEnv.isNative) {
    return trigger;
  }
  return (
    <StockSelectorPopover
      onOpenChange={(open) => {
        if (open) selection?.cancelSelection();
      }}
      title={intl.formatMessage({
        id: ETranslations.placeholder_stock_search,
      })}
      showHeader={false}
      placement="bottom-start"
      floatingPanelProps={{ width: 800, borderRadius: '$4' }}
      sheetProps={{ snapPoints: [86], snapPointsMode: 'percent' }}
      renderContent={StockTickerList}
      renderTrigger={trigger}
    />
  );
}
