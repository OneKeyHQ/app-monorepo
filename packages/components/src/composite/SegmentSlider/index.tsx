import { useCallback, useMemo, useState } from 'react';

import { StyleSheet, View } from 'react-native';
import { Slider } from 'react-native-awesome-slider';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { useThemeValue } from '../../hooks/useStyle';

import type { SliderThemeType } from 'react-native-awesome-slider';
import type { SharedValue } from 'react-native-reanimated';

const styles = StyleSheet.create({
  full: {
    width: '100%',
  },
});

const markWidth = 10;
const thumbWidth = markWidth + 6;

const Mark = ({
  slideOver,
  markColor,
  backgroundColor,
  borderColor,
}: {
  slideOver?: boolean;
  markColor?: string;
  backgroundColor?: string;
  borderColor?: string;
}) => {
  return (
    <View
      style={{
        width: markWidth,
        height: markWidth,
        backgroundColor: slideOver ? markColor : backgroundColor,
        borderWidth: 1,
        borderColor: slideOver ? markColor : borderColor,
        borderRadius: markWidth / 2,
      }}
    />
  );
};

const Thumb = ({
  backgroundColor,
  borderColor,
}: {
  backgroundColor?: string;
  borderColor?: string;
}) => {
  return (
    <View
      style={{
        width: thumbWidth,
        height: thumbWidth,
        backgroundColor,
        borderWidth: 1,
        borderColor,
        borderRadius: thumbWidth / 2,
        shadowColor: '#000000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
      }}
    />
  );
};

const MarkWithAnimatedView = ({
  index,
  progress,
  step,
  markColor,
  backgroundColor,
  borderColor,
}: {
  index: number;
  progress: SharedValue<number>;
  step: number;
  markColor?: string;
  backgroundColor?: string;
  borderColor?: string;
}) => {
  const style = useAnimatedStyle(() => {
    const progressStep = Math.floor((progress.value / 100) * step);
    return {
      opacity: index <= progressStep ? 1 : 0,
    };
  });
  return (
    <Animated.View style={[{ ...StyleSheet.absoluteFillObject }, style]}>
      <Mark
        slideOver
        markColor={markColor}
        backgroundColor={backgroundColor}
        borderColor={borderColor}
      />
    </Animated.View>
  );
};

export interface ISegmentSliderProps {
  value: number;
  sliderHeight?: number;
  onChange: (value: number) => void;
  segments: number;
  snapThreshold?: number;
  forceSnapToStep?: boolean;
  onSlideStart?: () => void;
  onSlideComplete?: () => void;
  renderThumb?: () => React.ReactNode;
  renderMark?: (props: { index: number }) => React.ReactNode;
}

export function SegmentSlider({
  value,
  onChange,
  sliderHeight = 4,
  segments: step = 1,
  forceSnapToStep = false,
  snapThreshold = 6,
  onSlideStart,
  onSlideComplete,
  renderThumb: renderThumbElement,
  renderMark: renderMarkElement,
}: ISegmentSliderProps) {
  const progress = useSharedValue(100);
  const min = useSharedValue(0);
  const max = useSharedValue(100);
  const thumbScaleValue = useSharedValue(1);
  const isScrubbing = useSharedValue(false);

  useAnimatedReaction(
    () => {
      return value;
    },
    (data) => {
      if (data !== undefined && !Number.isNaN(data) && !isScrubbing.value) {
        progress.value = data;
      }
    },
    [value],
  );

  const [bgPrimaryColor, neutral5Color, bgColor, borderColor] = useThemeValue([
    'bgPrimary',
    'neutral5',
    'bg',
    'borderStrong',
  ]);
  const sliderTheme: SliderThemeType = useMemo(() => {
    return {
      maximumTrackTintColor: neutral5Color,
      minimumTrackTintColor: bgPrimaryColor,
      bubbleBackgroundColor: bgPrimaryColor,
      bubbleTextColor: bgColor,
    };
  }, [bgColor, bgPrimaryColor, neutral5Color]);
  const onValueChange = useCallback(
    (sliderValue: number) => {
      onChange(sliderValue);
    },
    [onChange],
  );
  const renderThumb = useCallback(() => {
    return renderThumbElement ? (
      renderThumbElement()
    ) : (
      <Thumb backgroundColor={bgColor} borderColor={borderColor} />
    );
  }, [bgColor, borderColor, renderThumbElement]);
  const renderMark = useCallback(
    ({ index }: { index: number }) => {
      if (renderMarkElement) {
        return renderMarkElement({ index });
      }
      return (
        <>
          <Mark
            key={index}
            markColor={bgPrimaryColor}
            backgroundColor={bgColor}
            borderColor={neutral5Color}
          />
          <MarkWithAnimatedView
            index={index}
            progress={progress}
            step={step}
            markColor={bgPrimaryColor}
            backgroundColor={bgColor}
            borderColor={neutral5Color}
          />
        </>
      );
    },
    [bgColor, bgPrimaryColor, neutral5Color, progress, renderMarkElement, step],
  );
  const renderBubble = useCallback((s: number) => {
    return `${Math.round(s)}%`;
  }, []);
  const handleSlidingStart = useCallback(() => {
    thumbScaleValue.value = 1.15;
    onSlideStart?.();
  }, [onSlideStart, thumbScaleValue]);
  const handleSlidingComplete = useCallback(() => {
    thumbScaleValue.value = 1;
    onSlideComplete?.();
  }, [onSlideComplete, thumbScaleValue]);
  return (
    <View style={styles.full}>
      <Slider
        steps={step}
        thumbWidth={thumbWidth}
        sliderHeight={sliderHeight}
        isScrubbing={isScrubbing}
        forceSnapToStep={forceSnapToStep}
        onSlidingStart={handleSlidingStart}
        onSlidingComplete={handleSlidingComplete}
        bubble={renderBubble}
        snapThreshold={snapThreshold}
        snapThresholdMode="absolute"
        markWidth={markWidth}
        renderMark={renderMark}
        theme={sliderTheme}
        renderThumb={renderThumb}
        onValueChange={onValueChange}
        progress={progress}
        minimumValue={min}
        maximumValue={max}
        thumbScaleValue={thumbScaleValue}
      />
    </View>
  );
}
