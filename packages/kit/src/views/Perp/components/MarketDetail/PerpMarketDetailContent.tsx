/* cspell:ignore Fundings */

import { useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  DashText,
  Divider,
  Icon,
  Illustration,
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
import { PerpTestIDs } from '@onekeyhq/kit/src/views/Perp/testIDs';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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

import { formatExternalLinkLabel } from './linkLabelUtils';

import type { BaselineSeriesPartialOptions } from 'lightweight-charts';

export type IPerpMarketDetailTab =
  | 'overview'
  | 'funding'
  | 'trades'
  | 'contract'
  | 'about';

const TAB_CONFIG: Record<
  IPerpMarketDetailTab,
  { translationId: ETranslations }
> = {
  overview: { translationId: ETranslations.dexmarket_details_overview },
  funding: { translationId: ETranslations.perp_position_funding },
  trades: { translationId: ETranslations.perp_trades_history_title },
  contract: { translationId: ETranslations.global_contract },
  about: { translationId: ETranslations.global_about },
};

const FUNDING_RANGE_ITEMS: IPerpFundingHistoryRange[] = ['24h', '7d', '30d'];
const MARKET_DATA_CHART_HEIGHT = 220;
const MARKET_DATA_CHART_PRICE_SCALE_MARGINS = { top: 0.12, bottom: 0.12 };
const MARKET_DATA_CHART_CARD_MIN_WIDTH = 320;
const POSITIVE_LINE_COLOR = '#2EAA40';
const POSITIVE_TOP_COLOR = 'rgba(46, 170, 64, 0.24)';
const POSITIVE_BOTTOM_COLOR = 'rgba(46, 170, 64, 0)';
const NEGATIVE_LINE_COLOR = '#E5484D';
const DETAIL_LINK_LABEL_WIDTH = 96;
const DETAIL_LINK_CHIP_MAX_WIDTH = 200;

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

function formatUsdPriceValue(value?: string | number | null) {
  if (value === null || value === undefined || value === '') {
    return '--';
  }
  return (
    numberFormat(String(value), {
      formatter: 'price',
      formatterOptions: { currency: '$' },
    }) || '--'
  );
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
      testID={PerpTestIDs.MarketDetailLinkButton(label)}
      size="small"
      variant="secondary"
      maxWidth={DETAIL_LINK_CHIP_MAX_WIDTH}
      childrenAsText={false}
      iconAfter={iconAfter as any}
      onPress={() => openUrlExternal(url)}
    >
      <SizableText numberOfLines={1} ellipsizeMode="middle">
        {formatExternalLinkLabel({
          label,
          url: url ?? undefined,
        })}
      </SizableText>
    </Button>
  );
}

