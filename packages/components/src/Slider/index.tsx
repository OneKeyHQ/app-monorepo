import NativeSlider from '@react-native-community/slider';
import { Slider as WebSlider } from 'native-base';

import type { ISliderProps } from 'native-base';
import type { GestureResponderEvent } from 'react-native';

const Slider = ({
  nativeMode,
  children,
  ...props
}: ISliderProps & {
  nativeMode?: boolean;
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
}) =>
  nativeMode ? (
    <NativeSlider
      {...props}
      onSlidingStart={() => {
        if (props.onTouchStart) {
          props.onTouchStart({} as unknown as GestureResponderEvent);
        }
      }}
      onSlidingComplete={props.onChangeEnd}
      maximumValue={props.maxValue}
      minimumValue={props.minValue}
      onValueChange={props.onChange}
    />
  ) : (
    <WebSlider {...props}>{children}</WebSlider>
  );

Slider.Track = WebSlider.Track;
Slider.FilledTrack = WebSlider.FilledTrack;
Slider.Thumb = WebSlider.Thumb;
export default Slider;
