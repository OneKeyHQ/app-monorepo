import RNSlider, {
  type SliderProps as RNSliderProps,
} from '@react-native-community/slider';
import { styled } from 'tamagui';

import { useThemeValue } from '../Provider/hooks/useThemeValue';

import type { BaseSliderProps } from './type';

export type SliderProps = RNSliderProps & BaseSliderProps;

const BaseSlider = ({ disabled, ...props }: SliderProps) => {
  const [bgPrimaryColor, neutral5Color, borderInverseColor] = useThemeValue([
    'bgPrimary',
    'neutral5',
    'borderInverse',
  ]);
  return (
    <RNSlider
      // not work in native
      // opacity={disabled ? 0.5 : 1}
      disabled={disabled}
      tapToSeek
      minimumTrackTintColor={bgPrimaryColor}
      maximumTrackTintColor={neutral5Color}
      thumbTintColor={borderInverseColor}
      value={props.value ? props.value : props.defaultValue}
      {...props}
    />
  );
};

export const Slider = styled(BaseSlider, {
  name: 'Slider',
  height: '$1',
});
