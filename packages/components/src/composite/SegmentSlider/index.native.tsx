import { useCallback, useMemo, useState } from 'react';

import { StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { Slider } from 'react-native-awesome-slider';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { useTheme } from '../../hooks/useStyle';

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
  onPress,
  index,
  onPressIndex,
}: {
  slideOver?: boolean;
  markColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  onPress?: () => void;
  index?: number;
  onPressIndex?: (index: number) => void;
}) => {
  const markStyle = useMemo(
    () => ({
      width: markWidth,
      height: markWidth,
      backgroundColor: slideOver ? markColor : backgroundColor,
      borderWidth: 1,
      borderColor: slideOver ? markColor : borderColor,
      borderRadius: markWidth / 2,
    }),
    [slideOver, markColor, backgroundColor, borderColor],
  );

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
    } else if (onPressIndex !== undefined && index !== undefined) {
      onPressIndex(index);
    }
  }, [onPress, onPressIndex, index]);

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <View style={markStyle} />
    </TouchableWithoutFeedback>
  );
};

const Thumb = ({
  backgroundColor,
  borderColor,
}: {
  backgroundColor?: string;
  borderColor?: string;
}) => {
  const thumbStyle = useMemo(
    () => ({
      width: thumbWidth,
      height: thumbWidth,
      backgroundColor,
      borderWidth: 1,
      borderColor,
      borderRadius: thumbWidth / 2,
    }),
    [backgroundColor, borderColor],
  );

  return <View style={thumbStyle} />;
};

