import { memo, useEffect } from 'react';

import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Image, Stack } from '@onekeyhq/components';
import { useWebSiteHandler } from '@onekeyhq/kit/src/views/Discovery/hooks/useWebSiteHandler';
import { EEnterMethod } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/dapp';

import type { ImageSourcePropType, ImageURISource } from 'react-native';

// Animation constants
const FADE_IN_DURATION = 1000;
const FADE_IN_DELAY = 1000;
const FLOAT_MIN_DISTANCE = 3;
const FLOAT_MAX_DISTANCE = 7;
const FLOAT_DURATION_BASE = 2000;
const FLOAT_DURATION_VARIANCE = 1000;
const FLOAT_MAX_DELAY = 500;

const ROTATION_MIN_ANGLE = -20;
const ROTATION_MAX_ANGLE = 20;
const ROTATION_DURATION_BASE = 2000;
const ROTATION_DURATION_VARIANCE = 1000;
const ROTATION_MAX_DELAY = 300;

const SCALE_MIN_FACTOR = 1;
const SCALE_MAX_FACTOR = 1.2;
const SCALE_DURATION_BASE = 2500;
const SCALE_DURATION_VARIANCE = 1000;
const SCALE_MAX_DELAY = 1000;

const DEFAULT_SHADOW_OPACITY = 0.2;
const HOVER_SHADOW_OPACITY = 0.5;
const ANIMATION_SHADOW_OPACITY = 0.4;

const HOVER_TRANSITION_DURATION = 300;
const HOVER_SCALE_FACTOR = 1.2;

const SHADOW_COLOR = '#444';
const SHADOW_OFFSET = { width: 2, height: 8 };
const SHADOW_RADIUS = 22;
const ELEVATION = 5;

// Helper function to create random value within range
const getRandomInRange = (min: number, max: number) =>
  min + Math.random() * (max - min);

// Helper function to create random delay
const getRandomDelay = (maxDelay: number) => Math.random() * maxDelay;

// Helper function to create infinite animation
const createInfiniteAnimation = (
  sharedValue: { value: number },
  config: {
    targetValue: number;
    duration: number;
    delay?: number;
    easing?: any;
  },
) => {
  const {
    targetValue,
    duration,
    delay = 0,
    easing = Easing.inOut(Easing.quad),
  } = config;

  sharedValue.value = withDelay(
    delay,
    withRepeat(
      withTiming(targetValue, {
        duration,
        easing,
      }),
      -1, // Infinite repeats
      true, // Reverse on each repeat
    ),
  );
};

