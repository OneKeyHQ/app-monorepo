import RNSlider, {
  type SliderProps as RNSliderProps,
} from '@react-native-community/slider';
import { styled } from 'tamagui';

import { useThemeValue } from '../Provider/hooks/useThemeValue';

import type { BaseSliderProps } from './type';

export type SliderProps = RNSliderProps & BaseSliderProps;

const BaseSlider = ({ disabled, ...props }: SliderProps) => (
  <RNSlider
    // not work in native
    // opacity={disabled ? 0.5 : 1}
    disabled={disabled}
    tapToSeek
    minimumTrackTintColor={useThemeValue('bgPrimary')}
    maximumTrackTintColor={useThemeValue('neutral5')}
    // thumbImage={require('../../../kit/assets/logo_black.png')}
    thumbTintColor={useThemeValue('borderInverse')}
    value={props.value ? props.value : props.defaultValue}
    {...props}
  />
);

export const Slider = styled(BaseSlider, {
  name: 'Slider',
  height: '$1',
});
