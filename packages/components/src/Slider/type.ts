import type { ISliderProps } from 'native-base';

export type SliderProps = ISliderProps & {
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

  presentStyle?: { lineCount: number; space: number };
  thumbStyle?: {
    size: number;
    bgColor: string;
    borderColor: string;
    borderWidth: number;
  };
};
