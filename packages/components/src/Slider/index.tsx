import { Slider as TMSlider } from 'tamagui';

import type { SliderProps as TMSliderProps } from 'tamagui';

export interface SliderProps extends TMSliderProps {
  disabled?: boolean;
}

export const Slider = ({
  disabled,
  value,
  defaultValue,
  onValueChange,
  ...props
}: SliderProps) => (
  <TMSlider
    {...props}
    h="$1"
    opacity={disabled ? 0.5 : 1}
    disabled={disabled}
    min={0}
    max={1}
    step={0.001}
    defaultValue={defaultValue ? [defaultValue] : undefined}
    value={value ? [value] : undefined}
    onValueChange={(valueList) => onValueChange && onValueChange(valueList[0])}
  >
    <TMSlider.Track bg="$neutral5">
      <TMSlider.TrackActive bg="$bgPrimary" />
    </TMSlider.Track>
    <TMSlider.Thumb
      unstyled
      position="absolute"
      size="$5"
      $platform-native={{
        hitSlop: 8,
      }}
      circular
      index={0}
      bg="$bg"
      borderWidth="$px"
      borderColor="$borderStrong"
      elevation={1}
      focusStyle={{
        outlineColor: '$borderActive',
      }}
    />
  </TMSlider>
);
