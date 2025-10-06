import { useCallback, useMemo, useState } from 'react';

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Slider } from 'react-native-awesome-slider';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { useThemeValue } from '../../hooks/useStyle';

import type { TextStyle } from 'react-native';
import type { SliderThemeType } from 'react-native-awesome-slider';
import type { SharedValue } from 'react-native-reanimated';

const styles = StyleSheet.create({
  full: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    height: 38,
    justifyContent: 'center',
    marginBottom: 12,
  },
  slider: {
    marginBottom: 20,
    marginTop: 12,
  },
  container: {
    flex: 1,
  },

  desc: {
    color: '#888888',
  },
  button: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    position: 'absolute',
    // @ts-ignore
    userSelect: 'none',
  },
});

export const COLORS = {
  backgroundColor: '#111111',
  inputBackgroundColor: '#1A1A1A',

  borderColor: '#222222',
  markColor: '#FFFFFF',
  textColor: '#FFFFFF',
  descriptionColor: '#888888',

  optionStyle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 12,
  },

  optionTextStyle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  } satisfies TextStyle,

  sliderTheme: {
    maximumTrackTintColor: '#222222',
    minimumTrackTintColor: '#FFFFFF',

    bubbleBackgroundColor: '#1A1A1A',
    bubbleTextColor: '#FFFFFF',
  } satisfies SliderThemeType,
};

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
        width: slideOver ? markWidth + 2 : markWidth,
        height: slideOver ? markWidth + 2 : markWidth,
        left: slideOver ? -1 : 0,
        top: slideOver ? -1 : 0,
        transform: [{ rotate: '45deg' }],
        backgroundColor: slideOver ? markColor : backgroundColor,
        borderWidth: 1,
        borderColor: slideOver ? markColor : borderColor,
        borderRadius: 2,
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

export function SegmentSlider() {
  const [value, setValue] = useState(25);
  const [forceSnapToStep, setForceSnapToStep] = useState(false);
  const [snapThreshold, setSnapThreshold] = useState(6);

  const progress = useSharedValue(100);
  const min = useSharedValue(0);
  const max = useSharedValue(100);
  const thumbScaleValue = useSharedValue(1);
  const isScrubbing = useSharedValue(false);
  const step = 4;

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
  return (
    <View style={styles.full}>
      <Slider
        steps={step}
        thumbWidth={thumbWidth}
        sliderHeight={3}
        isScrubbing={isScrubbing}
        // disableTrackPress
        // thumbTouchSize={thumbWidth * 2}
        forceSnapToStep={forceSnapToStep}
        onSlidingStart={() => {
          thumbScaleValue.value = 1.15;
        }}
        // disableTapEvent={true}
        onSlidingComplete={() => {
          thumbScaleValue.value = 1;
        }}
        bubble={useCallback((s: number) => {
          return `${Math.round(s)}%`;
        }, [])}
        snapThreshold={snapThreshold}
        snapThresholdMode="absolute"
        markWidth={markWidth}
        renderMark={useCallback(
          ({ index }: { index: number }) => {
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
          [bgColor, bgPrimaryColor, neutral5Color, progress],
        )}
        theme={sliderTheme}
        renderThumb={() => (
          <Thumb backgroundColor={bgColor} borderColor={borderColor} />
        )}
        onValueChange={useCallback((sliderValue: number) => {
          setValue(Math.round(sliderValue));
        }, [])}
        style={styles.slider}
        progress={progress}
        minimumValue={min}
        maximumValue={max}
        thumbScaleValue={thumbScaleValue}
      />
    </View>
  );
}
