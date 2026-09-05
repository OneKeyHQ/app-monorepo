import type { ComponentProps, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { LinearGradient, Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { LayoutChangeEvent } from 'react-native';

type IProps = {
  children: ReactNode;
  borderRadius?: number;
  borderColor?: ComponentProps<typeof Stack>['borderColor'];
  duration?: number;
  // When false, suppress the animated rainbow sweep and render a plain static
  // border using borderColor.
  glow?: boolean;
};

const BORDER_PX = 1;
const FADE_MS = 800;
const GLOW_SPREAD = 4;

const GLOW_COLORS = [
  '#60a5fa',
  '#a78bfa',
  '#f472b6',
  '#fb923c',
  '#facc15',
  '#4ade80',
  '#22d3ee',
  '#60a5fa',
] as const;
const GLOW_LOCATIONS = [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.85, 1] as const;

const BORDER_COLORS = [
  'transparent',
  '#fdba74',
  '#fde047',
  '#86efac',
  '#67e8f9',
  '#c4b5fd',
  '#f0abfc',
  '#fda4af',
  'transparent',
  'transparent',
] as const;
const BORDER_LOCATIONS = [
  0.15, 0.26, 0.33, 0.4, 0.47, 0.54, 0.61, 0.68, 0.78, 1,
] as const;

const WEB_BLUR_STYLE = { filter: 'blur(6px)' } as Record<string, string>;

function LaserBorder({
  children,
  borderRadius = 12,
  borderColor = '$borderSubdued',
  duration = 2800,
  glow = true,
}: IProps) {
  const reducedMotion = useReducedMotion();
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const rotation = useSharedValue(0);
  const glowOpacity = useSharedValue(reducedMotion || !glow ? 0 : 1);
  const hasAnimated = useRef(false);
  // Keep the inset geometry stable for the entire glow lifecycle. Changing it
  // when the opacity animation ends would resize the card by 2px and shift all
  // content below it.
  const hasLaserInset = !reducedMotion && glow;

  const diagonal = Math.sqrt(layout.width ** 2 + layout.height ** 2);

  useEffect(() => {
    // `glow` can flip after mount as async caller state changes. Disable it
    // immediately; if it has not run yet, enable it once layout is available.
    if (reducedMotion || !glow) {
      rotation.value = 0;
      glowOpacity.value = 0;
      return;
    }
    if (layout.width === 0 || hasAnimated.current) {
      return;
    }
    hasAnimated.current = true;
    rotation.value = 0;
    glowOpacity.value = 1;
    rotation.value = withTiming(180, { duration, easing: Easing.linear });
    glowOpacity.value = withDelay(
      duration,
      withTiming(0, { duration: FADE_MS }),
    );
  }, [glow, layout.width, duration, rotation, glowOpacity, reducedMotion]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout((prev) => {
      if (prev.width === width && prev.height === height) return prev;
      return { width, height };
    });
  }, []);

  const gradientStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
    opacity: glowOpacity.value,
  }));

  const nativeShadowStyle = useAnimatedStyle(() => ({
    shadowColor: interpolateColor(
      rotation.value,
      [0, 45, 90, 135, 180],
      ['#fdba74', '#86efac', '#67e8f9', '#c4b5fd', '#fda4af'],
    ),
    shadowOpacity: interpolate(glowOpacity.value, [0, 1], [0, 0.45]),
    shadowRadius: interpolate(glowOpacity.value, [0, 1], [0, 4]),
    elevation: interpolate(glowOpacity.value, [0, 1], [0, 4]),
  }));

  const isNative = platformEnv.isNative;
  const glowW = layout.width + GLOW_SPREAD * 2;
  const glowH = layout.height + GLOW_SPREAD * 2;
  const glowDiag = Math.sqrt(glowW * glowW + glowH * glowH);

  return (
    <Animated.View
      style={[
        { borderRadius, alignSelf: 'stretch', width: '100%' },
        isNative && glow
          ? [{ shadowOffset: { width: 0, height: 0 } }, nativeShadowStyle]
          : undefined,
      ]}
    >
      {glow && !isNative && layout.width > 0 && glowDiag > 0 ? (
        <Stack
          style={[
            {
              position: 'absolute',
              top: -GLOW_SPREAD,
              left: -GLOW_SPREAD,
              right: -GLOW_SPREAD,
              bottom: -GLOW_SPREAD,
              borderRadius: borderRadius + GLOW_SPREAD,
              overflow: 'hidden',
              opacity: 0.25,
            },
            WEB_BLUR_STYLE,
          ]}
          pointerEvents="none"
        >
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: glowDiag,
                height: glowDiag,
                top: (glowH - glowDiag) / 2,
                left: (glowW - glowDiag) / 2,
              },
              gradientStyle,
            ]}
          >
            <LinearGradient
              colors={[...GLOW_COLORS]}
              locations={GLOW_LOCATIONS}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{ width: glowDiag, height: glowDiag }}
            />
          </Animated.View>
        </Stack>
      ) : null}

      <Stack
        width="100%"
        borderColor={borderColor}
        borderRadius={borderRadius}
        borderWidth={StyleSheet.hairlineWidth}
        bg="$bg"
        overflow="hidden"
        onLayout={handleLayout}
      >
        {glow && diagonal > 0 ? (
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: diagonal,
                height: diagonal,
                top: (layout.height - diagonal) / 2,
                left: (layout.width - diagonal) / 2,
              },
              gradientStyle,
            ]}
          >
            <LinearGradient
              colors={[...BORDER_COLORS]}
              locations={BORDER_LOCATIONS}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{ width: diagonal, height: diagonal }}
            />
          </Animated.View>
        ) : null}
        {hasLaserInset ? (
          <Stack
            m={BORDER_PX}
            borderRadius={borderRadius - BORDER_PX}
            bg="$bg"
            overflow="hidden"
          >
            {children}
          </Stack>
        ) : (
          children
        )}
      </Stack>
    </Animated.View>
  );
}

export { LaserBorder };
