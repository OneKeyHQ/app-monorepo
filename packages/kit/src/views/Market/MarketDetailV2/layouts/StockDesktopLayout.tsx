import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { MarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import { PriceChangePercentage } from '@onekeyhq/kit/src/views/Market/components/PriceChangePercentage';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import type {
  IMarketAccountPortfolioItem,
  IMarketStockInfo,
} from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { MarketStarV2 } from '../../components/MarketStarV2';
import { StockMarketStatusBadge } from '../../components/PerpsBadges';
import {
  type IStockSimpleChartRange,
  StockSimpleChart,
} from '../components/StockSimpleChart';
import { SwapPanel } from '../components/SwapPanel/SwapPanel';
import { ShareButton } from '../components/TokenDetailHeader/ShareButton';
import { MarketTokenSelector } from '../components/TokenSelector/MarketTokenSelector';
import { useStockDetail } from '../hooks/StockDetailContext';
import { useTokenDetail } from '../hooks/useTokenDetail';
import {
  STAT_FALLBACK_VALUE,
  formatCurrencyStatValue,
  formatMarketCapValue,
  formatPercentValue,
  formatRatioValue,
} from '../utils/statValue';
import {
  STOCK_ABOUT_IPO_DATE_LABEL,
  formatDirectPercentValue,
  getStockAnalystConsensus,
} from '../utils/stockPublicDataUtils';

import { StockEventsSection } from './components/StockEventsSection';
import { StockNewsSection } from './components/StockNewsSection';
import {
  STOCK_DETAIL_COLUMN_GAP,
  STOCK_DETAIL_CONTENT_OFFSET,
  STOCK_DETAIL_CONTENT_WIDTH,
  STOCK_DETAIL_HORIZONTAL_GUTTER,
  STOCK_DETAIL_MAIN_WIDTH,
  STOCK_DETAIL_TRADE_PANEL_WIDTH,
} from './stockDesktopLayoutConstants';

type IStockDetailTab = 'overview' | 'position';
type IStockPriceMode = 'share' | 'token';
type IStockChartMode = 'simple' | 'pro';

const STOCK_SIMPLE_CHART_RANGES: IStockSimpleChartRange[] = [
  '1H',
  '1D',
  '1W',
  '1M',
  '1Y',
  'All',
];

const STOCK_SIMPLE_CHART_RANGE_WIDTHS: Record<IStockSimpleChartRange, number> =
  {
    '1H': 33,
    '1D': 33,
    '1W': 37,
    '1M': 35,
    '1Y': 32,
    All: 34,
  };

function StockPageHeader({
  showFavoriteButton,
}: {
  showFavoriteButton: boolean;
}) {
  const { tokenDetail, networkId, isNative } = useTokenDetail();
  const { stockDetail, stockId } = useStockDetail();
  const stock = tokenDetail?.stock;

  return (
    <XStack
      testID="stock-token-detail-header"
      width={STOCK_DETAIL_CONTENT_WIDTH}
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
            borderRadius="$3"
            hoverStyle={{ opacity: 0.8 }}
            pressStyle={{ opacity: 0.6 }}
          >
            <Token
              size="xl"
              tokenImageUri={
                stockDetail?.logoUrl ||
                tokenDetail?.logoUrl ||
                stock?.sourceLogoUri
              }
              fallbackIcon="CryptoCoinOutline"
            />
            <YStack minWidth={0} justifyContent="center">
              <XStack alignItems="center" gap="$1.5">
                <SizableText size="$headingXl" numberOfLines={1}>
                  {stockDetail?.symbol ||
                    stock?.underlyingAssetTicker ||
                    stock?.title ||
                    tokenDetail?.symbol ||
                    stockId ||
                    ''}
                </SizableText>
                <Icon
                  name="ChevronDownSmallOutline"
                  size="$4"
                  color="$iconSubdued"
                />
              </XStack>
              <SizableText
                size="$bodyMdMedium"
                color="$textSubdued"
                numberOfLines={1}
              >
                {stockDetail?.name ||
                  stock?.subtitle ||
                  tokenDetail?.name ||
                  ''}
              </SizableText>
            </YStack>
          </XStack>
        }
      />

      {networkId ? (
        <XStack alignItems="center" gap="$4">
          {showFavoriteButton ? (
            <MarketStarV2
              chainId={networkId}
              contractAddress={tokenDetail?.address ?? ''}
              size="small"
              customIconSize="$5"
              from={EWatchlistFrom.Detail}
              tokenSymbol={tokenDetail?.symbol ?? ''}
              isNative={isNative}
            />
          ) : null}
          <ShareButton
            networkId={networkId}
            address={tokenDetail?.address ?? ''}
            isNative={isNative}
            useIconButton
            size="small"
          />
        </XStack>
      ) : null}
    </XStack>
  );
}

