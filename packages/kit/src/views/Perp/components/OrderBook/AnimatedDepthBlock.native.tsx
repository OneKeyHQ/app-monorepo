import { type ComponentType, useEffect, useMemo, useState } from 'react';

import {
  type PerpDepthBarsProps,
  PerpDepthBarsView,
  PerpSideRatioView,
} from '@onekeyfe/react-native-perp-depth-bar';
import {
  AccessibilityInfo,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
  processColor,
} from 'react-native';

import { normalizeDepthWidth } from './AnimatedDepthBlock.shared';

import type {
  IDepthBarColumnProps,
  IDepthBarProps,
  ISideRatioSegmentsProps,
} from './AnimatedDepthBlock.shared';

const DEFAULT_ROW_HEIGHT = 24;
const SIDE_RATIO_SEGMENT_HEIGHT = 4;
const SIDE_RATIO_CORNER_RADIUS = 999;
const StyledPerpDepthBarsView = PerpDepthBarsView as ComponentType<
  PerpDepthBarsProps & { style?: StyleProp<ViewStyle> }
>;
const noopOnRowPress = () => undefined;

/**
 * The native perp-depth-bar views parse only `#hex` and `rgb()/rgba()` color
 * strings. The OneKey theme often hands colors as `hsl(...)`, which the native
 * parser rejects (falls back to transparent → invisible bars). Normalize any
 * RN-supported color string to `rgba(...)` here so the native side always gets
 * a parseable value. (Web/desktop keep using the raw value — CSS parses hsl.)
 */
function toNativeColor(color: string): string {
  const processed = processColor(color);
  if (typeof processed !== 'number') {
    return color;
  }
  // RN's processColor returns a packed color int; on Android it can be negative.
  // Normalize to unsigned, then unpack via arithmetic into an rgba() string the
  // native parser accepts.
  const colorInt = processed < 0 ? processed + 0x1_00_00_00_00 : processed;
  const a = Math.floor(colorInt / 0x1_00_00_00) % 256;
  const r = Math.floor(colorInt / 0x1_00_00) % 256;
  const g = Math.floor(colorInt / 0x1_00) % 256;
  const b = colorInt % 256;
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(4)})`;
}

/**
 * Tracks the OS "reduce motion" accessibility setting. Replaces reanimated's
 * `useReducedMotion` now that this file no longer depends on reanimated.
 */
function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) {
        setReducedMotion(value);
      }
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => setReducedMotion(value),
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

/**
 * Renders an entire column of order-book depth bars for one side with a single
 * native view (replaces N reanimated `DepthBar` rows). The bars animate on the
 * native UI thread; pixel alignment with the sibling RN text layer is driven by
 * the constants in `AnimatedDepthBlock.shared.ts` (design §7).
 */
export function DepthBarColumn({
  animated = true,
  percents,
  rowHeight,
  rowMarginTop,
  barInset,
  color,
  origin = 'left',
  epoch,
  prices,
  sizes,
  priceColor,
  sizeColor,
  priceFontSize,
  sizeFontSize,
  textInset,
  onRowPress,
}: IDepthBarColumnProps) {
  const osReducedMotion = useReducedMotion();
  const reducedMotion = !animated || osReducedMotion;
  const totalHeight =
    percents.length * rowHeight + percents.length * rowMarginTop;
  const nativeColor = useMemo(() => toNativeColor(color), [color]);
  const nativePriceColor = useMemo(
    () => (priceColor ? toNativeColor(priceColor) : undefined),
    [priceColor],
  );
  const nativeSizeColor = useMemo(
    () => (sizeColor ? toNativeColor(sizeColor) : undefined),
    [sizeColor],
  );

  return (
    <StyledPerpDepthBarsView
      percents={percents}
      rowHeight={rowHeight}
      rowMarginTop={rowMarginTop}
      barInset={barInset}
      color={nativeColor}
      origin={origin}
      reducedMotion={reducedMotion}
      epoch={epoch}
      prices={prices ?? []}
      sizes={sizes ?? []}
      priceColor={nativePriceColor ?? 'rgba(0,0,0,1)'}
      sizeColor={nativeSizeColor ?? 'rgba(0,0,0,1)'}
      priceFontSize={priceFontSize ?? 11}
      sizeFontSize={sizeFontSize ?? 11}
      textInset={textInset ?? 0}
      onRowPress={onRowPress ?? noopOnRowPress}
      style={{ width: '100%', height: totalHeight }}
    />
  );
}

/**
 * Thin single-row wrapper preserving the legacy `DepthBar` API for the dev-only
 * `OrderPairBook` gallery. Production layouts use `DepthBarColumn` instead.
 */
export function DepthBar({
  color,
  width,
  left,
  right,
  height,
  origin = 'left',
}: IDepthBarProps) {
  const reducedMotion = useReducedMotion();
  const targetWidth = useMemo(() => normalizeDepthWidth(width), [width]);
  const rowHeight = height ?? DEFAULT_ROW_HEIGHT;
  const nativeColor = useMemo(() => toNativeColor(color), [color]);

  return (
    <StyledPerpDepthBarsView
      percents={[targetWidth]}
      rowHeight={rowHeight}
      rowMarginTop={0}
      barInset={0}
      color={nativeColor}
      origin={origin}
      reducedMotion={reducedMotion}
      epoch={0}
      prices={[]}
      sizes={[]}
      priceColor="rgba(0,0,0,1)"
      sizeColor="rgba(0,0,0,1)"
      priceFontSize={11}
      sizeFontSize={11}
      textInset={0}
      onRowPress={noopOnRowPress}
      style={{
        position: 'absolute',
        top: 0,
        left,
        right,
        ...((left === null || left === undefined) &&
        (right === null || right === undefined)
          ? { width: '100%' }
          : null),
        height: rowHeight,
      }}
    />
  );
}

export function SideRatioSegments({
  animated = true,
  bidPercentage,
  askPercentage,
  longColor,
  shortColor,
  segmentStyle,
  startSegmentStyle,
  gap = 4,
}: ISideRatioSegmentsProps) {
  const osReducedMotion = useReducedMotion();
  const reducedMotion = !animated || osReducedMotion;
  const flatSegment = StyleSheet.flatten(segmentStyle) ?? {};
  const flatStart = StyleSheet.flatten(startSegmentStyle) ?? {};
  const segmentHeight =
    typeof flatSegment.height === 'number'
      ? flatSegment.height
      : SIDE_RATIO_SEGMENT_HEIGHT;
  const cornerRadius =
    typeof flatStart.borderTopLeftRadius === 'number'
      ? flatStart.borderTopLeftRadius
      : SIDE_RATIO_CORNER_RADIUS;
  const nativeLongColor = useMemo(() => toNativeColor(longColor), [longColor]);
  const nativeShortColor = useMemo(
    () => toNativeColor(shortColor),
    [shortColor],
  );

  return (
    <PerpSideRatioView
      bidPercentage={bidPercentage}
      askPercentage={askPercentage}
      longColor={nativeLongColor}
      shortColor={nativeShortColor}
      segmentHeight={segmentHeight}
      cornerRadius={cornerRadius}
      gap={gap}
      reducedMotion={reducedMotion}
      style={{ flex: 1, height: segmentHeight }}
    />
  );
}
