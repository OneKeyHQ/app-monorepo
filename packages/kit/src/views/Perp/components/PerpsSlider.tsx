import { memo } from 'react';

import { SegmentSlider } from '@onekeyhq/components';

/**
 * Platform-adaptive slider component for Perps trading.
 *
 * Uses SegmentSlider on every platform — the underlying implementation is
 * file-extension-split: native runs the reanimated-based slider, web/desktop/
 * extension run a pure-DOM implementation that avoids React-state-per-frame
 * during drag (fixes hysteresis, refresh layout race, and segment click drift).
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
  sliderHeight?: number;
  showBubble?: boolean;
  step?: number;
  centerOrigin?: boolean;
}

function PerpsSliderComponent({
  value,
  onChange,
  min = 0,
  max = 100,
  segments = 0,
  disabled = false,
  sliderHeight,
  showBubble = false,
  centerOrigin = false,
}: IPerpsSliderProps) {
  return (
    <SegmentSlider
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      segments={segments}
      disabled={disabled}
      sliderHeight={sliderHeight}
      showBubble={showBubble}
      centerOrigin={centerOrigin}
    />
  );
}

export const PerpsSlider = memo(PerpsSliderComponent);
PerpsSlider.displayName = 'PerpsSlider';
