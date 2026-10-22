import { memo, useEffect, useRef } from 'react';

import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Theme, YStack, useTheme } from '@onekeyhq/components';

import {
  EARN_GUIDE_CARD_RADIUS,
  EARN_GUIDE_GREEN,
  GuideCardSteps,
  GuideCardTitle,
} from './EarnDesktopGuideCard';
import { EARN_GUIDE_MODAL_SIZE } from './earnGuide.utils';
import { EarnGuideHeader } from './EarnGuideHeader';
import { useEarnGuideSnapshot } from './earnGuideStore';

import type { IEarnGuideState } from './earnGuide.utils';
import type { IEarnGuideRect } from './earnGuideStore';

// The card grows into the guide in one smooth move with no bounce, the way a
// story card opens in the App Store, while the page dims; the modal, drawn in
// the same place, then fades in under it. Closing runs it back into the card
const GROW_MS = 420;
const SHRINK_MS = 360;
// The modal's own fade in, which the ghost fades out across
const HAND_OFF_MS = 250;
// The modal's fade out, mostly done before the ghost starts back
const CLOSE_HOLD_MS = 100;
const SETTLE_MS = 120;
// Past this the modal has had time to load; the ghost goes anyway
const READY_TIMEOUT_MS = 2000;
const EASE = Easing.bezier(0.32, 0.72, 0, 1);
const MODAL_RADIUS = 16;
// The title's rise from the card's padding (20) to the header's (16)
const TITLE_RISE = -4;
const BACKDROP = 'rgba(0, 0, 0, 0.5)';
// The modal's green header before the first open has measured it
export const EARN_GUIDE_HEADER_HEIGHT = 108;

/** Where the guide modal sits: the web modal's own rule, 90% of the window
 * up to its size, centred */
export function getGuideModalRect(): IEarnGuideRect {
  const vw = globalThis.innerWidth ?? 0;
  const vh = globalThis.innerHeight ?? 0;
  const width = Math.round(Math.min(vw * 0.9, EARN_GUIDE_MODAL_SIZE.width));
  const height = Math.round(Math.min(vh * 0.9, EARN_GUIDE_MODAL_SIZE.height));
  return {
    x: Math.round((vw - width) / 2),
    y: Math.round((vh - height) / 2),
    width,
    height,
  };
}

const fixed = { position: 'fixed', backgroundColor: BACKDROP } as const;