function StockPriceHeader({
  priceMode,
  onPriceModeChange,
}: {
  priceMode: IStockPriceMode;
  onPriceModeChange: (mode: IStockPriceMode) => void;
}) {
  const { tokenDetail } = useTokenDetail();
  const { stockDetail, stockId } = useStockDetail();
  const isSharePrice = priceMode === 'share';
  const price = isSharePrice ? stockDetail?.price : tokenDetail?.price;
  const priceChange = isSharePrice
    ? stockDetail?.priceChange24hPercent
    : tokenDetail?.priceChange24hPercent;
  const stockStatus = useMemo<IMarketStockInfo | undefined>(() => {
    if (!stockDetail) return tokenDetail?.stock;
    return {
      subtitle: stockDetail.name,
      sourceLogoUri: stockDetail.logoUrl,
      isOpen: stockDetail.marketStatus?.isOpen,
      description:
        stockDetail.marketStatus?.reason ??
        stockDetail.marketStatus?.session ??
        undefined,
    };
  }, [stockDetail, tokenDetail?.stock]);

  return (
    <XStack
      height={68}
      alignItems="flex-start"
      justifyContent="space-between"
      gap="$2"
    >
      <YStack flex={1} gap="$2">
        <XStack alignItems="baseline" gap="$3.5">
          <MarketTokenPrice
            size="$heading4xl"
            price={price ?? '--'}
            tokenName={stockDetail?.name ?? tokenDetail?.name ?? ''}
            tokenSymbol={
              stockDetail?.symbol ?? tokenDetail?.symbol ?? stockId ?? ''
            }
            lastUpdated={
              isSharePrice
                ? stockDetail?.quoteUpdatedAt
                : tokenDetail?.lastUpdated?.toString()
            }
          />
          <PriceChangePercentage size="$bodyLgMedium">
            {priceChange ?? '--'}
          </PriceChangePercentage>
        </XStack>
        <StockMarketStatusBadge stock={stockStatus} variant="inline" />
      </YStack>

      <XStack
        mt="$1"
        width={191}
        height={38}
        py="$1"
        gap="$0.5"
        alignItems="center"
      >
        <Button
          testID="stock-price-mode-share"
          width={94}
          minWidth={94}
          height={30}
          m="$0"
          px="$2.5"
          borderWidth={0}
          textEllipsis
          size="small"
          variant={priceMode === 'share' ? 'secondary' : 'tertiary'}
          borderRadius="$full"
          onPress={() => onPriceModeChange('share')}
        >
          Share Price
        </Button>
        <Button
          testID="stock-price-mode-token"
          width={95}
          minWidth={95}
          height={30}
          m="$0"
          px="$2.5"
          borderWidth={0}
          textEllipsis
          size="small"
          variant={priceMode === 'token' ? 'secondary' : 'tertiary'}
          borderRadius="$full"
          onPress={() => onPriceModeChange('token')}
        >
          Token Price
        </Button>
      </XStack>
    </XStack>
  );
}

function StockChartModeControl({
  mode,
  onChange,
}: {
  mode: IStockChartMode;
  onChange: (mode: IStockChartMode) => void;
}) {
  return (
    <XStack height={32} alignItems="center" gap="$3">
      <Button
        testID="stock-chart-mode-simple"
        width={62}
        minWidth={62}
        height={32}
        m="$0"
        px="$2"
        borderWidth={0}
        size="small"
        variant={mode === 'simple' ? 'secondary' : 'tertiary'}
        borderRadius="$full"
        onPress={() => onChange('simple')}
      >
        Simple
      </Button>
      <Button
        testID="stock-chart-mode-pro"
        width={40}
        minWidth={40}
        height={32}
        m="$0"
        px="$2"
        borderWidth={0}
        size="small"
        variant={mode === 'pro' ? 'secondary' : 'tertiary'}
        borderRadius="$full"
        onPress={() => onChange('pro')}
      >
        Pro
      </Button>
    </XStack>
  );
}

