import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IStockPriceLineChartHoverPoint } from '@onekeyhq/kit/src/components/StockPriceLineChart';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { ITradingViewChartMode } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { MarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import { PriceChangePercentage } from '@onekeyhq/kit/src/views/Market/components/PriceChangePercentage';
import {
  type IMarketDetailChartDisplayMode,
  type IMarketPriceSource,
  useMarketDetailChartDisplayModePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IMarketAccountPortfolioDisplayItem,
  IMarketStockInfo,
} from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { MarketStarV2 } from '../../components/MarketStarV2';
import { MarketTooltipLabel } from '../../components/MarketTooltipLabel';
import { StockMarketStatusBadge } from '../../components/PerpsBadges';
import { MARKET_DESKTOP_CONTENT_FRAME_PROPS } from '../../marketDesktopLayoutConstants';
import { Portfolio } from '../components/InformationTabs/components/Portfolio';
import {
  STOCK_ANALYST_GAUGE_HEIGHT,
  STOCK_ANALYST_GAUGE_WIDTH,
  StockAnalystGauge,
  parseStockAnalystRatingCounts,
} from '../components/StockAnalystGauge';
import { StockFinancials } from '../components/StockFinancials/StockFinancials';
import {
  type IStockSimpleChartRange,
  STOCK_SHARE_SIMPLE_CHART_RANGES,
  StockSimpleChart,
  TOKEN_SIMPLE_CHART_RANGES,
} from '../components/StockSimpleChart';
import { SwapPanel } from '../components/SwapPanel/SwapPanel';
import { ShareButton } from '../components/TokenDetailHeader/ShareButton';
import { MarketTokenSelector } from '../components/TokenSelector/MarketTokenSelector';
import { useStockDetail } from '../hooks/StockDetailContext';
import { useStockPortfolioData } from '../hooks/useStockPortfolioData';
import { useStockPriceSource } from '../hooks/useStockPriceSource';
import { useTokenDetail } from '../hooks/useTokenDetail';
import {
  STAT_FALLBACK_VALUE,
  formatCurrencyStatValue,
  formatMarketCapValue,
  formatPercentValue,
  formatPriceChangeDisplay,
  formatRatioValue,
} from '../utils/statValue';
import {
  buildStockInfoFromPublicDetail,
  formatDirectPercentValue,
} from '../utils/stockPublicDataUtils';
import { getStockTokenVariantActionIdentity } from '../utils/stockTokenVariant';

import { MarketDesktopChartContainer } from './components/MarketDesktopChartContainer';
import { MarketDetailProChartControls } from './components/MarketDetailProChartControls';
import {
  MARKET_CHART_TOOLBAR_HEIGHT,
  MARKET_CHART_TOOLBAR_VERTICAL_INSET,
  MARKET_SIMPLE_CHART_RANGE_GAP,
  MARKET_SIMPLE_CHART_RANGE_MIN_WIDTH,
} from './components/marketSimpleChartConstants';
import { StockEventsSection } from './components/StockEventsSection';
import { StockNewsSection } from './components/StockNewsSection';
import {
  STOCK_DETAIL_COLUMN_GAP,
  STOCK_DETAIL_HORIZONTAL_GUTTER,
  STOCK_DETAIL_TRADE_PANEL_WIDTH,
} from './stockDesktopLayoutConstants';

type IStockDetailTab = 'overview' | 'position';

function StockPageHeader({
  showFavoriteButton,
}: {
  showFavoriteButton: boolean;
}) {
  const { tokenDetail, networkId, isNative } = useTokenDetail();
  const { selectedTokenVariant, stockDetail, stockId, stockPreview } =
    useStockDetail();
  const stock = tokenDetail?.stock;
  const selectedTokenActionIdentity =
    getStockTokenVariantActionIdentity(selectedTokenVariant);
  const tokenDetailActionIdentity =
    networkId && tokenDetail?.address
      ? {
          networkId,
          address: tokenDetail.address,
          symbol: tokenDetail.symbol,
        }
      : undefined;
  const tokenActionIdentity =
    selectedTokenActionIdentity ?? tokenDetailActionIdentity;

  return (
    <XStack
      testID="stock-token-detail-header"
      width="100%"
      height={72}
      px={STOCK_DETAIL_HORIZONTAL_GUTTER}
      py="$3"
      alignItems="center"
      justifyContent="space-between"
      gap="$5"
    >
      <MarketTokenSelector
        defaultCategory="stocks"
        renderTrigger={
          // eslint-disable-next-line props-checker/validator -- MarketTokenSelector injects the popover press handler.
          <XStack
            testID="stock-header-token-selector"
            alignItems="center"
            gap="$3.5"
            minWidth={0}
            cursor="pointer"
            // Hovering paints a rounded-full pill that reaches 8px past the
            // content horizontally and 4px vertically. Each negative margin is
            // cancelled by matching padding, so the row itself never moves.
            ml={-8}
            mr={-8}
            my={-4}
            pl={8}
            pr={8}
            py={4}
            borderRadius="$full"
            borderCurve="continuous"
            hoverStyle={{ bg: '$bgHover' }}
            pressStyle={{ bg: '$bgActive' }}
          >
            <Token
              size="xl"
              tokenImageUri={
                stockDetail?.logoUrl ||
                stockPreview?.logoUrl ||
                tokenDetail?.logoUrl ||
                stock?.sourceLogoUri
              }
              fallbackIcon="CryptoCoinOutline"
            />
            <YStack minWidth={0} justifyContent="center">
              <SizableText size="$headingXl" numberOfLines={1}>
                {stockDetail?.symbol ||
                  stockPreview?.symbol ||
                  stock?.underlyingAssetTicker ||
                  stock?.title ||
                  tokenDetail?.symbol ||
                  stockId ||
                  ''}
              </SizableText>
              <SizableText
                size="$bodyMdMedium"
                color="$textSubdued"
                numberOfLines={1}
              >
                {stockDetail?.name ||
                  stockPreview?.name ||
                  stock?.subtitle ||
                  tokenDetail?.name ||
                  ''}
              </SizableText>
            </YStack>
            {/* Figma 25277:10352: the chevron closes the whole pill and is
                centered on it, not tucked beside the ticker. */}
            <Icon
              name="ChevronDownSmallOutline"
              size="$5"
              color="$iconSubdued"
            />
          </XStack>
        }
      />

      {/* The stock route can share the listing before any token variant
          resolves, so the row also stands on a bare `stockId`.
          Favorites use the stock ID independently of the selected token. */}
      {tokenActionIdentity || stockId ? (
        <XStack alignItems="center" gap="$4">
          {showFavoriteButton && (stockId || tokenActionIdentity) ? (
            <MarketStarV2
              stockId={stockId}
              chainId={tokenActionIdentity?.networkId ?? ''}
              contractAddress={tokenActionIdentity?.address ?? ''}
              size="small"
              customIconSize="$5"
              from={EWatchlistFrom.Detail}
              tokenSymbol={stockDetail?.symbol ?? tokenActionIdentity?.symbol}
              isNative={isNative}
            />
          ) : null}
          <ShareButton
            networkId={tokenActionIdentity?.networkId ?? ''}
            address={tokenActionIdentity?.address ?? ''}
            isNative={isNative}
            // Share the stock listing itself, not the token variant that
            // happens to be selected on the page.
            stockId={stockId}
            useIconButton
            size="small"
          />
        </XStack>
      ) : null}
    </XStack>
  );
}

// The design shows the move with two decimals ("+$9.46") while the derived and
// scrubbed figures carry full precision, so clamp for display — but only above
// one cent, sub-cent moves keep the price formatter's adaptive precision.
function roundPriceChangeForDisplay(value: BigNumber) {
  return value.abs().gte(0.01) ? value.decimalPlaces(2) : value;
}

// Live headline price. Split out of the header so the scrub branch can render a
// plain figure without ever reaching MarketTokenPrice's cache.
function StockLivePrice({
  price,
  priceMode,
  isSharePrice,
}: {
  price?: string;
  priceMode: IMarketPriceSource;
  isSharePrice: boolean;
}) {
  const { tokenDetail } = useTokenDetail();
  const { stockDetail, stockId } = useStockDetail();

  if (!price) {
    // MarketTokenPrice caches per key and only accepts a newer
    // `lastUpdated`, so feeding it a placeholder while the feed is still
    // loading stamps '--' with the current clock and the real price that
    // arrives afterwards (carrying an older quote timestamp) can never
    // replace it. Hold the placeholder outside the cache instead.
    return <SizableText size="$heading4xl">{STAT_FALLBACK_VALUE}</SizableText>;
  }

  return (
    <MarketTokenPrice
      size="$heading4xl"
      price={price}
      // MarketTokenPrice otherwise de-dupes by name+symbol and keeps whichever
      // price carries the newest timestamp. Both modes describe the same
      // instrument, so under one key the token price would win in share mode
      // too — the explicit cache key gives each mode its own entry.
      cacheKey={`stock-${stockId ?? 'unknown'}-${priceMode}`}
      tokenName={stockDetail?.name ?? tokenDetail?.name ?? ''}
      tokenSymbol={stockDetail?.symbol ?? tokenDetail?.symbol ?? stockId ?? ''}
      lastUpdated={
        isSharePrice
          ? stockDetail?.quoteUpdatedAt
          : tokenDetail?.lastUpdated?.toString()
      }
    />
  );
}

function StockPriceHeader({
  priceMode,
  onPriceModeChange,
  hoverPoint,
}: {
  priceMode: IMarketPriceSource;
  onPriceModeChange: (mode: IMarketPriceSource) => void;
  // Set while the pointer scrubs the simple chart: the header then reads the
  // point under the crosshair instead of the live quote.
  hoverPoint?: IStockPriceLineChartHoverPoint;
}) {
  const intl = useIntl();
  const { tokenDetail } = useTokenDetail();
  const { stockDetail, selectedTokenVariant } = useStockDetail();
  const isSharePrice = priceMode === 'share';
  const price = isSharePrice ? stockDetail?.price : tokenDetail?.price;
  const priceChangePercent = isSharePrice
    ? stockDetail?.priceChange24hPercent
    : tokenDetail?.priceChange24hPercent;
  const reportedPriceChangeValue = isSharePrice
    ? stockDetail?.priceChange24hValue
    : undefined;
  // Only the share feed reports the absolute move. Everywhere else it is
  // derived from the percentage and the price shown next to it, so the two
  // figures on the line can never disagree.
  const priceChangeValue = useMemo(() => {
    if (reportedPriceChangeValue) {
      const reported = new BigNumber(reportedPriceChangeValue);
      if (reported.isFinite()) {
        return roundPriceChangeForDisplay(reported);
      }
    }
    if (price === undefined || priceChangePercent === undefined) {
      return undefined;
    }
    const priceBN = new BigNumber(price);
    const percentBN = new BigNumber(priceChangePercent);
    if (!priceBN.isFinite() || !percentBN.isFinite()) {
      return undefined;
    }
    const ratio = percentBN.dividedBy(100).plus(1);
    if (ratio.isZero() || !ratio.isFinite()) {
      return undefined;
    }
    return roundPriceChangeForDisplay(priceBN.minus(priceBN.dividedBy(ratio)));
  }, [price, priceChangePercent, reportedPriceChangeValue]);
  const { color: priceChangeColor } =
    formatPriceChangeDisplay(priceChangePercent);
  const stockStatus = useMemo<IMarketStockInfo | undefined>(() => {
    if (!stockDetail) return tokenDetail?.stock;
    // The public stock feed describes the underlying listing and carries no
    // issuer, so the badge's source has to come from the token wrapping it —
    // without one `resolveUSMarketStatusVariant` returns no variant and the
    // badge renders nothing at all.
    return buildStockInfoFromPublicDetail(stockDetail, {
      source: tokenDetail?.stock?.source ?? selectedTokenVariant?.issuer,
      isPaused:
        tokenDetail?.stock?.isPaused ??
        selectedTokenVariant?.tradingHours?.isPaused,
    });
  }, [stockDetail, tokenDetail?.stock, selectedTokenVariant]);

  // Scrubbing only redirects the two figures on the price line: the headline
  // becomes the hovered price and the move beside it is measured from the first
  // point of the range, both in the places they already occupy. The
  // market-status badge stays put, and the moment being read is answered by the
  // label that follows the crosshair inside the plot. The scrub price is
  // rendered outside MarketTokenPrice on purpose — that component caches the
  // last price it saw and would poison the live quote.
  const { color: hoverChangeColor } = formatPriceChangeDisplay(
    hoverPoint?.changePercent,
  );
  const hoverChangeValue = useMemo(() => {
    if (!hoverPoint?.changeValue) {
      return undefined;
    }
    const value = new BigNumber(hoverPoint.changeValue);
    return value.isFinite()
      ? roundPriceChangeForDisplay(value).toFixed()
      : undefined;
  }, [hoverPoint?.changeValue]);
  const changeValueText = hoverPoint
    ? hoverChangeValue
    : priceChangeValue?.toFixed();
  const changePercentText = hoverPoint
    ? hoverPoint.changePercent
    : priceChangePercent;
  const changeColor = hoverPoint ? hoverChangeColor : priceChangeColor;

  return (
    <XStack
      testID="stock-price-header"
      minHeight={68}
      flexWrap="wrap-reverse"
      alignItems="flex-end"
      justifyContent="space-between"
      gap="$2"
    >
      {/* Keep the intrinsic price width when deciding whether the controls fit.
          Reverse wrapping places the controls above the quote on narrow charts. */}
      <YStack flexGrow={1} flexShrink={1} minWidth={0} gap="$2">
        <XStack alignItems="baseline" flexWrap="wrap" gap="$3.5">
          {hoverPoint ? (
            <NumberSizeableText
              testID="stock-price-hover-value"
              size="$heading4xl"
              formatter="price"
              formatterOptions={{ currency: '$' }}
            >
              {hoverPoint.price}
            </NumberSizeableText>
          ) : (
            <MarketTooltipLabel
              testID="stock-price-tooltip-trigger"
              hovering
              // The row baseline-aligns this figure with the change beside it.
              alignSelf="baseline"
              tooltip={intl.formatMessage({
                id: isSharePrice
                  ? ETranslations.market_stock_price_underlying_tooltip
                  : ETranslations.market_token_price_onchain_tooltip,
              })}
            >
              <StockLivePrice
                price={price}
                priceMode={priceMode}
                isSharePrice={isSharePrice}
              />
            </MarketTooltipLabel>
          )}
          <XStack alignItems="baseline" flexShrink={0} gap="$1.5">
            {changeValueText ? (
              <NumberSizeableText
                testID="stock-price-change-value"
                size="$bodyLgMedium"
                color={changeColor}
                formatter="price"
                formatterOptions={{ currency: '$', showPlusMinusSigns: true }}
              >
                {changeValueText}
              </NumberSizeableText>
            ) : null}
            <XStack alignItems="baseline">
              {changeValueText ? (
                <SizableText size="$bodyLgMedium" color={changeColor}>
                  (
                </SizableText>
              ) : null}
              <PriceChangePercentage size="$bodyLgMedium">
                {changePercentText ?? '--'}
              </PriceChangePercentage>
              {changeValueText ? (
                <SizableText size="$bodyLgMedium" color={changeColor}>
                  )
                </SizableText>
              ) : null}
            </XStack>
          </XStack>
        </XStack>
        <StockMarketStatusBadge stock={stockStatus} variant="inline" />
      </YStack>

      {/* Both options hug their label, per Figma 25476:89067: the widths this
          used to carry were read off the English boxes, which left the shorter
          CJK labels sitting in half-empty pills. #13271 restored them as
          minimums to stop long Spanish/Italian labels truncating; hugging
          answers that case too, since a button with no minimum and no shrink
          simply grows to its text, and the header above wraps the pair onto
          their own line when the row runs out of space. */}
      <XStack height={38} py="$1" gap="$0.5" alignItems="center" flexShrink={0}>
        <Tooltip
          placement="top"
          renderTrigger={
            // eslint-disable-next-line props-checker/validator -- Tooltip injects the trigger handlers.
            <Button
              testID="stock-price-mode-share"
              height={30}
              m="$0"
              px="$2.5"
              borderWidth={0}
              flexShrink={0}
              textEllipsis
              size="small"
              variant={priceMode === 'share' ? 'secondary' : 'tertiary'}
              borderRadius="$full"
              onPress={() => onPriceModeChange('share')}
            >
              {intl.formatMessage({ id: ETranslations.market_share_price })}
            </Button>
          }
          renderContent={
            <SizableText size="$bodySm">
              {intl.formatMessage({
                id: ETranslations.market_toggle_share_price_tooltip,
              })}
            </SizableText>
          }
        />
        <Tooltip
          placement="top"
          renderTrigger={
            // eslint-disable-next-line props-checker/validator -- Tooltip injects the trigger handlers.
            <Button
              testID="stock-price-mode-token"
              height={30}
              m="$0"
              px="$2.5"
              borderWidth={0}
              flexShrink={0}
              textEllipsis
              size="small"
              variant={priceMode === 'token' ? 'secondary' : 'tertiary'}
              borderRadius="$full"
              onPress={() => onPriceModeChange('token')}
            >
              {intl.formatMessage({ id: ETranslations.market_token_price })}
            </Button>
          }
          renderContent={
            <SizableText size="$bodySm">
              {intl.formatMessage({
                id: ETranslations.market_toggle_token_price_tooltip,
              })}
            </SizableText>
          }
        />
      </XStack>
    </XStack>
  );
}

function StockChartModeControl({
  mode,
  onChange,
}: {
  mode: IMarketDetailChartDisplayMode;
  onChange: (mode: IMarketDetailChartDisplayMode) => void;
}) {
  const intl = useIntl();

  // Figma 26552:24685. The small button supplies the 18px leading icon $2
  // from its label, but its $2.5 padding only survives on `secondary`:
  // `tertiary` is hard-coded to $2 so it can sit inline like a link. The
  // design wants both states on the same box, so px is set here — without it
  // the pill jumps 2px per side as the selection moves.
  return (
    <XStack alignItems="center" gap="$0.5" flexShrink={0}>
      <Button
        testID="stock-chart-mode-simple"
        height={32}
        m="$0"
        px="$2.5"
        borderWidth={0}
        flexShrink={0}
        icon="TradingViewLineOutline"
        size="small"
        variant={mode === 'simple' ? 'secondary' : 'tertiary'}
        borderRadius="$full"
        onPress={() => onChange('simple')}
      >
        {intl.formatMessage({ id: ETranslations.market_chart_mode_simple })}
      </Button>
      <Button
        testID="stock-chart-mode-pro"
        height={32}
        m="$0"
        px="$2.5"
        borderWidth={0}
        flexShrink={0}
        icon="TradingViewCandlesOutline"
        size="small"
        variant={mode === 'pro' ? 'secondary' : 'tertiary'}
        borderRadius="$full"
        onPress={() => onChange('pro')}
      >
        {intl.formatMessage({ id: ETranslations.dexmarket_pro })}
      </Button>
    </XStack>
  );
}

export function StockChart({
  chartContainerTestID,
  fullscreenStyle,
  fullscreenZIndex,
  marketTradingView,
  priceMode,
  chartMode,
  isChartSwitchDisabled,
  onHoverChange,
  onChartSwitch,
  isChartFullscreen,
  onEnterChartFullscreen,
}: {
  chartContainerTestID: string;
  fullscreenStyle?: CSSProperties;
  fullscreenZIndex?: number;
  marketTradingView: ReactNode;
  priceMode: IMarketPriceSource;
  chartMode: ITradingViewChartMode;
  isChartSwitchDisabled?: boolean;
  onHoverChange: (point: IStockPriceLineChartHoverPoint | undefined) => void;
  onChartSwitch: () => void;
  isChartFullscreen: boolean;
  onEnterChartFullscreen: () => void;
}) {
  const intl = useIntl();
  const [{ mode }, setChartDisplayMode] =
    useMarketDetailChartDisplayModePersistAtom();
  const [range, setRange] = useState<IStockSimpleChartRange>('1D');
  const isSimpleMode = mode === 'simple';
  const chartRanges =
    priceMode === 'share'
      ? STOCK_SHARE_SIMPLE_CHART_RANGES
      : TOKEN_SIMPLE_CHART_RANGES;
  const rangeSelectorWidth =
    chartRanges.length * MARKET_SIMPLE_CHART_RANGE_MIN_WIDTH +
    (chartRanges.length - 1) * MARKET_SIMPLE_CHART_RANGE_GAP;
  const handleModeChange = (nextMode: IMarketDetailChartDisplayMode) => {
    setChartDisplayMode({ mode: nextMode });
  };

  // The toolbar goes to the container's footer, under the resize handle: the
  // handle's line has to sit on the chart's own clipping edge to read as the
  // cut it makes while dragging, so nothing of ours may live below it inside
  // the resizable box.
  const toolbar = isChartFullscreen ? undefined : (
    <XStack
      testID="stock-chart-toolbar"
      width="100%"
      height={MARKET_CHART_TOOLBAR_HEIGHT}
      py="$1"
      gap="$3"
      alignItems="center"
    >
      <XStack
        testID="stock-chart-range-selector"
        flex={1}
        minWidth={isSimpleMode ? rangeSelectorWidth : 0}
        alignItems="center"
        gap="$0.5"
      >
        {isSimpleMode
          ? chartRanges.map((item) => {
              return (
                <Stack
                  key={item}
                  minWidth={MARKET_SIMPLE_CHART_RANGE_MIN_WIDTH}
                  height={32}
                  flexShrink={0}
                >
                  <Button
                    testID={`stock-chart-range-${item}`}
                    minWidth={MARKET_SIMPLE_CHART_RANGE_MIN_WIDTH}
                    height={32}
                    m="$0"
                    px="$2"
                    borderWidth={0}
                    size="small"
                    variant={range === item ? 'secondary' : 'tertiary'}
                    borderRadius="$full"
                    onPress={() => setRange(item)}
                  >
                    {item === 'All'
                      ? intl.formatMessage({ id: ETranslations.global_all })
                      : item}
                  </Button>
                </Stack>
              );
            })
          : null}
      </XStack>
      <Stack testID="stock-chart-mode-control">
        <StockChartModeControl mode={mode} onChange={handleModeChange} />
      </Stack>
    </XStack>
  );

  return (
    // Figma 26459:25760 / 26459:25981: the chart owns the resizable block and
    // the toolbar sits under it. Pro keeps only the mode switch there —
    // TradingView carries its own interval row, so an app-side range selector
    // would be a second, disagreeing control.
    <MarketDesktopChartContainer
      testID={chartContainerTestID}
      isFullscreen={isChartFullscreen}
      fullscreenZIndex={fullscreenZIndex}
      fullscreenStyle={fullscreenStyle}
      footer={toolbar}
    >
      {/* Desktop keeps the draggable title bar clear of the fullscreen chart. */}
      {isChartFullscreen && platformEnv.isDesktop ? (
        <Stack height={48} bg="$bgApp" flexShrink={0} />
      ) : null}
      <YStack width="100%" flex={1} minHeight={0} position="relative">
        {isSimpleMode ? (
          <StockSimpleChart
            range={range}
            priceMode={priceMode}
            onHoverChange={onHoverChange}
          />
        ) : (
          <>
            <Stack flex={1} minWidth={0} overflow="hidden">
              {marketTradingView}
            </Stack>
            {isChartFullscreen ? null : (
              <MarketDetailProChartControls
                testID="stock-chart-mode-control-pro"
                top={MARKET_CHART_TOOLBAR_VERTICAL_INSET}
                fullscreenTestID="stock-chart-fullscreen-toggle"
                chartMode={chartMode}
                isChartSwitchDisabled={isChartSwitchDisabled}
                onChartSwitch={onChartSwitch}
                onEnterChartFullscreen={onEnterChartFullscreen}
              />
            )}
          </>
        )}
      </YStack>
    </MarketDesktopChartContainer>
  );
}

function StockOverviewGrid() {
  const intl = useIntl();
  const { tokenDetail } = useTokenDetail();
  const {
    stockDetail,
    isStockDetailLoading,
    isStockDetailError,
    retryStockDetail,
  } = useStockDetail();
  const stock = tokenDetail?.stock;
  const marketCap = stockDetail?.marketCap ?? stock?.marketCap;

  const items = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.dexmarket_market_cap }),
        tooltip: intl.formatMessage({
          id: ETranslations.market_stock_market_cap_tooltip,
        }),
        value: formatCurrencyStatValue(marketCap),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_dividend_yield,
        }),
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_stock_dividend_yield_desc,
        }),
        value: formatPercentValue(
          stockDetail?.dividendYieldTtm ??
            stock?.tradingActivity?.dividendYield,
        ),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_pe_ttm,
        }),
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_stock_pe_ttm_desc,
        }),
        value: formatRatioValue(
          stockDetail?.peRatio ?? stock?.tradingActivity?.peRatio,
        ),
      },
      {
        label: intl.formatMessage({ id: ETranslations.market_stock_eps }),
        tooltip: intl.formatMessage({
          id: ETranslations.market_stock_eps_tooltip,
        }),
        value: formatCurrencyStatValue(stockDetail?.epsTtm),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_24h_volume,
        }),
        tooltip: intl.formatMessage({
          id: ETranslations.market_stock_volume_tooltip,
        }),
        value: formatCurrencyStatValue(
          stockDetail?.volume24h ?? stock?.assetAnalysis?.volume24h,
        ),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_turnover_rate,
        }),
        tooltip: intl.formatMessage({
          id: ETranslations.market_stock_turnover_rate_tooltip,
        }),
        value: formatDirectPercentValue(
          stockDetail?.turnoverRate24h ?? stock?.assetAnalysis?.turnoverRate,
        ),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_52_week_high,
        }),
        tooltip: intl.formatMessage({
          id: ETranslations.market_stock_52_week_high_tooltip,
        }),
        value: formatCurrencyStatValue(
          stockDetail?.weekHigh52 ?? stock?.assetAnalysis?.weekHigh52,
        ),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_52_week_low,
        }),
        tooltip: intl.formatMessage({
          id: ETranslations.market_stock_52_week_low_tooltip,
        }),
        value: formatCurrencyStatValue(
          stockDetail?.weekLow52 ?? stock?.assetAnalysis?.weekLow52,
        ),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.market_stock_net_income_fy,
        }),
        tooltip: intl.formatMessage({
          id: ETranslations.market_stock_net_income_fy_tooltip,
        }),
        value: formatCurrencyStatValue(stockDetail?.netIncomeFy),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.market_stock_revenue_fy,
        }),
        tooltip: intl.formatMessage({
          id: ETranslations.market_stock_revenue_fy_tooltip,
        }),
        value: formatCurrencyStatValue(stockDetail?.revenueFy),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.market_stock_shares_float,
        }),
        tooltip: intl.formatMessage({
          id: ETranslations.market_stock_shares_float_tooltip,
        }),
        value: formatMarketCapValue(stockDetail?.sharesFloat),
      },
      {
        label: intl.formatMessage({ id: ETranslations.market_stock_beta_1y }),
        tooltip: intl.formatMessage({
          id: ETranslations.market_stock_beta_tooltip,
        }),
        value: formatRatioValue(stockDetail?.beta1y),
      },
    ],
    [intl, marketCap, stock, stockDetail],
  );

  if (isStockDetailError) {
    return (
      <YStack height={288} alignItems="center" justifyContent="center" gap="$2">
        <SizableText color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_unknown_error_retry_message,
          })}
        </SizableText>
        <Button
          testID="stock-detail-retry"
          size="small"
          variant="tertiary"
          onPress={() => void retryStockDetail()}
        >
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Button>
      </YStack>
    );
  }

  // Only the very first load shows skeletons; a refetch keeps the values that
  // are already on screen instead of blanking the whole grid.
  if (isStockDetailLoading && !stockDetail) {
    return (
      <XStack
        testID="stock-detail-stats-skeleton"
        height={288}
        flexWrap="wrap"
        rowGap="$6"
      >
        {items.map((item) => (
          <YStack
            key={item.label}
            width="33.33%"
            height={54}
            pr="$2.5"
            gap="$1.5"
          >
            <Skeleton width={88} height={16} />
            <Skeleton width={120} height={24} />
          </YStack>
        ))}
      </XStack>
    );
  }

  return (
    <XStack height={288} flexWrap="wrap" rowGap="$6">
      {items.map((item) => (
        <YStack
          key={item.label}
          width="33.33%"
          height={54}
          pr="$2.5"
          gap="$1.5"
        >
          <MarketTooltipLabel tooltip={item.tooltip}>
            {item.label}
          </MarketTooltipLabel>
          <SizableText size="$headingXl">{item.value}</SizableText>
        </YStack>
      ))}
    </XStack>
  );
}

