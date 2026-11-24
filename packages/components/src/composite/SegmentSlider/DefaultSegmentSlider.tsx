import { memo } from 'react';
import type { ReactNode } from 'react';

import { SegmentSlider as BaseSegmentSlider } from '@onekeyfe/react-native-segment-slider';

import { useTheme } from '../../hooks/useStyle';

import type { ISegmentSliderProps as IBaseSegmentSliderProps } from '@onekeyfe/react-native-segment-slider';

export interface ISegmentSliderProps extends IBaseSegmentSliderProps {
  activeColor?: string;
  onSlideCancel?: () => void;
  appearance?: 'default' | 'dotted';
  snapThreshold?: number;
  forceSnapToStep?: boolean;
  renderThumb?: () => ReactNode;
  renderMark?: (props: { index: number }) => ReactNode;
}

/**
 * App slider for every platform. Rendering lives in
 * `@onekeyfe/react-native-segment-slider` (Nitro view on iOS/Android, DOM on
 * web/desktop/extension); this wrapper only supplies Tamagui theme colors as
 * defaults. Pass any color prop (resolved color string) to override it.
 */
function SegmentSliderComponent({
  activeColor,
  fillColor,
  trackColor,
  thumbColor,
  thumbBorderColor,
  markActiveColor,
  markInactiveColor,
  markBorderColor,
  bubbleColor,
  bubbleTextColor,
  ...props
}: ISegmentSliderProps) {
  // `.val` re-reads on theme change (useTheme re-runs the component), so the
  // slider repaints with fresh colors on light/dark switches.
  const theme = useTheme();
  const bgPrimary = theme.bgPrimary.val;
  const neutral5 = theme.neutral5.val;
  const bg = theme.bg.val;
  const borderStrong = theme.borderStrong.val;

  return (
    <BaseSegmentSlider
      {...props}
      fillColor={fillColor ?? activeColor ?? bgPrimary}
      trackColor={trackColor ?? neutral5}
      thumbColor={thumbColor ?? bg}
      thumbBorderColor={thumbBorderColor ?? borderStrong}
      markActiveColor={markActiveColor ?? activeColor ?? bgPrimary}
      markInactiveColor={markInactiveColor ?? bg}
      markBorderColor={markBorderColor ?? neutral5}
      bubbleColor={bubbleColor ?? activeColor ?? bgPrimary}
      bubbleTextColor={bubbleTextColor ?? bg}
    />
  );
}

export const DefaultSegmentSlider = memo(SegmentSliderComponent);
DefaultSegmentSlider.displayName = 'DefaultSegmentSlider';
