import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';

import { SegmentSliderView } from '@onekeyfe/react-native-segment-slider';
import { StyleSheet } from 'react-native';

import { useTheme } from '../../hooks/useStyle';

// Touch/hit area height, matching the web variant's HIT_AREA_HEIGHT.
const HIT_AREA_HEIGHT = 24;
const DEFAULT_TRACK_HEIGHT = 4;

// The native view's `epoch` token is only meant to suppress the thumb-scale
// animation on a hard reset — but that scale animation fires solely on touch
// (drag start/end), never on a controlled `value` change, which already
// applies instantly without animation. So no caller of this slider needs to
// bump it; keep it fixed. Re-expose as a prop if a future caller ever needs
// the reset semantics.
const FIXED_EPOCH = 0;

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

  return (
    <SegmentSliderView
      style={styles.slider}
      value={value}
      min={min}
      max={max}
      segments={segments}
      sliderHeight={sliderHeight}
      disabled={disabled}
      showBubble={showBubble}
      centerOrigin={centerOrigin}
      snapTapToSegment={snapTapToSegment}
      epoch={FIXED_EPOCH}
      onChange={onChange}
      onSlideStart={onSlideStart}
      onSlideComplete={onSlideComplete}
      {...colors}
    />
  );
}

export const SegmentSlider = memo(SegmentSliderComponent);
SegmentSlider.displayName = 'SegmentSlider';