function StockPosition({
  portfolioData,
  isRefreshing,
  hasAccount,
}: {
  portfolioData: IMarketAccountPortfolioDisplayItem[];
  isRefreshing: boolean;
  hasAccount: boolean;
}) {
  return (
    <Portfolio
      standalone
      hasAccount={hasAccount}
      portfolioData={portfolioData}
      isRefreshing={isRefreshing}
    />
  );
}

const STOCK_ANALYST_BAR_ROW_HEIGHT = 32;
// The track has to stay readable as a bar, so the distribution column claims a
// floor wide enough for label + track + percentage. Below that the row wraps
// and the column sits under the dial instead of being squeezed beside it.
const STOCK_ANALYST_BAR_MIN_WIDTH = 96;
const STOCK_ANALYST_DISTRIBUTION_MIN_WIDTH = 240;

function StockAnalystRatings() {
  const intl = useIntl();
  const { format } = useFormatDate();
  const { stockDetail, isStockDetailLoading } = useStockDetail();
  const ratings = stockDetail?.analystRatings;
  const isLoading = isStockDetailLoading && !stockDetail;
  // Parsed here rather than inside the gauge: the dial needs the counts for the
  // needle and the footer reports the same total.
  const ratingCounts = useMemo(
    () => parseStockAnalystRatingCounts(stockDetail?.underlyingMeta),
    [stockDetail?.underlyingMeta],
  );
  const lastUpdatedText = ratings?.updatedAt
    ? format(ratings.updatedAt, 'MMM d, yyyy')
    : STAT_FALLBACK_VALUE;
  const lastUpdatedLabel = intl.formatMessage({
    id: ETranslations.market_last_updated,
  });
  const footerText =
    ratingCounts.total > 0
      ? intl.formatMessage(
          { id: ETranslations.market_analyst_footer },
          {
            total: ratingCounts.total,
            label: lastUpdatedLabel,
            time: lastUpdatedText,
          },
        )
      : `${lastUpdatedLabel}: ${lastUpdatedText}`;

  return (
    <YStack
      testID="stock-detail-analyst-ratings"
      minHeight={216}
      px={STOCK_DETAIL_HORIZONTAL_GUTTER}
      py="$8"
      gap="$4"
    >
      <SizableText size="$headingXl">
        {intl.formatMessage({ id: ETranslations.market_stock_analyst_ratings })}
      </SizableText>
      {isLoading ? (
        <XStack
          testID="stock-detail-analyst-ratings-skeleton"
          flexWrap="wrap"
          gap="$8"
          alignItems="center"
          // Only bites once the row wraps: until then the distribution column
          // grows into the leftover space and there is nothing to centre.
          justifyContent="center"
          py="$2"
        >
          <Skeleton
            width={STOCK_ANALYST_GAUGE_WIDTH}
            height={STOCK_ANALYST_GAUGE_HEIGHT}
          />
          {/* Three 24px bars with 12px gaps add up to the 96px the loaded
          bars occupy, so the section does not jump when data lands. */}
          <YStack
            flex={1}
            minWidth={STOCK_ANALYST_DISTRIBUTION_MIN_WIDTH}
            gap="$3"
          >
            <Skeleton width="100%" height={24} />
            <Skeleton width="100%" height={24} />
            <Skeleton width="100%" height={24} />
          </YStack>
        </XStack>
      ) : (
        <XStack
          flexWrap="wrap"
          gap="$8"
          alignItems="center"
          justifyContent="center"
          py="$2"
          pr="$2"
        >
          <StockAnalystGauge ratings={ratings} ratingCounts={ratingCounts} />
          <YStack
            flex={1}
            minWidth={STOCK_ANALYST_DISTRIBUTION_MIN_WIDTH}
            justifyContent="center"
          >
            {[
              {
                key: 'buy',
                label: intl.formatMessage({ id: ETranslations.global_buy }),
                value: ratings?.buy,
                barColor: '$bgSuccessStrong',
              },
              {
                key: 'hold',
                label: intl.formatMessage({
                  id: ETranslations.market_stock_rating_hold,
                }),
                value: ratings?.hold,
                barColor: '$neutral8',
              },
              {
                key: 'sell',
                label: intl.formatMessage({ id: ETranslations.global_sell }),
                value: ratings?.sell,
                barColor: '$bgCriticalStrong',
              },
            ].map((item) => {
              const barWidth = Math.min(
                100,
                Math.max(0, Number(item.value) || 0),
              );
              return (
                <XStack
                  key={item.key}
                  height={STOCK_ANALYST_BAR_ROW_HEIGHT}
                  alignItems="center"
                  gap="$3"
                >
                  <SizableText
                    size="$bodyMdMedium"
                    minWidth={32}
                    flexShrink={0}
                  >
                    {item.label}
                  </SizableText>
                  <Stack
                    flex={1}
                    minWidth={STOCK_ANALYST_BAR_MIN_WIDTH}
                    height={4}
                    borderRadius="$full"
                    bg="$neutral5"
                    overflow="hidden"
                  >
                    <Stack
                      testID={`stock-analyst-${item.key}-bar`}
                      width={`${barWidth}%`}
                      height="100%"
                      borderRadius="$full"
                      bg={item.barColor}
                    />
                  </Stack>
                  <SizableText
                    testID={`stock-analyst-${item.key}`}
                    size="$bodyMdMedium"
                    minWidth={48}
                    textAlign="right"
                    color="$textSubdued"
                    flexShrink={0}
                    numberOfLines={1}
                  >
                    {formatDirectPercentValue(item.value)}
                  </SizableText>
                </XStack>
              );
            })}
          </YStack>
        </XStack>
      )}
      <SizableText size="$bodySm" color="$textDisabled">
        {footerText}
      </SizableText>
    </YStack>
  );
}

