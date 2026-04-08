import { useId } from 'react';

import {
  SizableText,
  Stack,
  XStack,
  useMedia,
  useTheme,
} from '@onekeyhq/components';

import {
  BOTTOM_Y,
  CHART_WIDTH,
  COLORS,
  CURRENT_REFERENCE_Y,
  DOT_X,
  END_X,
  FULL_CURVE_PATH,
  FULL_FILL_PATH,
  LABEL_Y,
  MID_X,
  NOW_X,
  SVG_HEIGHT,
  TARGET_Y,
  formatRate,
} from './shared';

import type { IPendlePtConvergenceChartProps } from './shared';

const WEB_BADGE_RADIUS = 2;
// Width reserved for the right-side labels column
const LABELS_COLUMN_WIDTH = 110;
const LABELS_COLUMN_GAP = 10;

const SMALL_SCREEN_SCALE = 0.8;

// Convert SVG x-coordinate to percentage within the chart area
const chartPct = (x: number) => `${(x / CHART_WIDTH) * 100}%`;

export function PendlePtConvergenceChart({
  chart,
}: IPendlePtConvergenceChartProps) {
  const theme = useTheme();
  const media = useMedia();
  const isSmall = !media.gtMd;
  const scale = isSmall ? SMALL_SCREEN_SCALE : 1;
  const chartHeight = Math.round(SVG_HEIGHT * scale);

  const chartId = useId().replace(/:/g, '');
  const { currentRate, targetRate, remainingDays, accountingSymbol, ptSymbol } =
    chart;
  const midLabel = `${remainingDays} days`;
  // Curve shape is fixed (illustrative diagram); only right-side labels reflect actual prices.
  const currentY = CURRENT_REFERENCE_Y * scale;
  const guideLineColor = theme.iconDisabled.val;
  const dotStrokeColor = theme.bg.val;
  const gradientId = `convergenceGrad-${chartId}`;
  const clipId = `convergenceClip-${chartId}`;

  const currentRateText = formatRate(currentRate);
  const targetRateText = formatRate(targetRate);
  const titleLabel = `${ptSymbol} Price`;
  const targetLabel = `${targetRateText} ${accountingSymbol}`;
  const currentLabel = `${currentRateText} ${accountingSymbol}`;

  // Scaled Y positions for HTML overlays
  const targetYScaled = TARGET_Y * scale;
  const labelYScaled = LABEL_Y * scale;

  return (
    <XStack width="100%" height={chartHeight}>
      {/* Chart area: SVG graphics + bottom labels + dot overlay */}
      <Stack flex={1} position="relative" overflow="visible">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${SVG_HEIGHT}`}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          style={{ display: 'block', position: 'absolute', inset: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.fillTop} />
              <stop offset="95%" stopColor={COLORS.fillBottom} />
            </linearGradient>
            <clipPath id={clipId}>
              <rect x="0" y="0" width={CHART_WIDTH} height={BOTTOM_Y} />
            </clipPath>
          </defs>

          <line
            x1={0}
            y1={TARGET_Y}
            x2={CHART_WIDTH}
            y2={TARGET_Y}
            stroke={guideLineColor}
            strokeWidth={1}
            strokeDasharray="3,3"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={NOW_X}
            y1={0}
            x2={NOW_X}
            y2={BOTTOM_Y}
            stroke={guideLineColor}
            strokeWidth={1}
            strokeDasharray="3,3"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={END_X}
            y1={0}
            x2={END_X}
            y2={BOTTOM_Y}
            stroke={guideLineColor}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />

          <g clipPath={`url(#${clipId})`}>
            <line
              x1={0}
              y1={CURRENT_REFERENCE_Y}
              x2={CHART_WIDTH}
              y2={CURRENT_REFERENCE_Y}
              stroke={guideLineColor}
              strokeWidth={1}
              strokeDasharray="3,3"
              vectorEffect="non-scaling-stroke"
            />
            <g>
              <path d={FULL_FILL_PATH} fill={`url(#${gradientId})`} />
              <path
                d={FULL_CURVE_PATH}
                stroke={COLORS.greenStroke}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="3 6"
                vectorEffect="non-scaling-stroke"
                fill="none"
              />
            </g>
          </g>
        </svg>

        {/* Dot overlay (HTML to keep circular shape under non-uniform scaling) */}
        <Stack
          position="absolute"
          style={{
            left: chartPct(DOT_X),
            top: currentY - 6,
            transform: 'translateX(-50%)',
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: COLORS.greenStroke,
            borderWidth: 2,
            borderStyle: 'solid',
            borderColor: dotStrokeColor,
            boxSizing: 'border-box',
          }}
        />

        {/* Bottom axis labels */}
        <Stack
          position="absolute"
          style={{
            left: chartPct(NOW_X),
            top: labelYScaled - 14,
            transform: 'translateX(-50%)',
          }}
        >
          <SizableText
            size="$bodySm"
            color="$textSubdued"
            style={{ whiteSpace: 'nowrap' }}
          >
            Now
          </SizableText>
        </Stack>
        <Stack
          position="absolute"
          style={{
            left: chartPct(MID_X),
            top: labelYScaled - 14,
            transform: 'translateX(-50%)',
          }}
        >
          <SizableText
            size="$bodySm"
            color="$textSubdued"
            style={{ whiteSpace: 'nowrap' }}
          >
            {midLabel}
          </SizableText>
        </Stack>
        <Stack
          position="absolute"
          style={{
            left: chartPct(END_X),
            top: labelYScaled - 14,
            transform: 'translateX(-50%)',
          }}
        >
          <SizableText
            size="$bodySm"
            color="$textSubdued"
            style={{ whiteSpace: 'nowrap' }}
          >
            Maturity
          </SizableText>
        </Stack>
      </Stack>

      {/* Right labels column (fixed width, never compressed) */}
      <Stack width={LABELS_COLUMN_WIDTH} flexShrink={0} position="relative">
        {/* Title */}
        <Stack
          position="absolute"
          top={Math.round(4 * scale)}
          left={LABELS_COLUMN_GAP}
        >
          <SizableText
            size="$bodySm"
            color="$textSubdued"
            style={{ fontWeight: '600', whiteSpace: 'nowrap' }}
          >
            {titleLabel}
          </SizableText>
        </Stack>

        {/* Target rate */}
        <Stack
          position="absolute"
          top={targetYScaled - 8}
          left={LABELS_COLUMN_GAP}
        >
          <SizableText
            size="$bodySm"
            color="$textSubdued"
            style={{ whiteSpace: 'nowrap' }}
          >
            {targetLabel}
          </SizableText>
        </Stack>

        {/* Current rate badge */}
        <Stack
          position="absolute"
          left={LABELS_COLUMN_GAP}
          top={currentY - 11}
          borderRadius={WEB_BADGE_RADIUS}
          style={{
            backgroundColor: COLORS.badge,
            paddingLeft: 4,
            paddingRight: 4,
            paddingTop: 3,
            paddingBottom: 3,
          }}
        >
          <SizableText
            size="$bodySm"
            style={{ whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.93)' }}
          >
            {currentLabel}
          </SizableText>
        </Stack>
      </Stack>
    </XStack>
  );
}
