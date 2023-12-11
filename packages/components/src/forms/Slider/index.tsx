import { useCallback, useRef } from 'react';

import { clamp } from 'lodash';
import { Slider as TMSlider } from 'tamagui';

import type { IBaseSliderProps } from './type';
// spell mistake in tamagui components.
// eslint-disable-next-line spellcheck/spell-checker
import type { GestureReponderEvent } from '@tamagui/core';

export type ISliderProps = IBaseSliderProps;

export const Slider = ({
  disabled,
  value,
  onChange,
  onSlideStart,
  onSlideMove,
  onSlideEnd,
  max,
  min,
  ...props
}: ISliderProps) => {
  const isSlidingRef = useRef(false);

  const handleValueChange = useCallback(
    (values: number[]) => onChange?.(values[0]),
    [onChange],
  );

  const handleSlideMove = useCallback(
    // spell mistake in tamagui components.
    // eslint-disable-next-line spellcheck/spell-checker
    (_: GestureReponderEvent, v: number) => {
      if (!isSlidingRef.current) {
        onSlideStart?.();
        isSlidingRef.current = true;
      }
      // When dragging the Slider, it will return a value based on the distance of the gesture slide,
      // so it is necessary to use clamp to limit the value range.
      onSlideMove?.(clamp(v, min, max));
    },
    [max, min, onSlideMove, onSlideStart],
  );

  const handleSlideEnd = useCallback(() => {
    isSlidingRef.current = false;
    onSlideEnd?.();
  }, [onSlideEnd]);
  return (
    <TMSlider
      h="$1"
      {...props}
      max={max}
      min={min}
      opacity={disabled ? 0.5 : 1}
      disabled={disabled}
      value={value ? [value] : undefined}
      onValueChange={handleValueChange}
      // "onSlideStart does not work on the Web Platform"
      // onSlideStart={handleSlideStart}
      onSlideMove={handleSlideMove}
      onSlideEnd={handleSlideEnd}
    >
      <TMSlider.Track bg="$neutral5">
        <TMSlider.TrackActive bg="$bgPrimary" />
      </TMSlider.Track>
      <TMSlider.Thumb
        unstyled
        position="absolute"
        size="$5"
        $platform-native={{
          hitSlop: { top: 8, left: 8, right: 8, bottom: 8 },
        }}
        circular
        index={0}
        bg="$bg"
        borderWidth="$px"
        borderColor="$borderStrong"
        elevation={1}
        focusStyle={{
          outlineColor: '$borderActive',
        }}
      />
    </TMSlider>
  );
};
