/* cspell:ignore Fundings */

import { useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import {
  Button,
  DashText,
  Divider,
  Icon,
  IconButton,
  ScrollView,
  SizableText,
  Spinner,
  Stack,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { LightweightChart } from '@onekeyhq/kit/src/components/LightweightChart';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { getHyperliquidTokenImageUrl } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPerpsFormattedAssetCtx } from '@onekeyhq/shared/types/hyperliquid/types';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import {
  type IPerpFundingHistoryRange,
  usePerpAnnotation,
  usePerpContractInfo,
  usePerpFundingHistory,
  usePerpMarketOverview,
  usePerpPredictedFundings,
  usePerpRecentTrades,
  usePerpResolvedMarketDetail,
} from '../../hooks/usePerpMarketDetail';

import type { BaselineSeriesPartialOptions } from 'lightweight-charts';

export type IPerpMarketDetailTab =
  | 'overview'
  | 'funding'
  | 'trades'
  | 'contract'
  | 'about';

const TAB_CONFIG: Record<IPerpMarketDetailTab, { label: string }> = {
  overview: { label: 'Overview' },
  funding: { label: 'Funding' },
  trades: { label: 'Trades' },
  contract: { label: 'Contract' },
  about: { label: 'About' },
};

const FUNDING_RANGE_ITEMS: IPerpFundingHistoryRange[] = ['24h', '7d', '30d'];
const MARKET_DATA_CHART_HEIGHT = 220;
const MARKET_DATA_CHART_PRICE_SCALE_MARGINS = { top: 0.12, bottom: 0.12 };
const MARKET_DATA_CHART_CARD_MIN_WIDTH = 320;
const POSITIVE_LINE_COLOR = '#2EAA40';
const POSITIVE_TOP_COLOR = 'rgba(46, 170, 64, 0.24)';
const POSITIVE_BOTTOM_COLOR = 'rgba(46, 170, 64, 0)';
const NEGATIVE_LINE_COLOR = '#E5484D';

export const PERP_MARKET_INFO_TAB_KEYS: IPerpMarketDetailTab[] = [
  'overview',
  'contract',
  'about',
];

export const PERP_MARKET_TRADING_DATA_TAB_KEYS: IPerpMarketDetailTab[] = [
  'trades',
  'funding',
];

function formatUsdValue(value?: string | null) {
  if (!value) {
    return '--';
  }
  const formatted = numberFormat(String(value), {
    formatter: 'marketCap',
  });
  return formatted ? `$${formatted}` : '--';
}

function formatPlainNumber(value?: string | null) {
  if (!value) {
    return '--';
  }
  return (
    numberFormat(String(value), {
      formatter: 'marketCap',
    }) || '--'
  );
}

function formatPercent(value?: string | number | null, digits = 4) {
  if (value === null || value === undefined || value === '') {
    return '--';
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return '--';
  }
  return `${numericValue.toFixed(digits)}%`;
}

function formatFundingRate(value?: string | null) {
  if (!value) {
    return '--';
  }
  return formatPercent(new BigNumber(value).multipliedBy(100).toNumber(), 4);
}

function formatTimestamp(value?: number | null) {
  if (!value) {
    return '--';
  }
  return formatDate(new Date(value), {
    hideYear: true,
    hideSeconds: true,
  });
}

function formatMarketDate(value?: Date | string | number | null) {
  if (!value) {
    return '--';
  }
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return '--';
  }
  return formatDate(parsedDate, {
    hideSeconds: true,
  });
}

function formatTokenAmount(
  value?: string | number | null,
  suffix?: string | null,
) {
  const formatted = formatPlainNumber(
    value === null || value === undefined ? undefined : String(value),
  );
  if (formatted === '--') {
    return formatted;
  }
  return suffix ? `${formatted} ${suffix.toUpperCase()}` : formatted;
}