function StockChart({ marketTradingView }: { marketTradingView: ReactNode }) {
  const [mode, setMode] = useState<IStockChartMode>('simple');
  const [range, setRange] = useState<IStockSimpleChartRange>('1D');

  if (mode === 'pro') {
    return (
      <Stack width="100%" height={360} position="relative" overflow="hidden">
        {marketTradingView}
        <XStack
          testID="stock-chart-mode-control-pro"
          position="absolute"
          top={4}
          right={190}
          zIndex={10}
          height={32}
          width={114}
          bg="$bgApp"
          alignItems="center"
        >
          <StockChartModeControl mode={mode} onChange={setMode} />
        </XStack>
      </Stack>
    );
  }

  return (
    <YStack width="100%" height={360} gap="$4">
      <XStack
        width="100%"
        height={40}
        py="$1"
        alignItems="center"
        justifyContent="space-between"
      >
        <XStack width={214} alignItems="center" gap="$0.5">
          {STOCK_SIMPLE_CHART_RANGES.map((item) => {
            const itemWidth = STOCK_SIMPLE_CHART_RANGE_WIDTHS[item];
            return (
              <Stack
                key={item}
                width={itemWidth}
                minWidth={itemWidth}
                height={32}
                flexShrink={0}
              >
                <Button
                  testID={`stock-chart-range-${item}`}
                  width="100%"
                  minWidth={itemWidth}
                  height={32}
                  m="$0"
                  px="$2"
                  borderWidth={0}
                  size="small"
                  variant={range === item ? 'secondary' : 'tertiary'}
                  borderRadius="$full"
                  onPress={() => setRange(item)}
                >
                  {item}
                </Button>
              </Stack>
            );
          })}
        </XStack>
        <StockChartModeControl mode={mode} onChange={setMode} />
      </XStack>
      <StockSimpleChart range={range} />
    </YStack>
  );
}

function StockOverviewGrid() {
  const intl = useIntl();
  const { tokenDetail } = useTokenDetail();
  const { stockDetail, isStockDetailError, retryStockDetail } =
    useStockDetail();
  const stock = tokenDetail?.stock;
  const marketCap = stockDetail?.marketCap ?? stock?.marketCap;
  const dividendPerShare =
    stockDetail?.dividendPerShareTtm ?? stock?.dividendPerShare;

  const items = useMemo(
    () =>
      [
        {
          label: intl.formatMessage({ id: ETranslations.dexmarket_market_cap }),
          value: formatCurrencyStatValue(marketCap),
        },
        {
          label: intl.formatMessage({
            id: ETranslations.dexmarket_stock_dividend_yield,
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
          value: formatRatioValue(
            stockDetail?.peRatio ?? stock?.tradingActivity?.peRatio,
          ),
        },
        {
          label: 'Dividend per share',
          value: formatCurrencyStatValue(dividendPerShare),
        },
        {
          label: 'EPS TTM',
          value: stockDetail?.epsTtm
            ? formatCurrencyStatValue(stockDetail.epsTtm)
            : STAT_FALLBACK_VALUE,
        },
        {
          label: intl.formatMessage({
            id: ETranslations.dexmarket_stock_24h_volume,
          }),
          value: formatCurrencyStatValue(
            stockDetail?.volume24h ?? stock?.assetAnalysis?.volume24h,
          ),
        },
        {
          label: intl.formatMessage({
            id: ETranslations.dexmarket_stock_turnover_rate,
          }),
          value: formatDirectPercentValue(
            stockDetail?.turnoverRate24h ?? stock?.assetAnalysis?.turnoverRate,
          ),
        },
        {
          label: intl.formatMessage({
            id: ETranslations.dexmarket_stock_52_week_high,
          }),
          value: formatCurrencyStatValue(
            stockDetail?.weekHigh52 ?? stock?.assetAnalysis?.weekHigh52,
          ),
        },
        {
          label: intl.formatMessage({
            id: ETranslations.dexmarket_stock_52_week_low,
          }),
          value: formatCurrencyStatValue(
            stockDetail?.weekLow52 ?? stock?.assetAnalysis?.weekLow52,
          ),
        },
        {
          label: 'Shares outstanding',
          value: formatMarketCapValue(
            stockDetail?.sharesOutstanding ?? stock?.sharesOutstanding,
          ),
        },
        {
          label: intl.formatMessage({ id: ETranslations.dexmarket_stock_pb }),
          value: formatRatioValue(
            stockDetail?.pbRatio ?? stock?.tradingActivity?.pbRatio,
          ),
        },
        {
          label: intl.formatMessage({ id: ETranslations.dexmarket_stock_ps }),
          value: formatRatioValue(
            stockDetail?.psRatio ?? stock?.tradingActivity?.psRatio,
          ),
        },
      ].filter((item): item is { label: string; value: string } =>
        Boolean(item),
      ),
    [dividendPerShare, intl, marketCap, stock, stockDetail],
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
          <SizableText size="$bodyMd" color="$textSubdued">
            {item.label}
          </SizableText>
          <SizableText size="$headingXl">{item.value}</SizableText>
        </YStack>
      ))}
    </XStack>
  );
}

