import { useCallback } from 'react';

import { Slider as TMSlider } from 'tamagui';

import type { BaseSliderProps } from './type';
import type { SliderProps as TMSliderProps } from 'tamagui';

export type SliderProps = BaseSliderProps &
  Omit<
    TMSliderProps,
    'defaultValue' | 'value' | 'onValueChange' | 'min' | 'max' | 'step'
  >;

export const Slider = ({
  disabled,
  value,
  onChange,
  ...props
}: SliderProps) => {
  const handleValueChange = useCallback(
    (values: number[]) => onChange?.(values[0]),
    [onChange],
  );
  return (
    <TMSlider
      h="$1"
      {...props}
      opacity={disabled ? 0.5 : 1}
      disabled={disabled}
      value={value ? [value] : undefined}
      onValueChange={handleValueChange}
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
};