function EarnGuideGhostView({
  direction,
  card,
  state,
  headerHeight,
  onLanded,
  onDone,
}: {
  direction: 'open' | 'close';
  card: IEarnGuideRect;
  state: IEarnGuideState;
  headerHeight: number;
  // Open: the ghost is where the modal goes, so the modal can be pushed.
  // Close: the ghost is on the card, which can show again under it
  onLanded?: () => void;
  onDone: () => void;
}) {
  const theme = useTheme();
  const modal = useRef(getGuideModalRect()).current;
  const isOpen = direction === 'open';
  // 0 is the card, 1 the modal
  const progress = useSharedValue(isOpen ? 0 : 1);
  const fade = useSharedValue(1);
  // Open: up once the ghost has landed. The page is then dimmed only around
  // the modal, so the modal fading in under the ghost isn't dimmed twice
  const landed = useSharedValue(0);
  const isModalOpen = Boolean(useEarnGuideSnapshot().isModalOpen);
  const isFadingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      const land = () => onLanded?.();
      progress.value = withTiming(
        1,
        { duration: GROW_MS, easing: EASE },
        (finished) => {
          if (finished) {
            landed.value = 1;
            runOnJS(land)();
          }
        },
      );
      return;
    }
    const handBack = () => onLanded?.();
    progress.value = withDelay(
      CLOSE_HOLD_MS,
      withTiming(0, { duration: SHRINK_MS, easing: EASE }, (finished) => {
        if (finished) {
          runOnJS(handBack)();
          fade.value = withTiming(0, { duration: SETTLE_MS }, (done) => {
            if (done) {
              runOnJS(onDone)();
            }
          });
        }
      }),
    );
    // One move per ghost
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open: the modal is pushed as the ghost lands, so once it is up the ghost
  // fades across its fade in. A modal that never comes still lets the ghost go
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const fadeOut = () => {
      if (isFadingRef.current) {
        return;
      }
      isFadingRef.current = true;
      fade.value = withTiming(0, { duration: HAND_OFF_MS }, (done) => {
        if (done) {
          runOnJS(onDone)();
        }
      });
    };
    if (isModalOpen) {
      fadeOut();
      return undefined;
    }
    const timer = setTimeout(fadeOut, GROW_MS + READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [fade, isModalOpen, isOpen, onDone]);

  const boxStyle = useAnimatedStyle(() => ({
    left: interpolate(progress.value, [0, 1], [card.x, modal.x]),
    top: interpolate(progress.value, [0, 1], [card.y, modal.y]),
    width: interpolate(progress.value, [0, 1], [card.width, modal.width]),
    height: interpolate(progress.value, [0, 1], [card.height, modal.height]),
    borderRadius: interpolate(
      progress.value,
      [0, 1],
      [EARN_GUIDE_CARD_RADIUS, MODAL_RADIUS],
    ),
    opacity: fade.value,
  }));
  const greenStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [card.height, headerHeight]),
  }));
  // The steps under the title go as the card grows and come back as it
  // shrinks; the title carries on into the modal's header
  const stepsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4], [1, 0], Extrapolation.CLAMP),
  }));
  const titleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, TITLE_RISE]) },
    ],
  }));
  // The rest of the modal's header comes up as the card nears its size, so
  // a modal still loading under it shows its header already
  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0.55, 1],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));
  // Closing leaves the dimming to the modal's own backdrop, already fading
  const aroundStyle = useAnimatedStyle(() => ({
    opacity: isOpen ? progress.value * fade.value : 0,
  }));
  const placeStyle = useAnimatedStyle(() => ({
    opacity: isOpen ? progress.value * (1 - landed.value) : 0,
  }));

  return (
    <>
      {/* The dimmed page in five pieces: four around the modal's place, and
          the place itself until the ghost covers it */}
      <Animated.View
        pointerEvents="none"
        style={[
          fixed,
          { top: 0, left: 0, right: 0, height: modal.y },
          aroundStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          fixed,
          { top: modal.y + modal.height, left: 0, right: 0, bottom: 0 },
          aroundStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          fixed,
          { top: modal.y, left: 0, width: modal.x, height: modal.height },
          aroundStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          fixed,
          {
            top: modal.y,
            left: modal.x + modal.width,
            right: 0,
            height: modal.height,
          },
          aroundStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          fixed,
          {
            top: modal.y,
            left: modal.x,
            width: modal.width,
            height: modal.height,
          },
          placeStyle,
        ]}
      />
      <Animated.View
        testID="earn-guide-ghost"
        pointerEvents="none"
        style={[
          {
            position: 'fixed',
            overflow: 'hidden',
            backgroundColor: theme.bgApp.val,
          },
          boxStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              backgroundColor: EARN_GUIDE_GREEN,
            },
            greenStyle,
          ]}
        />
        <Animated.View
          style={[
            { position: 'absolute', top: 0, left: 0, width: modal.width },
            headerStyle,
          ]}
        >
          <EarnGuideHeader shownStep={state.current} isCopy />
        </Animated.View>
        {/* The card's own layout at the card's size, pinned to the corner
            the title shares with the modal's header */}
        <Theme name="dark">
          <YStack
            position="absolute"
            top={0}
            left={0}
            width={card.width}
            height={card.height}
            p="$5"
            gap="$4"
            jc="space-between"
          >
            <Animated.View style={titleStyle}>
              <GuideCardTitle />
            </Animated.View>
            <Animated.View style={stepsStyle}>
              <GuideCardSteps state={state} />
            </Animated.View>
          </YStack>
        </Theme>
      </Animated.View>
    </>
  );
}

export const EarnGuideGhost = memo(EarnGuideGhostView);
