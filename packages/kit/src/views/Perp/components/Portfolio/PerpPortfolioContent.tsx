import { memo, useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import Svg, { Circle } from 'react-native-svg';

import {
  ActionList,
  Button,
  DashText,
  Divider,
  Icon,
  SegmentControl,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { LightweightChart } from '@onekeyhq/kit/src/components/LightweightChart';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { deferHeavyWorkUntilUIIdle } from '@onekeyhq/kit/src/utils/deferHeavyWork';
import {
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountMmrAtom,
  usePerpsComputedAccountValueAtom,
  useSpotPairDisplayMapAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  formatChartUsdPrice,
  formatPerpsCompactUsd,
  formatPerpsUsd,
  getHyperliquidTokenImageUrl,
  getPerpsValueColor,
  getSpotTokenDisplayName,
  isSpotInstrument,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { usePerpsActivePositionsByAddress } from '../../hooks/usePerpsActivePositionsByAddress';
import { useShowDepositWithdrawModal } from '../../hooks/useShowDepositWithdrawModal';
import { PERP_DIALOG_BUTTON_SIZE } from '../PerpDialogLayout';

import {
  type IPortfolioChartType,
  type IPortfolioPnlType,
  type IPortfolioTimePeriod,
  usePerpPortfolioData,
} from './usePerpPortfolioData';

import type { BaselineSeriesPartialOptions } from 'lightweight-charts';

interface IPerpPortfolioContentProps {
  isMobile?: boolean;
}

const WIN_RATE_TOOLTIP_MAP: Record<IPortfolioTimePeriod, ETranslations> = {
  day: ETranslations.perp_portfolio_win_rate_tooltip_day__desc,
  week: ETranslations.perp_portfolio_win_rate_tooltip_week__desc,
  month: ETranslations.perp_portfolio_win_rate_tooltip_month__desc,
  allTime: ETranslations.perp_portfolio_win_rate_tooltip_all_time__desc,
};

// Time period and chart type options are built inside the component using intl

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '--';
  return `${new BigNumber(value).toFixed(1)}%`;
}

function SectionBlock({
  children,
  gap,
}: {
  children: React.ReactNode;
  gap?: '$3' | '$3.5';
}) {
  return (
    <YStack bg="$bgSubdued" borderRadius="$3" p="$3.5" gap={gap ?? '$3.5'}>
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

const GAUGE_SAFE_THRESHOLD = 40;
const GAUGE_CAUTION_THRESHOLD = 70;
const COLOR_SAFE = '#30a46c';
const COLOR_CAUTION = '#eab308';
const COLOR_DANGER = '#e5484d';
const MAX_LEVERAGE_GAUGE = 20;
const CHART_HEIGHT_DESKTOP = 480;
const CHART_HEIGHT_MOBILE = 260;
const HOVER_TOOLTIP_WIDTH = 148;
const CHART_PRICE_SCALE_MARGINS = { top: 0.12, bottom: 0.12 };

function gaugeColor(pct: number): string {
  if (pct <= GAUGE_SAFE_THRESHOLD) return COLOR_SAFE;
  if (pct <= GAUGE_CAUTION_THRESHOLD) return COLOR_CAUTION;
  return COLOR_DANGER;
}

// Margin Used gauge: green/yellow only (no red — high utilization ≠ liquidation risk)
function marginUsedGaugeColor(pct: number): string {
  if (pct <= GAUGE_SAFE_THRESHOLD) return COLOR_SAFE;
  return COLOR_CAUTION;
}

// Composite risk score: MMR×3 + Leverage×2 + MarginUsed×1
function computeAccountHealthRisk(
  mmrPct: number,
  leverageX: number,
  marginUsedPct: number,
): { level: 'safe' | 'caution' | 'danger'; color: string } {
  let mmrScore = 2;
  if (mmrPct <= 30) mmrScore = 0;
  else if (mmrPct <= 60) mmrScore = 1;

  let levScore = 2;
  if (leverageX <= 5) levScore = 0;
  else if (leverageX <= 15) levScore = 1;

  let marginScore = 2;
  if (marginUsedPct <= 60) marginScore = 0;
  else if (marginUsedPct <= 85) marginScore = 1;

  const total = mmrScore * 3 + levScore * 2 + marginScore * 1;

  if (total >= 6) return { level: 'danger', color: COLOR_DANGER };
  if (total >= 3) return { level: 'caution', color: COLOR_CAUTION };
  return { level: 'safe', color: COLOR_SAFE };
}

function SemiCircleGauge({
  percentage,
  label,
  labelNode,
  value,
  size = 72,
  strokeWidth = 5,
  color,
}: {
  percentage: number;
  label: string;
  labelNode?: React.ReactNode;
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
      {labelNode ?? (
        <SizableText
          size="$bodyXs"
          color="$textDisabled"
          textTransform="uppercase"
          letterSpacing={0.8}
        >
          {label}
        </SizableText>
      )}
    </YStack>
  );
}

function PerpPortfolioContentComponent({
  isMobile = false,
}: IPerpPortfolioContentProps) {
  const intl = useIntl();
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();

  const timePeriodOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({
          id: ETranslations.perp_portfolio_period_1d,
        }),
        value: 'day' as IPortfolioTimePeriod,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.perp_portfolio_period_1w,
        }),
        value: 'week' as IPortfolioTimePeriod,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.perp_portfolio_period_1m,
        }),
        value: 'month' as IPortfolioTimePeriod,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.perp_portfolio_period_all,
        }),
        value: 'allTime' as IPortfolioTimePeriod,
      },
    ],
    [intl],
  );

  const chartTypeOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({
          id: ETranslations.perp_portfolio_chart_type_value,
        }),
        value: 'accountValue' as IPortfolioChartType,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.perp_portfolio_chart_type_pnl,
        }),
        value: 'pnl' as IPortfolioChartType,
      },
    ],
    [intl],
  );
  const pnlTypeOptions = useMemo(() => {
    const allLabel = intl.formatMessage({
      id: ETranslations.global_all,
    });
    const perpsLabel = intl.formatMessage({
      id: ETranslations.global_perp,
    });
    const spotLabel = intl.formatMessage({
      id: ETranslations.dexmarket_spot,
    });
    return [
      {
        label: allLabel,
        value: 'all' as IPortfolioPnlType,
      },
      {
        label: perpsLabel,
        value: 'perps' as IPortfolioPnlType,
      },
      {
        label: spotLabel,
        value: 'spot' as IPortfolioPnlType,
      },
    ];
  }, [intl]);
  const [activeAccount] = usePerpsActiveAccountAtom();
  const [mmrData] = usePerpsActiveAccountMmrAtom();
  const positionsLength = usePerpsActivePositionsByAddress(
    activeAccount?.accountAddress,
  ).length;

  const [timePeriod, setTimePeriod] = useState<IPortfolioTimePeriod>('allTime');
  const [chartType, setChartType] =
    useState<IPortfolioChartType>('accountValue');
  const [pnlType, setPnlType] = useState<IPortfolioPnlType>('all');
  const handlePnlTypeChange = useCallback(
    (nextPnlType: IPortfolioPnlType) => {
      if (nextPnlType === pnlType) return;
      if (platformEnv.isNative) {
        void deferHeavyWorkUntilUIIdle({ minFrames: 1 }).then(() => {
          setPnlType(nextPnlType);
        });
        return;
      }
      setPnlType(nextPnlType);
    },
    [pnlType],
  );
  const selectedPnlTypeLabel = useMemo(
    () =>
      pnlTypeOptions.find((item) => item.value === pnlType)?.label ??
      intl.formatMessage({
        id: ETranslations.perp_portfolio_chart_type_pnl,
      }),
    [intl, pnlType, pnlTypeOptions],
  );
  const pnlTypeActionItems = useMemo(
    () =>
      pnlTypeOptions.map((option) => ({
        label: option.label,
        onPress: () => {
          handlePnlTypeChange(option.value);
        },
        extra:
          option.value === pnlType ? (
            <Icon name="CheckLargeOutline" size="$5" color="$iconActive" />
          ) : undefined,
      })),
    [handlePnlTypeChange, pnlType, pnlTypeOptions],
  );
  const mobileChartTypeOptions = useMemo(
    () =>
      chartTypeOptions.map((option) => ({
        ...option,
        label: (
          <XStack height={20} alignItems="center" justifyContent="center">
            <SizableText
              size="$bodySmMedium"
              color={chartType === option.value ? '$textInverse' : '$text'}
              textAlign="center"
              numberOfLines={1}
            >
              {option.label}
            </SizableText>
          </XStack>
        ),
      })),
    [chartType, chartTypeOptions],
  );
  const mobileTimePeriodOptions = useMemo(
    () =>
      timePeriodOptions.map((option) => ({
        ...option,
        label: (
          <XStack height={20} alignItems="center" justifyContent="center">
            <SizableText
              size="$bodySmMedium"
              color={timePeriod === option.value ? '$textInverse' : '$text'}
              textAlign="center"
              numberOfLines={1}
            >
              {option.label}
            </SizableText>
          </XStack>
        ),
      })),
    [timePeriod, timePeriodOptions],
  );

  const [hoverData, setHoverData] = useState<{
    time: number;
    price: number;
    x: number;
    y: number;
  } | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const activityType: IPortfolioPnlType = chartType === 'pnl' ? pnlType : 'all';

  const {
    chartData,
    fillsStats,
    netDeposits,
    accountSummary,
    pnlTotals,
    isLoading,
  } = usePerpPortfolioData(timePeriod, activityType);
  const [computedValue] = usePerpsComputedAccountValueAtom();
  const [spotPairDisplayMap] = useSpotPairDisplayMapAtom();

  const chartSeriesData = useMemo((): IMarketTokenChart => {
    if (!chartData) return [];
    if (chartType === 'accountValue') return chartData.accountValueHistory;
    if (pnlType === 'perps') return chartData.perpsPnlHistory;
    if (pnlType === 'spot') return chartData.nonPerpsPnlHistory;
    return chartData.pnlHistory;
  }, [chartData, chartType, pnlType]);

  const accountValue = formatPerpsUsd(
    parseFloat(computedValue?.accountValue ?? '0'),
  );
  const withdrawable = formatPerpsUsd(
    parseFloat(computedValue?.withdrawable ?? '0'),
  );

  const unrealizedPnlRaw = parseFloat(
    accountSummary?.totalUnrealizedPnl ?? '0',
  );
  const unrealizedPnl = formatPerpsUsd(unrealizedPnlRaw, true);
  const unrealizedColor = getPerpsValueColor(unrealizedPnlRaw);

  let fallbackPnlVal = fillsStats.realizedPnl;
  if (chartType === 'pnl') {
    if (pnlType === 'perps') {
      fallbackPnlVal = fillsStats.realizedPnl - fillsStats.spotRealizedPnl;
    } else if (pnlType === 'spot') {
      fallbackPnlVal = fillsStats.spotRealizedPnl;
    }
  }
  const selectedPnlVal =
    chartType === 'pnl' ? pnlTotals[pnlType] : pnlTotals.all;
  const totalPnlVal = selectedPnlVal ?? fallbackPnlVal;
  const realizedPnl = formatPerpsUsd(totalPnlVal, true);
  const realizedColor = getPerpsValueColor(totalPnlVal);
  const totalPnlTooltip = intl.formatMessage({
    id: ETranslations.perp_portfolio_total_pnl_tooltip__desc,
  });
  const winRateTooltip = intl.formatMessage({
    id: WIN_RATE_TOOLTIP_MAP[timePeriod],
  });

  const vlm = useMemo(() => {
    if (activityType !== 'all') {
      if (fillsStats.totalTrades > 0) {
        return formatPerpsCompactUsd(fillsStats.volumeUsd);
      }
      return '--';
    }
    if (chartData?.vlm) {
      return formatPerpsCompactUsd(parseFloat(chartData.vlm));
    }
    return '--';
  }, [
    activityType,
    chartData?.vlm,
    fillsStats.totalTrades,
    fillsStats.volumeUsd,
  ]);

  const winRateVal =
    fillsStats.winRate !== null ? formatPercent(fillsStats.winRate) : '--';
  const winRateClr = getPerpsValueColor(
    fillsStats.winRate !== null ? fillsStats.winRate - 50 : null,
  );

  const mostTradedTokenDisplayName = useMemo(() => {
    const coin = fillsStats.mostTraded;
    if (!coin) return null;

    if (isSpotInstrument(coin)) {
      const mapped = spotPairDisplayMap[coin];
      if (mapped) return mapped;
      if (coin.includes('/')) {
        const [baseName] = coin.split('/');
        return getSpotTokenDisplayName(baseName);
      }
    }

    return parseDexCoin(coin).displayName;
  }, [fillsStats.mostTraded, spotPairDisplayMap]);

  // Account Health computed values
  const leverageRaw = useMemo(() => {
    const ntlPos = parseFloat(accountSummary?.totalNtlPos ?? '0');
    const acctVal = parseFloat(computedValue?.accountValue ?? '0');
    if (acctVal <= 0) return acctVal < 0 ? MAX_LEVERAGE_GAUGE : 0;
    return Math.abs(ntlPos) / acctVal;
  }, [accountSummary?.totalNtlPos, computedValue?.accountValue]);
  const leverageText = leverageRaw > 0 ? `${leverageRaw.toFixed(2)}x` : '--';
  const leverageGaugePct = Math.min(
    (leverageRaw / MAX_LEVERAGE_GAUGE) * 100,
    100,
  );

  const marginUsedRaw = parseFloat(accountSummary?.totalMarginUsed ?? '0');
  const marginUsedText = formatPerpsCompactUsd(marginUsedRaw);
  const acctValRaw = parseFloat(computedValue?.accountValue ?? '0');
  // Gauge: margin used as % of account value
  const marginUsedGaugePct =
    acctValRaw > 0 ? (marginUsedRaw / acctValRaw) * 100 : 0;

  const marginPercentRaw = parseFloat(mmrData?.mmrPercent ?? '0');
  const marginPercentText = mmrData?.mmrPercent
    ? `${mmrData.mmrPercent}%`
    : '--';

  const hasPosition =
    leverageRaw > 0 || marginUsedRaw > 0 || marginPercentRaw > 0;

  const accountHealthRisk = useMemo(
    () =>
      computeAccountHealthRisk(
        marginPercentRaw,
        leverageRaw,
        marginUsedGaugePct,
      ),
    [marginPercentRaw, leverageRaw, marginUsedGaugePct],
  );
  const accountHealthText = useMemo(() => {
    switch (accountHealthRisk.level) {
      case 'danger':
        return intl.formatMessage({
          id: ETranslations.perp_portfolio_health_status_high_risk,
        });
      case 'caution':
        return intl.formatMessage({
          id: ETranslations.perp_portfolio_health_status_moderate,
        });
      default:
        return intl.formatMessage({
          id: ETranslations.perp_portfolio_health_status_healthy,
        });
    }
  }, [accountHealthRisk.level, intl]);

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
    const W = HOVER_TOOLTIP_WIDTH;
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
  const chartHeight = isMobile ? CHART_HEIGHT_MOBILE : CHART_HEIGHT_DESKTOP;
  const isPnl = chartType === 'pnl';
  const chartTooltipLabel =
    chartType === 'accountValue'
      ? intl.formatMessage({
          id: ETranslations.perp_portfolio_chart_type_value,
        })
      : selectedPnlTypeLabel;

  const baselineOptions = useMemo(
    (): BaselineSeriesPartialOptions => ({
      baseValue: { type: 'price', price: 0 },
      topLineColor: COLOR_SAFE,
      topFillColor1: 'rgba(48, 164, 108, 0.24)',
      topFillColor2: 'rgba(48, 164, 108, 0.0)',
      bottomLineColor: COLOR_DANGER,
      bottomFillColor1: 'rgba(229, 72, 77, 0.0)',
      bottomFillColor2: 'rgba(229, 72, 77, 0.24)',
    }),
    [],
  );

  const pnlTypeSelectorTrigger = (
    <XStack
      testID="perp-portfolio-pnl-type-selector"
      alignItems="center"
      gap="$1"
      py="$1"
      userSelect="none"
      cursor="pointer"
    >
      <SizableText
        size={isMobile ? '$bodySmMedium' : '$bodyMdMedium'}
        color="$text"
        numberOfLines={1}
        maxWidth={isMobile ? '$24' : undefined}
      >
        {selectedPnlTypeLabel}
      </SizableText>
      <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );

  let pnlTypeSelector: React.ReactNode = null;
  if (isPnl) {
    pnlTypeSelector = (
      <ActionList
        title={intl.formatMessage({
          id: ETranslations.perp_portfolio_chart_type_pnl,
        })}
        placement="bottom-start"
        items={pnlTypeActionItems}
        floatingPanelProps={{ width: '$48' }}
        renderTrigger={pnlTypeSelectorTrigger}
      />
    );
  }

  const chartPanel = (
    <YStack flex={1} gap="$3">
      {/* Controls */}
      {isMobile ? (
        <YStack gap="$2">
          <XStack
            width="100%"
            justifyContent="space-between"
            alignItems="center"
            gap="$2"
            flexWrap="wrap"
          >
            <XStack alignItems="center" gap="$2" flexShrink={1}>
              <SegmentControl
                h={28}
                value={chartType}
                onChange={handleChartTypeChange}
                options={mobileChartTypeOptions}
                segmentControlItemStyleProps={{
                  px: '$2.5',
                  py: '$1',
                }}
              />
              {pnlTypeSelector}
            </XStack>
            <SegmentControl
              h={28}
              value={timePeriod}
              onChange={handleTimePeriodChange}
              options={mobileTimePeriodOptions}
              segmentControlItemStyleProps={{
                px: '$2.5',
                py: '$1',
              }}
            />
          </XStack>
        </YStack>
      ) : (
        <YStack gap="$2">
          <XStack
            justifyContent="space-between"
            alignItems="center"
            gap="$2"
            flexWrap="wrap"
          >
            <XStack alignItems="center" gap="$3">
              <SegmentControl
                value={chartType}
                onChange={handleChartTypeChange}
                options={chartTypeOptions}
              />
              {pnlTypeSelector}
            </XStack>
            <SegmentControl
              value={timePeriod}
              onChange={handleTimePeriodChange}
              options={timePeriodOptions}
            />
          </XStack>
        </YStack>
      )}

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
              width={HOVER_TOOLTIP_WIDTH}
            >
              <YStack gap="$1">
                <SizableText size="$bodyXs" color="$textDisabled">
                  {formatHoverDate(hoverData.time)}
                </SizableText>
                <XStack justifyContent="space-between" alignItems="center">
                  <SizableText size="$bodyXs" color="$textSubdued">
                    {chartTooltipLabel}
                  </SizableText>
                  <SizableText size="$bodySmMedium" color="$text">
                    {formatPerpsUsd(hoverData.price)}
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
            priceScaleMargins={CHART_PRICE_SCALE_MARGINS}
            priceFormatter={formatChartUsdPrice}
            fontSize={11}
            seriesType={isPnl ? 'baseline' : 'area'}
            baselineOptions={isPnl ? baselineOptions : undefined}
            showLastValue
          />
        </YStack>
      )}

      {/* P&L + Win Rate summary */}
      <SectionBlock>
        <XStack alignItems="center">
          <YStack flex={1} minWidth={0} gap="$0.5">
            <SizableText size="$bodyXs" color="$textDisabled">
              {intl.formatMessage({
                id: ETranslations.perp_portfolio_unrealized_pnl,
              })}
            </SizableText>
            <SizableText
              size="$headingSm"
              color={unrealizedColor}
              numberOfLines={1}
              minWidth={0}
            >
              {unrealizedPnl}
            </SizableText>
          </YStack>
          <YStack flex={1} minWidth={0} gap="$0.5" alignItems="center">
            <DashText
              size="$bodyXs"
              color="$textDisabled"
              dashThickness={0.5}
              tooltip={totalPnlTooltip}
            >
              {intl.formatMessage({
                id: ETranslations.perp_portfolio_total_pnl,
              })}
            </DashText>
            <SizableText
              size="$headingSm"
              color={realizedColor}
              numberOfLines={1}
              minWidth={0}
              maxWidth="100%"
              textAlign="center"
            >
              {realizedPnl}
            </SizableText>
          </YStack>
          <YStack flex={1} minWidth={0} gap="$0.5" alignItems="flex-end">
            <SizableText size="$bodyXs" color="$textDisabled">
              {intl.formatMessage({
                id: ETranslations.perp_portfolio_open_positions,
              })}
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

  // ─── Portfolio Value buttons (shared) ───────────────────────────────────────
  const portfolioButtons = (
    <XStack gap="$2">
      <Button
        testID="perp-portfolio-buttons-btn"
        flex={1}
        borderRadius="$full"
        size={PERP_DIALOG_BUTTON_SIZE}
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
        testID="perp-portfolio-buttons-btn"
        flex={1}
        borderRadius="$full"
        size={PERP_DIALOG_BUTTON_SIZE}
        variant="secondary"
        icon="AlignTopOutline"
        onPress={() => showDepositWithdrawModal('withdraw')}
      >
        {intl.formatMessage({
          id: ETranslations.perp_trade_withdraw,
        })}
      </Button>
    </XStack>
  );

  // ─── Portfolio Value — mobile layout ────────────────────────────────────────
  const mobilePortfolioValueBlock = (
    <YStack gap="$3">
      <YStack gap="$1">
        <SectionLabel>
          {intl.formatMessage({ id: ETranslations.perp_portfolio_value })}
        </SectionLabel>
        <SizableText size="$heading4xl" color="$text">
          {accountValue}
        </SizableText>
        <XStack gap="$1.5" alignItems="center">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.perp_portfolio_available })}
          </SizableText>
          <SizableText size="$bodySm" color="$text">
            {withdrawable}
          </SizableText>
        </XStack>
      </YStack>
      {portfolioButtons}
    </YStack>
  );

  // ─── Portfolio Value — desktop layout ───────────────────────────────────────
  const portfolioValueBlock = (
    <SectionBlock gap="$3">
      <XStack justifyContent="space-between" alignItems="flex-start">
        <YStack gap="$0.5">
          <SectionLabel>
            {intl.formatMessage({ id: ETranslations.perp_portfolio_value })}
          </SectionLabel>
          <SizableText size="$heading2xl" color="$text">
            {accountValue}
          </SizableText>
        </YStack>
        <YStack gap="$0.5" alignItems="flex-end">
          <SectionLabel>
            {intl.formatMessage({ id: ETranslations.perp_portfolio_available })}
          </SectionLabel>
          <SizableText size="$headingMd" color="$text">
            {withdrawable}
          </SizableText>
        </YStack>
      </XStack>
      {portfolioButtons}
    </SectionBlock>
  );

  // ─── Stats ──────────────────────────────────────────────────────────────────
  const statsPanel = (
    <YStack gap="$3">
      {/* Account Health */}
      <SectionBlock>
        <XStack justifyContent="space-between" alignItems="center">
          <SectionLabel>
            {intl.formatMessage({
              id: ETranslations.perp_portfolio_account_health,
            })}
          </SectionLabel>
          {hasPosition ? (
            <XStack gap="$1.5" alignItems="center">
              <Stack
                width={6}
                height={6}
                borderRadius="$full"
                bg={accountHealthRisk.color}
              />
              <SizableText
                size="$bodyXs"
                color={accountHealthRisk.color}
                textTransform="uppercase"
                letterSpacing={1.2}
              >
                {accountHealthText}
              </SizableText>
            </XStack>
          ) : null}
        </XStack>
        <XStack justifyContent="space-around" alignItems="flex-end">
          <SemiCircleGauge
            percentage={leverageGaugePct}
            label={intl.formatMessage({ id: ETranslations.perp_leverage })}
            value={leverageText}
            color={gaugeColor(leverageGaugePct)}
          />
          <SemiCircleGauge
            percentage={marginUsedGaugePct}
            label={intl.formatMessage({
              id: ETranslations.perp_portfolio_margin_used,
            })}
            labelNode={
              <DashText
                size="$bodyXs"
                color="$textDisabled"
                dashThickness={0.5}
                textTransform="uppercase"
                letterSpacing={0.8}
                tooltip={intl.formatMessage({
                  id: ETranslations.perp_portfolio_margin_used_tooltip,
                })}
              >
                {intl.formatMessage({
                  id: ETranslations.perp_portfolio_margin_used,
                })}
              </DashText>
            }
            value={marginUsedText}
            color={marginUsedGaugeColor(marginUsedGaugePct)}
          />
          <SemiCircleGauge
            percentage={marginPercentRaw}
            label="MMR"
            labelNode={
              <DashText
                size="$bodyXs"
                color="$textDisabled"
                dashThickness={0.5}
                textTransform="uppercase"
                letterSpacing={0.8}
                tooltip={intl.formatMessage({
                  id: ETranslations.perp_portfolio_mmr_tooltip,
                })}
              >
                MMR
              </DashText>
            }
            value={marginPercentText}
            color={gaugeColor(marginPercentRaw)}
          />
        </XStack>
      </SectionBlock>

      {/* Activity — moved above Performance per request */}
      <SectionBlock gap="$3.5">
        <SectionLabel>
          {intl.formatMessage({ id: ETranslations.perp_portfolio_activity })}
        </SectionLabel>
        {/* Volume row — hero number */}
        <XStack justifyContent="space-between" alignItems="flex-end">
          <YStack gap="$0.5">
            <SizableText size="$bodyXs" color="$textDisabled">
              {intl.formatMessage({ id: ETranslations.perp_portfolio_volume })}
            </SizableText>
            <SizableText size="$headingMd" color="$text">
              {vlm}
            </SizableText>
          </YStack>
          <YStack gap="$0.5" alignItems="flex-end">
            <SizableText size="$bodyXs" color="$textDisabled">
              {intl.formatMessage({
                id: ETranslations.perp_portfolio_most_traded,
              })}
            </SizableText>
            {mostTradedTokenDisplayName ? (
              <XStack gap="$1.5" alignItems="center">
                <Token
                  size="xxs"
                  tokenImageUri={getHyperliquidTokenImageUrl(
                    mostTradedTokenDisplayName,
                  )}
                />
                <SizableText size="$headingSm" color="$text">
                  {mostTradedTokenDisplayName}
                </SizableText>
              </XStack>
            ) : (
              <SizableText size="$headingSm" color="$text">
                --
              </SizableText>
            )}
          </YStack>
        </XStack>
        <Divider />
        {/* Fees + Deposits — compact row */}
        <XStack justifyContent="space-between" alignItems="center">
          <YStack gap="$0.5">
            <SizableText size="$bodyXs" color="$textDisabled">
              {intl.formatMessage({
                id: ETranslations.perp_portfolio_fees_paid,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium" color="$text">
              {formatPerpsCompactUsd(fillsStats.feesPaid ?? 0)}
            </SizableText>
          </YStack>
          <YStack gap="$0.5" alignItems="center">
            <DashText
              size="$bodyXs"
              color="$textDisabled"
              dashThickness={0.5}
              tooltip={intl.formatMessage({
                id: ETranslations.perp_portfolio_net_deposits_tooltip,
              })}
            >
              {intl.formatMessage({
                id: ETranslations.perp_portfolio_net_deposits,
              })}
            </DashText>
            <SizableText size="$bodyMdMedium" color="$text">
              {formatPerpsCompactUsd(netDeposits ?? 0)}
            </SizableText>
          </YStack>
          <YStack gap="$0.5" alignItems="flex-end">
            <SizableText size="$bodyXs" color="$textDisabled">
              {intl.formatMessage({
                id: ETranslations.perp_portfolio_total_trades,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium" color="$text">
              {fillsStats.totalTrades}
            </SizableText>
          </YStack>
        </XStack>
      </SectionBlock>

      {/* Performance — with win rate progress bar */}
      <SectionBlock gap="$3.5">
        <SectionLabel>
          {intl.formatMessage({ id: ETranslations.perp_portfolio_performance })}
        </SectionLabel>
        {/* Win Rate with progress bar */}
        <YStack gap="$2">
          <XStack justifyContent="space-between" alignItems="flex-end">
            <YStack gap="$0.5">
              <DashText
                size="$bodyXs"
                color="$textDisabled"
                dashThickness={0.5}
                tooltip={winRateTooltip}
              >
                {intl.formatMessage({
                  id: ETranslations.perp_portfolio_win_rate,
                })}
              </DashText>
              <SizableText size="$headingLg" color={winRateClr}>
                {winRateVal}
              </SizableText>
            </YStack>
            <YStack gap="$0.5" alignItems="flex-end">
              <DashText
                size="$bodyXs"
                color="$textDisabled"
                dashThickness={0.5}
                tooltip={intl.formatMessage({
                  id: ETranslations.perp_portfolio_profit_factor_tooltip,
                })}
              >
                {intl.formatMessage({
                  id: ETranslations.perp_portfolio_profit_factor,
                })}
              </DashText>
              <SizableText size="$headingSm" color="$text">
                {fillsStats.profitFactor !== null
                  ? new BigNumber(fillsStats.profitFactor).toFixed(2)
                  : '--'}
              </SizableText>
            </YStack>
          </XStack>
          {/* Win rate bar — green (win) + red (loss) */}
          <XStack height={4} borderRadius="$full" overflow="hidden">
            {fillsStats.winRate === null ? (
              <XStack flex={1} bg="$neutral5" borderRadius="$full" />
            ) : (
              <>
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
              </>
            )}
          </XStack>
        </YStack>
        {/* Avg Win / Loss — side by side cards */}
        <XStack gap="$2">
          <YStack flex={1} bg="$bgHover" borderRadius="$2" p="$2.5" gap="$0.5">
            <SizableText size="$bodyXs" color="$textDisabled">
              {intl.formatMessage({ id: ETranslations.perp_portfolio_avg_win })}
            </SizableText>
            <SizableText size="$bodyMdMedium" color="$green11">
              {formatPerpsUsd(fillsStats.avgWin, true)}
            </SizableText>
          </YStack>
          <YStack flex={1} bg="$bgHover" borderRadius="$2" p="$2.5" gap="$0.5">
            <SizableText size="$bodyXs" color="$textDisabled">
              {intl.formatMessage({
                id: ETranslations.perp_portfolio_avg_loss,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium" color="$red11">
              {formatPerpsUsd(fillsStats.avgLoss, true)}
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
        {mobilePortfolioValueBlock}
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
