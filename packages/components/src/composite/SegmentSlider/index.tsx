import { memo } from 'react';

import { SegmentSlider as BaseSegmentSlider } from '@onekeyfe/react-native-segment-slider';

import { useSettingConfig } from '../../hocs/Provider/hooks/useProviderValue';
import { useTheme } from '../../hooks/useStyle';

import type { ISegmentSliderProps as IBaseSegmentSliderProps } from '@onekeyfe/react-native-segment-slider';

export type ISegmentSliderProps = IBaseSegmentSliderProps;

/**
 * App slider for every platform. Rendering lives in
 * `@onekeyfe/react-native-segment-slider` (Nitro view on iOS/Android, DOM on
 * web/desktop/extension); this wrapper only supplies Tamagui theme colors as
 * defaults. Pass any color prop (resolved color string) to override it.
 * Native haptic ticks follow the app-level haptic setting; a caller can only
 * turn them off further, never back on while the setting is off.
 */
function SegmentSliderComponent({
  fillColor,
  trackColor,
  thumbColor,
  thumbBorderColor,
  markActiveColor,
  markInactiveColor,
  markBorderColor,
  bubbleColor,
  bubbleTextColor,
  hapticFeedbackEnabled,
  ...props
}: ISegmentSliderProps) {
  // The native view fires its own haptics, so the global Haptics switch
  // never reaches it; forward the setting explicitly. The context is empty
  // outside ConfigProvider, so only an explicit false disables.
  const { hapticFeedbackEnabled: settingHapticEnabled } = useSettingConfig();
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
      fillColor={fillColor ?? bgPrimary}
      trackColor={trackColor ?? neutral5}
      thumbColor={thumbColor ?? bg}
      thumbBorderColor={thumbBorderColor ?? borderStrong}
      markActiveColor={markActiveColor ?? bgPrimary}
      markInactiveColor={markInactiveColor ?? bg}
      markBorderColor={markBorderColor ?? neutral5}
      bubbleColor={bubbleColor ?? bgPrimary}
      bubbleTextColor={bubbleTextColor ?? bg}
      hapticFeedbackEnabled={
        settingHapticEnabled !== false && hapticFeedbackEnabled !== false
      }
    />
  );
}

export const SegmentSlider = memo(SegmentSliderComponent);
SegmentSlider.displayName = 'SegmentSlider';