const MarkWithAnimatedView = ({
  index,
  progress,
  step,
  markColor,
  backgroundColor,
  borderColor,
  onPressIndex,
  centerOrigin = false,
  minValue = 0,
  maxValue = 100,
}: {
  index: number;
  progress: SharedValue<number>;
  step: number;
  markColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  onPressIndex?: (index: number) => void;
  centerOrigin?: boolean;
  minValue?: number;
  maxValue?: number;
}) => {
  const style = useAnimatedStyle(() => {
    if (centerOrigin) {
      // For centerOrigin mode, calculate which marks should be filled
      const range = maxValue - minValue;
      const centerIndex = ((0 - minValue) / range) * step; // Index of center (0 value)
      const valueIndex = ((progress.value - minValue) / range) * step;

      if (progress.value === 0) {
        // No fill when value is 0
        return { opacity: 0 };
      }

      if (progress.value < 0) {
        // Negative value: fill marks between value and center (exclusive of center)
        const shouldFill = index >= valueIndex && index < centerIndex;
        return { opacity: shouldFill ? 1 : 0 };
      }
      // Positive value: fill marks between center and value (exclusive of center)
      const shouldFill = index > centerIndex && index <= valueIndex;
      return { opacity: shouldFill ? 1 : 0 };
    }

    // Default behavior: fill from left to current value
    const range = maxValue - minValue;
    const progressStep =
      range > 0 ? Math.floor(((progress.value - minValue) / range) * step) : 0;
    return {
      opacity: index <= progressStep ? 1 : 0,
    };
  });
  const combinedStyle = useMemo(
    () => [{ ...StyleSheet.absoluteFillObject }, style],
    [style],
  );

  return (
    <Animated.View style={combinedStyle}>
      <Mark
        slideOver
        index={index}
        onPressIndex={onPressIndex}
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
  /**
   * @deprecated TODO: remove after the cross-platform drag-snap behavior is
   * unified with the web variant (which has no drag-snap and snaps only on
   * explicit mark taps). Keep at the current default until then to avoid
   * regressing native feel mid-release.
   */
  snapThreshold?: number;
  forceSnapToStep?: boolean;
  onSlideStart?: () => void;
  onSlideComplete?: () => void;
  renderThumb?: () => React.ReactNode;
  renderMark?: (props: { index: number }) => React.ReactNode;
  min?: number;
  max?: number;
  disabled?: boolean;
  showBubble?: boolean;
  /**
   * When true, the slider fills from center (0) instead of left edge.
   * Negative values fill left from center, positive values fill right from center.
   */
  centerOrigin?: boolean;
}

export function SegmentSlider({
  value,
  onChange,
  sliderHeight = 4,
  segments: step = 1,
  forceSnapToStep = false,
  snapThreshold = 1,
  onSlideStart,
  onSlideComplete,
  renderThumb: renderThumbElement,
  min: minValue = 0,
  max: maxValue = 100,
  renderMark: renderMarkElement,
  showBubble = true,
  disabled,
  centerOrigin = false,
}: ISegmentSliderProps) {
  const progress = useSharedValue(maxValue - minValue);
  const min = useSharedValue(minValue);
  const max = useSharedValue(maxValue);
  const thumbScaleValue = useSharedValue(1);
  const isScrubbing = useSharedValue(false);
  const [sliderWidth, setSliderWidth] = useState(0);

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

  const theme = useTheme();
  const bgPrimaryColor = theme.bgPrimary.val;
  const neutral5Color = theme.neutral5.val;
  const bgColor = theme.bg.val;
  const borderColor = theme.borderStrong.val;

  // Animated style for the center-origin fill overlay
  const centerFillStyle = useAnimatedStyle(() => {
    if (!centerOrigin || sliderWidth === 0) {
      return { opacity: 0 };
    }

    const range = maxValue - minValue;
    const centerPercent = (0 - minValue) / range; // 0 is the origin

    // Clamp progress value to min/max range
    const clampedValue = Math.max(minValue, Math.min(maxValue, progress.value));
    const valuePercent = (clampedValue - minValue) / range;

    // Account for thumb width - the actual track width is sliderWidth - thumbWidth
    const trackWidth = sliderWidth - thumbWidth;
    const thumbOffset = thumbWidth / 2;

    const centerX = centerPercent * trackWidth + thumbOffset;
    const valueX = valuePercent * trackWidth + thumbOffset;

    if (progress.value === 0) {
      // No fill when value is 0
      return { opacity: 0 };
    }

    if (progress.value < 0) {
      // Negative value: fill from value to center (left side)
      const fillWidth = Math.max(0, centerX - valueX);
      return {
        opacity: 1,
        position: 'absolute',
        left: Math.max(thumbOffset, valueX),
        width: fillWidth,
        height: sliderHeight,
        backgroundColor: bgPrimaryColor,
        borderRadius: sliderHeight / 2,
      };
    }
    // Positive value: fill from center to value (right side)
    const maxRight = trackWidth + thumbOffset;
    const fillWidth = Math.min(valueX - centerX, maxRight - centerX);
    return {
      opacity: 1,
      position: 'absolute',
      left: centerX,
      width: Math.max(0, fillWidth),
      height: sliderHeight,
      backgroundColor: bgPrimaryColor,
      borderRadius: sliderHeight / 2,
    };
  }, [
    centerOrigin,
    sliderWidth,
    sliderHeight,
    bgPrimaryColor,
    minValue,
    maxValue,
  ]);

  const sliderTheme: SliderThemeType = useMemo(() => {
    return {
      maximumTrackTintColor: neutral5Color,
      // When centerOrigin is true, hide the default minimum track
      minimumTrackTintColor: centerOrigin ? 'transparent' : bgPrimaryColor,
      bubbleBackgroundColor: bgPrimaryColor,
      bubbleTextColor: bgColor,
    };
  }, [bgColor, bgPrimaryColor, neutral5Color, centerOrigin]);

  const handleLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      setSliderWidth(event.nativeEvent.layout.width);
    },
    [],
  );

  const onValueChange = useCallback(
    (sliderValue: number) => {
      onChange?.(Math.round(sliderValue));
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

  const handlePressSegment = useCallback(
    (index: number) => {
      const segmentValue = maxValue - minValue;
      onValueChange(Math.round((segmentValue * index) / step + minValue));
    },
    [onValueChange, maxValue, minValue, step],
  );

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
            index={index}
            onPressIndex={handlePressSegment}
            borderColor={neutral5Color}
          />
          <MarkWithAnimatedView
            index={index}
            progress={progress}
            step={step}
            markColor={bgPrimaryColor}
            backgroundColor={bgColor}
            borderColor={neutral5Color}
            onPressIndex={handlePressSegment}
            centerOrigin={centerOrigin}
            minValue={minValue}
            maxValue={maxValue}
          />
        </>
      );
    },
    [
      bgColor,
      bgPrimaryColor,
      neutral5Color,
      handlePressSegment,
      progress,
      renderMarkElement,
      step,
      centerOrigin,
      minValue,
      maxValue,
    ],
  );
  const renderBubbleText = useCallback(
    (s: number) => {
      return showBubble ? `${Math.round(s)}%` : '';
    },
    [showBubble],
  );
  const handleSlidingStart = useCallback(() => {
    thumbScaleValue.value = 1.15;
    onSlideStart?.();
  }, [onSlideStart, thumbScaleValue]);
  const handleSlidingComplete = useCallback(() => {
    thumbScaleValue.value = 1;
    onSlideComplete?.();
  }, [onSlideComplete, thumbScaleValue]);

  const renderEmptyBubble = useCallback(() => null, []);
  const renderBubble = showBubble ? undefined : renderEmptyBubble;
  return (
    <View style={styles.full} onLayout={handleLayout}>
      {centerOrigin ? (
        <Animated.View style={centerFillStyle} pointerEvents="none" />
      ) : null}
      <Slider
        disable={disabled}
        steps={step}
        thumbWidth={thumbWidth}
        sliderHeight={sliderHeight}
        isScrubbing={isScrubbing}
        forceSnapToStep={forceSnapToStep}
        onSlidingStart={handleSlidingStart}
        onSlidingComplete={handleSlidingComplete}
        renderBubble={renderBubble as any}
        bubble={renderBubbleText}
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