// react-native-web does not fire `onTextLayout` reliably, so the toggle is
// gated on a character count that approximates two lines at this section width
// instead of measuring the rendered text. Wider glyphs (CJK) can exceed the
// approximation, so the clamp is only applied when the toggle is offered —
// short-but-wide text renders unclamped rather than being cut with no way to
// expand it.
const STOCK_ABOUT_DESCRIPTION_COLLAPSED_LENGTH = 200;

function StockAbout() {
  const intl = useIntl();
  const { formatDate } = useFormatDate();
  const { tokenDetail } = useTokenDetail();
  const { stockDetail, stockId } = useStockDetail();
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const stock = tokenDetail?.stock;
  const ticker =
    stockDetail?.symbol ||
    stock?.underlyingAssetTicker ||
    stock?.title ||
    tokenDetail?.symbol ||
    stockId;
  const about = stockDetail?.about ?? stock?.about;
  const employeeCount = Number(about?.employees);
  const formattedEmployees = Number.isFinite(employeeCount)
    ? intl.formatNumber(employeeCount)
    : STAT_FALLBACK_VALUE;
  const description =
    about?.description ??
    stockDetail?.introduction ??
    intl.formatMessage({ id: ETranslations.market_stock_about_unavailable });
  const canExpandDescription =
    description.length > STOCK_ABOUT_DESCRIPTION_COLLAPSED_LENGTH;

  return (
    <YStack
      testID="stock-detail-about"
      px={STOCK_DETAIL_HORIZONTAL_GUTTER}
      pb="$3"
    >
      <YStack py="$8" gap="$6">
        <SizableText size="$headingXl">
          {intl.formatMessage(
            { id: ETranslations.market_about_title },
            { ticker },
          )}
        </SizableText>
        <XStack height={46}>
          <YStack flex={1} pr="$2.5" gap="$1.5">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.market_stock_about_ceo,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium">
              {about?.ceo || STAT_FALLBACK_VALUE}
            </SizableText>
          </YStack>
          <YStack flex={1} pr="$2.5" gap="$1.5">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.market_stock_about_employees,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium">{formattedEmployees}</SizableText>
          </YStack>
          <YStack flex={1} pr="$2.5" gap="$1.5">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.exchange__title })}
            </SizableText>
            <SizableText size="$bodyMdMedium">
              {about?.exchange || STAT_FALLBACK_VALUE}
            </SizableText>
          </YStack>
          <YStack flex={1} pr="$2.5" gap="$1.5">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.market_stock_about_ipo_date,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium">
              {about?.ipoDate
                ? formatDate(about.ipoDate, { hideTimeForever: true })
                : STAT_FALLBACK_VALUE}
            </SizableText>
          </YStack>
        </XStack>
        <YStack gap="$2" alignItems="flex-start">
          <SizableText
            testID="stock-about-description"
            size="$bodyMd"
            color="$textSubdued"
            numberOfLines={
              canExpandDescription && !isDescriptionExpanded ? 2 : undefined
            }
          >
            {description}
          </SizableText>
          {canExpandDescription ? (
            <Button
              testID="stock-about-description-toggle"
              size="small"
              variant="tertiary"
              alignSelf="flex-start"
              onPress={() => setIsDescriptionExpanded((value) => !value)}
            >
              {intl.formatMessage({
                id: isDescriptionExpanded
                  ? ETranslations.global_show_less
                  : ETranslations.global_show_more,
              })}
            </Button>
          ) : null}
        </YStack>
      </YStack>
    </YStack>
  );
}

