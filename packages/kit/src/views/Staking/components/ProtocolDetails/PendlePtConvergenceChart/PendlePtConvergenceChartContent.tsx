import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import {
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ChartInteraction } from './ChartInteraction';
import {
  buildConvergenceModel,
  clamp,
  findNearestPoint,
  formatRate,
} from './shared';

import type { IPendlePtConvergenceChartProps, IPtPricePoint } from './shared';

const HEIGHT = 224;
const TOP = 38;
const BOTTOM = 176;
const EDGE = 12;
const CARD_WIDTH = 172;

export function PendlePtConvergenceChart({
  chart,
  history,
  maturityDate,
  isHistoryLoading,
}: IPendlePtConvergenceChartProps) {
  const intl = useIntl();
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [selectedTime, setSelectedTime] = useState<number>();
  // Keep an approximate expiry fixed while the chart's clock advances.
  const snapshot = useMemo(() => ({ chart, asOf: Date.now() }), [chart]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const model = useMemo(
    () =>
      buildConvergenceModel({
        chart: snapshot.chart,
        history,
        maturityDate,
        now: Math.max(now, snapshot.asOf),
        asOf: snapshot.asOf,
      }),
    [snapshot, history, maturityDate, now],
  );
  const plotWidth = Math.max(1, width - EDGE * 2);
  const select = useCallback(
    (position: number) => {
      if (model) {
        setSelectedTime(
          model.start +
            clamp((position - EDGE) / plotWidth, 0, 1) *
              (model.maturity - model.start),
        );
      }
    },
    [model, plotWidth],
  );
  const endSelection = useCallback(() => setSelectedTime(undefined), []);
  useEffect(endSelection, [chart, maturityDate, endSelection]);

  const priceTitle = `${chart.ptSymbol} · ${intl.formatMessage({ id: ETranslations.global_price })}`;
  const todayLabel = intl.formatMessage({ id: ETranslations.date_today });
  const maturityLabel = intl.formatMessage({
    id: ETranslations.defi_protocol_maturity,
  });
  const estimatedLabel = intl.formatMessage({
    id: ETranslations.global_estimated_results,
  });
  const formatDate = (timestamp: number) =>
    intl.formatDate(timestamp, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  const priceLabel = (price: number) =>
    `${formatRate(price)} ${chart.accountingSymbol}`;

  if (!model) {
    return (
      <Stack py="$6" testID="pendle-price-chart-unavailable">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </Stack>
    );
  }
  const x = (timestamp: number) =>
    model.start === model.maturity
      ? width - EDGE
      : EDGE +
        ((timestamp - model.start) /
          Math.max(1, model.maturity - model.start)) *
          plotWidth;
  const y = (price: number) =>
    BOTTOM - ((price - model.min) / (model.max - model.min)) * (BOTTOM - TOP);
  const path = (points: IPtPricePoint[]) =>
    points
      .map(
        (point, index) =>
          `${index ? 'L' : 'M'} ${x(point.timestamp)} ${y(point.price)}`,
      )
      .join(' ');
  const currentX = x(model.current.timestamp);
  const currentY = y(model.current.price);
  const targetY = y(chart.targetRate);
  const selected =
    selectedTime === undefined
      ? undefined
      : findNearestPoint(model.points, selectedTime);
  const green = theme.iconSuccess.val;
  const currentLabelWidth = Math.min(164, Math.max(80, width * 0.46));
  const closeLabels =
    width - EDGE - currentX < currentLabelWidth &&
    Math.abs(currentY - targetY) < 36;
  const accessibilityLabel = `${priceTitle}, ${priceLabel(model.current.price)}, ${formatDate(model.current.timestamp)}. ${maturityLabel}: ${priceLabel(chart.targetRate)}, ${formatDate(model.maturity)}. ${model.isMatured ? '' : estimatedLabel}`;

  return (
    <YStack gap="$2" width="100%" testID="pendle-price-chart">
      <XStack
        gap="$3"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
      >
        <SizableText size="$bodySmMedium" color="$textSubdued" flexShrink={1}>
          {priceTitle}
        </SizableText>
        {!model.isMatured ? (
          <XStack gap="$1" alignItems="center">
            <SizableText size="$bodySm" color="$textSubdued">
              ≈ {estimatedLabel}
            </SizableText>
            {isHistoryLoading ? <Skeleton width={12} height={12} /> : null}
          </XStack>
        ) : null}
      </XStack>
      <Stack
        width="100%"
        height={HEIGHT}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {width > EDGE * 2 ? (
          <ChartInteraction
            width={width}
            height={HEIGHT}
            accessibilityLabel={accessibilityLabel}
            onSelect={select}
            onEnd={endSelection}
          >
            <Svg width={width} height={HEIGHT} accessible={false}>
              <Line
                x1={EDGE}
                x2={width - EDGE}
                y1={BOTTOM}
                y2={BOTTOM}
                stroke={theme.borderSubdued.val}
              />
              <Line
                x1={EDGE}
                x2={width - EDGE}
                y1={targetY}
                y2={targetY}
                stroke={theme.borderSubdued.val}
                strokeDasharray="3 5"
              />
              {!model.isMatured ? (
                <Line
                  x1={currentX}
                  x2={currentX}
                  y1={TOP}
                  y2={BOTTOM}
                  stroke={theme.borderSubdued.val}
                  strokeDasharray="3 5"
                />
              ) : null}
              {model.historical.length ? (
                <Path
                  d={path(model.historical)}
                  stroke={green}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  fill="none"
                />
              ) : null}
              {model.forecast.length ? (
                <Path
                  d={path(model.forecast)}
                  stroke={green}
                  strokeWidth={2}
                  strokeDasharray="4 5"
                  strokeLinecap="round"
                  fill="none"
                  opacity={0.7}
                />
              ) : null}
              <Circle
                cx={currentX}
                cy={currentY}
                r={4}
                fill={green}
                stroke={theme.bg.val}
                strokeWidth={2}
              />
              {!model.isMatured ? (
                <Circle
                  cx={width - EDGE}
                  cy={targetY}
                  r={4}
                  fill={green}
                  stroke={theme.bg.val}
                  strokeWidth={2}
                />
              ) : null}
              {selected ? (
                <>
                  <Line
                    x1={x(selected.timestamp)}
                    x2={x(selected.timestamp)}
                    y1={TOP}
                    y2={BOTTOM}
                    stroke={theme.iconSubdued.val}
                    strokeDasharray="3 3"
                  />
                  <Circle
                    cx={x(selected.timestamp)}
                    cy={y(selected.price)}
                    r={4}
                    fill={green}
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
                currentX - currentLabelWidth / 2,
                0,
                Math.max(0, width - currentLabelWidth),
              )}
              top={closeLabels ? currentY + 10 : Math.max(4, currentY - 30)}
              width={currentLabelWidth}
              alignItems={currentX < width / 3 ? 'flex-start' : 'center'}
            >
              <SizableText size="$bodySmMedium" color="$text" numberOfLines={1}>
                {priceLabel(model.current.price)}
              </SizableText>
            </Stack>
            {!model.isMatured ? (
              <Stack
                pointerEvents="none"
                position="absolute"
                right={0}
                top={Math.max(4, targetY - 30)}
                maxWidth="48%"
              >
                <SizableText
                  size="$bodySmMedium"
                  color="$text"
                  numberOfLines={1}
                >
                  {priceLabel(chart.targetRate)}
                </SizableText>
              </Stack>
            ) : null}
            {model.historical.length ? (
              <Stack
                pointerEvents="none"
                position="absolute"
                left={0}
                top={BOTTOM + 12}
                maxWidth="32%"
              >
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  numberOfLines={1}
                >
                  {intl.formatDate(model.start, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </SizableText>
              </Stack>
            ) : null}
            {!model.isMatured && currentX < width - 100 ? (
              <Stack
                pointerEvents="none"
                position="absolute"
                top={BOTTOM + 12}
                left={clamp(currentX - 40, 0, Math.max(0, width - 80))}
                width={80}
                alignItems={model.historical.length ? 'center' : 'flex-start'}
              >
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  numberOfLines={1}
                >
                  {todayLabel}
                </SizableText>
              </Stack>
            ) : null}
            <Stack
              pointerEvents="none"
              position="absolute"
              right={0}
              top={BOTTOM + 9}
              maxWidth="48%"
              alignItems="flex-end"
            >
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
              >
                {maturityLabel}
              </SizableText>
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
              >
                {intl.formatDate(model.maturity, {
                  month: 'short',
                  day: 'numeric',
                })}
              </SizableText>
            </Stack>
            {selected ? (
              <YStack
                testID="pendle-price-chart-tooltip"
                pointerEvents="none"
                position="absolute"
                left={clamp(
                  x(selected.timestamp) - CARD_WIDTH / 2,
                  0,
                  Math.max(0, width - CARD_WIDTH),
                )}
                top={0}
                width={Math.min(width, CARD_WIDTH)}
                padding="$2"
                gap="$1"
                borderRadius="$2"
                backgroundColor="$bg"
                borderWidth={1}
                borderColor="$borderSubdued"
                elevation={2}
              >
                <SizableText size="$bodySm" color="$textSubdued">
                  {formatDate(selected.timestamp)}
                </SizableText>
                <SizableText size="$bodySmMedium">
                  {selected.estimated ? '≈ ' : ''}
                  {priceLabel(selected.price)}
                </SizableText>
              </YStack>
            ) : null}
          </ChartInteraction>
        ) : (
          <Skeleton width="100%" height={HEIGHT} />
        )}
      </Stack>
    </YStack>
  );
}
