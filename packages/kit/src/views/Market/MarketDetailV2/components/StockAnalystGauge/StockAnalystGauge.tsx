import { useId, useMemo } from 'react';

import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import { SizableText, Stack, YStack, useTheme } from '@onekeyhq/components';
import type { IMarketStockAnalystRatings } from '@onekeyhq/shared/types/marketV2';

import { getStockAnalystConsensus } from '../../utils/stockPublicDataUtils';

import {
  STOCK_ANALYST_GAUGE_END_ANGLE,
  STOCK_ANALYST_GAUGE_START_ANGLE,
  STOCK_ANALYST_GAUGE_ZONE_LABELS,
  describeStockAnalystGaugeArc,
  getStockAnalystGaugeAngle,
  getStockAnalystGaugeScore,
  getStockAnalystGaugeZoneIndex,
  parseStockAnalystRatingCounts,
  polarToCartesian,
} from './analystGaugeUtils';

import type { IStockAnalystRatingCountsSource } from './analystGaugeUtils';

// Geometry transcribed from the Figma reference (node 26190:22905): a 1100x558
// capture of the analyst dial placed at 380px wide, so every measured pixel is
// scaled by 380 / 1100.
export const STOCK_ANALYST_GAUGE_WIDTH = 380;
const STOCK_ANALYST_GAUGE_DIAL_HEIGHT = 156;
// The consensus block sits under the dial: $headingMd (16/24) over
// $bodySmMedium (12/16), with the 4px the reference leaves under the arc.
const STOCK_ANALYST_GAUGE_CONSENSUS_TOP_GAP = 4;
export const STOCK_ANALYST_GAUGE_HEIGHT =
  STOCK_ANALYST_GAUGE_DIAL_HEIGHT +
  STOCK_ANALYST_GAUGE_CONSENSUS_TOP_GAP +
  24 +
  16;

const DIAL_CENTER_X = 187.8;
const DIAL_CENTER_Y = 149.1;
const DIAL_OUTER_RADIUS = 109.3;
// The dial is two concentric bands: the rating band on the outside and a faint
// halo of the same gradient just inside it, both cut flat (butt caps) where the
// consensus ends.
const DIAL_BAND_WIDTH = 7.4;
const DIAL_HALO_WIDTH = 8.1;
const DIAL_HALO_OPACITY = 0.25;
const DIAL_BAND_RADIUS = DIAL_OUTER_RADIUS - DIAL_BAND_WIDTH / 2;
const DIAL_HALO_RADIUS =
  DIAL_OUTER_RADIUS - DIAL_BAND_WIDTH - DIAL_HALO_WIDTH / 2;
const NEEDLE_LENGTH = 76.5;
const NEEDLE_WIDTH = 3.5;
const NEEDLE_PIVOT_RADIUS = 4.2;

const ZONE_LABEL_LAYOUT: {
  left: number;
  width: number;
  top: number;
  textAlign: 'left' | 'center' | 'right';
}[] = [
  { left: 0, width: 62, top: 94.6, textAlign: 'right' },
  { left: 59, width: 80, top: 40, textAlign: 'center' },
  { left: 147.8, width: 80, top: 11.2, textAlign: 'center' },
  { left: 236.9, width: 80, top: 40, textAlign: 'center' },
  { left: 312.6, width: 67.4, top: 94.6, textAlign: 'left' },
];

// Zones 0-1 are the sell half of the dial, zone 2 is neutral, zones 3-4 are the
// buy half; the highlighted label borrows the same tone as its band.
function getZoneLabelColor(
  zoneIndex: number,
  isActive: boolean,
): '$textCritical' | '$textSuccess' | '$text' | '$textSubdued' {
  if (!isActive) {
    return '$textSubdued';
  }
  if (zoneIndex <= 1) {
    return '$textCritical';
  }
  if (zoneIndex >= 3) {
    return '$textSuccess';
  }
  return '$text';
}

export interface IStockAnalystGaugeProps {
  ratings?: IMarketStockAnalystRatings;
  ratingCountsSource?: IStockAnalystRatingCountsSource;
}