function DetailInfoTable({
  rows,
}: {
  rows: Array<{
    label: string;
    value: string;
    secondaryValue?: string;
    tooltip?: string;
  }>;
}) {
  const visibleRows = rows.filter((item) => item.value && item.value !== '--');

  if (!visibleRows.length) {
    return null;
  }

  return (
    <YStack gap="$2.5">
      {visibleRows.map((item) => (
        <XStack
          key={item.label}
          py="$1"
          alignItems="flex-start"
          justifyContent="space-between"
          gap="$4"
        >
          {item.tooltip ? (
            <Tooltip
              placement="top"
              renderTrigger={
                <SizableText
                  size="$bodyMd"
                  color="$textSubdued"
                  cursor="help"
                  flex={1}
                >
                  {item.label}
                </SizableText>
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
          <YStack flex={1} alignItems="flex-end" minWidth={0}>
            <SizableText size="$bodyMdMedium" textAlign="right">
              {item.value}
            </SizableText>
            {item.secondaryValue ? (
              <SizableText size="$bodySm" color="$textSubdued">
                {item.secondaryValue}
              </SizableText>
            ) : null}
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}

function DetailLinkTable({
  rows,
}: {
  rows: Array<{
    label: string;
    items: Array<{ label: string; url: string }>;
  }>;
}) {
  const visibleRows = rows.filter((item) => item.items.length > 0);

  if (!visibleRows.length) {
    return null;
  }

  return (
    <YStack gap="$2.5">
      {visibleRows.map((item) => (
        <XStack key={item.label} py="$1" alignItems="flex-start" gap="$4">
          <SizableText
            size="$bodyMd"
            color="$textSubdued"
            width={DETAIL_LINK_LABEL_WIDTH}
            flexShrink={0}
          >
            {item.label}
          </SizableText>
          <XStack
            flex={1}
            minWidth={0}
            gap="$2"
            flexWrap="wrap"
            justifyContent="flex-end"
          >
            {item.items.map((link) => (
              <LinkChip
                key={`${item.label}-${link.label}-${link.url}`}
                label={link.label}
                url={link.url}
                iconAfter="OpenOutline"
              />
            ))}
          </XStack>
        </XStack>
      ))}
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

function MarketInfoEmptyState() {
  const intl = useIntl();

  return (
    <YStack
      flex={1}
      minHeight={320}
      px="$6"
      alignItems="center"
      justifyContent="center"
      gap="$4"
    >
      <Illustration name="SearchDocument" size={100} />
      <SizableText
        size="$bodySm"
        color="$textSubdued"
        textAlign="center"
        maxWidth={360}
      >
        {intl.formatMessage({
          id: ETranslations.perp_market_info_data_unavailable__desc,
        })}
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
  const intl = useIntl();
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

  const isStandaloneMode = !combineTradingData && !combineInfoData;
  const shouldLoadOverview = isStandaloneMode && activeTab === 'overview';
  const shouldLoadFunding = combineTradingData || activeTab === 'funding';
  const shouldLoadTrades = combineTradingData || activeTab === 'trades';
  const shouldLoadContractInfo = isStandaloneMode && activeTab === 'contract';
  const shouldLoadAnnotation = isStandaloneMode && activeTab === 'about';

  const overview = usePerpMarketOverview(shouldLoadOverview ? coin : undefined);
  const fundingHistory = usePerpFundingHistory(
    shouldLoadFunding ? coin : undefined,
    fundingRange,
  );
  const recentTrades = usePerpRecentTrades(shouldLoadTrades ? coin : undefined);
  const contractInfo = usePerpContractInfo(
    shouldLoadContractInfo ? coin : undefined,
  );
  const predictedFundings = usePerpPredictedFundings(
    shouldLoadFunding ? coin : undefined,
  );
  const annotation = usePerpAnnotation(shouldLoadAnnotation ? coin : undefined);
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
  const marketDetailReferenceNote = intl.formatMessage({
    id: ETranslations.perp_market_info_reference_note__desc,
  });

  const aboutText = useMemo(
    () => sanitizeDescriptionText(marketDetail?.about) || '',
    [marketDetail?.about],
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
    const isInitialLoading = resolvedMarketDetail.isLoading;

    if (isInitialLoading) {
      return <SectionLoading />;
    }

    if (!marketDetail) {
      return <MarketInfoEmptyState />;
    }

    const marketReferenceRows = marketDetail
      ? [
          {
            label: intl.formatMessage({
              id: ETranslations.dexmarket_details_holders_rank,
            }),
            value: marketDetail.stats.marketCapRank
              ? `#${marketDetail.stats.marketCapRank}`
              : '--',
            tooltip: intl.formatMessage({
              id: ETranslations.perp_market_info_rank_tooltip__desc,
            }),
          },
          {
            label: intl.formatMessage({ id: ETranslations.global_market_cap }),
            value: formatUsdValue(String(marketDetail.stats.marketCap)),
            tooltip: intl.formatMessage({
              id: ETranslations.perp_market_info_market_cap_tooltip__desc,
            }),
          },
          {
            label: intl.formatMessage({
              id: ETranslations.perp_market_info_fully_diluted_valuation__title,
            }),
            value: formatUsdValue(String(marketDetail.stats.fdv)),
            tooltip: intl.formatMessage({
              id: ETranslations.dexmarket_fdv_desc,
            }),
          },
          {
            label: intl.formatMessage({
              id: ETranslations.market_twenty_four_hour_volume,
            }),
            value: formatUsdValue(String(marketDetail.stats.volume24h)),
            tooltip: intl.formatMessage({
              id: ETranslations.perp_market_info_24h_volume_tooltip__desc,
            }),
          },
          {
            label: intl.formatMessage({
              id: ETranslations.global_circulating_supply,
            }),
            value: formatTokenAmount(
              marketDetail.stats.circulatingSupply,
              marketDetail.symbol,
            ),
            tooltip: intl.formatMessage({
              id: ETranslations.dexmarket_circulating_supply_tips,
            }),
          },
          {
            label: intl.formatMessage({ id: ETranslations.global_max_supply }),
            value: formatTokenAmount(
              marketDetail.stats.maxSupply,
              marketDetail.symbol,
            ),
            tooltip: intl.formatMessage({
              id: ETranslations.dexmarket_max_supply_tips,
            }),
          },
          {
            label: intl.formatMessage({
              id: ETranslations.global_total_supply,
            }),
            value: formatTokenAmount(
              marketDetail.stats.totalSupply,
              marketDetail.symbol,
            ),
            tooltip: intl.formatMessage({
              id: ETranslations.perp_market_info_total_supply_tooltip__desc,
            }),
          },
          {
            label: intl.formatMessage({
              id: ETranslations.market_all_time_high,
            }),
            value: formatUsdPriceValue(marketDetail.stats.ath.value),
            secondaryValue: formatMarketDate(marketDetail.stats.ath.time),
            tooltip: intl.formatMessage({
              id: ETranslations.perp_market_info_all_time_high_tooltip__desc,
            }),
          },
          {
            label: intl.formatMessage({
              id: ETranslations.market_all_time_low,
            }),
            value: formatUsdPriceValue(marketDetail.stats.atl.value),
            secondaryValue: formatMarketDate(marketDetail.stats.atl.time),
            tooltip: intl.formatMessage({
              id: ETranslations.perp_market_info_all_time_low_tooltip__desc,
            }),
          },
          {
            label: intl.formatMessage({
              id: ETranslations.perp_market_info_24h_high__title,
            }),
            value: formatUsdPriceValue(marketDetail.stats.high24h),
            tooltip: intl.formatMessage({
              id: ETranslations.perp_market_info_24h_high_tooltip__desc,
            }),
          },
          {
            label: intl.formatMessage({
              id: ETranslations.perp_market_info_24h_low__title,
            }),
            value: formatUsdPriceValue(marketDetail.stats.low24h),
            tooltip: intl.formatMessage({
              id: ETranslations.perp_market_info_24h_low_tooltip__desc,
            }),
          },
          {
            label: intl.formatMessage({
              id: ETranslations.market_last_updated,
            }),
            value: formatMarketDate(marketDetail.stats.lastUpdated),
            tooltip: intl.formatMessage({
              id: ETranslations.perp_market_info_last_updated_tooltip__desc,
            }),
          },
        ]
      : [];

    const linkRows = marketDetail
      ? [
          {
            label: intl.formatMessage({ id: ETranslations.global_website }),
            items: [
              {
                label: intl.formatMessage({
                  id: ETranslations.global_official_website,
                }),
                url: marketDetail.links.homePageUrl,
              },
              {
                label: intl.formatMessage({
                  id: ETranslations.global_white_paper,
                }),
                url: marketDetail.links.whitepaper,
              },
            ].filter((item) => Boolean(item.url)),
          },
          {
            label: intl.formatMessage({
              id: ETranslations.global_block_explorer,
            }),
            items:
              marketDetail.explorers
                ?.slice(0, 2)
                .map((item) => ({
                  label: item.name,
                  url: item.url,
                }))
                .filter((item) => Boolean(item.url)) ?? [],
          },
          {
            label: intl.formatMessage({
              id: ETranslations.perp_market_info_social_media__title,
            }),
            items: [
              { label: 'X', url: marketDetail.links.twitterUrl },
              { label: 'Telegram', url: marketDetail.links.telegramUrl },
              { label: 'Discord', url: marketDetail.links.discordUrl },
            ].filter((item) => Boolean(item.url)),
          },
        ]
      : [];

    const showDescriptionToggle = aboutText.length > 320;

    return (
      <YStack pt="$4" gap="$6">
        <XStack alignItems="center" gap="$2.5">
          <Token
            size="sm"
            tokenImageUri={
              displayName || marketDetail?.symbol || coin
                ? getHyperliquidTokenImageUrl(
                    displayName || marketDetail?.symbol || coin || '',
                  )
                : marketDetail?.image
            }
          />
          <SizableText size="$headingLg">
            {displayName || marketDetail?.symbol?.toUpperCase() || coin || '--'}
          </SizableText>
          {marketDetail?.name ? (
            <SizableText size="$bodyLg" color="$textSubdued">
              {marketDetail.name}
            </SizableText>
          ) : null}
        </XStack>

        <XStack
          flexWrap="wrap"
          gap="$6"
          alignItems="flex-start"
          $gtMd={{ flexWrap: 'nowrap', gap: '$16' } as any}
        >
          <YStack flex={1} flexBasis={0} minWidth={0} width="100%" gap="$2.5">
            <SizableText size="$headingSm">
              {intl.formatMessage({
                id: ETranslations.perp_market_info_coin_info__title,
              })}
            </SizableText>
            {marketReferenceRows.length ? (
              <DetailInfoTable rows={marketReferenceRows} />
            ) : (
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_market_info_no_reference_data__desc,
                })}
              </SizableText>
            )}
          </YStack>

          <YStack flex={1} flexBasis={0} width="100%" minWidth={0} gap="$2.5">
            <SizableText size="$headingSm">
              {intl.formatMessage({ id: ETranslations.global_links })}
            </SizableText>
            {linkRows.some((item) => item.items.length > 0) ? (
              <YStack gap="$3">
                <DetailLinkTable rows={linkRows} />
                <SizableText
                  size="$bodyXs"
                  color="$textDisabled"
                  lineHeight={16}
                  numberOfLines={1}
                  whiteSpace="nowrap"
                >
                  {`* ${marketDetailReferenceNote}`}
                </SizableText>
              </YStack>
            ) : (
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_market_info_no_external_links__desc,
                })}
              </SizableText>
            )}
          </YStack>
        </XStack>

        {aboutText ? (
          <YStack gap="$3.5">
            <XStack alignItems="center" justifyContent="space-between" gap="$3">
              <SizableText size="$headingSm">
                {intl.formatMessage({
                  id: ETranslations.perp_market_info_introduction__title,
                })}
              </SizableText>
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
                    {intl.formatMessage({
                      id: ETranslations.perp_market_info_raw_source__title,
                    })}
                  </DashText>
                }
                renderContent={
                  <SizableText size="$bodySm">
                    {intl.formatMessage({
                      id: ETranslations.perp_market_info_raw_source_tooltip__desc,
                    })}
                  </SizableText>
                }
              />
            </XStack>
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              lineHeight={26}
              numberOfLines={isInfoDescriptionExpanded ? undefined : 4}
            >
              {aboutText}
            </SizableText>
            {showDescriptionToggle ? (
              <XStack
                alignItems="center"
                gap="$1"
                alignSelf="flex-start"
                onPress={() => setIsInfoDescriptionExpanded((prev) => !prev)}
                cursor="default"
              >
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: isInfoDescriptionExpanded
                      ? ETranslations.global_collapse
                      : ETranslations.global_expand,
                  })}
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
              label={intl.formatMessage({ id: TAB_CONFIG[item].translationId })}
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
        <Stack px={paddingX} pb={paddingBottom}>
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
