import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ComponentProps, ComponentType, ReactNode } from 'react';

import {
  type SegmentSliderMethods,
  type SegmentSliderProps,
  SegmentSliderView,
} from '@onekeyfe/react-native-segment-slider';
import { StyleSheet } from 'react-native';
import {
  type HybridRef,
  type NitroViewWrappedCallback,
  callback,
} from 'react-native-nitro-modules';

import { useTheme } from '../../hooks/useStyle';

// Touch/hit area height, matching the web variant's HIT_AREA_HEIGHT.
const HIT_AREA_HEIGHT = 24;
const DEFAULT_TRACK_HEIGHT = 4;

// Handle to the underlying Nitro hybrid object, used to drive the (now
// uncontrolled) native view imperatively via `setValue`.
type ISegmentSliderHybridRef = HybridRef<
  SegmentSliderProps,
  SegmentSliderMethods & {
    setValue(value: number): void;
  }
>;

// The module wrapper types its props as `SegmentSliderProps & ViewProps`, which
// omits the Nitro-injected `hybridRef`. Re-add it so we can grab the ref. (It
// must be wrapped with `callback(...)` to cross the JSI boundary.)
type ISegmentSliderNativeViewProps = Omit<
  ComponentProps<typeof SegmentSliderView>,
  'value' | 'epoch'
> & {
  hybridRef?: NitroViewWrappedCallback<(ref: ISegmentSliderHybridRef) => void>;
  defaultValue?: number;
};

const SegmentSliderNativeView =
  SegmentSliderView as ComponentType<ISegmentSliderNativeViewProps>;

const styles = StyleSheet.create({
  slider: {
    width: '100%',
    height: HIT_AREA_HEIGHT,
  },
});

export interface ISegmentSliderProps {
  value: number;
  sliderHeight?: number;
  onChange: (value: number) => void;
  segments: number;
  /**
   * @deprecated The native view does not snap (parity with the web variant,
   * which has no drag-snap). Kept for cross-platform prop compatibility.
   */
  snapThreshold?: number;
  /** @deprecated No drag-snap on native. Accepted for prop compatibility. */
  forceSnapToStep?: boolean;
  onSlideStart?: () => void;
  onSlideComplete?: () => void;
  /**
   * When true, a tap (a press that does not turn into a drag) snaps the value to
   * the nearest segment mark; a drag still moves freely to any value. No-op when
   * `segments` is 0. Default false. Native-only for now — the web variant
   * (`./index.tsx`) does not yet honor this and keeps its tap-on-mark snapping.
   */
  snapTapToSegment?: boolean;
  /**
   * @deprecated Not supported by the native (Nitro) renderer — marks/thumb are
   * drawn natively. Accepted for prop compatibility but ignored.
   */
  renderThumb?: () => ReactNode;
  /** @deprecated Not supported by the native renderer. Ignored. */
  renderMark?: (props: { index: number }) => ReactNode;
  min?: number;
  max?: number;
  disabled?: boolean;
  showBubble?: boolean;
  /**
   * When true, the slider fills from center (0) instead of left edge.
   * Negative values fill left from center, positive values fill right from center.
   */
  centerOrigin?: boolean;
}

/**
 * Native SegmentSlider backed by the `@onekeyfe/react-native-segment-slider`
 * Nitro HybridView. Track, fill, segment marks, thumb and value bubble are
 * drawn entirely on the native UI thread and the pan gesture is handled
 * natively, so a drag never crosses the JS bridge per frame. Colors are
 * resolved from the Tamagui theme here and passed in as hex strings, mirroring
 * the web variant (`./index.tsx`) 1:1.
 *
 * The native view is UNCONTROLLED: it takes the initial value via `defaultValue`
 * (applied once at mount) and afterwards owns the value, reporting drags through
 * `onChange`. This wrapper keeps the public `value` prop controlled — like the
 * web variant — by pushing external value changes back into the native view
 * imperatively through `setValue` on the hybrid ref. The sync is skipped while
 * the user is dragging (so a re-render from the in-flight `onChange` can't yank
 * the thumb away from the finger) and on no-op updates.
 */
