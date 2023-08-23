import { useCallback, useState } from 'react';

import NativeSlider from '@react-native-community/slider';
import { Slider as WebSlider } from 'native-base';

import useThemeValue from '../Provider/hooks/useThemeValue';

import type { SliderProps } from './type';

const Slider = ({ nativeMode, children, ...props }: SliderProps) => {
  const { onChangeBegin, onChange, onChangeEnd, maxValue, minValue } = props;
  const minimumTrackTintColor = useThemeValue('interactive-default');
  const maximumTrackTintColor = useThemeValue('surface-neutral-default');

  const [isSliding, changeSliding] = useState(false);
  const onWebValueChange = useCallback(
    (value: number) => {
      if (!isSliding && onChangeBegin) {
        changeSliding(true);
        onChangeBegin();
      }
      if (onChange) {
        onChange(value);
      }
    },
    [onChange, isSliding, onChangeBegin],
  );

  const onWebChangeEnd = useCallback(
    (value: number) => {
      changeSliding(false);
      if (onChangeEnd) {
        onChangeEnd(value);
      }
    },
    [changeSliding, onChangeEnd],
  );

  return nativeMode ? (
    <NativeSlider
      minimumTrackTintColor={minimumTrackTintColor}
      maximumTrackTintColor={maximumTrackTintColor}
      {...props}
      onSlidingStart={onChangeBegin}
      onSlidingComplete={onChangeEnd}
      maximumValue={maxValue}
      minimumValue={minValue}
      onValueChange={onChange}
    />
  ) : (
    <WebSlider
      {...props}
      onChange={onWebValueChange}
      onChangeEnd={onWebChangeEnd}
    >
      {children}
    </WebSlider>
  );
};

Slider.Track = WebSlider.Track;
Slider.FilledTrack = WebSlider.FilledTrack;
Slider.Thumb = WebSlider.Thumb;
export default Slider;
