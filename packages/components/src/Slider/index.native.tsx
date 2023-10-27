import RNSlider from '@react-native-community/slider';

import { useThemeValue } from '../Provider/hooks/useThemeValue';

import type { SliderProps as TMSliderProps } from 'tamagui';

export interface SliderProps extends TMSliderProps {
  disabled?: boolean;
}

export const Slider = ({ disabled, ...props }: SliderProps) => (
  <RNSlider
    h="$1"
    opacity={disabled ? 0.5 : 1}
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
