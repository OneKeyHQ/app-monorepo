import { useId, useMemo } from 'react';

import { useIntl } from 'react-intl';
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

import { formatStockAnalystConsensus } from '../../utils/stockPublicDataUtils';

import {
  STOCK_ANALYST_GAUGE_END_ANGLE,
  STOCK_ANALYST_GAUGE_START_ANGLE,
  STOCK_ANALYST_GAUGE_ZONE_LABEL_IDS,
  describeStockAnalystGaugeArc,
  getStockAnalystGaugeAngle,
  getStockAnalystGaugeScore,
  getStockAnalystGaugeZoneIndex,
  polarToCartesian,
} from './analystGaugeUtils';

import type { IStockAnalystRatingCounts } from './analystGaugeUtils';

// Geometry transcribed from the Figma reference (node 26190:22905): a 1100x558
// capture of the analyst dial placed at 380px wide, so every measured pixel is
// scaled by 380 / 1100.
export const STOCK_ANALYST_GAUGE_WIDTH = 380;
const STOCK_ANALYST_GAUGE_DIAL_HEIGHT = 156;
// The consensus block sits under the dial: a single $headingMd (16/24) line,
// with the 4px the reference leaves under the arc. The rating total moved to
// the section footer, so no second line is reserved here.
const STOCK_ANALYST_GAUGE_CONSENSUS_TOP_GAP = 4;
export const STOCK_ANALYST_GAUGE_HEIGHT =
  STOCK_ANALYST_GAUGE_DIAL_HEIGHT + STOCK_ANALYST_GAUGE_CONSENSUS_TOP_GAP + 24;

// Snapped to the box center (380 / 2) so the consensus heading, which centers
// on the container, lines up with the needle pivot; the TradingView reference
// screenshot had the dial 2.2px left of its own frame.
const DIAL_CENTER_X = 190;
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

/**
 * The band gradient is painted in user space along the dial's x axis, from
 * `cx - DIAL_OUTER_RADIUS` to `cx + DIAL_OUTER_RADIUS`. A point sitting at
 * `angle` on the dial has x = cx + R * cos(angle), so it lands on the stop
 * offset (1 + cos(angle)) / 2 (offset 0 is the 180deg end of the half circle).
 */
function gaugeAngleToGradientOffset(angle: number): number {
  return (1 + Math.cos((angle * Math.PI) / 180)) / 2;
}

// Strong sell end of the dial (180deg) -> offset 0.
const GRADIENT_CRITICAL_OFFSET = gaugeAngleToGradientOffset(180);
// Sell / Neutral boundary (108deg) -> offset ~0.345, where the band passes
// through the same tone as the unreached track.
const GRADIENT_TRACK_OFFSET = gaugeAngleToGradientOffset(108);
// Inside the Buy zone, ahead of the Strong buy boundary at 36deg (45deg) ->
// offset ~0.854; the band is fully green from there on.
const GRADIENT_SUCCESS_OFFSET = gaugeAngleToGradientOffset(45);
// Strong buy end of the dial (0deg) -> offset 1.
const GRADIENT_END_OFFSET = gaugeAngleToGradientOffset(0);

// Measured at $bodySmMedium (12/16) in the reference and re-fitted for
// $bodyMdMedium (14/20): every anchor moves so the glyphs keep the reference's
// optical center. English boxes were measured for the English copy; translated
// extremes run much longer (German, Russian, Ukrainian), so:
// - The outer boxes are capped by the arc, not the dial center: at the label
//   line-box bottom (y = 112.6) the arc's edge sits at
//   DIAL_CENTER_X - sqrt(DIAL_OUTER_RADIUS² - (DIAL_CENTER_Y - 112.6)²) ≈ 87,
//   so 79 keeps ~8px of clearance. Long translations wrap onto a second line
//   that grows UPWARD (bottom-anchored; the area above the label at x < 79 is
//   outside the arc), so a single-line English label sits exactly where the
//   reference put it.
// - The middle box widens to 90 around its unchanged center (190): the
//   Russian/Ukrainian "Neutral" label measures 81px and overflows the
//   English-measured 80.
const OUTER_ZONE_LABEL_WIDTH = 79;
const OUTER_ZONE_LABEL_BOTTOM = STOCK_ANALYST_GAUGE_DIAL_HEIGHT - 112.6;
const ZONE_LABEL_LAYOUT: {
  left?: number;
  right?: number;
  width: number;
  top?: number;
  bottom?: number;
  maxLines: number;
  textAlign: 'left' | 'center' | 'right';
}[] = [
  {
    left: 0,
    width: OUTER_ZONE_LABEL_WIDTH,
    bottom: OUTER_ZONE_LABEL_BOTTOM,
    maxLines: 2,
    textAlign: 'right',
  },
  { left: 61.2, width: 80, top: 38, maxLines: 1, textAlign: 'center' },
  { left: 145, width: 90, top: 9.2, maxLines: 1, textAlign: 'center' },
  { left: 239.1, width: 80, top: 38, maxLines: 1, textAlign: 'center' },
  {
    right: 0,
    width: OUTER_ZONE_LABEL_WIDTH,
    bottom: OUTER_ZONE_LABEL_BOTTOM,
    maxLines: 2,
    textAlign: 'left',
  },
];

// Zones 0-1 are the sell half of the dial, zone 2 is neutral, zones 3-4 are the
// buy half; the highlighted label borrows the same tone as its band.
function getZoneLabelColor(
  zoneIndex: number,
  isActive: boolean,
): '$textCritical' | '$textSuccess' | '$text' | '$textDisabled' {
  if (!isActive) {
    return '$textDisabled';
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
  // Parsed by the caller: the section footer reports the same total, so the
  // provider payload is only walked once.
  ratingCounts?: IStockAnalystRatingCounts;
}

export function StockAnalystGauge({
  ratings,
  ratingCounts,
}: IStockAnalystGaugeProps) {
  const intl = useIntl();
  const theme = useTheme();
  // SVG gradient ids share one namespace per document on web, so the id has to
  // stay unique per instance. `useId` returns colon separated ids that url(#)
  // references cannot resolve.
  const gradientId = `stockAnalystGaugeBand${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const score = useMemo(
    () => getStockAnalystGaugeScore({ counts: ratingCounts, ratings }),
    [ratingCounts, ratings],
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
              <Stop
                offset={GRADIENT_CRITICAL_OFFSET}
                stopColor={theme.bgCriticalStrong.val}
              />
              <Stop
                offset={GRADIENT_TRACK_OFFSET}
                stopColor={theme.neutral5.val}
              />
              <Stop
                offset={GRADIENT_SUCCESS_OFFSET}
                stopColor={theme.bgSuccessStrong.val}
              />
              <Stop
                offset={GRADIENT_END_OFFSET}
                stopColor={theme.bgSuccessStrong.val}
              />
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
        {STOCK_ANALYST_GAUGE_ZONE_LABEL_IDS.map((labelId, index) => {
          const layout = ZONE_LABEL_LAYOUT[index];
          return (
            <Stack
              key={labelId}
              position="absolute"
              left={layout.left}
              right={layout.right}
              top={layout.top}
              bottom={layout.bottom}
              width={layout.width}
              pointerEvents="none"
            >
              <SizableText
                size="$bodyMdMedium"
                textAlign={layout.textAlign}
                numberOfLines={layout.maxLines}
                color={getZoneLabelColor(index, index === activeZoneIndex)}
              >
                {intl.formatMessage({ id: labelId })}
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
          {formatStockAnalystConsensus({ intl, analystRatings: ratings })}
        </SizableText>
      </YStack>
    </YStack>
  );
}