function StockPosition({
  portfolioData,
}: {
  portfolioData: IMarketAccountPortfolioItem[];
}) {
  const position = portfolioData[0];

  if (!position) {
    return (
      <YStack py="$12" alignItems="center" gap="$2">
        <Icon name="WalletOutline" size="$8" color="$iconSubdued" />
        <SizableText color="$textSubdued">No position yet</SizableText>
      </YStack>
    );
  }

  return (
    <XStack gap="$8" py="$2">
      <YStack gap="$1">
        <SizableText size="$bodySm" color="$textSubdued">
          Amount
        </SizableText>
        <SizableText size="$headingMd">
          {position.amount} {position.symbol}
        </SizableText>
      </YStack>
      <YStack gap="$1">
        <SizableText size="$bodySm" color="$textSubdued">
          Value
        </SizableText>
        <SizableText size="$headingMd">
          {formatCurrencyStatValue(position.totalPrice)}
        </SizableText>
      </YStack>
    </XStack>
  );
}

function StockOverview({
  portfolioData,
}: {
  portfolioData: IMarketAccountPortfolioItem[];
}) {
  const intl = useIntl();
  const [activeTab, setActiveTab] = useState<IStockDetailTab>('overview');

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
      <YStack height={344} px={STOCK_DETAIL_HORIZONTAL_GUTTER} pt="$2">
        <YStack height={336} py="$6">
          {activeTab === 'overview' ? (
            <StockOverviewGrid />
          ) : (
            <StockPosition portfolioData={portfolioData} />
          )}
        </YStack>
      </YStack>
    </YStack>
  );
}

function StockAnalystRatings() {
  const { format } = useFormatDate();
  const { stockDetail } = useStockDetail();
  const ratings = stockDetail?.analystRatings;
  let consensusColor: '$textSuccess' | '$textCritical' | '$textSubdued' =
    '$textSubdued';
  if (ratings?.consensus === 'Buy') {
    consensusColor = '$textSuccess';
  } else if (ratings?.consensus === 'Sell') {
    consensusColor = '$textCritical';
  }

  return (
    <YStack
      testID="stock-detail-analyst-ratings"
      minHeight={216}
      px={STOCK_DETAIL_HORIZONTAL_GUTTER}
      py="$6"
      gap="$5"
    >
      <SizableText size="$headingXl">Analyst ratings</SizableText>
      <XStack gap="$5" alignItems="center">
        <YStack
          width={88}
          height={88}
          borderRadius="$full"
          alignItems="center"
          justifyContent="center"
          bg={ratings ? '$bgSuccessSubdued' : '$bgSubdued'}
          gap="$1"
        >
          <SizableText
            testID="stock-analyst-consensus"
            size="$bodyMdMedium"
            color={consensusColor}
          >
            {getStockAnalystConsensus(ratings)}
          </SizableText>
          {ratings ? (
            <SizableText size="$bodyXs" color="$textSubdued">
              Consensus
            </SizableText>
          ) : null}
        </YStack>
        <YStack flex={1} gap="$3">
          {[
            {
              label: 'Buy',
              value: ratings?.buy,
              barColor: '$bgSuccessStrong',
            },
            {
              label: 'Hold',
              value: ratings?.hold,
              barColor: '$neutral8',
            },
            {
              label: 'Sell',
              value: ratings?.sell,
              barColor: '$bgCriticalStrong',
            },
          ].map((item) => {
            const barWidth = Math.min(
              100,
              Math.max(0, Number(item.value) || 0),
            );
            return (
              <XStack key={item.label} height={18} alignItems="center" gap="$3">
                <SizableText size="$bodySm" width={30}>
                  {item.label}
                </SizableText>
                <Stack
                  flex={1}
                  height={4}
                  borderRadius="$full"
                  bg="$neutral5"
                  overflow="hidden"
                >
                  <Stack
                    testID={`stock-analyst-${item.label.toLowerCase()}-bar`}
                    width={`${barWidth}%`}
                    height="100%"
                    borderRadius="$full"
                    bg={item.barColor}
                  />
                </Stack>
                <SizableText
                  testID={`stock-analyst-${item.label.toLowerCase()}`}
                  size="$bodyMd"
                  width={56}
                  textAlign="right"
                  color="$textSubdued"
                >
                  {formatDirectPercentValue(item.value)}
                </SizableText>
              </XStack>
            );
          })}
        </YStack>
      </XStack>
      <SizableText size="$bodyXs" color="$textDisabled">
        Last Updated:{' '}
        {ratings?.updatedAt
          ? format(ratings.updatedAt, 'MMM d, yyyy')
          : STAT_FALLBACK_VALUE}
      </SizableText>
    </YStack>
  );
}

