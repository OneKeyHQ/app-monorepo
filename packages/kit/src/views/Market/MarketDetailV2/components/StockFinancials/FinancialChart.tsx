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
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';

import {
  getFinancialDomain,
  getFinancialPercentDomain,
  isFinancialNumber,
} from './financialsUtils';
import { formatFinancialValue } from './financialValueFormat';

export type IFinancialChartSeries = {
  key: string;
  label: string;
  color: string;
  kind: 'bar' | 'line' | 'actual' | 'estimate';
};

export type IFinancialChartRow = {
  key: string;
  label: string;
  values: (number | null)[];
  range?: { start: number; end: number; color: string; connect: boolean };
};

const CHART_HEIGHT = 268;
const TOP = 16;
const BOTTOM = 208;
const LEFT = 52;
const RIGHT = 76;

function circleRadius(kind: IFinancialChartSeries['kind']) {
  if (kind === 'line') return 2.5;
  return kind === 'estimate' ? 6 : 4;
}

export function FinancialChart({
  rows,
  series,
  testID,
}: {
  rows: IFinancialChartRow[];
  series: IFinancialChartSeries[];
  testID: string;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(640);
  const [selected, setSelected] = useState<string>();
  const textColor = theme.textSubdued.val;
  const borderColor = theme.borderSubdued.val;
  const right = width < 400 ? 64 : RIGHT;
  const plotWidth = Math.max(1, width - LEFT - right);
  const columnWidth = plotWidth / Math.max(1, rows.length);
  const selectedIndex = rows.findIndex((row) => row.key === selected);
  const selectedRow = rows[selectedIndex];
  const lineIndex = series.findIndex((item) => item.kind === 'line');
  const domain = getFinancialDomain(
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
  const x = (index: number) => LEFT + columnWidth * (index + 0.5);
  const formatValue = (value: number | null, percent = false) =>
    formatFinancialValue(value, { percent });
  const barSeries = series.filter((item) => item.kind === 'bar');
  const barWidth = Math.min(
    32,
    (columnWidth * 0.65) / Math.max(1, barSeries.length),
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
    <YStack gap="$2" testID={testID}>
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
                  x1={LEFT}
                  x2={width - right}
                  y1={tickY}
                  y2={tickY}
                  stroke={borderColor}
                />
                <SvgText
                  x={width - right + 8}
                  y={tickY + 4}
                  fontSize={11}
                  fill={textColor}
                >
                  {formatFinancialValue(amount, {
                    maxCharacters: width < 400 ? 7 : 8,
                  })}
                </SvgText>
                {lineIndex >= 0 ? (
                  <SvgText
                    x={LEFT - 8}
                    y={tickY + 4}
                    textAnchor="end"
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
            x1={LEFT}
            x2={width - right}
            y1={y(0)}
            y2={y(0)}
            stroke={textColor}
            strokeWidth={0.5}
          />
          {selectedRow ? (
            <Line
              x1={x(selectedIndex)}
              x2={x(selectedIndex)}
              y1={TOP}
              y2={BOTTOM}
              stroke={textColor}
              strokeDasharray="3 3"
            />
          ) : null}
          {rows.map((row, rowIndex) => {
            const center = x(rowIndex);
            const range = row.range;
            const previousRange = rows[rowIndex - 1]?.range;
            const words = row.label.split(/[\s/]+/);
            const lines: string[] = [];
            const maxCharacters = Math.max(
              3,
              Math.floor((columnWidth - 6) / 6),
            );
            words.forEach((fullWord) => {
              // The interaction target retains the full label for narrow charts.
              const word =
                fullWord.length > maxCharacters
                  ? `${fullWord.slice(0, maxCharacters - 1)}…`
                  : fullWord;
              const last = lines.at(-1);
              if (last && last.length + word.length + 1 <= maxCharacters) {
                lines[lines.length - 1] = `${last} ${word}`;
              } else {
                lines.push(word);
              }
            });
            return (
              <G key={row.key}>
                {range ? (
                  <>
                    <Rect
                      x={center - columnWidth * 0.3}
                      y={Math.min(y(range.start), y(range.end))}
                      width={columnWidth * 0.6}
                      height={Math.max(
                        1,
                        Math.abs(y(range.start) - y(range.end)),
                      )}
                      fill={range.color}
                    />
                    {range.connect && previousRange ? (
                      <Line
                        x1={x(rowIndex - 1) + columnWidth * 0.3}
                        x2={center - columnWidth * 0.3}
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
                    if (item.kind === 'bar') {
                      const barIndex = barSeries.indexOf(item);
                      return (
                        <Rect
                          key={item.key}
                          x={
                            center +
                            (barIndex - barSeries.length / 2) * barWidth
                          }
                          y={Math.min(y(0), y(value))}
                          width={Math.max(1, barWidth - 2)}
                          height={Math.max(1, Math.abs(y(0) - y(value)))}
                          fill={item.color}
                        />
                      );
                    }
                    return (
                      <Circle
                        key={item.key}
                        cx={center}
                        cy={y(value, item.kind === 'line')}
                        r={circleRadius(item.kind)}
                        fill={item.kind === 'estimate' ? 'none' : item.color}
                        stroke={item.color}
                        strokeWidth={1.5}
                      />
                    );
                  })
                )}
                {lines.slice(0, 3).map((line, lineNumber) => (
                  <SvgText
                    key={`${lineNumber}-${line}`}
                    x={center}
                    y={BOTTOM + 20 + lineNumber * 13}
                    textAnchor="middle"
                    fontSize={11}
                    fill={textColor}
                  >
                    {line}
                  </SvgText>
                ))}
              </G>
            );
          })}
          {lineIndex >= 0 ? (
            <Path
              d={linePath}
              stroke={series[lineIndex].color}
              strokeWidth={1.5}
              fill="none"
            />
          ) : null}
        </Svg>
        {rows.map((row, index) => (
          <Stack
            key={row.key}
            position="absolute"
            left={LEFT + columnWidth * index}
            top={TOP}
            width={columnWidth}
            height={BOTTOM - TOP}
            cursor="pointer"
            focusable
            role="button"
            tabIndex={0}
            testID={`${testID}-point-${index}`}
            aria-label={`${row.label}: ${row.values.map((value, valueIndex) => `${series[valueIndex]?.label ?? ''} ${formatValue(value, valueIndex === lineIndex)}`).join(', ')}`}
            onHoverIn={() => setSelected(row.key)}
            onHoverOut={() => setSelected(undefined)}
            onPress={() => setSelected(row.key)}
            onFocus={() => setSelected(row.key)}
            onBlur={() => setSelected(undefined)}
          />
        ))}
      </Stack>
      <XStack gap="$4" justifyContent="center" flexWrap="wrap">
        {series.map((item) => (
          <XStack key={item.key} gap="$1" alignItems="center">
            <Stack
              width={7}
              height={7}
              borderRadius="$full"
              bg={item.kind === 'estimate' ? '$transparent' : item.color}
              borderColor={item.color}
              borderWidth={1}
            />
            <SizableText size="$bodyXs" color="$textSubdued">
              {item.label}
            </SizableText>
          </XStack>
        ))}
      </XStack>
      <XStack
        minHeight={36}
        gap="$3"
        justifyContent="center"
        flexWrap="wrap"
        testID={`${testID}-tooltip`}
      >
        {selectedRow ? (
          <>
            <SizableText size="$bodySmMedium">{selectedRow.label}</SizableText>
            {selectedRow.values.map((value, index) => (
              <SizableText
                key={series[index]?.key ?? index}
                size="$bodySm"
                color="$textSubdued"
              >
                {`${series[index]?.label ?? ''} ${formatValue(value, index === lineIndex)}`}
              </SizableText>
            ))}
          </>
        ) : null}
      </XStack>
    </YStack>
  );
}
