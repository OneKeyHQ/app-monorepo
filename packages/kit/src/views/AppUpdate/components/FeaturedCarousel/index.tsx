import { useCallback, useEffect, useState } from 'react';

import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Badge, IconButton, LinearGradient, Stack } from '@onekeyhq/components';
import type { IFeaturedItem } from '@onekeyhq/shared/src/appUpdate/featuredChangelog';

import { FeaturedMedia } from '../FeaturedMedia';

import {
  CONTENT_SPRING_CONFIG,
  MEDIA_HEIGHT,
  OPACITY_FALLOFF,
  SLIDE_TRANSLATE_FACTOR,
  TAP_JUMP_DISTANCE,
  TAP_JUMP_DURATION_MS,
  TAP_JUMP_NEW_SLIDE_DELAY_MS,
} from './constants';
import { FeaturedIndicator } from './FeaturedIndicator';
import { FeaturedContentSlide } from './FeaturedSlide';
import { useCarouselGesture } from './useCarouselGesture';
import { useHeightSpring } from './useHeightSpring';

import type { LayoutChangeEvent } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

export interface IFeaturedCarouselProps {
  features: IFeaturedItem[];
  badgeText: string;
  showCloseButton: boolean;
  onClose: () => void;
  onActiveFeatureChange?: (feature: IFeaturedItem) => void;
  /** Optional out-prop: gets `MEDIA_HEIGHT + content height` written each frame
   * so a parent can drive its own explicit-height wrapper for a smooth dialog
   * resize on platforms whose container doesn't transition auto-height. */
  totalHeight?: SharedValue<number>;
}

interface ISlideWrapperProps {
  index: number;
  progress: SharedValue<number>;
  slideWidth: number;
  children: React.ReactNode;
}

function SlideWrapper({
  index,
  progress,
  slideWidth,
  children,
}: ISlideWrapperProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const offset = index - progress.value;
    const translateX = offset * slideWidth * SLIDE_TRANSLATE_FACTOR;
    const opacity = Math.max(
      0,
      Math.min(1, 1 - Math.abs(offset) * OPACITY_FALLOFF),
    );
    return {
      transform: [{ translateX }],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
        },
        animatedStyle,
      ]}
    >
      {children}
    </Animated.View>
  );
}

// 'slideRole' distinguishes old vs new slide in jump mode (avoids colliding with HTML/ARIA 'role')
type IJumpSlideRole = 'old' | 'new';

interface IJumpSlideWrapperProps {
  slideRole: IJumpSlideRole;
  jumpFromIndex: SharedValue<number>;
  jumpToIndex: SharedValue<number>;
  jumpProgress: SharedValue<number>;
  children: React.ReactNode;
}

