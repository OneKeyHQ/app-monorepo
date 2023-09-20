import { useCallback, useState } from 'react';

import NativeSlider from '@react-native-community/slider';
import { Slider as WebSlider } from 'native-base';

import type { ISliderProps } from 'native-base';

const Slider = ({
  nativeMode,
  children,
  ...props
}: ISliderProps & {
  nativeMode?: boolean;
  onChangeBegin?: () => void;
  /**
   * The color used for the track to the left of the button.
   * Overrides the default blue gradient image.
   */
  minimumTrackTintColor?: string;
  /**
   * The color used for the track to the right of the button.
   * Overrides the default blue gradient image.
   */
  maximumTrackTintColor?: string;
}) => {
  const { onChangeBegin, onChange, onChangeEnd, maxValue, minValue } = props;
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
      minimumTrackTintColor="#33c641"
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
