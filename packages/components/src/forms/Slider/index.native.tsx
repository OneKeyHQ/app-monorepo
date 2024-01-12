import { useCallback, useRef } from 'react';

import RNSlider from '@react-native-community/slider';
import { usePropsAndStyle } from '@tamagui/core';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useThemeValue } from '../../hooks';

import type { IBaseSliderProps } from './type';
import type { ViewStyle } from 'react-native';

export type ISliderProps = IBaseSliderProps;

export function Slider({
  onChange,
  min,
  max,
  step,
  onSlideStart,
  onSlideMove,
  onSlideEnd,
  ...props
}: ISliderProps) {
  const isSlidingRef = useRef(false);
  const isSlideEndRef = useRef<NodeJS.Timeout>();

  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  const [bgPrimaryColor, neutral5Color] = useThemeValue([
    'bgPrimary',
    'neutral5',
  ]);

  const handleSlideEnd = useCallback(() => {
    isSlidingRef.current = false;
    onSlideEnd?.();
  }, [onSlideEnd]);

  const handleValueChange = useCallback(
    (value: number) => {
      if (!isSlidingRef.current) {
        onSlideStart?.();
        isSlidingRef.current = true;
      }
      onChange?.(value);
      onSlideMove?.(value);
      if (platformEnv.isNativeAndroid) {
        clearTimeout(isSlideEndRef.current);
        isSlideEndRef.current = setTimeout(() => {
          handleSlideEnd();
        }, 50);
      }
    },
    [handleSlideEnd, onChange, onSlideMove, onSlideStart],
  );

  return (
    <RNSlider
      tapToSeek
      // The style type annotation returned by the usePropsAndStyle function is incorrect, it needs to be fixed by Tamagui.
      style={style as ViewStyle}
      minimumValue={min}
      maximumValue={max}
      step={step}
      minimumTrackTintColor={bgPrimaryColor}
      maximumTrackTintColor={neutral5Color}
      onValueChange={handleValueChange}
      // "onSlideStart does not work on the Web Platform"
      // onSlideStart={onSlideStart}
      //
      // In the tap scenario, Android does not trigger onSlidingComplete function.
      onSlidingComplete={
        platformEnv.isNativeAndroid ? handleSlideEnd : undefined
      }
      {...restProps}
    />
  );
}
