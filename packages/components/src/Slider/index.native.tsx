import { useCallback } from 'react';

import RNSlider, {
  type SliderProps as RNSliderProps,
} from '@react-native-community/slider';
import { usePropsAndStyle } from '@tamagui/core';

import { useThemeValue } from '../Provider/hooks/useThemeValue';

import type { BaseSliderProps } from './type';

export type SliderProps = Omit<
  RNSliderProps,
  'onValueChange' | 'minimumValue' | 'maximumValue' | 'step'
> &
  BaseSliderProps;

export function Slider({ onChange, min, max, step, ...props }: SliderProps) {
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  const [bgPrimaryColor, neutral5Color, borderInverseColor] = useThemeValue([
    'bgPrimary',
    'neutral5',
    'borderInverse',
  ]);

  const handleValueChange = useCallback(
    (values: number) => onChange?.(values),
    [onChange],
  );
  return (
    <RNSlider
      tapToSeek
      style={style}
      minimumValue={min}
      maximumValue={max}
      step={step}
      minimumTrackTintColor={bgPrimaryColor}
      maximumTrackTintColor={neutral5Color}
      thumbTintColor={borderInverseColor}
      onValueChange={handleValueChange}
      {...restProps}
    />
  );
}