function sanitizeDescriptionText(value?: string | null) {
  if (!value) {
    return '';
  }

  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatChartPercent(value: number) {
  const digits = Math.abs(value) >= 1 ? 2 : 4;
  return `${value.toFixed(digits)}%`;
}

function formatChartCompactUsd(value: number) {
  const formatted = numberFormat(String(Math.abs(value)), {
    formatter: 'marketCap',
  });
  if (!formatted) {
    return '$0';
  }
  return `${value < 0 ? '-' : ''}$${formatted}`;
}

function getTradeBucketMs(spanMs: number) {
  if (spanMs <= 30 * 60 * 1000) {
    return 60 * 1000;
  }
  if (spanMs <= 2 * 60 * 60 * 1000) {
    return 5 * 60 * 1000;
  }
  return 15 * 60 * 1000;
}

function DetailStatItem({ label, value }: { label: string; value: string }) {
  return (
    <YStack
      flex={1}
      minWidth={180}
      gap="$1"
      borderWidth="$px"
      borderColor="$borderSubdued"
      borderRadius="$3"
      px="$3.5"
      py="$3"
      bg="$bgSubdued"
    >
      <SizableText size="$bodySm" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText size="$bodyMdMedium">{value}</SizableText>
    </YStack>
  );
}

function LinkChip({
  label,
  url,
  iconAfter,
}: {
  label: string;
  url?: string | null;
  iconAfter?: string;
}) {
  if (!url) {
    return null;
  }

  return (
    <Button
      size="small"
      variant="secondary"
      iconAfter={iconAfter as any}
      onPress={() => openUrlExternal(url)}
    >
      {label}
    </Button>
  );
}

function DetailListSection({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string; tooltip?: string }>;
}) {
  const visibleRows = rows.filter((item) => item.value && item.value !== '--');

  if (!visibleRows.length) {
    return null;
  }

  return (
    <YStack gap="$3">
      <SizableText size="$headingSm">{title}</SizableText>
      <YStack gap="$2.5">
        {visibleRows.map((item) => (
          <XStack
            key={item.label}
            alignItems="flex-start"
            justifyContent="space-between"
            gap="$3"
          >
            {item.tooltip ? (
              <Tooltip
                placement="top"
                renderTrigger={
                  <DashText
                    size="$bodyMd"
                    dashColor="$textDisabled"
                    dashThickness={0.5}
                    color="$textSubdued"
                    cursor="help"
                    flex={1}
                  >
                    {item.label}
                  </DashText>
                }
                renderContent={
                  <SizableText size="$bodySm">{item.tooltip}</SizableText>
                }
              />
            ) : (
              <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
                {item.label}
              </SizableText>
            )}
            <SizableText size="$bodyMd" textAlign="right" flex={1}>
              {item.value}
            </SizableText>
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

function TabButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <XStack
      px="$3"
      py="$2"
      borderRadius="$2"
      bg={active ? '$bgActive' : '$bgSubdued'}
      onPress={onPress}
      cursor="default"
    >
      <SizableText
        size="$bodySmMedium"
        color={active ? '$textOnColor' : '$text'}
      >
        {label}
      </SizableText>
    </XStack>
  );
}

function RangeButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <XStack
      px="$2.5"
      py="$1.5"
      borderRadius="$2"
      bg={active ? '$bgActive' : '$bgSubdued'}
      onPress={onPress}
      cursor="default"
    >
      <SizableText
        size="$bodySm"
        color={active ? '$textOnColor' : '$textSubdued'}
      >
        {label}
      </SizableText>
    </XStack>
  );
}

function SectionLoading() {
  return (
    <YStack py="$8" alignItems="center" justifyContent="center">
      <Spinner size="large" />
    </YStack>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <YStack py="$8" alignItems="center" justifyContent="center">
      <SizableText size="$bodyMd" color="$textSubdued">
        {text}
      </SizableText>
    </YStack>
  );
}

function TradeRatioBar({ buyPercentage }: { buyPercentage: number }) {
  const safeBuyPercentage = Number.isFinite(buyPercentage)
    ? Math.min(100, Math.max(0, buyPercentage))
    : 50;
  const sellPercentage = 100 - safeBuyPercentage;

  return (
    <XStack height="$2" borderRadius="$2" overflow="hidden" gap="$1">
      <Stack flex={safeBuyPercentage} bg="$bgSuccessStrong" />
      <Stack flex={sellPercentage} bg="$bgCriticalStrong" />
    </XStack>
  );
}

function MarketDataChartCard({
  title,
  description,
  data,
  height = MARKET_DATA_CHART_HEIGHT,
  priceFormatter,
  seriesType = 'area',
  baselineOptions,
  lineColor,
  topColor,
  bottomColor,
}: {
  title: string;
  description?: string;
  data: IMarketTokenChart;
  height?: number;
  priceFormatter: (price: number) => string;
  seriesType?: 'area' | 'baseline';
  baselineOptions?: BaselineSeriesPartialOptions;
  lineColor?: string;
  topColor?: string;
  bottomColor?: string;
}) {
  return (
    <YStack
      flex={1}
      minWidth={MARKET_DATA_CHART_CARD_MIN_WIDTH}
      gap="$2"
      borderWidth="$px"
      borderColor="$borderSubdued"
      borderRadius="$3"
      px="$3.5"
      py="$3"
    >
      <YStack gap="$1">
        <SizableText size="$bodyMdMedium">{title}</SizableText>
        {description ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {description}
          </SizableText>
        ) : null}
      </YStack>

      {data.length > 1 ? (
        <LightweightChart
          data={data}
          height={height}
          lineColor={lineColor}
          topColor={topColor}
          bottomColor={bottomColor}
          lineWidth={3}
          showPriceScale
          showHorzGridLines
          priceScaleMargins={MARKET_DATA_CHART_PRICE_SCALE_MARGINS}
          priceFormatter={priceFormatter}
          fontSize={11}
          seriesType={seriesType}
          baselineOptions={baselineOptions}
          showLastValue
        />
      ) : (
        <YStack height={height} alignItems="center" justifyContent="center">
          <SizableText size="$bodySm" color="$textSubdued">
            Not enough data to render chart.
          </SizableText>
        </YStack>
      )}
    </YStack>
  );
}