function StockAbout() {
  const { formatDate } = useFormatDate();
  const { tokenDetail } = useTokenDetail();
  const { stockDetail, stockId } = useStockDetail();
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
    ? employeeCount.toLocaleString('en-US')
    : STAT_FALLBACK_VALUE;

  return (
    <YStack
      testID="stock-detail-about"
      height={238}
      px={STOCK_DETAIL_HORIZONTAL_GUTTER}
      pb="$3"
    >
      <YStack height={226} py="$8" gap="$6">
        <SizableText size="$headingXl">About {ticker}</SizableText>
        <XStack height={46}>
          <YStack flex={1} pr="$2.5" gap="$1.5">
            <SizableText size="$bodyMd" color="$textSubdued">
              CEO
            </SizableText>
            <SizableText size="$bodyMdMedium">
              {about?.ceo || STAT_FALLBACK_VALUE}
            </SizableText>
          </YStack>
          <YStack flex={1} pr="$2.5" gap="$1.5">
            <SizableText size="$bodyMd" color="$textSubdued">
              Employees
            </SizableText>
            <SizableText size="$bodyMdMedium">{formattedEmployees}</SizableText>
          </YStack>
          <YStack flex={1} pr="$2.5" gap="$1.5">
            <SizableText size="$bodyMd" color="$textSubdued">
              Exchange
            </SizableText>
            <SizableText size="$bodyMdMedium">
              {about?.exchange || STAT_FALLBACK_VALUE}
            </SizableText>
          </YStack>
          <YStack flex={1} pr="$2.5" gap="$1.5">
            <SizableText size="$bodyMd" color="$textSubdued">
              {STOCK_ABOUT_IPO_DATE_LABEL}
            </SizableText>
            <SizableText size="$bodyMdMedium">
              {about?.ipoDate
                ? formatDate(about.ipoDate, { hideTimeForever: true })
                : STAT_FALLBACK_VALUE}
            </SizableText>
          </YStack>
        </XStack>
        <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={2}>
          {about?.description ??
            stockDetail?.introduction ??
            'Company information is not available.'}
        </SizableText>
      </YStack>
    </YStack>
  );
}

export function StockDesktopLayout({
  marketTradingView,
  swapToken,
  portfolioData,
  showFavoriteButton,
}: {
  marketTradingView: ReactNode;
  swapToken: ISwapToken;
  portfolioData: IMarketAccountPortfolioItem[];
  showFavoriteButton: boolean;
}) {
  const [priceMode, setPriceMode] = useState<IStockPriceMode>('share');

  return (
    <Stack
      testID="stock-token-detail-desktop"
      width="100%"
      minHeight={2241}
      pl={STOCK_DETAIL_CONTENT_OFFSET}
      py="$5"
    >
      <StockPageHeader showFavoriteButton={showFavoriteButton} />
      <XStack
        testID="stock-token-detail-columns"
        width={STOCK_DETAIL_CONTENT_WIDTH}
        minHeight={2129}
        alignItems="flex-start"
        gap={STOCK_DETAIL_COLUMN_GAP}
      >
        <YStack
          testID="stock-token-detail-main"
          width={STOCK_DETAIL_MAIN_WIDTH}
          minHeight={2129}
          minWidth={0}
        >
          <YStack
            testID="stock-token-detail-chart"
            width="100%"
            height={504}
            px={STOCK_DETAIL_HORIZONTAL_GUTTER}
            pt="$5"
            pb="$8"
            gap="$6"
          >
            <StockPriceHeader
              priceMode={priceMode}
              onPriceModeChange={setPriceMode}
            />
            <Stack
              testID="stock-token-detail-tradingview"
              width="100%"
              height={360}
              overflow="hidden"
              bg="$bgApp"
            >
              <StockChart marketTradingView={marketTradingView} />
            </Stack>
          </YStack>
          <StockOverview portfolioData={portfolioData} />
          <StockEventsSection />
          <StockAnalystRatings />
          <StockNewsSection />
          <StockAbout />
        </YStack>

        <Stack
          testID="stock-token-detail-trade"
          width={STOCK_DETAIL_TRADE_PANEL_WIDTH}
          minHeight={2129}
          pt="$6"
          px={STOCK_DETAIL_HORIZONTAL_GUTTER}
          flexShrink={0}
        >
          <SwapPanel
            swapToken={swapToken}
            portfolioData={portfolioData}
            stockDetailDesktopLayout
          />
        </Stack>
      </XStack>
    </Stack>
  );
}
