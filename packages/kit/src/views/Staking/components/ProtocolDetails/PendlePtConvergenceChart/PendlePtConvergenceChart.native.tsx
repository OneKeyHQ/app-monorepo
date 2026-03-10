import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { View } from 'react-native';
import WebView from 'react-native-webview';

import { Skeleton, Stack, useTheme } from '@onekeyhq/components';

import { COLORS, fitTextToWidth, formatRate, getBadgeWidth } from './shared';

import type { IPendlePtConvergenceChartProps } from './shared';

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

// Full-width wavy curve in native SVG absolute coordinates (scaled from web reference).
// Key anchor: at NATIVE_NOW_X (66) the curve sits at NATIVE_CURRENT_REFERENCE_Y (118).
const NATIVE_FULL_CURVE_PATH =
  'M 5 121 C 15 121 29 100 39 103 C 49 106 58 115 66 118 C 73 121 77 136 85 136 C 94 136 103 83 115 83 C 124 83 128 96 137 88 C 148 76 157 66 166 60 C 176 54 189 39 198 37 C 207 34 215 29 221 28';

// Same curve closed to the bottom for the gradient fill area.
const NATIVE_FULL_FILL_PATH =
  'M 5 121 C 15 121 29 100 39 103 C 49 106 58 115 66 118 C 73 121 77 136 85 136 C 94 136 103 83 115 83 C 124 83 128 96 137 88 C 148 76 157 66 166 60 C 176 54 189 39 198 37 C 207 34 215 29 221 28 L 221 150 L 5 150 Z';

// Curve shape is fixed (illustrative diagram); only right-side labels reflect actual prices.
const NATIVE_CURRENT_Y = NATIVE_CURRENT_REFERENCE_Y;

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
  } = params;
  const safeMidLabel = escapeHtml(midLabel);
  const safeTitleLabel = escapeHtml(titleLabel);
  const safeTargetLabel = escapeHtml(targetLabel);
  const safeCurrentLabel = escapeHtml(currentLabel);
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
      <g>
        <path d="${NATIVE_FULL_FILL_PATH}" fill="url(#convergenceGrad)"/>
        <path d="${NATIVE_FULL_CURVE_PATH}" stroke="${COLORS.greenStroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 6" vector-effect="non-scaling-stroke" fill="none"/>
      </g>
      <circle cx="${NATIVE_DOT_X}" cy="${currentY}" r="5" fill="${COLORS.greenStroke}" stroke="${dotStrokeColor}" stroke-width="2"/>
    </g>
    <text x="${NATIVE_NOW_X}" y="${NATIVE_LABEL_Y}" text-anchor="middle" fill="${textMutedColor}" font-size="12">Now</text>
    <text x="${NATIVE_MID_X}" y="${NATIVE_LABEL_Y}" text-anchor="middle" fill="${textMutedColor}" font-size="12">${safeMidLabel}</text>
    <text x="${NATIVE_END_X}" y="${NATIVE_LABEL_Y}" text-anchor="middle" fill="${textMutedColor}" font-size="12">Maturity</text>
    <text x="${NATIVE_AXIS_TEXT_X}" y="12" fill="${textMutedColor}" font-size="12" font-weight="600">${safeTitleLabel}</text>
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
  const midLabel = `${remainingDays} days`;
  const currentY = NATIVE_CURRENT_Y;
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
    ],
  );

  const [webViewReady, setWebViewReady] = useState(false);
  const prevHtmlRef = useRef(htmlContent);
  useEffect(() => {
    if (prevHtmlRef.current !== htmlContent) {
      prevHtmlRef.current = htmlContent;
      setWebViewReady(false);
    }
  }, [htmlContent]);
  const handleLoadEnd = useCallback(() => setWebViewReady(true), []);

  return (
    <Stack width={NATIVE_SVG_WIDTH} maxWidth="100%" height={NATIVE_SVG_HEIGHT}>
      {!webViewReady ? (
        <Stack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={1}
        >
          <Skeleton w="100%" h="100%" borderRadius="$2" />
        </Stack>
      ) : null}
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
          onLoadEnd={handleLoadEnd}
        />
      </View>
    </Stack>
  );
}
