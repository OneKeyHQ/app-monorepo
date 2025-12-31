import { useCallback, useMemo, useRef, useState } from 'react';

import { clamp } from 'lodash';

import { TMSlider } from '@onekeyhq/components/src/shared/tamagui';

import { XStack, YStack } from '../../primitives';
import { NATIVE_HIT_SLOP } from '../../utils/getFontSize';

import type { IBaseSliderProps } from './type';
// spell mistake in tamagui components.
// eslint-disable-next-line spellcheck/spell-checker
import type { LayoutChangeEvent } from 'react-native';

function SliderSegment({
  onPress,
  isActive,
}: {
  onPress: () => void;
  isActive: boolean;
}) {
  return (
    <XStack
      w={8}
      h={8}
      borderRadius="$full"
      borderCurve="continuous"
      borderWidth={1}
      borderColor={isActive ? '$bgPrimary' : '$neutral9'}
      bg="$bgApp"
      onPress={onPress}
      cursor="pointer"
    />
  );
}

export type ISliderProps = IBaseSliderProps;

export const Slider = ({
  disabled,
  value,
  defaultValue,
  onChange,
  onSlideStart,
  onSlideMove,
  onSlideEnd,
  max,
  min,
  onLayout,
  segments,

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
    (_: unknown, v: number) => {
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
  const [layout, setLayout] = useState<
    LayoutChangeEvent['nativeEvent']['layout'] | undefined
  >(undefined);
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      setLayout?.(event.nativeEvent.layout);
      onLayout?.(event);
    },
    [onLayout],
  );

  const handleSlideEnd = useCallback(() => {
    isSlidingRef.current = false;
    onSlideEnd?.();
  }, [onSlideEnd]);

  const sliderContent = useMemo(() => {
    return (
      <TMSlider
        h="$1"
        cursor="pointer"
        {...(props as any)}
        max={max}
        min={min}
        opacity={disabled ? 0.5 : 1}
        disabled={disabled}
        value={value !== undefined && value !== null ? [value] : undefined}
        defaultValue={
          defaultValue !== undefined && defaultValue !== null
            ? [defaultValue]
            : undefined
        }
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
          size="$4"
          hitSlop={NATIVE_HIT_SLOP}
          circular
          index={0}
          bg="$bg"
          cursor="pointer"
          zIndex={segments ? 10 : undefined}
          borderWidth="$px"
          borderColor="$borderStrong"
          elevation={1}
          focusVisibleStyle={{
            outlineColor: '$borderActive',
          }}
        />
      </TMSlider>
    );
  }, [
    defaultValue,
    disabled,
    handleSlideEnd,
    handleSlideMove,
    handleValueChange,
    max,
    min,
    props,
    segments,
    value,
  ]);
  return segments ? (
    <YStack position="relative" onLayout={handleLayout}>
      {sliderContent}
      {layout?.width && layout?.height ? (
        <XStack
          pointerEvents="none"
          gap="$0.5"
          flex={1}
          justifyContent="space-between"
          top={-layout.height / 2}
        >
          <SliderSegment
            key={-1}
            isActive
            onPress={() => {
              handleValueChange([min]);
            }}
          />
          {Array.from({ length: (segments ?? 1) - 1 }).map((_, index) => (
            <SliderSegment
              key={index}
              isActive={
                value
                  ? ((index + 1) / segments) * (max - min) + min <= value
                  : false
              }
              onPress={() => {
                handleValueChange([
                  min + ((max - min) * (index + 1)) / segments,
                ]);
              }}
            />
          ))}
          <SliderSegment
            key={segments ?? 1}
            isActive={value === max}
            onPress={() => {
              handleValueChange([max]);
            }}
          />
        </XStack>
      ) : null}
    </YStack>
  ) : (
    sliderContent
  );
};
