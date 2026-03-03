import { useId } from 'react';

import { Stack, useTheme } from '@onekeyhq/components';

import {
  BOTTOM_Y,
  CHART_WIDTH,
  COLORS,
  CURVE_LAYOUT,
  CURVE_PATH,
  DOT_X,
  END_X,
  FILL_LAYOUT,
  FILL_PATH,
  LABEL_Y,
  LEFT_LAYOUT,
  LEFT_LINE_PATH,
  MID_X,
  NOW_X,
  SVG_HEIGHT,
  SVG_WIDTH,
  TARGET_Y,
  buildPathTransform,
  fitTextToWidth,
  formatRate,
  getBadgeWidth,
  getCurrentPointY,
  getCurveScale,
} from './shared';

import type { IPendlePtConvergenceChartProps } from './shared';

const WEB_AXIS_X = 522;
const WEB_AXIS_TEXT_PADDING = 4;
const WEB_AXIS_RIGHT_PADDING = 4;
const WEB_BADGE_MIN_WIDTH = 56;
const WEB_BADGE_HEIGHT = 22;
const WEB_BADGE_RADIUS = 2;

export function PendlePtConvergenceChart({
  chart,
}: IPendlePtConvergenceChartProps) {
  const theme = useTheme();
  const chartId = useId().replace(/:/g, '');
  const { currentRate, targetRate, remainingDays, accountingSymbol, ptSymbol } =
    chart;
  const midLabel = `${Math.round(remainingDays / 2)} days`;
  const curveScale = getCurveScale({ currentRate, targetRate });
  const currentY = getCurrentPointY(curveScale);
  const currentRateText = formatRate(currentRate);
  const targetRateText = formatRate(targetRate);
  const guideLineColor = theme.iconDisabled.val;
  const textMutedColor = theme.textSubdued.val;
  const dotStrokeColor = theme.bg.val;
  const gradientId = `convergenceGrad-${chartId}`;
  const clipId = `convergenceClip-${chartId}`;
  const axisMaxWidth = SVG_WIDTH - WEB_AXIS_X - WEB_AXIS_RIGHT_PADDING;
  const titleLabel = fitTextToWidth(`${ptSymbol} Price`, axisMaxWidth);
  const targetLabel = fitTextToWidth(
    `${targetRateText} ${accountingSymbol}`,
    axisMaxWidth,
  );
  const currentLabel = fitTextToWidth(
    `${currentRateText} ${accountingSymbol}`,
    axisMaxWidth,
  );
  const currentBadgeWidth = getBadgeWidth({
    text: currentLabel,
    minWidth: WEB_BADGE_MIN_WIDTH,
    maxWidth: axisMaxWidth,
  });
  const currentBadgeY = currentY - WEB_BADGE_HEIGHT / 2;
  const badgeClipId = `convergenceBadgeClip-${chartId}`;
  const badgeTextClipX = WEB_AXIS_X + WEB_AXIS_TEXT_PADDING;
  const badgeTextClipWidth = Math.max(
    0,
    currentBadgeWidth - WEB_AXIS_TEXT_PADDING * 2,
  );

  return (
    <Stack position="relative" width="100%" style={{ height: 'fit-content' }}>
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', height: 'auto' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.fillTop} />
            <stop offset="95%" stopColor={COLORS.fillBottom} />
          </linearGradient>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={CHART_WIDTH} height={BOTTOM_Y} />
          </clipPath>
          <clipPath id={badgeClipId}>
            <rect
              x={badgeTextClipX}
              y={currentBadgeY}
              width={badgeTextClipWidth}
              height={WEB_BADGE_HEIGHT}
            />
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
        />
        <line
          x1={NOW_X}
          y1={0}
          x2={NOW_X}
          y2={BOTTOM_Y}
          stroke={guideLineColor}
          strokeWidth={1}
          strokeDasharray="3,3"
        />
        <line
          x1={END_X}
          y1={0}
          x2={END_X}
          y2={BOTTOM_Y}
          stroke={guideLineColor}
          strokeWidth={1}
        />

        <g clipPath={`url(#${clipId})`}>
          <line
            x1={0}
            y1={currentY}
            x2={CHART_WIDTH}
            y2={currentY}
            stroke={guideLineColor}
            strokeWidth={1}
            strokeDasharray="3,3"
          />
          <g
            transform={`translate(0 ${TARGET_Y}) scale(1 ${curveScale}) translate(0 ${-TARGET_Y})`}
          >
            <path
              d={FILL_PATH}
              transform={buildPathTransform(FILL_LAYOUT)}
              fill={`url(#${gradientId})`}
            />
            <path
              d={LEFT_LINE_PATH}
              transform={buildPathTransform(LEFT_LAYOUT)}
              stroke={COLORS.greenStroke}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              fill="none"
            />
            <path
              d={CURVE_PATH}
              transform={buildPathTransform(CURVE_LAYOUT)}
              stroke={COLORS.greenStroke}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="3 6"
              vectorEffect="non-scaling-stroke"
              fill="none"
            />
          </g>
          <circle
            cx={DOT_X}
            cy={currentY}
            r={5}
            fill={COLORS.greenStroke}
            stroke={dotStrokeColor}
            strokeWidth={2}
          />
        </g>

        <text
          x={NOW_X}
          y={LABEL_Y}
          textAnchor="middle"
          fill={textMutedColor}
          fontSize={12}
        >
          Now
        </text>
        <text
          x={MID_X}
          y={LABEL_Y}
          textAnchor="middle"
          fill={textMutedColor}
          fontSize={12}
        >
          {midLabel}
        </text>
        <text
          x={END_X}
          y={LABEL_Y}
          textAnchor="middle"
          fill={textMutedColor}
          fontSize={12}
        >
          Maturity
        </text>
        <text x={WEB_AXIS_X} y={16} fill={textMutedColor} fontSize={12}>
          {titleLabel}
        </text>
        <text x={WEB_AXIS_X} y={58} fill={textMutedColor} fontSize={12}>
          {targetLabel}
        </text>
        <rect
          x={WEB_AXIS_X}
          y={currentBadgeY}
          rx={WEB_BADGE_RADIUS}
          ry={WEB_BADGE_RADIUS}
          width={currentBadgeWidth}
          height={WEB_BADGE_HEIGHT}
          fill={COLORS.badge}
        />
        <text
          x={WEB_AXIS_X + WEB_AXIS_TEXT_PADDING}
          y={currentY + 4}
          clipPath={`url(#${badgeClipId})`}
          fill="rgba(255,255,255,0.93)"
          fontSize={12}
        >
          {currentLabel}
        </text>
      </svg>
    </Stack>
  );
}