export function StockAnalystGauge({
  ratings,
  ratingCountsSource,
}: IStockAnalystGaugeProps) {
  const theme = useTheme();
  // SVG gradient ids share one namespace per document on web, so the id has to
  // stay unique per instance. `useId` returns colon separated ids that url(#)
  // references cannot resolve.
  const gradientId = `stockAnalystGaugeBand${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const counts = useMemo(
    () => parseStockAnalystRatingCounts(ratingCountsSource),
    [ratingCountsSource],
  );
  const score = useMemo(
    () => getStockAnalystGaugeScore({ counts, ratings }),
    [counts, ratings],
  );

  const hasScore = score !== undefined;
  // With no usable data the needle rests in the middle and the whole dial stays
  // on the neutral track color.
  const needleAngle = hasScore
    ? getStockAnalystGaugeAngle(score)
    : (STOCK_ANALYST_GAUGE_START_ANGLE + STOCK_ANALYST_GAUGE_END_ANGLE) / 2;
  const activeZoneIndex = hasScore
    ? getStockAnalystGaugeZoneIndex(score)
    : undefined;

  const trackPath = describeStockAnalystGaugeArc({
    cx: DIAL_CENTER_X,
    cy: DIAL_CENTER_Y,
    radius: DIAL_BAND_RADIUS,
    startAngle: STOCK_ANALYST_GAUGE_START_ANGLE,
    endAngle: STOCK_ANALYST_GAUGE_END_ANGLE,
  });
  const bandPath = hasScore
    ? describeStockAnalystGaugeArc({
        cx: DIAL_CENTER_X,
        cy: DIAL_CENTER_Y,
        radius: DIAL_BAND_RADIUS,
        startAngle: STOCK_ANALYST_GAUGE_START_ANGLE,
        endAngle: needleAngle,
      })
    : '';
  const haloPath = hasScore
    ? describeStockAnalystGaugeArc({
        cx: DIAL_CENTER_X,
        cy: DIAL_CENTER_Y,
        radius: DIAL_HALO_RADIUS,
        startAngle: STOCK_ANALYST_GAUGE_START_ANGLE,
        endAngle: needleAngle,
      })
    : '';
  const needleTip = polarToCartesian({
    cx: DIAL_CENTER_X,
    cy: DIAL_CENTER_Y,
    radius: NEEDLE_LENGTH,
    angle: needleAngle,
  });

  const consensus = ratings?.consensus;
  let consensusColor: '$textSuccess' | '$textCritical' | '$textSubdued' =
    '$textSubdued';
  if (consensus === 'Buy') {
    consensusColor = '$textSuccess';
  } else if (consensus === 'Sell') {
    consensusColor = '$textCritical';
  }

  return (
    <YStack
      testID="stock-analyst-gauge"
      width={STOCK_ANALYST_GAUGE_WIDTH}
      height={STOCK_ANALYST_GAUGE_HEIGHT}
      flexShrink={0}
    >
      <Stack
        width={STOCK_ANALYST_GAUGE_WIDTH}
        height={STOCK_ANALYST_GAUGE_DIAL_HEIGHT}
      >
        <Svg
          width={STOCK_ANALYST_GAUGE_WIDTH}
          height={STOCK_ANALYST_GAUGE_DIAL_HEIGHT}
        >
          <Defs>
            <LinearGradient
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1={DIAL_CENTER_X - DIAL_OUTER_RADIUS}
              y1={0}
              x2={DIAL_CENTER_X + DIAL_OUTER_RADIUS}
              y2={0}
            >
              <Stop offset="0" stopColor={theme.bgCriticalStrong.val} />
              <Stop offset="0.5" stopColor={theme.neutral8.val} />
              <Stop offset="1" stopColor={theme.bgSuccessStrong.val} />
            </LinearGradient>
          </Defs>
          <Path
            d={trackPath}
            fill="none"
            stroke={theme.neutral5.val}
            strokeWidth={DIAL_BAND_WIDTH}
          />
          {haloPath ? (
            <Path
              d={haloPath}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth={DIAL_HALO_WIDTH}
              strokeOpacity={DIAL_HALO_OPACITY}
            />
          ) : null}
          {bandPath ? (
            <Path
              d={bandPath}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth={DIAL_BAND_WIDTH}
            />
          ) : null}
          <Line
            x1={DIAL_CENTER_X}
            y1={DIAL_CENTER_Y}
            x2={needleTip.x}
            y2={needleTip.y}
            stroke={theme.text.val}
            strokeWidth={NEEDLE_WIDTH}
            strokeLinecap="round"
          />
          <Circle
            cx={DIAL_CENTER_X}
            cy={DIAL_CENTER_Y}
            r={NEEDLE_PIVOT_RADIUS}
            fill={theme.text.val}
          />
        </Svg>
        {STOCK_ANALYST_GAUGE_ZONE_LABELS.map((label, index) => {
          const layout = ZONE_LABEL_LAYOUT[index];
          return (
            <Stack
              key={label}
              position="absolute"
              left={layout.left}
              top={layout.top}
              width={layout.width}
              pointerEvents="none"
            >
              <SizableText
                size="$bodySmMedium"
                textAlign={layout.textAlign}
                numberOfLines={1}
                color={getZoneLabelColor(index, index === activeZoneIndex)}
              >
                {label}
              </SizableText>
            </Stack>
          );
        })}
      </Stack>
      <YStack
        pt={STOCK_ANALYST_GAUGE_CONSENSUS_TOP_GAP}
        alignItems="center"
        gap="$0"
      >
        <SizableText
          testID="stock-analyst-consensus"
          size="$headingMd"
          color={consensusColor}
          textAlign="center"
        >
          {getStockAnalystConsensus(ratings)}
        </SizableText>
        {ratings ? (
          <SizableText
            testID="stock-analyst-total"
            size="$bodySmMedium"
            color="$textSubdued"
            textAlign="center"
          >
            {counts.total > 0 ? `${counts.total} ratings` : 'Consensus'}
          </SizableText>
        ) : null}
      </YStack>
    </YStack>
  );
}
