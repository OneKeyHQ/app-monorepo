// cspell:ignore financials
import { useState } from 'react';

import Svg, {
  Circle,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

import {
  SizableText,
  Stack,
  Theme,
  XStack,
  YStack,
  getTokenValue,
  useTheme,
  useThemeName,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  getFinancialDomain,
  getFinancialPercentDomain,
  getFinancialPerformanceDomain,
  isFinancialNumber,
} from './financialsUtils';
import { formatFinancialValue } from './financialValueFormat';

export type IFinancialChartSeries = {
  key: string;
  label: string;
  color: 'blue9' | 'orange9' | 'teal9' | 'red9';
  kind: 'bar' | 'line' | 'actual' | 'estimate';
};

export type IFinancialChartRow = {
  key: string;
  label: string;
  values: (number | null)[];
  details?: {
    label: string;
    value: number;
    color: IFinancialChartSeries['color'];
  }[];
  range?: {
    start: number;
    end: number;
    color: IFinancialChartSeries['color'];
    connect: boolean;
  };
};

const TOP = 16;
const BOTTOM = 188;
const RIGHT = 60;
// The SVG only holds the plot; axis labels render below it as text.
const CHART_HEIGHT = BOTTOM + 6;
// Browsers keep an over-wide single word on one line unless allowed to break
// it; native text already breaks such words.
const AXIS_LABEL_WEB_STYLE = { wordBreak: 'break-word' } as const;

function circleRadius(kind: IFinancialChartSeries['kind']) {
  if (kind === 'line') return 2.5;
  return 7;
}

function roundedBarPath(
  x: number,
  top: number,
  width: number,
  height: number,
  radius: number,
  roundBottom = false,
) {
  const r = Math.min(radius, width / 2, height);
  const right = x + width;
  const bottom = top + height;
  if (roundBottom) {
    return `M${x} ${top}H${right}V${bottom - r}Q${right} ${bottom} ${right - r} ${bottom}H${x + r}Q${x} ${bottom} ${x} ${bottom - r}Z`;
  }
  return `M${x} ${bottom}V${top + r}Q${x} ${top} ${x + r} ${top}H${right - r}Q${right} ${top} ${right} ${top + r}V${bottom}Z`;
}

export function FinancialChart({
  rows,
  series,
  testID,
  currency,
}: {
  rows: IFinancialChartRow[];
  series: IFinancialChartSeries[];
  testID: string;
  currency?: string;
}) {
  const theme = useTheme();
  const themeName = useThemeName();
  const inverseThemeName = themeName === 'dark' ? 'light' : 'dark';
  const [width, setWidth] = useState(640);
  const [selection, setSelection] = useState<{
    key: string;
    pinned: boolean;
  }>();
  const textColor = theme.textSubdued.val;
  const borderColor = theme.neutral3.val;
  const radius = getTokenValue('$1', 'radius') / 2;
  const lineIndex = series.findIndex((item) => item.kind === 'line');
  const left = lineIndex >= 0 ? 44 : 0;
  const plotWidth = Math.max(1, width - left - RIGHT);
  const columnWidth = plotWidth / Math.max(1, rows.length);
  const selectedIndex = rows.findIndex((row) => row.key === selection?.key);
  const selectedRow = rows[selectedIndex];
  const domain = (
    lineIndex >= 0 ? getFinancialPerformanceDomain : getFinancialDomain
  )(
    rows.flatMap((row) =>
      row.range
        ? [row.range.start, row.range.end]
        : row.values.filter((_, index) => index !== lineIndex),
    ),
  );
  const marginDomain = getFinancialPercentDomain(
    rows.map((row) => row.values[lineIndex] ?? null),
  );
  const y = (value: number, percent = false) => {
    const scale = percent ? marginDomain : domain;
    return (
      BOTTOM - ((value - scale.min) / (scale.max - scale.min)) * (BOTTOM - TOP)
    );
  };
  const x = (index: number) => left + columnWidth * (index + 0.5);
  const formatValue = (value: number | null, percent = false) =>
    formatFinancialValue(value, { percent });
  const barSeries = series.filter((item) => item.kind === 'bar');
  const barWidth = Math.min(
    width < 560 ? 22 : 28,
    (columnWidth * 0.5) / Math.max(1, barSeries.length),
  );
  const waterfallBarWidth = Math.min(width < 560 ? 38 : 48, columnWidth * 0.55);
  const tooltipWidth = Math.min(selectedRow?.details ? 280 : 240, width);
  const tooltipLeft = Math.max(
    0,
    Math.min(width - tooltipWidth, x(selectedIndex) - tooltipWidth / 2),
  );
  let linePath = '';
  let lineStarted = false;
  if (lineIndex >= 0) {
    rows.forEach((row, index) => {
      const value = row.values[lineIndex];
      if (isFinancialNumber(value)) {
        linePath += `${lineStarted ? 'L' : 'M'}${x(index)},${y(value, true)} `;
        lineStarted = true;
      } else {
        lineStarted = false;
      }
    });
  }

  return (
    <YStack gap="$1" testID={testID} zIndex={selectedRow ? 1 : 0}>
      <Stack
        height={CHART_HEIGHT}
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          if (nextWidth > 0) setWidth(nextWidth);
        }}
      >
        <Svg
          width="100%"
          height={CHART_HEIGHT}
          viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
        >
          {[0, 1, 2, 3, 4].map((tick) => {
            const tickY = TOP + ((BOTTOM - TOP) * tick) / 4;
            const amount = domain.max - ((domain.max - domain.min) * tick) / 4;
            const margin =
              marginDomain.max -
              ((marginDomain.max - marginDomain.min) * tick) / 4;
            return (
              <G key={tick}>
                <Line
                  x1={left}
                  x2={width - RIGHT}
                  y1={tickY}
                  y2={tickY}
                  stroke={borderColor}
                />
                <SvgText
                  x={width - 2}
                  y={tickY + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill={textColor}
                >
                  {formatFinancialValue(amount, {
                    maxCharacters: width < 400 ? 7 : 8,
                  })}
                </SvgText>
                {lineIndex >= 0 ? (
                  // Start-anchored at the card edge so the axis lines up with
                  // the card title above it.
                  <SvgText
                    x={0}
                    y={tickY + 4}
                    textAnchor="start"
                    fontSize={11}
                    fill={textColor}
                  >
                    {formatValue(margin, true)}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
          <Line
            x1={left}
            x2={width - RIGHT}
            y1={y(0)}
            y2={y(0)}
            stroke={textColor}
            strokeWidth={0.5}
          />
          {selectedRow ? (
            <Rect
              x={left + columnWidth * selectedIndex}
              y={TOP}
              width={columnWidth}
              height={BOTTOM - TOP}
              fill={theme.bgHover.val}
              opacity={0.5}
            />
          ) : null}
          {rows.map((row, rowIndex) => {
            const center = x(rowIndex);
            const range = row.range;
            const previousRange = rows[rowIndex - 1]?.range;
            return (
              <G key={row.key}>
                {range ? (
                  <>
                    <Rect
                      x={center - waterfallBarWidth / 2}
                      y={Math.min(y(range.start), y(range.end))}
                      width={waterfallBarWidth}
                      height={Math.max(
                        1,
                        Math.abs(y(range.start) - y(range.end)),
                      )}
                      fill={theme[range.color].val}
                    />
                    {range.connect && previousRange ? (
                      <Line
                        x1={x(rowIndex - 1) + waterfallBarWidth / 2}
                        x2={center - waterfallBarWidth / 2}
                        y1={y(previousRange.end)}
                        y2={y(previousRange.end)}
                        stroke={textColor}
                        strokeDasharray="3 3"
                      />
                    ) : null}
                  </>
                ) : (
                  series.map((item, index) => {
                    const value = row.values[index];
                    if (!isFinancialNumber(value)) return null;
                    if (item.kind === 'line') return null;
                    if (item.kind === 'bar') {
                      const barIndex = barSeries.indexOf(item);
                      return (
                        <Path
                          key={item.key}
                          d={roundedBarPath(
                            center +
                              (barIndex - barSeries.length / 2) * barWidth +
                              1,
                            Math.min(y(0), y(value)),
                            Math.max(1, barWidth - 2),
                            Math.max(1, Math.abs(y(0) - y(value))),
                            radius,
                            value < 0,
                          )}
                          fill={theme[item.color].val}
                        />
                      );
                    }
                    return (
                      <Circle
                        key={item.key}
                        cx={center}
                        cy={y(value)}
                        r={circleRadius(item.kind)}
                        fill={
                          item.kind === 'actual'
                            ? theme[item.color].val
                            : theme.bgApp.val
                        }
                        stroke={theme[item.color].val}
                        strokeWidth={1.5}
                      />
                    );
                  })
                )}
              </G>
            );
          })}
          {lineIndex >= 0 ? (
            <G>
              <Path
                d={linePath}
                stroke={theme[series[lineIndex].color].val}
                strokeWidth={2}
                fill="none"
              />
              {rows.map((row, index) => {
                const value = row.values[lineIndex];
                return isFinancialNumber(value) ? (
                  <Circle
                    key={row.key}
                    cx={x(index)}
                    cy={y(value, true)}
                    r={circleRadius('line')}
                    fill={theme.bgApp.val}
                    stroke={theme[series[lineIndex].color].val}
                    strokeWidth={1.5}
                  />
                ) : null;
              })}
            </G>
          ) : null}
        </Svg>
        {rows.map((row, index) => (
          <Stack
            key={row.key}
            position="absolute"
            left={left + columnWidth * index}
            top={TOP}
            width={columnWidth}
            height={BOTTOM - TOP}
            cursor="pointer"
            focusable
            role="button"
            tabIndex={0}
            testID={`${testID}-point-${index}`}
            aria-label={`${row.label}: ${row.values.map((value, valueIndex) => `${series[valueIndex]?.label ?? ''} ${formatValue(value, valueIndex === lineIndex)}`).join(', ')}`}
            onHoverIn={() => setSelection({ key: row.key, pinned: false })}
            onHoverOut={() => setSelection(undefined)}
            onPress={() =>
              setSelection((current) =>
                current?.key === row.key && current.pinned
                  ? undefined
                  : { key: row.key, pinned: true },
              )
            }
            onFocus={() => setSelection({ key: row.key, pinned: false })}
            onBlur={() => setSelection(undefined)}
            onKeyDown={
              platformEnv.isNative
                ? undefined
                : (event) => {
                    if (event.key === 'Escape') setSelection(undefined);
                  }
            }
          />
        ))}
        {selectedRow ? (
          <YStack
            position="absolute"
            left={tooltipLeft}
            bottom={CHART_HEIGHT - TOP + 12}
            width={tooltipWidth}
            py="$3"
            px="$3"
            gap="$2"
            bg="$bgInverse"
            borderRadius="$2"
            elevation={8}
            pointerEvents="none"
            role="tooltip"
            testID={`${testID}-tooltip`}
          >
            {selectedRow.values.map((value, index) => {
              const item = series[index];
              const color = item?.color ?? selectedRow.range?.color;
              const markerColor = color ? `$${color}` : '$textInverse';
              const percent = index === lineIndex;
              return (
                <XStack key={item?.key ?? index} alignItems="center" gap="$2">
                  <Theme name={inverseThemeName}>
                    <Stack
                      width="$2"
                      height="$2"
                      borderRadius="$full"
                      bg={
                        item?.kind === 'estimate' ? '$transparent' : markerColor
                      }
                      borderColor={markerColor}
                      borderWidth={1}
                    />
                  </Theme>
                  <SizableText size="$bodySm" color="$textInverse" flex={1}>
                    {item?.label ?? selectedRow.label}{' '}
                  </SizableText>
                  <SizableText
                    size="$bodySmMedium"
                    color="$textInverse"
                    textAlign="right"
                  >
                    {formatValue(value, percent)}
                    {!percent && currency && isFinancialNumber(value)
                      ? ` ${currency}`
                      : ''}
                  </SizableText>
                </XStack>
              );
            })}
            {selectedRow.details ? (
              <YStack
                gap="$2"
                pt="$2"
                borderTopWidth="$px"
                borderTopColor="$textInverseSubdued"
              >
                {selectedRow.details.map((detail) => (
                  <XStack key={detail.label} alignItems="center" gap="$2">
                    <Theme name={inverseThemeName}>
                      <Stack
                        width="$2"
                        height="$2"
                        borderRadius="$full"
                        bg={`$${detail.color}`}
                      />
                    </Theme>
                    <SizableText size="$bodySm" color="$textInverse" flex={1}>
                      {detail.label}{' '}
                    </SizableText>
                    <SizableText
                      size="$bodySmMedium"
                      color="$textInverse"
                      textAlign="right"
                    >
                      {formatValue(detail.value)}
                      {currency ? ` ${currency}` : ''}
                    </SizableText>
                  </XStack>
                ))}
              </YStack>
            ) : null}
            <Stack
              position="absolute"
              left={Math.max(
                8,
                Math.min(tooltipWidth - 20, x(selectedIndex) - tooltipLeft - 6),
              )}
              bottom={-6}
              pointerEvents="none"
            >
              <Svg width={12} height={6}>
                <Path d="M0 0H12L6 6Z" fill={theme.bgInverse.val} />
              </Svg>
            </Stack>
          </YStack>
        ) : null}
      </Stack>
      {/* Axis labels are platform text rather than SvgText: native and browser
          line breaking handles every script (Thai, Bengali, CJK, long German
          compounds), which SVG text cannot do on its own. */}
      <XStack pl={left} pr={RIGHT} pb="$1" testID={`${testID}-labels`}>
        {rows.map((row) => (
          <SizableText
            key={row.key}
            width={columnWidth}
            px="$0.5"
            fontSize={11}
            lineHeight={13}
            color="$textSubdued"
            textAlign="center"
            $platform-web={AXIS_LABEL_WEB_STYLE}
          >
            {row.label}
          </SizableText>
        ))}
      </XStack>
      <XStack gap="$3" justifyContent="center" flexWrap="wrap" minHeight="$5">
        {series.map((item) => (
          <XStack key={item.key} gap="$1" alignItems="center">
            <Stack
              width={7}
              height={7}
              borderRadius="$full"
              bg={
                item.kind === 'estimate'
                  ? '$transparent'
                  : theme[item.color].val
              }
              borderColor={theme[item.color].val}
              borderWidth={1}
            />
            <SizableText size="$bodyXs" color="$textSubdued">
              {item.label}
            </SizableText>
          </XStack>
        ))}
      </XStack>
    </YStack>
  );
}
