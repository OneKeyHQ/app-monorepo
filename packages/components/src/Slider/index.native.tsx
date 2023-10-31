import { useCallback } from 'react';

import RNSlider, {
  type SliderProps as RNSliderProps,
} from '@react-native-community/slider';
import { styled } from 'tamagui';

import { useThemeValue } from '../Provider/hooks/useThemeValue';

import type { BaseSliderProps } from './type';

export type SliderProps = RNSliderProps & BaseSliderProps;

function BaseSlider({ disabled, onChange, ...props }: SliderProps) {
  const [bgPrimaryColor, neutral5Color, borderInverseColor] = useThemeValue([
    'bgPrimary',
    'neutral5',
    'borderInverse',
  ]);
  console.log(disabled, props);

  const handleValueChange = useCallback(
    (values: number) => onChange?.(values),
    [onChange],
  );
  return (
    <RNSlider
      disabled={disabled}
      tapToSeek
      minimumTrackTintColor={bgPrimaryColor}
      maximumTrackTintColor={neutral5Color}
      thumbTintColor={borderInverseColor}
      value={props.value ? props.value : props.defaultValue}
      onValueChange={handleValueChange}
      {...props}
    />
  );
};

export const Slider = styled(BaseSlider, {
  name: 'Slider',
  height: '$1',
});
