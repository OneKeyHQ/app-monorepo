import { useCallback, useRef, useState } from 'react';

import RNSlider from '@react-native-community/slider';

import {
  usePropsAndStyle,
  useTheme,
} from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { XStack, YStack } from '../../primitives';

import type { IBaseSliderProps } from './type';
import type { LayoutChangeEvent, ViewStyle } from 'react-native';

function SliderSegment({ marked }: { marked: boolean }) {
  const theme = useTheme();
  const bgPrimaryColor = theme.bgPrimary.val;
  const neutral5Color = theme.neutral5.val;
  return (
    <XStack
      w={8}
      h={8}
      borderRadius={100}
      bg={marked ? bgPrimaryColor : neutral5Color}
    />
  );
}

export type ISliderProps = IBaseSliderProps;

export function Slider({
  onChange,
  min,
  max,
  step,
  onSlideStart,
  onSlideMove,
  onSlideEnd,
  onLayout,
  segments,
  ...props
}: ISliderProps) {
  const isSlidingRef = useRef(false);
  const isSlideEndRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [layout, setLayout] = useState<
    LayoutChangeEvent['nativeEvent']['layout'] | undefined
  >(undefined);

  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  const theme = useTheme();
  const bgPrimaryColor = theme.bgPrimary.val;
  const neutral5Color = theme.neutral5.val;

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

  const handleValueChange = useCallback(
    (value: number) => {
      if (!isSlidingRef.current) {
        onSlideStart?.();
        isSlidingRef.current = true;
      }
      onChange?.(value);
      onSlideMove?.(value);
      if (platformEnv.isNativeAndroid) {
        if (isSlideEndRef.current) {
          clearTimeout(isSlideEndRef.current);
        }
        isSlideEndRef.current = setTimeout(() => {
          handleSlideEnd();
        }, 50);
      }
    },
    [handleSlideEnd, onChange, onSlideMove, onSlideStart],
  );

  const sliderContent = (
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

  const value = props.value ?? props.defaultValue;
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
          <XStack
            left={platformEnv.isNativeAndroid ? 12 : 2}
            onPress={() => {
              handleValueChange(min);
            }}
          >
            <SliderSegment key={-1} marked />
          </XStack>
          {Array.from({ length: (segments ?? 1) - 1 }).map((_, index) => (
            <SliderSegment
              key={index}
              marked={
                value
                  ? ((index + 1) / segments) * (max - min) + min <= value
                  : false
              }
            />
          ))}
          <XStack
            right={platformEnv.isNativeAndroid ? 12 : 2}
            onPress={() => {
              handleValueChange(max);
            }}
          >
            <SliderSegment key={segments ?? 1} marked={value === max} />
          </XStack>
        </XStack>
      ) : null}
    </YStack>
  ) : (
    sliderContent
  );
}
