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
import {
  type ITradingViewNativeSource,
  TradingViewNative,
  getTradingViewNativeSourceKey,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import { BaseMarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import { MarketTooltipLabel } from '@onekeyhq/kit/src/views/Market/components/MarketTooltipLabel';
import { StockMarketStatusBadge } from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import { PriceChangePercentage } from '@onekeyhq/kit/src/views/Market/components/PriceChangePercentage';
import type { IStockSimpleChartRange } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/StockSimpleChart/StockSimpleChart';
import { StockSimpleChartContent } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/StockSimpleChart/StockSimpleChart';
import {
  STOCK_SHARE_SIMPLE_CHART_RANGES,
  TOKEN_SIMPLE_CHART_RANGES,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/StockSimpleChart/stockSimpleChartData';
import { StockTokenInfoPopover } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/StockTokenInfo/StockTokenInfoPopover';
import { StockTokenVariantSelector } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/StockTokenVariantSelector';
import { useStockDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext';
import {
  MARKET_CHART_TOOLBAR_HEIGHT,
  MARKET_SIMPLE_CHART_RANGE_GAP,
  MARKET_SIMPLE_CHART_RANGE_MIN_WIDTH,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/layouts/components/marketSimpleChartConstants';
import { StockChartModeControl } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/layouts/components/StockChartModeControl';
import { getMarketStockChartPreviousClose } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketStockPreviousClose';
import { buildStockInfoFromPublicDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/stockPublicDataUtils';
import { useToMarketStockDetailPage } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/hooks/useToMarketStockDetailPage';
import { useMarketDetailChartDisplayModePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { SwapTestIDs } from '../../testIDs';
import {
  SWAP_DESKTOP_CARD_SHADOW_NATIVE_STYLE,
  SWAP_DESKTOP_CARD_SHADOW_WEB_STYLE,
} from '../../utils/swapDesktopCardShadow';
import { getSwapKLineTradingViewNativeSource } from '../modal/swapKLineTradingViewNativeUtils';

import { useSwapStockSelection } from './SwapStockMarketProvider';
import {
  SwapStockMyPosition,
  useSwapStockPortfolio,
} from './SwapStockPortfolio';
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
  const pendingStock = Boolean(selection?.stockSelectionPending);
  const hasError =
    priceMode === 'share' &&
    !price &&
    !pendingStock &&
    (isStockDetailError || selection?.identityResolutionError);
  const loading =
    pendingStock || (priceMode === 'share' && !stockDetail && !hasError);
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
    // The mobile column is 44px tall and its two lines fill it, so the blocks
    // would sit flush against each other: trim the quote block and leave a gap.
    content = mobile ? (
      <YStack alignItems="flex-end" gap="$1">
        <Skeleton width={112} height={24} />
        <Skeleton width={88} height={16} />
      </YStack>
    ) : (
      <>
        <Skeleton width={128} height={40} />
        <Skeleton width={116} height={24} />
      </>
    );
  } else {
    const quote = (
      <BaseMarketTokenPrice
        price={price ?? '--'}
        tokenName=""
        tokenSymbol=""
        currency="$"
        size={mobile ? '$headingXl' : '$heading4xl'}
      />
    );
    content = (
      <>
        {mobile ? (
          quote
        ) : (
          // Same dashed hover explanation as the Market stock header: the
          // share quote tracks the listed security, the token quote is on-chain.
          <MarketTooltipLabel
            testID="swap-stock-price-tooltip-trigger"
            hovering
            alignSelf="baseline"
            tooltip={intl.formatMessage({
              id:
                priceMode === 'share'
                  ? ETranslations.market_stock_price_underlying_tooltip
                  : ETranslations.market_token_price_onchain_tooltip,
            })}
          >
            {quote}
          </MarketTooltipLabel>
        )}
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
  const { isStockDetailLoading, stockDetail } = useStockDetail();
  const selection = useSwapStockSelection();
  const selectedStock =
    selection?.pendingStock ?? selection?.selectedStockPreview;
  const showStatus =
    !selection?.stockSelectionPending ||
    (selectedStock &&
      stockDetail?.stockId.toUpperCase() ===
        selectedStock.stockId.toUpperCase());
  const isStatusLoading = Boolean(
    selection?.stockSelectionPending || (isStockDetailLoading && !stockDetail),
  );
  return (
    <YStack gap="$2" pb="$5">
      <XStack alignItems="center" justifyContent="space-between" gap="$3">
        <SwapStockTickerSelector />
      </XStack>
      <Stack minHeight={20}>
        {isStatusLoading ? (
          <Skeleton width={220} height={20} />
        ) : (
          <StockMarketStatusBadge
            stock={showStatus ? status : undefined}
            variant="inline"
          />
        )}
      </Stack>
    </YStack>
  );
}

export function SwapStockVariantSelector() {
  const selection = useSwapStockSelection();
  const { isTokenVariantPending } = useStockDetail();
  const variantLoading = Boolean(
    selection?.loadingScopes.tradeTarget || isTokenVariantPending,
  );
  // The same per-variant lookup the Market page feeds its selector, so the
  // balances in the list match the My position table below the chart.
  const portfolio = useSwapStockPortfolio();
  const intl = useIntl();
  const { currentStockToken, displayStockTokenDetail } =
    useSwapStockTradeContext();
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
            forceLoading={variantLoading}
            onOpenChange={(open) => {
              if (open) selection?.cancelSelection();
            }}
            onSelect={selection?.selectVariant}
            portfolioData={portfolio?.portfolioData}
            resolvedVariantKeys={portfolio?.resolvedVariantKeys}
          />
        </Stack>
        {variantLoading ? (
          <Skeleton width={88} height={24} />
        ) : (
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
        )}
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
  // Shared with the Market stock detail chart, so the choice follows the user
  // between the two surfaces.
  const [{ mode: chartMode }, setChartDisplayMode] =
    useMarketDetailChartDisplayModePersistAtom();
  const {
    stockDetail,
    stockId,
    selectedTokenVariant,
    isStockDetailError,
    retryStockDetail,
  } = useStockDetail();
  const { displayStockTokenDetail: tokenDetail, currentStockToken } =
    useSwapStockTradeContext();
  const selection = useSwapStockSelection();
  const { status } = useSwapStockPrice(priceMode);
  const selectedStock =
    selection?.pendingStock ?? selection?.selectedStockPreview;
  const showStatus =
    !selection?.stockSelectionPending ||
    (selectedStock &&
      stockDetail?.stockId.toUpperCase() ===
        selectedStock.stockId.toUpperCase());
  const toMarket = useToMarketStockDetailPage();
  const chartRanges =
    priceMode === 'share'
      ? STOCK_SHARE_SIMPLE_CHART_RANGES
      : TOKEN_SIMPLE_CHART_RANGES;
  const rangeSelectorWidth =
    chartRanges.length * MARKET_SIMPLE_CHART_RANGE_MIN_WIDTH +
    (chartRanges.length - 1) * MARKET_SIMPLE_CHART_RANGE_GAP;
  // Pro follows the Market page: the share quote charts the listing itself,
  // the token quote charts the selected on-chain token.
  const proChartSource = useMemo<ITradingViewNativeSource | undefined>(() => {
    if (priceMode === 'share') {
      return stockId ? { kind: 'stock', stockId } : undefined;
    }
    return getSwapKLineTradingViewNativeSource({ token: currentStockToken });
  }, [currentStockToken, priceMode, stockId]);
  const isSimpleChart = chartMode === 'simple' || !proChartSource;
  const previousClose = getMarketStockChartPreviousClose({
    priceSource: priceMode,
    stockDetail,
    selectedTokenVariant,
    tokenDetail,
    tokenDetailNetworkId: currentStockToken?.networkId,
  });
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
              <StockMarketStatusBadge
                stock={showStatus ? status : undefined}
                variant="inline"
              />
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
          <YStack flex={1} minHeight={0} minWidth={0}>
            {selection?.stockSelectionPending ? (
              <Skeleton width="100%" height="100%" />
            ) : null}
            {!selection?.stockSelectionPending && isSimpleChart ? (
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
            ) : null}
            {!selection?.stockSelectionPending && !isSimpleChart ? (
              <Stack flex={1} minWidth={0} overflow="hidden">
                <TradingViewNative
                  key={getTradingViewNativeSourceKey(proChartSource)}
                  testID="swap-stock-pro-chart"
                  source={proChartSource}
                  enablePreviousClose
                  previousClose={previousClose}
                  forcedChartType="candlestick"
                  enableNativeChartSettings
                  nativeControlsLayoutMode="desktop"
                  nativeControlsFlushHorizontalInset
                />
              </Stack>
            ) : null}
          </YStack>
          {/* Same toolbar as the Market stock chart: ranges lead, Simple/Pro
              trails. Pro carries its own interval row inside the widget. */}
          <XStack
            testID="swap-stock-chart-toolbar"
            height={MARKET_CHART_TOOLBAR_HEIGHT}
            py="$1"
            gap="$3"
            alignItems="center"
          >
            <XStack
              flex={1}
              minWidth={isSimpleChart ? rangeSelectorWidth : 0}
              alignItems="center"
              gap="$0.5"
            >
              {isSimpleChart
                ? chartRanges.map((value) => (
                    <Stack
                      key={value}
                      minWidth={MARKET_SIMPLE_CHART_RANGE_MIN_WIDTH}
                      height={32}
                      flexShrink={0}
                    >
                      <Button
                        testID={`swap-stock-chart-range-${value}`}
                        minWidth={MARKET_SIMPLE_CHART_RANGE_MIN_WIDTH}
                        height={32}
                        m="$0"
                        px="$2"
                        borderWidth={0}
                        size="small"
                        variant={range === value ? 'secondary' : 'tertiary'}
                        borderRadius="$full"
                        onPress={() => setRange(value)}
                      >
                        {intl.formatMessage({
                          id: STOCK_CHART_RANGE_LABELS[value],
                        })}
                      </Button>
                    </Stack>
                  ))
                : null}
            </XStack>
            {/* Reflect what is drawn: with no Pro source the simple chart
                stands in, so the control must not claim Pro. */}
            <StockChartModeControl
              mode={isSimpleChart ? 'simple' : 'pro'}
              onChange={(mode) => setChartDisplayMode({ mode })}
            />
          </XStack>
        </YStack>
      </YStack>
      <SwapStockMyPosition />
      <SwapStockTokenDetails
        summary
        tokenDetail={tokenDetail}
        networkId={currentStockToken?.networkId}
        loading={Boolean(selection?.stockSelectionPending) || !tokenDetail}
      />
      <XStack justifyContent="center">
        <Button
          testID="swap-stock-view-in-market"
          size="small"
          variant="tertiary"
          iconAfter="OpenOutline"
          disabled={!stockId || Boolean(selection?.stockSelectionPending)}
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
