import { memo, useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import Svg, { Circle } from 'react-native-svg';

import {
  Button,
  Divider,
  SegmentControl,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { LightweightChart } from '@onekeyhq/kit/src/components/LightweightChart';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { usePerpsActivePositionLengthAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { usePerpsActiveAccountMmrAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { getHyperliquidTokenImageUrl } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { useShowDepositWithdrawModal } from '../../hooks/useShowDepositWithdrawModal';

import {
  type IPortfolioChartType,
  type IPortfolioTimePeriod,
  usePerpPortfolioData,
} from './usePerpPortfolioData';

import type { BaselineSeriesPartialOptions } from 'lightweight-charts';

interface IPerpPortfolioContentProps {
  isMobile?: boolean;
}

const TIME_PERIOD_OPTIONS = [
  { label: '1D', value: 'day' as IPortfolioTimePeriod },
  { label: '1W', value: 'week' as IPortfolioTimePeriod },
  { label: '1M', value: 'month' as IPortfolioTimePeriod },
  { label: 'All', value: 'allTime' as IPortfolioTimePeriod },
];

const CHART_TYPE_OPTIONS = [
  { label: 'Value', value: 'accountValue' as IPortfolioChartType },
  { label: 'P&L', value: 'pnl' as IPortfolioChartType },
];

function formatUsd(value: number | null | undefined, showSign = false): string {
  if (value === null || value === undefined) return '--';
  const bn = new BigNumber(value);
  const abs = bn.abs().toFixed();
  const formatted = numberFormat(abs, {
    formatter: 'value',
    formatterOptions: { currency: '$' },
  });
  if (showSign && !bn.isZero()) {
    return bn.lt(0) ? `-${formatted}` : `+${formatted}`;
  }
  if (bn.lt(0)) {
    return `-${formatted}`;
  }
  return formatted;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '--';
  return `${new BigNumber(value).toFixed(1)}%`;
}

function pnlColor(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return '$text';
  return value > 0 ? '$green11' : '$red11';
}

const chartPriceFormatter = (price: number): string => {
  const abs = Math.abs(price);
  const sign = price < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1000) {
    return `${sign}$${(abs / 1000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  }
  if (Number.isInteger(abs)) {
    return `${sign}$${abs.toFixed(0)}`;
  }
  return `${sign}$${abs.toFixed(2)}`;
};

function SectionBlock({
  children,
  gap = '$3.5',
}: {
  children: React.ReactNode;
  gap?: string;
}) {
  return (
    <YStack bg="$bgSubdued" borderRadius="$3" p="$3.5" gap={gap as any}>
      {children}
    </YStack>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <SizableText
      size="$bodyXs"
      color="$textDisabled"
      textTransform="uppercase"
      letterSpacing={1.2}
    >
      {children}
    </SizableText>
  );
}

function formatCompactUsd(value: number): string {
  if (value === 0) return '$0';
  const bn = new BigNumber(value);
  const abs = bn.abs().toFixed();
  const formatted = numberFormat(abs, {
    formatter: 'marketCap',
    formatterOptions: { currency: '$' },
  });
  if (bn.lt(0)) {
    return `-${formatted}`;
  }
  return formatted;
}

function gaugeColor(pct: number): string {
  if (pct <= 40) return '#30a46c'; // green — safe ($green9)
  if (pct <= 70) return '#eab308'; // yellow — caution
  return '#e5484d'; // red — danger ($red9)
}

function SemiCircleGauge({
  percentage,
  label,
  value,
  size = 72,
  strokeWidth = 5,
  color,
}: {
  percentage: number;
  label: string;
  value: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const theme = useTheme();
  const arcColor = color ?? theme.textSuccess?.val ?? '#30a46c';
  const trackColor = theme.bgStrong?.val ?? '#333';

  const radius = (size - strokeWidth) / 2;
  // Semi-circle: half the circumference
  const semiCircumference = Math.PI * radius;
  const clamped = Math.min(Math.max(percentage, 0), 100);
  const offset = semiCircumference * (1 - clamped / 100);
  const center = size / 2;

  return (
    <YStack alignItems="center" gap="$0.5">
      <XStack position="relative" width={size} height={size / 2 + strokeWidth}>
        <Svg width={size} height={size / 2 + strokeWidth}>
          {/* Track (semi-circle) */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${semiCircumference}, ${semiCircumference * 2}`}
            transform={`rotate(180, ${center}, ${center})`}
          />
          {/* Progress arc */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={arcColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${semiCircumference}, ${semiCircumference * 2}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(180, ${center}, ${center})`}
          />
        </Svg>
        {/* Center value */}
        <YStack
          position="absolute"
          left={0}
          right={0}
          bottom={strokeWidth / 2}
          alignItems="center"
        >
          <SizableText size="$bodySmMedium" color="$text" numberOfLines={1}>
            {value}
          </SizableText>
        </YStack>
      </XStack>
      <SizableText
        size="$bodyXs"
        color="$textDisabled"
        textTransform="uppercase"
        letterSpacing={0.8}
      >
        {label}
      </SizableText>
    </YStack>
  );
}

function PerpPortfolioContentComponent({
  isMobile = false,
}: IPerpPortfolioContentProps) {
  const intl = useIntl();
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();
  const [mmrData] = usePerpsActiveAccountMmrAtom();
  const [positionsLength] = usePerpsActivePositionLengthAtom();

  const [timePeriod, setTimePeriod] = useState<IPortfolioTimePeriod>('allTime');
  const [chartType, setChartType] =
    useState<IPortfolioChartType>('accountValue');

  const [hoverData, setHoverData] = useState<{
    time: number;
    price: number;
    x: number;
    y: number;
  } | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const { chartData, fillsStats, netDeposits, accountSummary, isLoading } =
    usePerpPortfolioData(timePeriod);

  const chartSeriesData = useMemo((): IMarketTokenChart => {
    if (!chartData) return [];
    return chartType === 'accountValue'
      ? chartData.accountValueHistory
      : chartData.pnlHistory;
  }, [chartData, chartType]);

  const accountValue = formatUsd(
    parseFloat(accountSummary?.accountValue ?? '0'),
  );
  const withdrawable = formatUsd(
    parseFloat(accountSummary?.withdrawable ?? '0'),
  );

  const unrealizedPnlRaw = parseFloat(
    accountSummary?.totalUnrealizedPnl ?? '0',
  );
  const unrealizedPnl = formatUsd(unrealizedPnlRaw, true);
  const unrealizedColor = pnlColor(unrealizedPnlRaw);

  const realizedPnl = formatUsd(fillsStats.realizedPnl, true);
  const realizedColor = pnlColor(fillsStats.realizedPnl);

  const vlm = chartData?.vlm
    ? formatCompactUsd(parseFloat(chartData.vlm))
    : '--';

  const winRateVal =
    fillsStats.winRate !== null ? formatPercent(fillsStats.winRate) : '--';
  const winRateClr = pnlColor(
    fillsStats.winRate !== null ? fillsStats.winRate - 50 : null,
  );

  // Account Health computed values
  const leverageRaw = useMemo(() => {
    const ntlPos = parseFloat(accountSummary?.totalNtlPos ?? '0');
    const acctVal = parseFloat(accountSummary?.accountValue ?? '0');
    if (acctVal === 0) return 0;
    return Math.abs(ntlPos) / acctVal;
  }, [accountSummary]);
  const leverageText = leverageRaw > 0 ? `${leverageRaw.toFixed(2)}x` : '--';
  // Gauge: cap leverage at 20x for visual scale
  const leverageGaugePct = Math.min((leverageRaw / 20) * 100, 100);

  const marginUsedRaw = parseFloat(accountSummary?.totalMarginUsed ?? '0');
  const marginUsedText = formatCompactUsd(marginUsedRaw);
  const acctValRaw = parseFloat(accountSummary?.accountValue ?? '0');
  // Gauge: margin used as % of account value
  const marginUsedGaugePct =
    acctValRaw > 0 ? (marginUsedRaw / acctValRaw) * 100 : 0;

  const marginPercentRaw = parseFloat(mmrData?.mmrPercent ?? '0');
  const marginPercentText = mmrData?.mmrPercent
    ? `${mmrData.mmrPercent}%`
    : '--';

  const handleTimePeriodChange = useCallback(
    (v: string | number) => setTimePeriod(v as IPortfolioTimePeriod),
    [],
  );
  const handleChartTypeChange = useCallback(
    (v: string | number) => setChartType(v as IPortfolioChartType),
    [],
  );

  const handleHover = useCallback(
    ({
      time,
      price,
      x,
      y,
    }: {
      time?: number;
      price?: number;
      x?: number;
      y?: number;
    }) => {
      if (
        time !== undefined &&
        price !== undefined &&
        x !== undefined &&
        y !== undefined
      ) {
        setHoverData({ time, price, x, y });
      } else {
        setHoverData(null);
      }
    },
    [],
  );

  const tooltipPosition = useMemo(() => {
    if (!hoverData || !containerWidth) return null;
    const W = 148;
    const OFFSET = 10;
    const EDGE = 8;
    const isLeft = hoverData.x < containerWidth / 2;
    const tx = isLeft ? 0 : -W;
    const desired = isLeft ? hoverData.x + OFFSET : hoverData.x - OFFSET;
    const clamped = Math.min(
      Math.max(desired + tx, EDGE),
      containerWidth - W - EDGE,
    );
    return {
      left: clamped - tx,
      translateX: tx,
      top: Math.max(8, hoverData.y - 64),
    };
  }, [hoverData, containerWidth]);

  const formatHoverDate = useCallback(
    (ts: number) =>
      intl.formatDate(new Date(ts * 1000), {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    [intl],
  );

  // ─── Chart ──────────────────────────────────────────────────────────────────
  const chartHeight = isMobile ? 260 : 480;
  const isPnl = chartType === 'pnl';

  const baselineOptions = useMemo(
    (): BaselineSeriesPartialOptions => ({
      baseValue: { type: 'price', price: 0 },
      topLineColor: '#30a46c',
      topFillColor1: 'rgba(48, 164, 108, 0.24)',
      topFillColor2: 'rgba(48, 164, 108, 0.0)',
      bottomLineColor: '#e5484d',
      bottomFillColor1: 'rgba(229, 72, 77, 0.0)',
      bottomFillColor2: 'rgba(229, 72, 77, 0.24)',
    }),
    [],
  );

  const chartPanel = (
    <YStack flex={1} gap="$3">
      {/* Controls */}
      <XStack justifyContent="space-between" alignItems="center">
        <SegmentControl
          value={chartType}
          onChange={handleChartTypeChange}
          options={CHART_TYPE_OPTIONS}
        />
        <SegmentControl
          value={timePeriod}
          onChange={handleTimePeriodChange}
          options={TIME_PERIOD_OPTIONS}
        />
      </XStack>

      {/* Chart — negative mr shifts chart right so plot area aligns with controls */}
      {isLoading ? (
        <Skeleton height={chartHeight} borderRadius="$2" />
      ) : (
        <YStack
          position="relative"
          flex={1}
          mr={isMobile ? -12 : -16}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w !== containerWidth) setContainerWidth(w);
          }}
        >
          {hoverData && tooltipPosition ? (
            <YStack
              position="absolute"
              top={tooltipPosition.top}
              left={tooltipPosition.left}
              transform={[{ translateX: tooltipPosition.translateX }]}
              bg="$bg"
              borderRadius="$2"
              borderWidth={1}
              borderColor="$borderSubdued"
              px="$3"
              py="$2"
              zIndex={100}
              pointerEvents="none"
              width={148}
            >
              <YStack gap="$1">
                <SizableText size="$bodyXs" color="$textDisabled">
                  {formatHoverDate(hoverData.time)}
                </SizableText>
                <XStack justifyContent="space-between" alignItems="center">
                  <SizableText size="$bodyXs" color="$textSubdued">
                    {chartType === 'accountValue' ? 'Value' : 'P&L'}
                  </SizableText>
                  <SizableText size="$bodySmMedium" color="$text">
                    {formatUsd(hoverData.price)}
                  </SizableText>
                </XStack>
              </YStack>
            </YStack>
          ) : null}
          <LightweightChart
            data={chartSeriesData}
            height={chartHeight}
            onHover={handleHover}
            lineColor="#2EAA40"
            topColor="#2EAA4026"
            bottomColor="#2EAA4000"
            lineWidth={3}
            showPriceScale
            showHorzGridLines
            priceFormatter={chartPriceFormatter}
            fontSize={11}
            seriesType={isPnl ? 'baseline' : 'area'}
            baselineOptions={isPnl ? baselineOptions : undefined}
            showLastValue
          />
        </YStack>
      )}

      {/* P&L + Win Rate summary */}
      <SectionBlock>
        <XStack justifyContent="space-between" alignItems="center">
          <YStack gap="$0.5">
            <SizableText size="$bodyXs" color="$textDisabled">
              Unrealized P&L
            </SizableText>
            <SizableText size="$headingSm" color={unrealizedColor as any}>
              {unrealizedPnl}
            </SizableText>
          </YStack>
          <YStack gap="$0.5" alignItems="center">
            <SizableText size="$bodyXs" color="$textDisabled">
              Total P&L
            </SizableText>
            <SizableText size="$headingSm" color={realizedColor as any}>
              {realizedPnl}
            </SizableText>
          </YStack>
          <YStack gap="$0.5" alignItems="flex-end">
            <SizableText size="$bodyXs" color="$textDisabled">
              Positions
            </SizableText>
            <SizableText size="$headingSm" color="$text">
              {positionsLength ?? 0}
            </SizableText>
          </YStack>
        </XStack>
      </SectionBlock>
    </YStack>
  );

  // Win rate progress value (0-100)
  const winRateProgress = fillsStats.winRate ?? 0;

  // ─── Portfolio Value (shared between mobile top + desktop stats) ────────────
  const portfolioValueBlock = (
    <SectionBlock gap="$3">
      <XStack justifyContent="space-between" alignItems="flex-start">
        <YStack gap="$0.5">
          <SectionLabel>Portfolio Value</SectionLabel>
          <SizableText size="$heading2xl" color="$text">
            {accountValue}
          </SizableText>
        </YStack>
        <YStack gap="$0.5" alignItems="flex-end">
          <SectionLabel>Available</SectionLabel>
          <SizableText size="$headingMd" color="$text">
            {withdrawable}
          </SizableText>
        </YStack>
      </XStack>
      <XStack gap="$2">
        <Button
          flex={1}
          borderRadius="$full"
          size="medium"
          bg="$brand8"
          hoverStyle={{ bg: '$brand9' }}
          pressStyle={{ bg: '$brand10' }}
          color="$textOnColor"
          iconColor="$iconOnColor"
          icon="DownloadOutline"
          onPress={() => showDepositWithdrawModal('deposit')}
        >
          {intl.formatMessage({
            id: ETranslations.perp_trade_deposit,
          })}
        </Button>
        <Button
          flex={1}
          borderRadius="$full"
          size="medium"
          variant="secondary"
          icon="AlignTopOutline"
          onPress={() => showDepositWithdrawModal('withdraw')}
        >
          {intl.formatMessage({
            id: ETranslations.perp_trade_withdraw,
          })}
        </Button>
      </XStack>
    </SectionBlock>
  );

  // ─── Stats ──────────────────────────────────────────────────────────────────
  const statsPanel = (
    <YStack gap="$3">
      {/* Account Health */}
      <SectionBlock>
        <SectionLabel>Account Health</SectionLabel>
        <XStack justifyContent="space-around" alignItems="flex-end">
          <SemiCircleGauge
            percentage={leverageGaugePct}
            label="Leverage"
            value={leverageText}
            color={gaugeColor(leverageGaugePct)}
          />
          <SemiCircleGauge
            percentage={marginUsedGaugePct}
            label="Margin Used"
            value={marginUsedText}
            color={gaugeColor(marginUsedGaugePct)}
          />
          <SemiCircleGauge
            percentage={marginPercentRaw}
            label="Margin %"
            value={marginPercentText}
            color={gaugeColor(marginPercentRaw)}
          />
        </XStack>
      </SectionBlock>

      {/* Activity — moved above Performance per request */}
      <SectionBlock gap="$3.5">
        <SectionLabel>Activity</SectionLabel>
        {/* Volume row — hero number */}
        <XStack justifyContent="space-between" alignItems="flex-end">
          <YStack gap="$0.5">
            <SizableText size="$bodyXs" color="$textDisabled">
              Volume
            </SizableText>
            <SizableText size="$headingMd" color="$text">
              {vlm}
            </SizableText>
          </YStack>
          {fillsStats.mostTraded ? (
            <YStack gap="$0.5" alignItems="flex-end">
              <SizableText size="$bodyXs" color="$textDisabled">
                Most Traded
              </SizableText>
              <XStack gap="$1.5" alignItems="center">
                <Token
                  size="xs"
                  tokenImageUri={getHyperliquidTokenImageUrl(
                    fillsStats.mostTraded,
                  )}
                />
                <SizableText size="$headingSm" color="$text">
                  {fillsStats.mostTraded}
                </SizableText>
              </XStack>
            </YStack>
          ) : null}
        </XStack>
        <Divider />
        {/* Fees + Deposits — compact row */}
        <XStack justifyContent="space-between" alignItems="center">
          <YStack gap="$0.5">
            <SizableText size="$bodyXs" color="$textDisabled">
              Fees Paid
            </SizableText>
            <SizableText size="$bodyMdMedium" color="$text">
              {formatCompactUsd(fillsStats.feesPaid ?? 0)}
            </SizableText>
          </YStack>
          <YStack gap="$0.5" alignItems="center">
            <SizableText size="$bodyXs" color="$textDisabled">
              Net Deposits
            </SizableText>
            <SizableText size="$bodyMdMedium" color="$text">
              {formatCompactUsd(netDeposits ?? 0)}
            </SizableText>
          </YStack>
          <YStack gap="$0.5" alignItems="flex-end">
            <SizableText size="$bodyXs" color="$textDisabled">
              Total Trades
            </SizableText>
            <SizableText size="$bodyMdMedium" color="$text">
              {fillsStats.totalTrades}
            </SizableText>
          </YStack>
        </XStack>
      </SectionBlock>

      {/* Performance — with win rate progress bar */}
      <SectionBlock gap="$3.5">
        <SectionLabel>Performance</SectionLabel>
        {/* Win Rate with progress bar */}
        <YStack gap="$2">
          <XStack justifyContent="space-between" alignItems="flex-end">
            <YStack gap="$0.5">
              <SizableText size="$bodyXs" color="$textDisabled">
                Win Rate
              </SizableText>
              <SizableText size="$headingLg" color={winRateClr as any}>
                {winRateVal}
              </SizableText>
            </YStack>
            <YStack gap="$0.5" alignItems="flex-end">
              <SizableText size="$bodyXs" color="$textDisabled">
                Profit Factor
              </SizableText>
              <SizableText size="$headingSm" color="$text">
                {fillsStats.profitFactor !== null
                  ? new BigNumber(fillsStats.profitFactor).toFixed(2)
                  : '--'}
              </SizableText>
            </YStack>
          </XStack>
          {/* Win rate bar — green (win) + red (loss) */}
          <XStack height={4} borderRadius="$full" overflow="hidden">
            <XStack
              flex={winRateProgress}
              bg="$green9"
              borderTopLeftRadius="$full"
              borderBottomLeftRadius="$full"
            />
            <XStack
              flex={100 - winRateProgress}
              bg="$red9"
              borderTopRightRadius="$full"
              borderBottomRightRadius="$full"
            />
          </XStack>
        </YStack>
        {/* Avg Win / Loss — side by side cards */}
        <XStack gap="$2">
          <YStack flex={1} bg="$bgHover" borderRadius="$2" p="$2.5" gap="$0.5">
            <SizableText size="$bodyXs" color="$textDisabled">
              Avg Win
            </SizableText>
            <SizableText size="$bodyMdMedium" color="$green11">
              {formatUsd(fillsStats.avgWin, true)}
            </SizableText>
          </YStack>
          <YStack flex={1} bg="$bgHover" borderRadius="$2" p="$2.5" gap="$0.5">
            <SizableText size="$bodyXs" color="$textDisabled">
              Avg Loss
            </SizableText>
            <SizableText size="$bodyMdMedium" color="$red11">
              {formatUsd(fillsStats.avgLoss, true)}
            </SizableText>
          </YStack>
        </XStack>
      </SectionBlock>
    </YStack>
  );

  // ─── Mobile ─────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <YStack gap="$4" px="$5" pb="$5">
        {portfolioValueBlock}
        {chartPanel}
        {statsPanel}
      </YStack>
    );
  }

  // ─── Desktop ────────────────────────────────────────────────────────────────
  return (
    <XStack flex={1} gap="$5">
      <YStack flex={6} flexBasis={0} overflow="visible" zIndex={1}>
        {chartPanel}
      </YStack>
      <YStack flex={4} flexBasis={0} gap="$3">
        {portfolioValueBlock}
        {statsPanel}
      </YStack>
    </XStack>
  );
}

export const PerpPortfolioContent = memo(PerpPortfolioContentComponent);