export function PerpMarketDetailContent({
  coin,
  displayName,
  tabKeys = Object.keys(TAB_CONFIG) as IPerpMarketDetailTab[],
  initialTab,
  paddingX = '$4',
  paddingTop = '$4',
  paddingBottom = '$4',
  maxHeight,
  combineTradingData = false,
  combineInfoData = false,
}: {
  coin?: string;
  displayName?: string;
  tabKeys?: IPerpMarketDetailTab[];
  initialTab?: IPerpMarketDetailTab;
  paddingX?: number | string;
  paddingTop?: number | string;
  paddingBottom?: number | string;
  maxHeight?: number;
  combineTradingData?: boolean;
  combineInfoData?: boolean;
}) {
  const resolvedInitialTab =
    (initialTab && tabKeys.includes(initialTab) ? initialTab : tabKeys[0]) ??
    'overview';
  const [activeTab, setActiveTab] =
    useState<IPerpMarketDetailTab>(resolvedInitialTab);
  const [fundingRange, setFundingRange] =
    useState<IPerpFundingHistoryRange>('24h');
  const [isInfoDescriptionExpanded, setIsInfoDescriptionExpanded] =
    useState(false);

  useEffect(() => {
    if (!tabKeys.includes(activeTab)) {
      setActiveTab(resolvedInitialTab);
    }
  }, [activeTab, resolvedInitialTab, tabKeys]);

  useEffect(() => {
    setIsInfoDescriptionExpanded(false);
  }, [coin, displayName]);

  const overview = usePerpMarketOverview(coin);
  const fundingHistory = usePerpFundingHistory(coin, fundingRange);
  const recentTrades = usePerpRecentTrades(coin);
  const contractInfo = usePerpContractInfo(coin);
  const predictedFundings = usePerpPredictedFundings(coin);
  const annotation = usePerpAnnotation(coin);
  const resolvedMarketDetail = usePerpResolvedMarketDetail({
    coin: combineInfoData ? coin : undefined,
    displayName: combineInfoData ? displayName : undefined,
  });
  const fundingHistoryResult = useMemo(
    () => fundingHistory.result ?? [],
    [fundingHistory.result],
  );
  const recentTradesResult = useMemo(
    () => recentTrades.result ?? [],
    [recentTrades.result],
  );
  const predictedFundingsResult = useMemo(
    () => predictedFundings.result ?? [],
    [predictedFundings.result],
  );

  const tradeStats = useMemo(() => {
    const trades = recentTradesResult;
    return trades.reduce(
      (acc, trade) => {
        const notional = new BigNumber(trade.px || 0).multipliedBy(
          trade.sz || 0,
        );
        if (trade.side === 'B') {
          acc.buy = acc.buy.plus(notional);
        } else {
          acc.sell = acc.sell.plus(notional);
        }
        return acc;
      },
      {
        buy: new BigNumber(0),
        sell: new BigNumber(0),
      },
    );
  }, [recentTradesResult]);

  const buySellPercentage = useMemo(() => {
    const total = tradeStats.buy.plus(tradeStats.sell);
    if (total.isZero()) {
      return 50;
    }
    return tradeStats.buy.dividedBy(total).multipliedBy(100).toNumber();
  }, [tradeStats.buy, tradeStats.sell]);

  const overviewCtx = overview.result?.ctx as
    | (IPerpsFormattedAssetCtx & {
        bestBid?: string | null;
        bestAsk?: string | null;
        spread?: string | null;
        spreadPercent?: number | null;
      })
    | undefined;

  const marketDetail = resolvedMarketDetail.result?.detail;

  const aboutText = useMemo(
    () =>
      sanitizeDescriptionText(marketDetail?.about) ||
      sanitizeDescriptionText(annotation.result?.description) ||
      '',
    [annotation.result?.description, marketDetail?.about],
  );

  const fundingHistoryItems = useMemo(
    () => fundingHistoryResult.slice(-8).reverse(),
    [fundingHistoryResult],
  );

  const recentTradeItems = useMemo(
    () => recentTradesResult.slice(0, 16),
    [recentTradesResult],
  );

  const fundingChartData = useMemo<IMarketTokenChart>(() => {
    return [...fundingHistoryResult]
      .toSorted((a, b) => a.time - b.time)
      .map((item): [number, number] => [
        Math.floor(item.time / 1000),
        new BigNumber(item.fundingRate || 0).multipliedBy(100).toNumber(),
      ])
      .filter((item) => Number.isFinite(item[1]));
  }, [fundingHistoryResult]);

  const premiumChartData = useMemo<IMarketTokenChart>(() => {
    return [...fundingHistoryResult]
      .toSorted((a, b) => a.time - b.time)
      .map((item): [number, number] => [
        Math.floor(item.time / 1000),
        new BigNumber(item.premium || 0).multipliedBy(100).toNumber(),
      ])
      .filter((item) => Number.isFinite(item[1]));
  }, [fundingHistoryResult]);

  const tradeBucketData = useMemo(() => {
    const sortedTrades = [...recentTradesResult].toSorted(
      (a, b) => a.time - b.time,
    );
    if (sortedTrades.length === 0) {
      return {
        deltaChartData: [] as IMarketTokenChart,
        volumeChartData: [] as IMarketTokenChart,
      };
    }

    const spanMs =
      sortedTrades[sortedTrades.length - 1].time - sortedTrades[0].time;
    const bucketMs = getTradeBucketMs(spanMs);

    const bucketMap = new Map<number, { delta: BigNumber; total: BigNumber }>();

    sortedTrades.forEach((trade) => {
      const bucketStart = Math.floor(trade.time / bucketMs) * bucketMs;
      const existing = bucketMap.get(bucketStart) ?? {
        delta: new BigNumber(0),
        total: new BigNumber(0),
      };
      const notional = new BigNumber(trade.px || 0).multipliedBy(trade.sz || 0);
      existing.total = existing.total.plus(notional);
      existing.delta =
        trade.side === 'B'
          ? existing.delta.plus(notional)
          : existing.delta.minus(notional);
      bucketMap.set(bucketStart, existing);
    });

    const entries = [...bucketMap.entries()].toSorted((a, b) => a[0] - b[0]);

    return {
      deltaChartData: entries.map(([time, value]): [number, number] => [
        Math.floor(time / 1000),
        value.delta.toNumber(),
      ]),
      volumeChartData: entries.map(([time, value]): [number, number] => [
        Math.floor(time / 1000),
        value.total.toNumber(),
      ]),
    };
  }, [recentTradesResult]);

  const baselineOptions = useMemo(
    (): BaselineSeriesPartialOptions => ({
      baseValue: { type: 'price', price: 0 },
      topLineColor: POSITIVE_LINE_COLOR,
      topFillColor1: POSITIVE_TOP_COLOR,
      topFillColor2: POSITIVE_BOTTOM_COLOR,
      bottomLineColor: NEGATIVE_LINE_COLOR,
      bottomFillColor1: 'rgba(229, 72, 77, 0)',
      bottomFillColor2: 'rgba(229, 72, 77, 0.24)',
    }),
    [],
  );

  const renderTradingSnapshotCards = () => (
    <XStack flexWrap="wrap" gap="$3">
      <DetailStatItem
        label="Mark Price"
        value={`$${overviewCtx?.markPrice || marketDetail?.stats.currentPrice || '--'}`}
      />
      <DetailStatItem
        label="24h Change"
        value={formatPercent(
          overviewCtx?.change24hPercent ??
            marketDetail?.stats.performance.priceChangePercentage24h,
          2,
        )}
      />
      <DetailStatItem
        label="Funding Rate"
        value={formatFundingRate(overviewCtx?.fundingRate)}
      />
      <DetailStatItem
        label="Open Interest"
        value={formatPlainNumber(overviewCtx?.openInterest)}
      />
      <DetailStatItem
        label="OI Notional"
        value={formatUsdValue(overview.result?.openInterestNotional)}
      />
      <DetailStatItem
        label="Premium"
        value={formatPercent(
          overview.result?.premium
            ? new BigNumber(overview.result.premium)
                .multipliedBy(100)
                .toNumber()
            : null,
          4,
        )}
      />
    </XStack>
  );

  const renderInfoCombined = () => {
    const isInitialLoading =
      overview.isLoading &&
      contractInfo.isLoading &&
      annotation.isLoading &&
      resolvedMarketDetail.isLoading;

    if (isInitialLoading) {
      return <SectionLoading />;
    }

    if (
      !overview.result &&
      !contractInfo.result &&
      !annotation.result &&
      !marketDetail
    ) {
      return <EmptyState text="Market information is unavailable." />;
    }

    const marketReferenceRows = marketDetail
      ? [
          {
            label: 'Market Cap Rank',
            value: marketDetail.stats.marketCapRank
              ? `#${marketDetail.stats.marketCapRank}`
              : '--',
            tooltip: '按市值计算的市场排名。',
          },
          {
            label: 'Market Cap',
            value: formatUsdValue(String(marketDetail.stats.marketCap)),
            tooltip: '当前价格乘以流通供应量。',
          },
          {
            label: 'FDV',
            value: formatUsdValue(String(marketDetail.stats.fdv)),
            tooltip: '按完全稀释供应量估算的总市值。',
          },
          {
            label: '24h Volume',
            value: formatUsdValue(String(marketDetail.stats.volume24h)),
            tooltip: '过去 24 小时的成交额。',
          },
          {
            label: 'Circulating Supply',
            value: formatTokenAmount(
              marketDetail.stats.circulatingSupply,
              marketDetail.symbol,
            ),
            tooltip: '当前市场中可流通的代币数量。',
          },
          {
            label: 'Total Supply',
            value: formatTokenAmount(
              marketDetail.stats.totalSupply,
              marketDetail.symbol,
            ),
            tooltip: '当前已发行的代币总量。',
          },
          {
            label: 'Max Supply',
            value: formatTokenAmount(
              marketDetail.stats.maxSupply,
              marketDetail.symbol,
            ),
            tooltip: '协议定义的最大供应量上限。',
          },
          {
            label: 'ATH',
            value: `${formatUsdValue(String(marketDetail.stats.ath.value))} (${formatMarketDate(marketDetail.stats.ath.time)})`,
            tooltip: '历史最高成交价格。',
          },
          {
            label: 'ATL',
            value: `${formatUsdValue(String(marketDetail.stats.atl.value))} (${formatMarketDate(marketDetail.stats.atl.time)})`,
            tooltip: '历史最低成交价格。',
          },
          {
            label: '24h High',
            value: formatUsdValue(String(marketDetail.stats.high24h)),
            tooltip: '过去 24 小时的最高价格。',
          },
          {
            label: '24h Low',
            value: formatUsdValue(String(marketDetail.stats.low24h)),
            tooltip: '过去 24 小时的最低价格。',
          },
          {
            label: 'Last Updated',
            value: formatMarketDate(marketDetail.stats.lastUpdated),
            tooltip: '第三方资料最近一次更新时间。',
          },
        ]
      : [];

    const officialLinks = marketDetail
      ? [
          { label: '官网', url: marketDetail.links.homePageUrl },
          { label: '白皮书', url: marketDetail.links.whitepaper },
          ...(marketDetail.explorers?.slice(0, 2).map((item) => ({
            label: item.name,
            url: item.url,
          })) ?? []),
        ].filter((item) => Boolean(item.url))
      : [];

    const socialLinks = marketDetail
      ? [
          { label: 'X', url: marketDetail.links.twitterUrl, icon: 'Xbrand' },
          {
            label: 'Telegram',
            url: marketDetail.links.telegramUrl,
            icon: 'TelegramBrand',
          },
          {
            label: 'Discord',
            url: marketDetail.links.discordUrl,
            icon: 'DiscordBrand',
          },
        ].filter((item) => Boolean(item.url))
      : [];

    const showDescriptionToggle = aboutText.length > 320;

    return (
      <XStack
        flexWrap="wrap"
        gap="$6"
        pt="$4"
        alignItems="flex-start"
        $gtMd={{ flexWrap: 'nowrap', gap: '$6' } as any}
      >
        <YStack flex={1} flexBasis={0} minWidth={0} gap="$4.5" width="100%">
          <YStack gap="$2.5">
            <XStack alignItems="center" gap="$2.5">
              <Token
                size="sm"
                tokenImageUri={
                  marketDetail?.image ||
                  getHyperliquidTokenImageUrl(
                    displayName || marketDetail?.symbol || coin || '',
                  )
                }
              />
              <SizableText size="$headingLg">
                {displayName ||
                  marketDetail?.symbol?.toUpperCase() ||
                  coin ||
                  '--'}
              </SizableText>
              {marketDetail?.name ? (
                <SizableText size="$bodyLg" color="$textSubdued">
                  {marketDetail.name}
                </SizableText>
              ) : null}
            </XStack>

            {aboutText ? (
              <YStack gap="$2.5">
                <Tooltip
                  placement="top"
                  renderTrigger={
                    <DashText
                      size="$bodySm"
                      dashColor="$textDisabled"
                      dashThickness={0.5}
                      color="$textSubdued"
                      cursor="help"
                      alignSelf="flex-start"
                    >
                      原始资料
                    </DashText>
                  }
                  renderContent={
                    <SizableText size="$bodySm">
                      当前展示第三方原始资料，暂未接入自动翻译。
                    </SizableText>
                  }
                />
                <SizableText
                  size="$bodyMd"
                  color="$textSubdued"
                  lineHeight="$6"
                  numberOfLines={isInfoDescriptionExpanded ? undefined : 7}
                >
                  {aboutText}
                </SizableText>
                {showDescriptionToggle ? (
                  <XStack
                    alignItems="center"
                    gap="$1"
                    alignSelf="flex-start"
                    onPress={() =>
                      setIsInfoDescriptionExpanded((prev) => !prev)
                    }
                    cursor="default"
                  >
                    <SizableText size="$bodyMd" color="$textSubdued">
                      {isInfoDescriptionExpanded ? '收起' : '展开'}
                    </SizableText>
                    <Icon
                      name={
                        isInfoDescriptionExpanded
                          ? 'ChevronTopSmallOutline'
                          : 'ChevronDownSmallOutline'
                      }
                      size="$4"
                      color="$iconSubdued"
                    />
                  </XStack>
                ) : null}
              </YStack>
            ) : null}
          </YStack>

          {marketReferenceRows.length ? (
            <DetailListSection title="币种信息" rows={marketReferenceRows} />
          ) : (
            <YStack gap="$2">
              <SizableText size="$headingSm">币种信息</SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                暂无可用的现货参考信息。
              </SizableText>
            </YStack>
          )}
        </YStack>

        <YStack flex={1} flexBasis={0} width="100%" minWidth={0} gap="$5">
          {officialLinks.length ? (
            <YStack gap="$2.5">
              <SizableText size="$headingSm">官方链接</SizableText>
              <XStack flexWrap="wrap" gap="$2">
                {officialLinks.map((item) => (
                  <LinkChip
                    key={`${item.label}-${item.url}`}
                    {...item}
                    iconAfter="OpenOutline"
                  />
                ))}
              </XStack>
            </YStack>
          ) : null}

          {socialLinks.length ? (
            <YStack gap="$2.5">
              <SizableText size="$headingSm">社交媒体</SizableText>
              <XStack flexWrap="wrap" gap="$2">
                {socialLinks.map((item) => (
                  <IconButton
                    key={`${item.label}-${item.url}`}
                    title={item.label}
                    icon={item.icon as any}
                    onPress={() => openUrlExternal(item.url)}
                  />
                ))}
              </XStack>
            </YStack>
          ) : null}
        </YStack>
      </XStack>
    );
  };

  const renderOverviewTab = () => {
    if (overview.isLoading) {
      return <SectionLoading />;
    }
    if (!overview.result) {
      return <EmptyState text="Market overview is unavailable." />;
    }

    return (
      <YStack gap="$3">
        <XStack flexWrap="wrap" gap="$3">
          <DetailStatItem
            label="Mark Price"
            value={`$${overviewCtx?.markPrice || '--'}`}
          />
          <DetailStatItem
            label="Oracle Price"
            value={`$${overviewCtx?.oraclePrice || '--'}`}
          />
          <DetailStatItem
            label="24h Change"
            value={formatPercent(overviewCtx?.change24hPercent, 2)}
          />
          <DetailStatItem
            label="24h Volume"
            value={formatUsdValue(overviewCtx?.volume24h)}
          />
          <DetailStatItem
            label="Open Interest"
            value={formatPlainNumber(overviewCtx?.openInterest)}
          />
          <DetailStatItem
            label="OI Notional"
            value={formatUsdValue(overview.result.openInterestNotional)}
          />
          <DetailStatItem
            label="Funding Rate"
            value={formatFundingRate(overviewCtx?.fundingRate)}
          />
          <DetailStatItem
            label="Premium"
            value={formatPercent(
              overview.result.premium
                ? new BigNumber(overview.result.premium)
                    .multipliedBy(100)
                    .toNumber()
                : null,
              4,
            )}
          />
          <DetailStatItem
            label="Best Bid"
            value={overviewCtx?.bestBid ? `$${overviewCtx.bestBid}` : '--'}
          />
          <DetailStatItem
            label="Best Ask"
            value={overviewCtx?.bestAsk ? `$${overviewCtx.bestAsk}` : '--'}
          />
          <DetailStatItem
            label="Spread"
            value={overviewCtx?.spread ? `$${overviewCtx.spread}` : '--'}
          />
          <DetailStatItem
            label="Spread %"
            value={formatPercent(overviewCtx?.spreadPercent, 4)}
          />
        </XStack>
      </YStack>
    );
  };

  const renderFundingTab = () => {
    if (fundingHistory.isLoading && fundingHistoryResult.length === 0) {
      return <SectionLoading />;
    }

    return (
      <YStack gap="$4">
        <XStack gap="$2">
          {FUNDING_RANGE_ITEMS.map((item) => (
            <RangeButton
              key={item}
              label={item.toUpperCase()}
              active={fundingRange === item}
              onPress={() => setFundingRange(item)}
            />
          ))}
        </XStack>

        <XStack flexWrap="wrap" gap="$3">
          <MarketDataChartCard
            title="Funding Rate History"
            description="Funding rate trend over the selected range."
            data={fundingChartData}
            priceFormatter={formatChartPercent}
            seriesType="baseline"
            baselineOptions={baselineOptions}
          />
          <MarketDataChartCard
            title="Premium History"
            description="Premium versus oracle price over the same period."
            data={premiumChartData}
            priceFormatter={formatChartPercent}
            seriesType="baseline"
            baselineOptions={baselineOptions}
          />
        </XStack>

        <YStack gap="$2">
          <SizableText size="$bodyMdMedium">Funding History</SizableText>
          {fundingHistoryItems.length === 0 ? (
            <EmptyState text="Funding history is unavailable." />
          ) : (
            <YStack
              borderWidth="$px"
              borderColor="$borderSubdued"
              borderRadius="$3"
              overflow="hidden"
            >
              {fundingHistoryItems.map((item, index) => (
                <YStack key={`${item.time}-${index}`}>
                  <XStack
                    px="$3.5"
                    py="$2.5"
                    alignItems="center"
                    justifyContent="space-between"
                    gap="$3"
                  >
                    <SizableText size="$bodySm" color="$textSubdued">
                      {formatTimestamp(item.time)}
                    </SizableText>
                    <SizableText size="$bodySmMedium">
                      {formatFundingRate(item.fundingRate)}
                    </SizableText>
                    <SizableText size="$bodySm" color="$textSubdued">
                      Premium{' '}
                      {formatPercent(
                        new BigNumber(item.premium || 0)
                          .multipliedBy(100)
                          .toNumber(),
                        4,
                      )}
                    </SizableText>
                  </XStack>
                  {index !== fundingHistoryItems.length - 1 ? (
                    <Divider />
                  ) : null}
                </YStack>
              ))}
            </YStack>
          )}
        </YStack>

        <YStack gap="$2">
          <SizableText size="$bodyMdMedium">Predicted Funding</SizableText>
          {predictedFundingsResult.length === 0 ? (
            <EmptyState text="Predicted funding is unavailable." />
          ) : (
            <YStack
              borderWidth="$px"
              borderColor="$borderSubdued"
              borderRadius="$3"
              overflow="hidden"
            >
              {predictedFundingsResult.map((item, index) => (
                <YStack key={item.exchange}>
                  <XStack
                    px="$3.5"
                    py="$2.5"
                    alignItems="center"
                    justifyContent="space-between"
                    gap="$3"
                  >
                    <SizableText size="$bodySmMedium">
                      {item.exchange}
                    </SizableText>
                    <SizableText size="$bodySm">
                      {formatFundingRate(item.fundingRate)}
                    </SizableText>
                    <SizableText size="$bodySm" color="$textSubdued">
                      {item.fundingIntervalHours
                        ? `${item.fundingIntervalHours}h interval`
                        : '--'}
                    </SizableText>
                    <SizableText size="$bodySm" color="$textSubdued">
                      {formatTimestamp(item.nextFundingTime)}
                    </SizableText>
                  </XStack>
                  {index !== predictedFundingsResult.length - 1 ? (
                    <Divider />
                  ) : null}
                </YStack>
              ))}
            </YStack>
          )}
        </YStack>
      </YStack>
    );
  };

  const renderTradesTab = () => {
    if (recentTrades.isLoading && recentTradesResult.length === 0) {
      return <SectionLoading />;
    }

    return (
      <YStack gap="$4">
        <XStack flexWrap="wrap" gap="$3">
          <MarketDataChartCard
            title="Net Flow Delta"
            description="Aggregated buy notional minus sell notional."
            data={tradeBucketData.deltaChartData}
            priceFormatter={formatChartCompactUsd}
            seriesType="baseline"
            baselineOptions={baselineOptions}
          />
          <MarketDataChartCard
            title="Aggregated Trade Notional"
            description="Total traded notional grouped into recent time buckets."
            data={tradeBucketData.volumeChartData}
            priceFormatter={formatChartCompactUsd}
            lineColor={POSITIVE_LINE_COLOR}
            topColor={POSITIVE_TOP_COLOR}
            bottomColor={POSITIVE_BOTTOM_COLOR}
          />
        </XStack>

        <YStack gap="$2">
          <SizableText size="$bodyMdMedium">Recent Buy / Sell Flow</SizableText>
          <YStack
            gap="$2.5"
            borderWidth="$px"
            borderColor="$borderSubdued"
            borderRadius="$3"
            px="$3.5"
            py="$3"
          >
            <XStack justifyContent="space-between" gap="$3">
              <SizableText size="$bodySm" color="$textSubdued">
                Buy
              </SizableText>
              <SizableText size="$bodySmMedium">
                {formatUsdValue(tradeStats.buy.toFixed())}
              </SizableText>
            </XStack>
            <TradeRatioBar buyPercentage={buySellPercentage} />
            <XStack justifyContent="space-between" gap="$3">
              <SizableText size="$bodySm" color="$textSubdued">
                Sell
              </SizableText>
              <SizableText size="$bodySmMedium">
                {formatUsdValue(tradeStats.sell.toFixed())}
              </SizableText>
            </XStack>
          </YStack>
        </YStack>

        <YStack gap="$2">
          <SizableText size="$bodyMdMedium">Recent Trades</SizableText>
          {recentTradeItems.length === 0 ? (
            <EmptyState text="Recent trades are unavailable." />
          ) : (
            <YStack
              borderWidth="$px"
              borderColor="$borderSubdued"
              borderRadius="$3"
              overflow="hidden"
            >
              {recentTradeItems.map((item, index) => (
                <YStack key={`${item.tid}-${index}`}>
                  <XStack
                    px="$3.5"
                    py="$2.5"
                    alignItems="center"
                    justifyContent="space-between"
                    gap="$3"
                  >
                    <SizableText
                      size="$bodySmMedium"
                      color={item.side === 'B' ? '$green11' : '$red11'}
                    >
                      {item.side === 'B' ? 'Buy' : 'Sell'}
                    </SizableText>
                    <SizableText size="$bodySm">${item.px}</SizableText>
                    <SizableText size="$bodySm" color="$textSubdued">
                      {formatPlainNumber(item.sz)}
                    </SizableText>
                    <SizableText size="$bodySm" color="$textSubdued">
                      {formatTimestamp(item.time)}
                    </SizableText>
                  </XStack>
                  {index !== recentTradeItems.length - 1 ? <Divider /> : null}
                </YStack>
              ))}
            </YStack>
          )}
        </YStack>
      </YStack>
    );
  };

  const renderTradingDataCombined = () => {
    if (
      fundingHistory.isLoading &&
      fundingHistoryResult.length === 0 &&
      recentTrades.isLoading &&
      recentTradesResult.length === 0
    ) {
      return <SectionLoading />;
    }

    return (
      <YStack gap="$4">
        {renderTradingSnapshotCards()}

        <XStack gap="$2">
          {FUNDING_RANGE_ITEMS.map((item) => (
            <RangeButton
              key={item}
              label={item.toUpperCase()}
              active={fundingRange === item}
              onPress={() => setFundingRange(item)}
            />
          ))}
        </XStack>

        <XStack flexWrap="wrap" gap="$3">
          <MarketDataChartCard
            title="Funding Rate History"
            description="Funding rate trend over the selected range."
            data={fundingChartData}
            priceFormatter={formatChartPercent}
            seriesType="baseline"
            baselineOptions={baselineOptions}
          />
          <MarketDataChartCard
            title="Premium History"
            description="Premium versus oracle price over the same period."
            data={premiumChartData}
            priceFormatter={formatChartPercent}
            seriesType="baseline"
            baselineOptions={baselineOptions}
          />
          <MarketDataChartCard
            title="Net Flow Delta"
            description="Aggregated buy notional minus sell notional."
            data={tradeBucketData.deltaChartData}
            priceFormatter={formatChartCompactUsd}
            seriesType="baseline"
            baselineOptions={baselineOptions}
          />
          <MarketDataChartCard
            title="Aggregated Trade Notional"
            description="Total traded notional grouped into recent time buckets."
            data={tradeBucketData.volumeChartData}
            priceFormatter={formatChartCompactUsd}
            lineColor={POSITIVE_LINE_COLOR}
            topColor={POSITIVE_TOP_COLOR}
            bottomColor={POSITIVE_BOTTOM_COLOR}
          />
        </XStack>

        <YStack gap="$2">
          <SizableText size="$bodyMdMedium">Recent Buy / Sell Flow</SizableText>
          <YStack
            gap="$2.5"
            borderWidth="$px"
            borderColor="$borderSubdued"
            borderRadius="$3"
            px="$3.5"
            py="$3"
          >
            <XStack justifyContent="space-between" gap="$3">
              <SizableText size="$bodySm" color="$textSubdued">
                Buy
              </SizableText>
              <SizableText size="$bodySmMedium">
                {formatUsdValue(tradeStats.buy.toFixed())}
              </SizableText>
            </XStack>
            <TradeRatioBar buyPercentage={buySellPercentage} />
            <XStack justifyContent="space-between" gap="$3">
              <SizableText size="$bodySm" color="$textSubdued">
                Sell
              </SizableText>
              <SizableText size="$bodySmMedium">
                {formatUsdValue(tradeStats.sell.toFixed())}
              </SizableText>
            </XStack>
          </YStack>
        </YStack>

        <YStack gap="$2">
          <SizableText size="$bodyMdMedium">Funding History</SizableText>
          {fundingHistoryItems.length === 0 ? (
            <EmptyState text="Funding history is unavailable." />
          ) : (
            <YStack
              borderWidth="$px"
              borderColor="$borderSubdued"
              borderRadius="$3"
              overflow="hidden"
            >
              {fundingHistoryItems.map((item, index) => (
                <YStack key={`${item.time}-${index}`}>
                  <XStack
                    px="$3.5"
                    py="$2.5"
                    alignItems="center"
                    justifyContent="space-between"
                    gap="$3"
                  >
                    <SizableText size="$bodySm" color="$textSubdued">
                      {formatTimestamp(item.time)}
                    </SizableText>
                    <SizableText size="$bodySmMedium">
                      {formatFundingRate(item.fundingRate)}
                    </SizableText>
                    <SizableText size="$bodySm" color="$textSubdued">
                      Premium{' '}
                      {formatPercent(
                        new BigNumber(item.premium || 0)
                          .multipliedBy(100)
                          .toNumber(),
                        4,
                      )}
                    </SizableText>
                  </XStack>
                  {index !== fundingHistoryItems.length - 1 ? (
                    <Divider />
                  ) : null}
                </YStack>
              ))}
            </YStack>
          )}
        </YStack>

        <YStack gap="$2">
          <SizableText size="$bodyMdMedium">Predicted Funding</SizableText>
          {predictedFundingsResult.length === 0 ? (
            <EmptyState text="Predicted funding is unavailable." />
          ) : (
            <YStack
              borderWidth="$px"
              borderColor="$borderSubdued"
              borderRadius="$3"
              overflow="hidden"
            >
              {predictedFundingsResult.map((item, index) => (
                <YStack key={item.exchange}>
                  <XStack
                    px="$3.5"
                    py="$2.5"
                    alignItems="center"
                    justifyContent="space-between"
                    gap="$3"
                  >
                    <SizableText size="$bodySmMedium">
                      {item.exchange}
                    </SizableText>
                    <SizableText size="$bodySm">
                      {formatFundingRate(item.fundingRate)}
                    </SizableText>
                    <SizableText size="$bodySm" color="$textSubdued">
                      {item.fundingIntervalHours
                        ? `${item.fundingIntervalHours}h interval`
                        : '--'}
                    </SizableText>
                    <SizableText size="$bodySm" color="$textSubdued">
                      {formatTimestamp(item.nextFundingTime)}
                    </SizableText>
                  </XStack>
                  {index !== predictedFundingsResult.length - 1 ? (
                    <Divider />
                  ) : null}
                </YStack>
              ))}
            </YStack>
          )}
        </YStack>

        <YStack gap="$2">
          <SizableText size="$bodyMdMedium">Recent Trades</SizableText>
          {recentTradeItems.length === 0 ? (
            <EmptyState text="Recent trades are unavailable." />
          ) : (
            <YStack
              borderWidth="$px"
              borderColor="$borderSubdued"
              borderRadius="$3"
              overflow="hidden"
            >
              {recentTradeItems.map((item, index) => (
                <YStack key={`${item.tid}-${index}`}>
                  <XStack
                    px="$3.5"
                    py="$2.5"
                    alignItems="center"
                    justifyContent="space-between"
                    gap="$3"
                  >
                    <SizableText
                      size="$bodySmMedium"
                      color={item.side === 'B' ? '$green11' : '$red11'}
                    >
                      {item.side === 'B' ? 'Buy' : 'Sell'}
                    </SizableText>
                    <SizableText size="$bodySm">${item.px}</SizableText>
                    <SizableText size="$bodySm" color="$textSubdued">
                      {formatPlainNumber(item.sz)}
                    </SizableText>
                    <SizableText size="$bodySm" color="$textSubdued">
                      {formatTimestamp(item.time)}
                    </SizableText>
                  </XStack>
                  {index !== recentTradeItems.length - 1 ? <Divider /> : null}
                </YStack>
              ))}
            </YStack>
          )}
        </YStack>
      </YStack>
    );
  };

  const renderContractTab = () => {
    if (contractInfo.isLoading) {
      return <SectionLoading />;
    }
    if (!contractInfo.result) {
      return <EmptyState text="Contract details are unavailable." />;
    }

    const marginTiers = contractInfo.result.marginTable?.marginTiers ?? [];

    return (
      <YStack gap="$4">
        <XStack flexWrap="wrap" gap="$3">
          <DetailStatItem
            label="Max Leverage"
            value={
              contractInfo.result.maxLeverage
                ? `${contractInfo.result.maxLeverage}x`
                : '--'
            }
          />
          <DetailStatItem
            label="Size Decimals"
            value={
              contractInfo.result.szDecimals !== undefined
                ? String(contractInfo.result.szDecimals)
                : '--'
            }
          />
          <DetailStatItem
            label="Margin Mode"
            value={contractInfo.result.marginMode || 'Cross'}
          />
          <DetailStatItem
            label="Isolated Only"
            value={contractInfo.result.onlyIsolated ? 'Yes' : 'No'}
          />
          <DetailStatItem
            label="OI Cap Status"
            value={
              contractInfo.result.isAtOpenInterestCap ? 'At Cap' : 'Normal'
            }
          />
        </XStack>

        <YStack gap="$2">
          <SizableText size="$bodyMdMedium">Margin Tiers</SizableText>
          {marginTiers.length ? (
            <YStack
              borderWidth="$px"
              borderColor="$borderSubdued"
              borderRadius="$3"
              overflow="hidden"
            >
              {marginTiers.map((item, index) => (
                <YStack key={`${item.lowerBound}-${item.maxLeverage}`}>
                  <XStack
                    px="$3.5"
                    py="$2.5"
                    alignItems="center"
                    justifyContent="space-between"
                    gap="$3"
                  >
                    <SizableText size="$bodySm" color="$textSubdued">
                      Lower Bound
                    </SizableText>
                    <SizableText size="$bodySmMedium">
                      {formatUsdValue(item.lowerBound)}
                    </SizableText>
                    <SizableText size="$bodySm" color="$textSubdued">
                      {item.maxLeverage}x
                    </SizableText>
                  </XStack>
                  {index !== marginTiers.length - 1 ? <Divider /> : null}
                </YStack>
              ))}
            </YStack>
          ) : (
            <EmptyState text="Margin tiers are unavailable." />
          )}
        </YStack>
      </YStack>
    );
  };

  const renderAboutTab = () => {
    if (annotation.isLoading) {
      return <SectionLoading />;
    }
    if (!annotation.result) {
      return <EmptyState text="Annotation is unavailable." />;
    }

    return (
      <YStack gap="$3">
        <DetailStatItem
          label="Category"
          value={annotation.result.category || '--'}
        />
        <DetailStatItem
          label="Display Name"
          value={annotation.result.displayName || displayName || '--'}
        />
        <YStack
          gap="$2"
          borderWidth="$px"
          borderColor="$borderSubdued"
          borderRadius="$3"
          px="$3.5"
          py="$3"
        >
          <SizableText size="$bodySm" color="$textSubdued">
            Description
          </SizableText>
          <SizableText size="$bodyMd">
            {annotation.result.description}
          </SizableText>
        </YStack>
        {annotation.result.keywords?.length ? (
          <YStack
            gap="$2"
            borderWidth="$px"
            borderColor="$borderSubdued"
            borderRadius="$3"
            px="$3.5"
            py="$3"
          >
            <SizableText size="$bodySm" color="$textSubdued">
              Keywords
            </SizableText>
            <SizableText size="$bodyMd">
              {annotation.result.keywords.join(', ')}
            </SizableText>
          </YStack>
        ) : null}
      </YStack>
    );
  };

  return (
    <YStack flex={1} minHeight={0} gap="$4">
      {!combineTradingData && !combineInfoData && tabKeys.length > 1 ? (
        <XStack px={paddingX} pt={paddingTop} flexWrap="wrap" gap="$2">
          {tabKeys.map((item) => (
            <TabButton
              key={item}
              active={activeTab === item}
              label={TAB_CONFIG[item].label}
              onPress={() => setActiveTab(item)}
            />
          ))}
        </XStack>
      ) : null}

      <ScrollView
        flex={maxHeight ? undefined : 1}
        minHeight={0}
        maxHeight={maxHeight}
        showsVerticalScrollIndicator={false}
      >
        <Stack px={paddingX} pb={paddingBottom} pr="$1">
          {combineTradingData ? renderTradingDataCombined() : null}
          {combineInfoData ? renderInfoCombined() : null}
          {!combineTradingData && !combineInfoData && activeTab === 'overview'
            ? renderOverviewTab()
            : null}
          {!combineTradingData && !combineInfoData && activeTab === 'funding'
            ? renderFundingTab()
            : null}
          {!combineTradingData && !combineInfoData && activeTab === 'trades'
            ? renderTradesTab()
            : null}
          {!combineTradingData && !combineInfoData && activeTab === 'contract'
            ? renderContractTab()
            : null}
          {!combineTradingData && !combineInfoData && activeTab === 'about'
            ? renderAboutTab()
            : null}
        </Stack>
      </ScrollView>
    </YStack>
  );
}