export const WelcomeItem = memo(
  ({
    logo,
    url,
    size = '$12',
    borderRadius = 12,
    maxOpacity = 1,
    ...stackProps
  }: {
    logo: ImageURISource | ImageURISource['uri'];
    url?: string;
    size?: string;
    borderRadius?: number;
    maxOpacity?: number;
  } & React.ComponentProps<typeof Stack>) => {
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(0);
    const rotate = useSharedValue(0);
    const scale = useSharedValue(1);
    const shadowOpacity = useSharedValue(DEFAULT_SHADOW_OPACITY);
    const handleWebSite = useWebSiteHandler();

    useEffect(() => {
      setTimeout(
        () => {
          // Fade-in animation
          opacity.value = withTiming(maxOpacity, {
            duration: FADE_IN_DURATION,
          });
        },
        // random delay
        getRandomDelay(FADE_IN_DELAY),
      );

      // Random values for animations
      const floatDistance = getRandomInRange(
        FLOAT_MIN_DISTANCE,
        FLOAT_MAX_DISTANCE,
      );
      const floatDuration = getRandomInRange(
        FLOAT_DURATION_BASE,
        FLOAT_DURATION_BASE + FLOAT_DURATION_VARIANCE,
      );
      const floatDelay = getRandomDelay(FLOAT_MAX_DELAY);

      const rotationAngle =
        getRandomInRange(ROTATION_MIN_ANGLE, ROTATION_MAX_ANGLE) *
        (Math.random() > 0.5 ? 1 : -1);
      const rotationDuration = getRandomInRange(
        ROTATION_DURATION_BASE,
        ROTATION_DURATION_BASE + ROTATION_DURATION_VARIANCE,
      );
      const rotationDelay = getRandomDelay(ROTATION_MAX_DELAY);

      const scaleFactor = getRandomInRange(SCALE_MIN_FACTOR, SCALE_MAX_FACTOR);
      const scaleDuration = getRandomInRange(
        SCALE_DURATION_BASE,
        SCALE_DURATION_BASE + SCALE_DURATION_VARIANCE,
      );
      const scaleDelay = getRandomDelay(SCALE_MAX_DELAY);

      // Setup float animation
      createInfiniteAnimation(translateY, {
        targetValue: -floatDistance,
        duration: floatDuration,
        delay: floatDelay,
        easing: Easing.inOut(Easing.sin),
      });

      // Setup rotation animation
      createInfiniteAnimation(rotate, {
        targetValue: rotationAngle,
        duration: rotationDuration,
        delay: rotationDelay,
      });

      // Setup scale animation
      createInfiniteAnimation(scale, {
        targetValue: scaleFactor,
        duration: scaleDuration,
        delay: scaleDelay,
      });

      // Setup shadow opacity animation (synced with scale)
      createInfiniteAnimation(shadowOpacity, {
        targetValue: ANIMATION_SHADOW_OPACITY,
        duration: scaleDuration,
        delay: scaleDelay,
      });
    }, [opacity, translateY, rotate, scale, shadowOpacity, maxOpacity]);

    const handleHoverIn = () => {
      // Cancel and reset animations
      cancelAnimation(rotate);

      // Apply hover effects
      rotate.value = withTiming(0, { duration: HOVER_TRANSITION_DURATION });
      scale.value = withTiming(HOVER_SCALE_FACTOR, {
        duration: HOVER_TRANSITION_DURATION,
      });
      shadowOpacity.value = withTiming(HOVER_SHADOW_OPACITY, {
        duration: HOVER_TRANSITION_DURATION,
      });
      opacity.value = withTiming(1, { duration: HOVER_TRANSITION_DURATION });
    };

    const handleHoverOut = () => {
      // Restore original values
      scale.value = withTiming(1, { duration: HOVER_TRANSITION_DURATION });
      shadowOpacity.value = withTiming(DEFAULT_SHADOW_OPACITY, {
        duration: HOVER_TRANSITION_DURATION,
      });
      opacity.value = withTiming(maxOpacity, {
        duration: HOVER_TRANSITION_DURATION,
      });

      // Restart rotation animation with new random values
      const rotationAngle =
        getRandomInRange(ROTATION_MIN_ANGLE, ROTATION_MAX_ANGLE) *
        (Math.random() > 0.5 ? 1 : -1);
      rotate.value = withRepeat(
        withTiming(rotationAngle, {
          duration: getRandomInRange(
            ROTATION_DURATION_BASE,
            ROTATION_DURATION_BASE + ROTATION_DURATION_VARIANCE,
          ),
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
        true,
      );
    };

    const handlePress = () => {
      if (url) {
        handleWebSite({
          webSite: {
            url,
            title: url,
          },
          shouldPopNavigation: false,
          enterMethod: EEnterMethod.dashboard,
        });
      }
    };

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [
        { translateY: translateY.value },
        { rotate: `${rotate.value}deg` },
        { scale: scale.value },
      ],
      shadowColor: SHADOW_COLOR,
      shadowOffset: SHADOW_OFFSET,
      shadowOpacity: shadowOpacity.value,
      shadowRadius: SHADOW_RADIUS,
      elevation: ELEVATION,
      backgroundColor: 'transparent',
      borderRadius: borderRadius * scale.value * 0.5,
      overflow: 'hidden',
    }));

    return (
      <Stack
        width={size}
        height={size}
        cursor={url ? 'pointer' : 'default'}
        onPress={handlePress}
        onMouseEnter={handleHoverIn}
        onMouseLeave={handleHoverOut}
        {...stackProps}
      >
        <Animated.View style={animatedStyle}>
          <Image
            $platform-web={{
              transform: 'translate3d(0, 0, 0)',
            }}
            source={{ uri: logo } as ImageSourcePropType}
            width={size}
            height={size}
          />
        </Animated.View>
      </Stack>
    );
  },
);

WelcomeItem.displayName = 'WelcomeItem';
