import { useMemo } from 'react';

import { View } from 'react-native';
import WebView from 'react-native-webview';

import { Stack, useTheme } from '@onekeyhq/components';

import {
  COLORS,
  REFERENCE_CURRENT_RATE,
  REFERENCE_TARGET_RATE,
  buildPathTransform,
  clamp,
  fitTextToWidth,
  formatRate,
  getBadgeWidth,
} from './shared';

import type { IPathLayout, IPendlePtConvergenceChartProps } from './shared';

const NATIVE_SVG_WIDTH = 353;
const NATIVE_SVG_HEIGHT = 176;

const NATIVE_CHART_WIDTH = 233;
const NATIVE_TARGET_Y = 28;
const NATIVE_CURRENT_REFERENCE_Y = 118;
const NATIVE_BOTTOM_Y = 150;
const NATIVE_LABEL_Y = 172;

const NATIVE_NOW_X = 66;
const NATIVE_DOT_X = 67;
const NATIVE_MID_X = 140;
const NATIVE_END_X = 221;

const NATIVE_AXIS_TEXT_X = 243;
const NATIVE_AXIS_TEXT_PADDING = 4;
const NATIVE_AXIS_RIGHT_PADDING = 4;
const NATIVE_CURRENT_BADGE_HEIGHT = 16;
const NATIVE_BADGE_MIN_WIDTH = 56;

const NATIVE_LEFT_LINE_PATH =
  'M67.5 21.236C56.9762 21.236 46.4523 18.2009 35.9285 15.3176C25.4047 12.4344 14.8808 11.524 4.35703 3.93658C3.23802 3.1298 2.11901 2.1359 1 1';
const NATIVE_CURVE_PATH =
  'M1 1C11.5238 1 22.0476 12.2318 32.5714 15.7135C43.0952 19.1952 53.6191 17.7725 64.1429 21.8904C74.6667 26.0083 85.1906 52.4119 95.7144 55.5605C106.238 58.709 116.762 57.1348 127.286 60.2833C136.69 63.0971 146.095 82.6741 155.5 92.2208';
const NATIVE_FILL_PATH =
  'M31.5714 14.7135C21.0476 11.2318 10.5238 0 0 0V122H221V111.457C210.476 111.457 199.952 108.422 189.429 105.538C178.905 102.655 168.381 101.745 157.857 94.1574C147.333 86.57 136.809 62.4319 126.286 59.2833C115.762 56.1348 105.238 57.709 94.7144 54.5605C84.1906 51.4119 73.6667 25.0083 63.1429 20.8904C52.6191 16.7725 42.0952 18.1952 31.5714 14.7135Z';

const NATIVE_FILL_LAYOUT: IPathLayout = {
  x: 0,
  y: 28,
  width: 221,
  height: 122,
  viewBoxWidth: 221,
  viewBoxHeight: 122,
};

const NATIVE_LEFT_LAYOUT: IPathLayout = {
  x: 0,
  y: 119.216,
  width: 66.5,
  height: 20.236,
  viewBoxWidth: 68.5,
  viewBoxHeight: 22.236,
};

const NATIVE_CURVE_LAYOUT: IPathLayout = {
  x: 66.5,
  y: 28,
  width: 154.5,
  height: 91.221,
  viewBoxWidth: 156.5,
  viewBoxHeight: 93.2208,
};

const REFERENCE_RATE_GAP = REFERENCE_TARGET_RATE - REFERENCE_CURRENT_RATE;
const NATIVE_REFERENCE_CURVE_SPAN =
  NATIVE_CURRENT_REFERENCE_Y - NATIVE_TARGET_Y;
const NATIVE_CHART_Y_SPAN = NATIVE_BOTTOM_Y - NATIVE_TARGET_Y;
const NATIVE_AXIS_PADDING_GAP =
  (REFERENCE_RATE_GAP * (NATIVE_CHART_Y_SPAN - NATIVE_REFERENCE_CURVE_SPAN)) /
  NATIVE_REFERENCE_CURVE_SPAN;
const NATIVE_MAX_CURVE_SCALE =
  NATIVE_CHART_Y_SPAN / NATIVE_REFERENCE_CURVE_SPAN;

