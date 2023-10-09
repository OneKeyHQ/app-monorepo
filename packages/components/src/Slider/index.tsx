import { Slider as TMSlider } from 'tamagui';

import type { SliderProps as TMSliderProps } from 'tamagui';

export interface SliderProps extends TMSliderProps {
  disabled?: boolean;
}

export const Slider = ({ disabled, ...rest }: SliderProps) => (
  <TMSlider {...rest} h="$1" opacity={disabled ? 0.5 : 1}>
    <TMSlider.Track bg="$neutral5">
      <TMSlider.TrackActive bg="$bgPrimary" />
    </TMSlider.Track>
    <TMSlider.Thumb
      unstyled
      position="absolute"
      size="$5"
      hitSlop={8}
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
