import {
  type ComponentType,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  type PerpDepthBarsMethods,
  type PerpDepthBarsProps,
  PerpDepthBarsView,
  type PerpSideRatioMethods,
  type PerpSideRatioProps,
  PerpSideRatioView,
} from '@onekeyfe/react-native-perp-depth-bar';
import {
  type HybridView,
  callback as nitroCallback,
} from 'react-native-nitro-modules';
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

/**
 * Stable empty array passed as the `percents` prop on `DepthBarColumn`. The
 * high-frequency per-row depth data is pushed imperatively via the native
 * `setDepth` method (see below), so the prop must stay referentially stable to
 * avoid re-entering the React reconciliation + Fabric props commit + JSI
 * serialization path on every frame (REACT-NATIVE-1JZ).
 */
const EMPTY_PERCENTS: number[] = [];

/**
 * Imperative hybrid-view ref types. Nitro views expose their native methods on
 * the `hybridRef` (NOT the React `ref`); we mirror the same `HybridView<Props,
 * Methods>` shape the package declares internally (its index only re-exports
 * the Props/Methods, not the composed alias).
 */
type IPerpDepthBarsRef = HybridView<PerpDepthBarsProps, PerpDepthBarsMethods>;
type IPerpSideRatioRef = HybridView<PerpSideRatioProps, PerpSideRatioMethods>;

const DEFAULT_ROW_HEIGHT = 24;
const SIDE_RATIO_SEGMENT_HEIGHT = 4;
const SIDE_RATIO_CORNER_RADIUS = 999;
const StyledPerpDepthBarsView = PerpDepthBarsView as ComponentType<
  PerpDepthBarsProps & {
    style?: StyleProp<ViewStyle>;
    // Nitro `hybridRef` callback; wrapped via `callback(...)`. The wrapper
    // component spreads it straight through to the underlying host component.
    hybridRef?: { f: (ref: IPerpDepthBarsRef) => void };
  }
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
  // Depth bars animate by default — the `animated` prop is intentionally ignored
  // so callers can never accidentally ship a non-animated book. Only the OS
  // "reduce motion" accessibility setting disables the native easing.
  const reducedMotion = useReducedMotion();
  // `totalHeight` is still derived from the live `percents` arg (row count drives
  // layout); only the high-frequency native data path is moved off props.
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

  // Imperative depth push: bypass the per-frame `percents` prop commit and feed
  // the native view a single packed Float32Array via `setDepth` (one JSI call,
  // skipping the React/Fabric props chain — REACT-NATIVE-1JZ).
  const depthRef = useRef<IPerpDepthBarsRef | null>(null);
  // Typed as `Float32Array<ArrayBuffer>` so `.buffer` narrows to `ArrayBuffer`
  // (not `ArrayBufferLike`) for the `setDepth(buffer: ArrayBuffer)` call.
  const bufRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  // Stable `hybridRef` callback so the prop never changes identity between
  // renders (a new callback would force a Fabric props re-commit every frame).
  const hybridRef = useMemo(
    () =>
      nitroCallback((node: IPerpDepthBarsRef) => {
        depthRef.current = node;
      }),
    [],
  );

  useEffect(() => {
    const node = depthRef.current;
    if (!node) {
      return;
    }
    let buf = bufRef.current;
    // Reuse the same backing buffer across frames; only reallocate when the row
    // count changes. `setDepth` synchronously copies the data into the native
    // target (it does not retain the buffer), so overwriting it next frame is
    // safe.
    if (!buf || buf.length !== percents.length) {
      buf = new Float32Array(percents.length);
      bufRef.current = buf;
    }
    buf.set(percents);
    node.setDepth?.(buf.buffer);
  }, [percents]);

  return (
    <StyledPerpDepthBarsView
      hybridRef={hybridRef}
      percents={EMPTY_PERCENTS}
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
  bidPercentage,
  askPercentage,
  longColor,
  shortColor,
  segmentStyle,
  startSegmentStyle,
  gap = 4,
}: ISideRatioSegmentsProps) {
  // Animates by default — `animated` is intentionally ignored (only OS reduce
  // motion disables it), so callers never need a prop to get animation.
  const reducedMotion = useReducedMotion();
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

  // Imperative ratio push: bypass the high-frequency
  // `bidPercentage`/`askPercentage` prop commits and update the native view in a
  // single JSI call via `setRatio` (REACT-NATIVE-1JZ).
  const ratioRef = useRef<IPerpSideRatioRef | null>(null);
  const hybridRef = useMemo(
    () =>
      nitroCallback((node: IPerpSideRatioRef) => {
        ratioRef.current = node;
      }),
    [],
  );

  useEffect(() => {
    ratioRef.current?.setRatio?.(bidPercentage, askPercentage);
  }, [bidPercentage, askPercentage]);

  return (
    <PerpSideRatioView
      hybridRef={hybridRef}
      bidPercentage={50}
      askPercentage={50}
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
