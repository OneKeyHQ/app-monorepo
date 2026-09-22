import { useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { BaseMarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import { StockMarketStatusBadge } from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import { PriceChangePercentage } from '@onekeyhq/kit/src/views/Market/components/PriceChangePercentage';
import type { IStockSimpleChartRange } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/StockSimpleChart/StockSimpleChart';
import { StockSimpleChartContent } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/StockSimpleChart/StockSimpleChart';
import { STOCK_SHARE_SIMPLE_CHART_RANGES } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/StockSimpleChart/stockSimpleChartData';
import { StockTokenInfoPopover } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/StockTokenInfo/StockTokenInfoPopover';
import { StockTokenVariantSelector } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/StockTokenVariantSelector';
import { useStockDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext';
import { buildStockInfoFromPublicDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/stockPublicDataUtils';
import { useToMarketStockDetailPage } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/hooks/useToMarketStockDetailPage';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { SwapTestIDs } from '../../testIDs';
import {
  SWAP_DESKTOP_CARD_SHADOW_NATIVE_STYLE,
  SWAP_DESKTOP_CARD_SHADOW_WEB_STYLE,
} from '../../utils/swapDesktopCardShadow';

import { SwapStockMarketDataGrid } from './SwapStockMarketData';
import { useSwapStockSelection } from './SwapStockMarketProvider';
import {
  SwapStockCurrentPosition,
  useSwapStockPositions,
} from './SwapStockPositions';
import { SwapStockTickerSelector } from './SwapStockTickerSelector';
import { SwapStockTokenDetails } from './SwapStockTokenDetails';
import { useSwapStockTradeContext } from './SwapStockTradeProvider';

const STOCK_CHART_RANGE_LABELS: Record<IStockSimpleChartRange, ETranslations> =
  {
    '1H': ETranslations.market_1h,
    '1D': ETranslations.market_1d,
    '1W': ETranslations.market_1w,
    '1M': ETranslations.market_1m,
    '1Y': ETranslations.market_1y,
    All: ETranslations.global_all,
  };

function useSwapStockPrice(priceMode: 'share' | 'token') {
  const { stockDetail, selectedTokenVariant } = useStockDetail();
  const { displayStockTokenDetail: tokenDetail, currentStockToken } =
    useSwapStockTradeContext();
  const price = priceMode === 'share' ? stockDetail?.price : tokenDetail?.price;
  const percent =
    priceMode === 'share'
      ? stockDetail?.priceChange24hPercent
      : tokenDetail?.priceChange24hPercent;
  const reportedChange =
    priceMode === 'share' ? stockDetail?.priceChange24hValue : undefined;
  const change = useMemo(() => {
    const reported = new BigNumber(reportedChange ?? '');
    const quote = new BigNumber(price ?? '');
    const ratio = new BigNumber(percent ?? '').div(100).plus(1);
    const value = reported.isFinite()
      ? reported
      : quote.minus(quote.div(ratio));
    return value.isFinite()
      ? (value.abs().gte(0.01) ? value.decimalPlaces(2) : value).toFixed()
      : undefined;
  }, [percent, price, reportedChange]);
  const status = stockDetail
    ? buildStockInfoFromPublicDetail(stockDetail, {
        source: tokenDetail?.stock?.source ?? selectedTokenVariant?.issuer,
        isPaused:
          tokenDetail?.stock?.isPaused ??
          selectedTokenVariant?.tradingHours?.isPaused,
      })
    : (tokenDetail?.stock ?? currentStockToken?.stock);
  return { price, percent, change, status };
}

function StockPrice({
  mobile,
  priceMode,
}: {
  mobile?: boolean;
  priceMode: 'share' | 'token';
}) {
  const { price, percent, change } = useSwapStockPrice(priceMode);
  const { stockDetail, isStockDetailError, retryStockDetail } =
    useStockDetail();
  const selection = useSwapStockSelection();
  const intl = useIntl();
  const color = new BigNumber(percent ?? 0).lt(0)
    ? '$textCritical'
    : '$textSuccess';
  const size = mobile ? '$bodySm' : '$bodyLg';
  const hasError =
    priceMode === 'share' &&
    !price &&
    (isStockDetailError || selection?.identityResolutionError);
  const loading = priceMode === 'share' && !stockDetail && !hasError;
  let content;
  if (hasError) {
    content = (
      <Button
        testID="swap-stock-price-retry"
        size="small"
        variant="tertiary"
        onPress={() =>
          selection?.identityResolutionError
            ? selection.retryIdentityResolution()
            : void retryStockDetail()
        }
      >
        {intl.formatMessage({ id: ETranslations.global_retry })}
      </Button>
    );
  } else if (loading) {
    content = (
      <>
        <Skeleton width={mobile ? 112 : 128} height={mobile ? 28 : 40} />
        <Skeleton width={mobile ? 88 : 116} height={mobile ? 16 : 24} />
      </>
    );
  } else {
    content = (
      <>
        <BaseMarketTokenPrice
          price={price ?? '--'}
          tokenName=""
          tokenSymbol=""
          currency="$"
          size={mobile ? '$headingXl' : '$heading4xl'}
        />
        <XStack gap="$1.5" alignItems="baseline">
          {change ? (
            <NumberSizeableText
              size={size}
              color={color}
              formatter="price"
              formatterOptions={{ currency: '$', showPlusMinusSigns: true }}
            >
              {change}
            </NumberSizeableText>
          ) : null}
          <XStack alignItems="baseline">
            {change ? (
              <SizableText size={size} color={color}>
                (
              </SizableText>
            ) : null}
            <PriceChangePercentage size={size}>
              {percent ?? '--'}
            </PriceChangePercentage>
            {change ? (
              <SizableText size={size} color={color}>
                )
              </SizableText>
            ) : null}
          </XStack>
        </XStack>
      </>
    );
  }
  return (
    <Stack
      testID="swap-stock-price"
      height={mobile ? 44 : 40}
      flexDirection={mobile ? 'column' : 'row'}
      alignItems={mobile ? 'flex-end' : 'baseline'}
      gap={mobile ? '$0' : '$3.5'}
    >
      {content}
    </Stack>
  );
}

export function SwapStockMobileHeader() {
  const { status } = useSwapStockPrice('share');
  return (
    <YStack gap="$2" pb="$5">
      <XStack alignItems="center" justifyContent="space-between" gap="$3">
        <SwapStockTickerSelector />
        <StockPrice mobile priceMode="share" />
      </XStack>
      <Stack minHeight={20}>
        <StockMarketStatusBadge stock={status} variant="inline" />
      </Stack>
    </YStack>
  );
}

export function SwapStockVariantSelector() {
  const selection = useSwapStockSelection();
  const positions = useSwapStockPositions();
  const intl = useIntl();
  const { currentStockToken, displayStockTokenDetail } =
    useSwapStockTradeContext();
  const portfolioData = useMemo(
    () =>
      positions?.positionTokenList.map((token) => ({
        networkId: token.networkId,
        accountAddress: token.accountAddress ?? '',
        tokenAddress: token.contractAddress,
        amount: token.balanceParsed ?? '',
        symbol: token.symbol,
        tokenPrice: token.price ?? '',
        totalPrice: '',
      })),
    [positions?.positionTokenList],
  );
  return (
    <YStack gap="$1">
      <XStack
        testID="swap-stock-trade-target"
        h={44}
        pl="$1"
        alignItems="center"
        justifyContent="space-between"
        gap="$2"
      >
        <Stack minHeight={28}>
          <StockTokenVariantSelector
            compact
            fallbackToken={currentStockToken}
            onOpenChange={(open) => {
              if (!open) selection?.cancelSelection();
            }}
            onSelect={selection?.selectVariant}
            portfolioData={portfolioData}
          />
        </Stack>
        <StockTokenInfoPopover
          label={
            <BaseMarketTokenPrice
              price={
                displayStockTokenDetail?.price ??
                currentStockToken?.price ??
                '--'
              }
              tokenName={currentStockToken?.name ?? ''}
              tokenSymbol={currentStockToken?.symbol ?? ''}
              currency="$"
              size="$bodyLgMedium"
            />
          }
        />
      </XStack>
      {selection?.selectionError ? (
        <SizableText size="$bodySm" color="$textCritical">
          {intl.formatMessage({
            id: ETranslations.global_unknown_error_retry_message,
          })}
        </SizableText>
      ) : null}
    </YStack>
  );
}

export function SwapStockMarketPanel() {
  const intl = useIntl();
  const [priceMode, setPriceMode] = useState<'share' | 'token'>('share');
  const [range, setRange] = useState<IStockSimpleChartRange>('1D');
  const { stockDetail, stockId, isStockDetailError, retryStockDetail } =
    useStockDetail();
  const { displayStockTokenDetail: tokenDetail, currentStockToken } =
    useSwapStockTradeContext();
  const selection = useSwapStockSelection();
  const { status } = useSwapStockPrice(priceMode);
  const toMarket = useToMarketStockDetailPage();
  const marketData = useMemo(
    () =>
      tokenDetail && stockDetail
        ? {
            ...tokenDetail,
            stock: buildStockInfoFromPublicDetail(
              stockDetail,
              tokenDetail.stock,
            ),
          }
        : tokenDetail,
    [stockDetail, tokenDetail],
  );
  return (
    <YStack
      testID={SwapTestIDs.stockMarketPanel}
      flex={1}
      minWidth={0}
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$5"
      px="$5"
      py="$5"
      gap="$7"
      elevationAndroid="$1"
      $platform-web={SWAP_DESKTOP_CARD_SHADOW_WEB_STYLE}
      style={SWAP_DESKTOP_CARD_SHADOW_NATIVE_STYLE}
    >
      <YStack gap="$4">
        <SwapStockTickerSelector />
        <XStack
          alignItems="flex-start"
          justifyContent="space-between"
          gap="$2"
          flexWrap="wrap"
        >
          <YStack gap="$2">
            <StockPrice priceMode={priceMode} />
            <Stack minHeight={20}>
              <StockMarketStatusBadge stock={status} variant="inline" />
            </Stack>
          </YStack>
          <XStack py="$1" gap="$0.5">
            {(['share', 'token'] as const).map((mode) => (
              <Button
                key={mode}
                testID={`swap-stock-price-mode-${mode}`}
                size="small"
                variant="tertiary"
                m="$0"
                h={30}
                px="$2.5"
                borderRadius="$full"
                bg={priceMode === mode ? '$bgActive' : '$transparent'}
                onPress={() => setPriceMode(mode)}
              >
                {intl.formatMessage({
                  id:
                    mode === 'share'
                      ? ETranslations.market_share_price
                      : ETranslations.market_token_price,
                })}
              </Button>
            ))}
          </XStack>
        </XStack>
        <YStack height={360} gap="$4">
          <XStack height={40} alignItems="center" gap="$0.5">
            {STOCK_SHARE_SIMPLE_CHART_RANGES.map((value) => (
              <Button
                key={value}
                testID={`swap-stock-chart-range-${value}`}
                size="small"
                variant="tertiary"
                m="$0"
                h={32}
                minWidth={32}
                borderRadius="$full"
                px="$2"
                bg={range === value ? '$bgActive' : '$transparent'}
                onPress={() => setRange(value)}
              >
                {intl.formatMessage({ id: STOCK_CHART_RANGE_LABELS[value] })}
              </Button>
            ))}
          </XStack>
          <StockSimpleChartContent
            priceMode={priceMode}
            range={range}
            stockId={stockId}
            stockDetail={stockDetail}
            tokenDetail={tokenDetail}
            networkId={currentStockToken?.networkId ?? ''}
            tokenAddress={currentStockToken?.contractAddress ?? ''}
            isNative={!!currentStockToken?.isNative}
            requestError={Boolean(
              selection?.identityResolutionError ||
              (isStockDetailError && !stockId),
            )}
            onRequestRetry={() => {
              if (selection?.identityResolutionError) {
                selection.retryIdentityResolution();
              } else {
                void retryStockDetail();
              }
            }}
            coinGeckoId={
              typeof tokenDetail?.coingeckoId === 'string'
                ? tokenDetail.coingeckoId
                : undefined
            }
          />
        </YStack>
        <Stack h="$4" />
      </YStack>
      <SwapStockCurrentPosition />
      <SwapStockMarketDataGrid tokenDetail={marketData} />
      <SwapStockTokenDetails
        summary
        tokenDetail={tokenDetail}
        networkId={currentStockToken?.networkId}
        loading={!tokenDetail}
      />
      <XStack justifyContent="center">
        <Button
          testID="swap-stock-view-in-market"
          size="small"
          variant="tertiary"
          iconAfter="OpenOutline"
          disabled={!stockId}
          onPress={() => {
            if (stockId)
              void toMarket({
                stockId,
                symbol: stockDetail?.symbol ?? stockId,
                name: stockDetail?.name ?? '',
                logoUrl: stockDetail?.logoUrl ?? '',
                networkId: currentStockToken?.networkId,
                tokenAddress: currentStockToken?.contractAddress,
              });
          }}
        >
          {intl.formatMessage({
            id: ETranslations.button_view_full_stock_data_in_markets,
          })}
        </Button>
      </XStack>
    </YStack>
  );
}