function SegmentSliderComponent({
  value,
  sliderHeight = DEFAULT_TRACK_HEIGHT,
  onChange,
  segments,
  onSlideStart,
  onSlideComplete,
  min = 0,
  max = 100,
  disabled = false,
  showBubble = true,
  centerOrigin = false,
  snapTapToSegment = false,
}: ISegmentSliderProps) {
  const theme = useTheme();
  // `.val` re-reads on theme change (useTheme re-runs the component), so the
  // native view repaints with fresh colors on light/dark switches.
  const bgPrimary = theme.bgPrimary.val;
  const neutral5 = theme.neutral5.val;
  const bg = theme.bg.val;
  const borderStrong = theme.borderStrong.val;

  const colors = useMemo(
    () => ({
      fillColor: bgPrimary,
      trackColor: neutral5,
      thumbColor: bg,
      thumbBorderColor: borderStrong,
      markActiveColor: bgPrimary,
      markInactiveColor: bg,
      markBorderColor: neutral5,
      bubbleColor: bgPrimary,
      bubbleTextColor: bg,
    }),
    [bgPrimary, neutral5, bg, borderStrong],
  );

  // Always holds the latest external `value`, so the hybridRef callback can push
  // it once the native view attaches even if `value` changed before that.
  const latestValueRef = useRef(value);
  // Last value the native side reported, or that we successfully pushed in. Lets
  // us skip the post-drag re-render's setValue (value already matches) and any
  // other no-op. Declared before hybridRef so the callback can read it.
  const lastValueRef = useRef(value);
  // True between onSlideStart/onSlideComplete; gates the value-sync effect so a
  // re-render mid-drag (the parent echoing our own onChange back as `value`)
  // doesn't call setValue and cancel the in-flight drag.
  const draggingRef = useRef(false);

  const sliderRef = useRef<ISegmentSliderHybridRef | null>(null);
  const hybridRef = useMemo(
    () =>
      callback((node: ISegmentSliderHybridRef) => {
        sliderRef.current = node;
        // Catch-up: the native view's `defaultValue` only captures the FIRST
        // value. If `value` advanced before this ref attached (async native view
        // creation), the value-sync effect's setValue was a no-op against a null
        // ref — push the latest value now so it isn't lost.
        if (
          !draggingRef.current &&
          latestValueRef.current !== lastValueRef.current
        ) {
          lastValueRef.current = latestValueRef.current;
          node.setValue(latestValueRef.current);
        }
      }),
    [],
  );

  // Value captured ONCE for the uncontrolled native view's `defaultValue`.
  // Subsequent external changes are pushed via `setValue` in the effect below.
  const initialValueRef = useRef(value);

  const handleChange = useCallback(
    (next: number) => {
      lastValueRef.current = next;
      onChange(next);
    },
    [onChange],
  );

  const handleSlideStart = useCallback(() => {
    draggingRef.current = true;
    onSlideStart?.();
  }, [onSlideStart]);

  const handleSlideComplete = useCallback(() => {
    draggingRef.current = false;
    onSlideComplete?.();
  }, [onSlideComplete]);

  useEffect(() => {
    latestValueRef.current = value;
    // Skip the initial mount (covered by defaultValue, value === lastValueRef),
    // any update while dragging, and no-op echoes of the native value.
    if (draggingRef.current) return;
    if (value === lastValueRef.current) return;
    const node = sliderRef.current;
    if (!node) {
      // Ref not ready yet: leave lastValueRef stale so the hybridRef callback
      // pushes this value once the native view attaches (else it'd be lost).
      return;
    }
    lastValueRef.current = value;
    node.setValue(value);
  }, [value]);

  return (
    <SegmentSliderNativeView
      style={styles.slider}
      hybridRef={hybridRef}
      defaultValue={initialValueRef.current}
      min={min}
      max={max}
      segments={segments}
      sliderHeight={sliderHeight}
      disabled={disabled}
      showBubble={showBubble}
      centerOrigin={centerOrigin}
      snapTapToSegment={snapTapToSegment}
      onChange={handleChange}
      onSlideStart={handleSlideStart}
      onSlideComplete={handleSlideComplete}
      {...colors}
    />
  );
}

export const SegmentSlider = memo(SegmentSliderComponent);
SegmentSlider.displayName = 'SegmentSlider';
