import { useEffect, useId, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import {
  SizableText,
  Stack,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  buildPtPriceChart,
  clamp,
  formatRate,
  getMaturityTimestamp,
  getPtPriceAtTime,
} from './shared';

import type {
  IPendlePtConvergenceChartProps,
  IPtPriceChart,
  IPtPricePoint,
} from './shared';

const HEIGHT = 224;
const TOP = 34;
const BOTTOM = 182;
const INSET = 12;
const TOOLTIP_WIDTH = 176;

function PricePlot({
  model,
  chart,
}: {
  model: IPtPriceChart;
  chart: IPendlePtConvergenceChartProps['chart'];
}) {
  const intl = useIntl();
  const theme = useTheme();
  const gradientId = `pt-price-${useId().replace(/:/g, '')}`;
  const [width, setWidth] = useState(0);
  const [selection, setSelection] = useState<number>();
  const plotWidth = Math.max(1, width - INSET * 2);
  const xOf = (timestamp: number) =>
    INSET + ((timestamp - model.start) / (model.end - model.start)) * plotWidth;
  const yOf = (price: number) =>
    BOTTOM -
    ((price - model.minPrice) / (model.maxPrice - model.minPrice)) *
      (BOTTOM - TOP);
  const pathOf = (points: IPtPricePoint[]) =>
    points
      .map(
        (point, index) =>
          `${index === 0 ? 'M' : 'L'} ${xOf(point.timestamp)} ${yOf(point.price)}`,
      )
      .join(' ');
  const nowX = xOf(model.now);
  const nowY = yOf(model.current.price);
  const endX = xOf(model.end);
  const targetY = yOf(chart.targetRate);
  const labelWidth = Math.min(168, width * 0.47);
  const historical = model.historical.length
    ? [...model.historical, model.current]
    : [];
  const priceLabel = (price: number) =>
    `${formatRate(price)} ${chart.accountingSymbol}`;
  const shortDate = (timestamp: number) =>
    intl.formatDate(timestamp, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  const todayLabel = intl.formatMessage({
    id: ETranslations.global_date_today,
  });
  const selectAt = (x: number) => {
    const fraction = clamp((x - INSET) / plotWidth, 0, 1);
    const timestamp = model.start + fraction * (model.end - model.start);
    setSelection(timestamp);
  };
  // A new history snapshot changes the coordinate system; selection is only
  // used while its observation still belongs to the visible time window.
  const active =
    selection === undefined ? undefined : getPtPriceAtTime(model, selection);
  const tooltipLeft = active
    ? clamp(
        xOf(active.timestamp) - TOOLTIP_WIDTH / 2,
        0,
        Math.max(0, width - TOOLTIP_WIDTH),
      )
    : 0;
  const axisSteps = width >= 500 ? 4 : 2;

  return (
    <YStack gap="$3">
      <XStack gap="$2" ai="center">
        <SizableText size="$bodySmMedium" numberOfLines={1} flexShrink={1}>
          {chart.ptSymbol}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_price })}
        </SizableText>
      </XStack>
      <Stack
        width="100%"
        height={HEIGHT}
        position="relative"
        userSelect="none"
        accessibilityRole="image"
        accessibilityLabel={`${chart.ptSymbol}: ${todayLabel} ${priceLabel(model.current.price)}; ${shortDate(model.end)} ${priceLabel(chart.targetRate)}`}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        // Tap inspection lets the parent pager and vertical scroller own drags.
        onPress={(event) => selectAt(event.nativeEvent.locationX)}
        onPointerMove={(event) => {
          if (event.nativeEvent.pointerType === 'mouse') {
            selectAt(event.nativeEvent.offsetX);
          }
        }}
        onPointerLeave={(event) => {
          if (event.nativeEvent.pointerType === 'mouse') {
            setSelection(undefined);
          }
        }}
      >
        {width > 0 ? (
          <>
            <Svg width={width} height={HEIGHT} pointerEvents="none">
              <Defs>
                <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <Stop
                    offset="0"
                    stopColor={theme.textSuccess.val}
                    stopOpacity={0.12}
                  />
                  <Stop
                    offset="1"
                    stopColor={theme.textSuccess.val}
                    stopOpacity={0}
                  />
                </LinearGradient>
              </Defs>
              <Line
                x1={INSET}
                x2={endX}
                y1={targetY}
                y2={targetY}
                stroke={theme.borderSubdued.val}
                strokeDasharray="3 5"
              />
              <Line
                x1={INSET}
                x2={endX}
                y1={BOTTOM}
                y2={BOTTOM}
                stroke={theme.borderSubdued.val}
              />
              <Line
                x1={nowX}
                x2={nowX}
                y1={TOP - 8}
                y2={BOTTOM}
                stroke={theme.borderSubdued.val}
                strokeDasharray="3 5"
              />
              {historical.length ? (
                <>
                  <Path
                    d={`${pathOf(historical)} L ${nowX} ${BOTTOM} L ${xOf(historical[0].timestamp)} ${BOTTOM} Z`}
                    fill={`url(#${gradientId})`}
                  />
                  <Path
                    d={pathOf(historical)}
                    stroke={theme.textSuccess.val}
                    strokeWidth={2}
                    fill="none"
                    strokeLinejoin="round"
                  />
                  {model.historical.length === 1 ? (
                    <Circle
                      cx={xOf(model.historical[0].timestamp)}
                      cy={yOf(model.historical[0].price)}
                      r={3}
                      fill={theme.textSuccess.val}
                    />
                  ) : null}
                </>
              ) : null}
              <Path
                d={`${pathOf(model.projection)} L ${endX} ${BOTTOM} L ${nowX} ${BOTTOM} Z`}
                fill={`url(#${gradientId})`}
              />
              <Path
                d={pathOf(model.projection)}
                stroke={theme.textSuccess.val}
                strokeWidth={2}
                strokeDasharray="4 5"
                strokeLinecap="round"
                fill="none"
              />
              <Circle
                cx={nowX}
                cy={nowY}
                r={5}
                fill={theme.textSuccess.val}
                stroke={theme.bg.val}
                strokeWidth={2}
              />
              <Circle
                cx={endX}
                cy={targetY}
                r={4}
                fill={theme.bg.val}
                stroke={theme.textSuccess.val}
                strokeWidth={2}
              />
              {active ? (
                <>
                  <Line
                    x1={xOf(active.timestamp)}
                    x2={xOf(active.timestamp)}
                    y1={TOP}
                    y2={BOTTOM}
                    stroke={theme.iconSubdued.val}
                    strokeDasharray="2 3"
                  />
                  <Circle
                    cx={xOf(active.timestamp)}
                    cy={yOf(active.price)}
                    r={4}
                    fill={theme.textSuccess.val}
                    stroke={theme.bg.val}
                    strokeWidth={2}
                  />
                </>
              ) : null}
            </Svg>
            <Stack
              pointerEvents="none"
              position="absolute"
              left={clamp(
                nowX - labelWidth / 2,
                0,
                Math.max(0, width - labelWidth),
              )}
              top={Math.abs(nowY - targetY) < 36 ? nowY + 9 : nowY - 28}
              width={labelWidth}
            >
              <SizableText
                size="$bodySmMedium"
                numberOfLines={1}
                textAlign={nowX < labelWidth / 2 ? 'left' : 'center'}
              >
                {priceLabel(chart.currentRate)}
              </SizableText>
            </Stack>
            <Stack
              pointerEvents="none"
              position="absolute"
              right={INSET}
              top={Math.max(0, targetY - 28)}
              maxWidth={labelWidth}
            >
              <SizableText
                size="$bodySmMedium"
                numberOfLines={1}
                textAlign="right"
              >
                {priceLabel(chart.targetRate)}
              </SizableText>
            </Stack>
            {Array.from({ length: axisSteps + 1 }, (_, index) => {
              const timestamp =
                model.start + (model.end - model.start) * (index / axisSteps);
              const x = xOf(timestamp);
              if (Math.abs(x - nowX) < 48) return null;
              let textAlign: 'left' | 'right' | 'center' = 'center';
              if (index === 0) textAlign = 'left';
              if (index === axisSteps) textAlign = 'right';
              return (
                <Stack
                  key={index}
                  pointerEvents="none"
                  position="absolute"
                  left={clamp(x - 40, 0, Math.max(0, width - 80))}
                  top={BOTTOM + 12}
                  width={80}
                >
                  <SizableText
                    size="$bodySm"
                    color="$textSubdued"
                    textAlign={textAlign}
                    numberOfLines={1}
                  >
                    {shortDate(timestamp)}
                  </SizableText>
                </Stack>
              );
            })}
            <Stack
              pointerEvents="none"
              position="absolute"
              left={clamp(nowX - 40, 0, Math.max(0, width - 80))}
              top={BOTTOM + 12}
              width={80}
            >
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                textAlign={nowX < 40 ? 'left' : 'center'}
                numberOfLines={1}
              >
                {todayLabel}
              </SizableText>
            </Stack>
            {active ? (
              <YStack
                pointerEvents="none"
                position="absolute"
                top={0}
                left={tooltipLeft}
                width={Math.min(TOOLTIP_WIDTH, width)}
                bg="$bg"
                borderWidth={1}
                borderColor="$borderSubdued"
                borderRadius="$2"
                px="$3"
                py="$2"
                gap="$1"
              >
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  numberOfLines={1}
                >
                  {intl.formatDate(active.timestamp, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  })}
                </SizableText>
                <SizableText size="$bodySmMedium" numberOfLines={1}>
                  {active.source !== 'current' ? '≈ ' : ''}
                  {priceLabel(active.price)}
                </SizableText>
              </YStack>
            ) : null}
          </>
        ) : null}
      </Stack>
      <XStack gap="$4" flexWrap="wrap">
        {model.historical.length ? (
          <XStack gap="$2" ai="center">
            <Stack w={20} h={2} bg="$textSuccess" />
            <SizableText size="$bodySm" color="$textSubdued">
              ≈ {intl.formatMessage({ id: ETranslations.global_history })}
            </SizableText>
          </XStack>
        ) : null}
        <XStack gap="$2" ai="center">
          <XStack gap={3}>
            {[0, 1, 2].map((key) => (
              <Stack key={key} w={5} h={2} bg="$textSuccess" />
            ))}
          </XStack>
          <SizableText size="$bodySm" color="$textSubdued">
            ≈{' '}
            {intl.formatMessage({ id: ETranslations.global_estimated_results })}
          </SizableText>
        </XStack>
      </XStack>
    </YStack>
  );
}

export function PendlePtConvergenceChart({
  chart,
  maturity,
  history,
}: IPendlePtConvergenceChartProps) {
  const intl = useIntl();
  const [currentTime, setCurrentTime] = useState(Date.now);
  // Clock ticks must not extend a payload's fallback duration.
  const model = useMemo(
    () => buildPtPriceChart({ chart, maturity, history }),
    [chart, maturity, history],
  );
  const expiry = model?.end ?? getMaturityTimestamp(maturity?.date);
  useEffect(() => {
    if (expiry === undefined) return undefined;
    const remaining = expiry - Date.now();
    if (remaining <= 0) return undefined;
    const timer = setTimeout(
      () => setCurrentTime(Date.now()),
      Math.min(remaining + 1, 2_147_483_647),
    );
    return () => clearTimeout(timer);
  }, [expiry, currentTime]);
  if (
    maturity?.isMatured ||
    (expiry !== undefined && expiry <= Date.now())
  )
    return null;
  if (!model)
    return (
      <SizableText size="$bodySm" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.global_no_data })}
      </SizableText>
    );
  return (
    <PricePlot
      key={`${chart.ptSymbol}:${model.end}`}
      model={model}
      chart={chart}
    />
  );
}
