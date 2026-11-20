import { memo } from 'react';

import { SegmentSlider } from '@onekeyhq/components';

/**
 * Slider for Perps trading, built on SegmentSlider (Nitro view on iOS/Android,
 * DOM on web/desktop/extension). On iOS/Android a drag ticks a light haptic on
 * every 1 unit (1% of a 0..100 range, 1x of leverage) and a stronger one on
 * each segment mark.
 *
 * @param segments - Number of visual segment marks to display
 * @param sliderHeight - Height of the slider track
 * @param showBubble - Whether to show value bubble during drag
 * @param centerOrigin - Fill from center (0) instead of left edge (for ±range)
 * @param step - Accepted for API compatibility; segments drives the snap grid.
 */
export interface IPerpsSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  segments?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
  sliderHeight?: number;
  showBubble?: boolean;
  step?: number;
  centerOrigin?: boolean;
  /** When true, a quick tap snaps to the nearest segment mark while a drag
   * stays free. Default false. */
  snapTapToSegment?: boolean;
}

function PerpsSliderComponent({
  value,
  onChange,
  min = 0,
  max = 100,
  segments = 0,
  disabled = false,
  accessibilityLabel,
  sliderHeight,
  showBubble = false,
  centerOrigin = false,
  snapTapToSegment = false,
}: IPerpsSliderProps) {
  return (
    <SegmentSlider
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      segments={segments}
      disabled={disabled}
      aria-label={accessibilityLabel}
      sliderHeight={sliderHeight}
      showBubble={showBubble}
      centerOrigin={centerOrigin}
      snapTapToSegment={snapTapToSegment}
      hapticStep={1}
    />
  );
}

export const PerpsSlider = memo(PerpsSliderComponent);
PerpsSlider.displayName = 'PerpsSlider';