function JumpSlideWrapper({
  slideRole,
  jumpFromIndex,
  jumpToIndex,
  jumpProgress,
  children,
}: IJumpSlideWrapperProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const direction = Math.sign(jumpToIndex.value - jumpFromIndex.value);
    const t = jumpProgress.value;

    if (slideRole === 'old') {
      // 0 → 1 mapped to translate 0 → -direction * TAP_JUMP_DISTANCE, opacity 1 → 0
      return {
        transform: [{ translateX: -direction * TAP_JUMP_DISTANCE * t }],
        opacity: 1 - t,
      };
    }

    // 'new': starts after delay, normalized to [0, 1] over remaining duration
    const delayFraction = TAP_JUMP_NEW_SLIDE_DELAY_MS / TAP_JUMP_DURATION_MS;
    const tNew = Math.max(
      0,
      Math.min(1, (t - delayFraction) / (1 - delayFraction)),
    );
    return {
      transform: [{ translateX: direction * TAP_JUMP_DISTANCE * (1 - tNew) }],
      opacity: tNew,
    };
  });

  return (
    <Animated.View
      style={[
        { position: 'absolute', top: 0, left: 0, right: 0, width: '100%' },
        animatedStyle,
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function FeaturedCarousel({
  features,
  badgeText,
  showCloseButton,
  onClose,
  onActiveFeatureChange,
  totalHeight,
}: IFeaturedCarouselProps) {
  const progress = useSharedValue(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // measuredHeights[i] = onLayout-reported content height of slide i
  const measuredHeights = useSharedValue<number[]>([]);

  // Jump-mode shared values
  const isJumping = useSharedValue(false);
  const jumpFromIndex = useSharedValue(0);
  const jumpToIndex = useSharedValue(0);
  const jumpProgress = useSharedValue(0);

  const [jumpIndices, setJumpIndices] = useState<{
    from: number;
    to: number;
  } | null>(null);
  const isJumpingJs = jumpIndices !== null;

  const heightSpring = useHeightSpring({ progress, measuredHeights });

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setContainerWidth((prev) => (prev === w ? prev : w));
  }, []);

  const handleContentLayout = useCallback(
    (slideIndex: number, height: number) => {
      if (measuredHeights.value[slideIndex] === height) return;
      const next = [...measuredHeights.value];
      next[slideIndex] = height;
      measuredHeights.value = next;
    },
    [measuredHeights],
  );

  const jumpTo = useCallback(
    (target: number) => {
      const clamped = Math.max(0, Math.min(features.length - 1, target));
      const distance = Math.abs(clamped - activeIndex);

      if (distance > 1) {
        // Jump mode: snap progress immediately, run a short timing transition for old/new slides
        jumpFromIndex.value = activeIndex;
        jumpToIndex.value = clamped;
        jumpProgress.value = 0;
        isJumping.value = true;
        progress.value = clamped; // snap so indicator is correct

        // Set jumpIndices synchronously (before React re-renders from the
        // setActiveIndex below) so the carousel enters jump-mode rendering
        // on the very next frame. Relying solely on useAnimatedReaction to
        // mirror isJumping → jumpIndices causes a 1-frame flicker where the
        // snapped progress briefly shows the destination slide at full
        // opacity in normal-mode rendering before jump-mode kicks in.
        setJumpIndices({ from: activeIndex, to: clamped });

        jumpProgress.value = withTiming(
          1,
          { duration: TAP_JUMP_DURATION_MS },
          (finished) => {
            'worklet';

            if (finished) {
              isJumping.value = false;
            }
          },
        );
        setActiveIndex(clamped);
      } else {
        progress.value = withSpring(clamped, CONTENT_SPRING_CONFIG);
        setActiveIndex(clamped);
      }
    },
    [
      activeIndex,
      features.length,
      isJumping,
      jumpFromIndex,
      jumpToIndex,
      jumpProgress,
      progress,
    ],
  );

  const onCommit = useCallback((target: number) => {
    setActiveIndex(target);
  }, []);

  const panGesture = useCarouselGesture({
    progress,
    slideWidth: containerWidth,
    count: features.length,
    onCommit,
    enabled: !isJumpingJs, // disable swipe during jump animation
  });

  // Sync activeIndex from progress on settle (for video play/pause + CTA data)
  useAnimatedReaction(
    () => Math.round(progress.value),
    (rounded, prev) => {
      if (rounded !== prev) {
        runOnJS(setActiveIndex)(rounded);
      }
    },
  );

  // Clear jumpIndices when the timing animation completes.
  // (Entry to jump mode is set synchronously inside jumpTo to avoid a
  // 1-frame normal-mode flash; only the exit needs worklet → JS bridge.)
  useAnimatedReaction(
    () => isJumping.value,
    (current, prev) => {
      if (prev === true && current === false) {
        runOnJS(setJumpIndices)(null);
      }
    },
  );

  // If features shrinks below the current activeIndex (e.g., a refetch while
  // the dialog is open), clamp before reading. Without this, both the indicator
  // and the visible slide can drift out of sync (progress stays past max).
  useEffect(() => {
    if (features.length > 0 && activeIndex >= features.length) {
      const lastIdx = features.length - 1;
      setActiveIndex(lastIdx);
      progress.value = lastIdx;
    }
  }, [features.length, activeIndex, progress]);

  // Notify parent on active change
  useEffect(() => {
    const feature = features[activeIndex];
    if (feature) onActiveFeatureChange?.(feature);
  }, [activeIndex, features, onActiveFeatureChange]);

  const contentRegionStyle = useAnimatedStyle(() => ({
    height: heightSpring.value,
  }));

  // Total carousel height = media + content. Drives outer wrapper height AND
  // optionally exposes to parent so it can size the dialog frame explicitly.
  const totalHeightStyle = useAnimatedStyle(() => ({
    height: MEDIA_HEIGHT + heightSpring.value,
  }));
  useAnimatedReaction(
    () => MEDIA_HEIGHT + heightSpring.value,
    (h) => {
      if (totalHeight) totalHeight.value = h;
    },
  );

  // Render window: activeIndex ± 1 (3 slides max)
  const renderIndices = [activeIndex - 1, activeIndex, activeIndex + 1].filter(
    (i) => i >= 0 && i < features.length,
  );

  function renderSlides(
    keyPrefix: 'media' | 'content',
    renderInner: (feature: IFeaturedItem, idx: number) => React.ReactNode,
  ) {
    if (containerWidth === 0) return null;

    if (isJumpingJs && jumpIndices) {
      const oldFeature = features[jumpIndices.from];
      const newFeature = features[jumpIndices.to];
      return (
        <>
          {oldFeature ? (
            <JumpSlideWrapper
              slideRole="old"
              jumpFromIndex={jumpFromIndex}
              jumpToIndex={jumpToIndex}
              jumpProgress={jumpProgress}
            >
              {renderInner(oldFeature, jumpIndices.from)}
            </JumpSlideWrapper>
          ) : null}
          {newFeature ? (
            <JumpSlideWrapper
              slideRole="new"
              jumpFromIndex={jumpFromIndex}
              jumpToIndex={jumpToIndex}
              jumpProgress={jumpProgress}
            >
              {renderInner(newFeature, jumpIndices.to)}
            </JumpSlideWrapper>
          ) : null}
        </>
      );
    }

    return renderIndices.map((i) => {
      const feature = features[i];
      if (!feature) return null;
      return (
        <SlideWrapper
          key={`${keyPrefix}-${i}`}
          index={i}
          progress={progress}
          slideWidth={containerWidth}
        >
          {renderInner(feature, i)}
        </SlideWrapper>
      );
    });
  }

  return (
    <Animated.View onLayout={onContainerLayout} style={totalHeightStyle}>
      {/* Media region: fixed height, slides absolutely positioned */}
      <GestureDetector gesture={panGesture}>
        <Stack height={MEDIA_HEIGHT} position="relative" overflow="hidden">
          {renderSlides('media', (feature, i) => (
            <FeaturedMedia
              feature={feature}
              height={MEDIA_HEIGHT}
              isActive={i === activeIndex}
            />
          ))}
          {/* Top scrim covers the badge + close-button zone so the chrome
              stays readable on bright or low-contrast media. Raw rgba on
              purpose: LinearGradient.colors is an array prop and Tamagui
              does not resolve theme tokens inside it. */}
          <LinearGradient
            pointerEvents="none"
            position="absolute"
            top={0}
            left={0}
            right={0}
            height={80}
            colors={['rgba(0,0,0,0.5)', 'transparent']}
          />
          <Badge
            position="absolute"
            top="$5"
            left="$5"
            badgeType="default"
            badgeSize="sm"
            bg="$whiteA4"
          >
            <Badge.Text color="$whiteA12">{badgeText}</Badge.Text>
          </Badge>
          {showCloseButton ? (
            <IconButton
              position="absolute"
              top="$5"
              right="$5"
              icon="CrossedSmallOutline"
              size="small"
              onPress={onClose}
              bg="$whiteA4"
              hoverStyle={{ bg: '$whiteA5' }}
              pressStyle={{ bg: '$whiteA6' }}
              iconProps={{ color: '$whiteA10' }}
            />
          ) : null}
          <FeaturedIndicator
            count={features.length}
            progress={progress}
            onJump={jumpTo}
          />
        </Stack>
      </GestureDetector>

      {/* Content region: animated height, slides absolutely positioned. */}
      <Animated.View
        style={[
          { position: 'relative', overflow: 'hidden' },
          contentRegionStyle,
        ]}
      >
        {renderSlides('content', (feature, i) => (
          <FeaturedContentSlide
            feature={feature}
            slideIndex={i}
            onContentLayout={handleContentLayout}
          />
        ))}
      </Animated.View>
    </Animated.View>
  );
}