function StockOverview({
  portfolioData,
  isRefreshing,
  hasAccount,
}: {
  portfolioData: IMarketAccountPortfolioDisplayItem[];
  isRefreshing: boolean;
  hasAccount: boolean;
}) {
  const intl = useIntl();
  const [activeTab, setActiveTab] = useState<IStockDetailTab>('overview');
  const { stockId } = useStockDetail();

  return (
    <YStack>
      <XStack
        height={44}
        px={STOCK_DETAIL_HORIZONTAL_GUTTER}
        gap="$6"
        alignItems="center"
      >
        <Button
          testID="stock-detail-tab-overview"
          size="medium"
          variant="tertiary"
          color={activeTab === 'overview' ? '$text' : '$textSubdued'}
          bg="$transparent"
          hoverStyle={{ bg: '$transparent' }}
          pressStyle={{ bg: '$transparent' }}
          borderRadius={0}
          borderBottomWidth={activeTab === 'overview' ? 2 : 0}
          borderBottomColor="$borderActive"
          height={44}
          m="$0"
          px="$0"
          onPress={() => setActiveTab('overview')}
        >
          {intl.formatMessage({ id: ETranslations.global_overview })}
        </Button>
        <Button
          testID="stock-detail-tab-position"
          size="medium"
          variant="tertiary"
          color={activeTab === 'position' ? '$text' : '$textSubdued'}
          bg="$transparent"
          hoverStyle={{ bg: '$transparent' }}
          pressStyle={{ bg: '$transparent' }}
          borderRadius={0}
          borderBottomWidth={activeTab === 'position' ? 2 : 0}
          borderBottomColor="$borderActive"
          height={44}
          m="$0"
          px="$0"
          onPress={() => setActiveTab('position')}
        >
          {intl.formatMessage({
            id: ETranslations.dexmarket_details_myposition,
          })}
        </Button>
      </XStack>
      {activeTab === 'overview' ? (
        <>
          <YStack minHeight={344} px={STOCK_DETAIL_HORIZONTAL_GUTTER} pt="$2">
            <YStack minHeight={336} py="$6">
              <StockOverviewGrid />
            </YStack>
          </YStack>
          <StockEventsSection />
          <StockAnalystRatings />
          {stockId ? <StockFinancials stockId={stockId} /> : null}
          <StockNewsSection />
          <StockAbout />
        </>
      ) : (
        // Portfolio brings its own horizontal padding and sizes to its rows, so
        // it is mounted bare: an outer gutter would double-indent the table and
        // a min-height would strand the section header above dead space.
        <StockPosition
          portfolioData={portfolioData}
          isRefreshing={isRefreshing}
          hasAccount={hasAccount}
        />
      )}
    </YStack>
  );
}

