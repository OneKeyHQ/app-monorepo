import { memo } from 'react';

import { SegmentSlider, Slider } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

/**
 * Platform-adaptive slider component for Perps trading.
 *
 * - Native (iOS/Android): Uses SegmentSlider for better performance
 * - Web/Desktop: Uses standard Slider for better compatibility
 *
 * This component handles the platform-specific differences automatically.
 *
 * @param step - Step value for the slider, defaults to 1 (Web/Desktop only)
 * @param segments - Number of visual segment marks to display
 * @param sliderHeight - Height of the slider track (Native only)
 * @param showBubble - Whether to show value bubble (Native only)
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
  /**
   * When true, the slider fills from center (0) instead of left edge.
   * Negative values fill left from center, positive values fill right from center.
   * Native only.
   */
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
  step = 1,
  centerOrigin = false,
}: IPerpsSliderProps) {
  if (platformEnv.isNative) {
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

  return (
    <Slider
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      step={step}
      segments={segments}
      disabled={disabled}
    />
  );
}

export const PerpsSlider = memo(PerpsSliderComponent);
PerpsSlider.displayName = 'PerpsSlider';