function getNativeCurveScale({
  currentRate,
  targetRate,
}: {
  currentRate: number;
  targetRate: number;
}) {
  const gap = Math.max(targetRate - currentRate, 0);
  if (!Number.isFinite(gap) || REFERENCE_RATE_GAP <= 0) {
    return 1;
  }
  const scaledSpan =
    (NATIVE_CHART_Y_SPAN * gap) / (gap + NATIVE_AXIS_PADDING_GAP);
  const rawScale = scaledSpan / NATIVE_REFERENCE_CURVE_SPAN;
  return clamp(rawScale, 0, NATIVE_MAX_CURVE_SCALE);
}

function getNativeCurrentPointY(curveScale: number) {
  return NATIVE_TARGET_Y + curveScale * NATIVE_REFERENCE_CURVE_SPAN;
}

function escapeHtml(value: string) {
  const htmlEntityMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (char) => htmlEntityMap[char]);
}

function generateSvgHTML(params: {
  midLabel: string;
  titleLabel: string;
  targetLabel: string;
  currentLabel: string;
  textMutedColor: string;
  guideLineColor: string;
  nowLineColor: string;
  maturityLineColor: string;
  dotStrokeColor: string;
  currentY: number;
  currentBadgeWidth: number;
  curveScale: number;
}): string {
  const {
    midLabel,
    titleLabel,
    targetLabel,
    currentLabel,
    textMutedColor,
    guideLineColor,
    nowLineColor,
    maturityLineColor,
    dotStrokeColor,
    currentY,
    currentBadgeWidth,
    curveScale,
  } = params;
  const safeMidLabel = escapeHtml(midLabel);
  const safeTitleLabel = escapeHtml(titleLabel);
  const safeTargetLabel = escapeHtml(targetLabel);
  const safeCurrentLabel = escapeHtml(currentLabel);
  const fillTransform = buildPathTransform(NATIVE_FILL_LAYOUT);
  const leftTransform = buildPathTransform(NATIVE_LEFT_LAYOUT);
  const curveTransform = buildPathTransform(NATIVE_CURVE_LAYOUT);
  const curveGroupTransform = `translate(0 ${NATIVE_TARGET_Y}) scale(1 ${curveScale}) translate(0 ${-NATIVE_TARGET_Y})`;
  const currentBadgeY = currentY - NATIVE_CURRENT_BADGE_HEIGHT / 2;
  const badgeTextClipX = NATIVE_AXIS_TEXT_X + NATIVE_AXIS_TEXT_PADDING;
  const badgeTextClipWidth = Math.max(
    0,
    currentBadgeWidth - NATIVE_AXIS_TEXT_PADDING * 2,
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: transparent; }
    svg { width: 100%; height: 100%; display: block; }
  </style>
</head>
<body>
  <svg viewBox="0 0 ${NATIVE_SVG_WIDTH} ${NATIVE_SVG_HEIGHT}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="convergenceGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stop-color="${COLORS.fillTop}"/>
        <stop offset="95%" stop-color="${COLORS.fillBottom}"/>
      </linearGradient>
      <clipPath id="convergenceClip">
        <rect x="0" y="0" width="${NATIVE_CHART_WIDTH}" height="${NATIVE_BOTTOM_Y}" />
      </clipPath>
      <clipPath id="badgeTextClip">
        <rect x="${badgeTextClipX}" y="${currentBadgeY}" width="${badgeTextClipWidth}" height="${NATIVE_CURRENT_BADGE_HEIGHT}" />
      </clipPath>
    </defs>
    <line x1="0" y1="${NATIVE_TARGET_Y}" x2="${NATIVE_CHART_WIDTH}" y2="${NATIVE_TARGET_Y}" stroke="${guideLineColor}" stroke-width="1" stroke-dasharray="2,2"/>
    <line x1="${NATIVE_NOW_X}" y1="0" x2="${NATIVE_NOW_X}" y2="${NATIVE_BOTTOM_Y}" stroke="${nowLineColor}" stroke-width="1" stroke-dasharray="2,2"/>
    <line x1="${NATIVE_END_X}" y1="0" x2="${NATIVE_END_X}" y2="${NATIVE_BOTTOM_Y}" stroke="${maturityLineColor}" stroke-width="1"/>
    <g clip-path="url(#convergenceClip)">
      <line x1="0" y1="${currentY}" x2="${NATIVE_CHART_WIDTH}" y2="${currentY}" stroke="${guideLineColor}" stroke-width="1" stroke-dasharray="2,2"/>
      <g transform="${curveGroupTransform}">
        <path d="${NATIVE_FILL_PATH}" transform="${fillTransform}" fill="url(#convergenceGrad)"/>
        <path d="${NATIVE_LEFT_LINE_PATH}" transform="${leftTransform}" stroke="${COLORS.greenStroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" fill="none"/>
        <path d="${NATIVE_CURVE_PATH}" transform="${curveTransform}" stroke="${COLORS.greenStroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 6" vector-effect="non-scaling-stroke" fill="none"/>
      </g>
      <circle cx="${NATIVE_DOT_X}" cy="${currentY}" r="5" fill="${COLORS.greenStroke}" stroke="${dotStrokeColor}" stroke-width="2"/>
    </g>
    <text x="${NATIVE_NOW_X}" y="${NATIVE_LABEL_Y}" text-anchor="middle" fill="${textMutedColor}" font-size="12">Now</text>
    <text x="${NATIVE_MID_X}" y="${NATIVE_LABEL_Y}" text-anchor="middle" fill="${textMutedColor}" font-size="12">${safeMidLabel}</text>
    <text x="${NATIVE_END_X}" y="${NATIVE_LABEL_Y}" text-anchor="middle" fill="${textMutedColor}" font-size="12">Maturity</text>
    <text x="${NATIVE_AXIS_TEXT_X}" y="12" fill="${textMutedColor}" font-size="12">${safeTitleLabel}</text>
    <text x="${NATIVE_AXIS_TEXT_X}" y="32" fill="${textMutedColor}" font-size="12">${safeTargetLabel}</text>
    <rect x="${NATIVE_AXIS_TEXT_X}" y="${currentBadgeY}" width="${currentBadgeWidth}" height="${NATIVE_CURRENT_BADGE_HEIGHT}" fill="${COLORS.badge}" />
    <text x="${NATIVE_AXIS_TEXT_X + NATIVE_AXIS_TEXT_PADDING}" y="${currentY + 4}" clip-path="url(#badgeTextClip)" fill="rgba(255,255,255,0.93)" font-size="12">${safeCurrentLabel}</text>
  </svg>
</body>
</html>`;
}

export function PendlePtConvergenceChart({
  chart,
}: IPendlePtConvergenceChartProps) {
  const theme = useTheme();
  const { currentRate, targetRate, remainingDays, accountingSymbol, ptSymbol } =
    chart;
  const midLabel = `${Math.round(remainingDays / 2)} days`;
  const curveScale = getNativeCurveScale({ currentRate, targetRate });
  const currentY = getNativeCurrentPointY(curveScale);
  const currentRateText = formatRate(currentRate);
  const targetRateText = formatRate(targetRate);
  const textMutedColor = theme.textSubdued.val;
  const guideLineColor = theme.iconDisabled.val;
  const nowLineColor = theme.iconSubdued.val;
  const maturityLineColor = theme.iconDisabled.val;
  const dotStrokeColor = theme.bg.val;
  const axisMaxWidth =
    NATIVE_SVG_WIDTH - NATIVE_AXIS_TEXT_X - NATIVE_AXIS_RIGHT_PADDING;
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
    minWidth: NATIVE_BADGE_MIN_WIDTH,
    maxWidth: axisMaxWidth,
  });

  const htmlContent = useMemo(
    () =>
      generateSvgHTML({
        midLabel,
        titleLabel,
        targetLabel,
        currentLabel,
        textMutedColor,
        guideLineColor,
        nowLineColor,
        maturityLineColor,
        dotStrokeColor,
        currentY,
        currentBadgeWidth,
        curveScale,
      }),
    [
      midLabel,
      titleLabel,
      targetLabel,
      currentLabel,
      textMutedColor,
      guideLineColor,
      nowLineColor,
      maturityLineColor,
      dotStrokeColor,
      currentY,
      currentBadgeWidth,
      curveScale,
    ],
  );

  return (
    <Stack width={NATIVE_SVG_WIDTH} maxWidth="100%" height={NATIVE_SVG_HEIGHT}>
      <View style={{ flex: 1 }}>
        <WebView
          source={{ html: htmlContent }}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          bounces={false}
          style={{ backgroundColor: 'transparent' }}
          androidLayerType="hardware"
          originWhitelist={['about:blank']}
          allowFileAccess={false}
          allowUniversalAccessFromFileURLs={false}
          javaScriptEnabled={false}
          domStorageEnabled={false}
          mixedContentMode="never"
          onShouldStartLoadWithRequest={({ url }) => url === 'about:blank'}
        />
      </View>
    </Stack>
  );
}