export function StockDesktopLayout({
  marketTradingView,
  swapToken,
  chartMode,
  isChartSwitchDisabled,
  disableTrade,
  showFavoriteButton,
  isChartFullscreen,
  chartFullscreenZIndex,
  onChartSwitch,
  onEnterChartFullscreen,
}: {
  marketTradingView: ReactNode;
  swapToken: ISwapToken;
  chartMode: ITradingViewChartMode;
  isChartSwitchDisabled?: boolean;
  disableTrade?: boolean;
  showFavoriteButton: boolean;
  isChartFullscreen: boolean;
  chartFullscreenZIndex: number;
  onChartSwitch: () => void;
  // Pro renders the source and expand controls itself, because the widget's
  // control row hands its trailing slots to this page's stable overlay.
  onEnterChartFullscreen: () => void;
}) {
  const {
    portfolioData: stockPortfolioData,
    resolvedVariantKeys: resolvedStockVariantKeys,
    isRefreshing: isStockPortfolioRefreshing,
    hasAccount: hasStockPortfolioAccount,
  } = useStockPortfolioData();
  const { priceMode, handlePriceModeChange } = useStockPriceSource();
  // Lives here rather than inside the chart so the price header above it can
  // follow the crosshair; the chart clears it on pointer-out and on unmount.
  const [chartHoverPoint, setChartHoverPoint] = useState<
    IStockPriceLineChartHoverPoint | undefined
  >(undefined);

  return (
    <Stack
      testID="stock-token-detail-desktop"
      {...MARKET_DESKTOP_CONTENT_FRAME_PROPS}
      py="$5"
    >
      <StockPageHeader showFavoriteButton={showFavoriteButton} />
      <XStack
        testID="stock-token-detail-columns"
        width="100%"
        alignItems="flex-start"
        gap={STOCK_DETAIL_COLUMN_GAP}
      >
        <YStack testID="stock-token-detail-main" flex={1} minWidth={0}>
          <YStack
            testID="stock-token-detail-chart"
            width="100%"
            minHeight={600}
            px={STOCK_DETAIL_HORIZONTAL_GUTTER}
            pt="$5"
            pb="$8"
            gap="$4"
          >
            <StockPriceHeader
              priceMode={priceMode}
              onPriceModeChange={handlePriceModeChange}
              hoverPoint={chartHoverPoint}
            />
            <StockChart
              chartContainerTestID="stock-token-detail-tradingview"
              fullscreenZIndex={chartFullscreenZIndex}
              fullscreenStyle={{
                position: 'fixed',
                left: 0,
                top: 0,
                right: 0,
                bottom: platformEnv.isWeb ? 40 : 0,
              }}
              marketTradingView={marketTradingView}
              priceMode={priceMode}
              chartMode={chartMode}
              isChartSwitchDisabled={isChartSwitchDisabled}
              onHoverChange={setChartHoverPoint}
              onChartSwitch={onChartSwitch}
              isChartFullscreen={isChartFullscreen}
              onEnterChartFullscreen={onEnterChartFullscreen}
            />
          </YStack>
          {/* The tab owns the whole lower region: Overview carries the stat
              grid and the editorial sections, My position replaces all of
              them. */}
          <StockOverview
            portfolioData={stockPortfolioData}
            isRefreshing={isStockPortfolioRefreshing}
            hasAccount={hasStockPortfolioAccount}
          />
        </YStack>

        <Stack
          testID="stock-token-detail-trade"
          width={STOCK_DETAIL_TRADE_PANEL_WIDTH}
          pt="$6"
          px={STOCK_DETAIL_HORIZONTAL_GUTTER}
          flexShrink={0}
        >
          <SwapPanel
            swapToken={swapToken}
            disableTrade={disableTrade}
            portfolioData={stockPortfolioData}
            resolvedVariantKeys={resolvedStockVariantKeys}
            stockDetailDesktopLayout
          />
        </Stack>
      </XStack>
    </Stack>
  );
}
