import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import Animated, {
  Easing,
  ReduceMotion,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  SWAP_ACTION_CONTENT_EXIT_MS,
  SWAP_ACTION_CONTENT_EXIT_PX,
  SWAP_ACTION_CONTENT_FADE_EASING,
  SWAP_ACTION_CONTENT_FADE_MS,
  SWAP_ACTION_CONTENT_RISE_EASING,
  SWAP_ACTION_CONTENT_RISE_MS,
  SWAP_ACTION_CONTENT_RISE_PX,
} from '../../utils/swapActionContentMotion';

import type { ISwapActionContentMotionProps } from './SwapActionContentMotion';
import type { ViewStyle } from 'react-native';

const FADE_EASING = Easing.bezier(...SWAP_ACTION_CONTENT_FADE_EASING);
const RISE_EASING = Easing.bezier(...SWAP_ACTION_CONTENT_RISE_EASING);
// The same curves on the JS thread, to find where an entrance has got to.
const fadeProgress = Easing.bezierFn(...SWAP_ACTION_CONTENT_FADE_EASING);
const riseProgress = Easing.bezierFn(...SWAP_ACTION_CONTENT_RISE_EASING);

interface IContentPose {
  opacity: number;
  y: number;
}

interface IShownContent {
  contentKey: string | null;
  fillKey: boolean;
  node: ReactNode;
  // Bumped on every content change, so the new content mounts and enters.
  seq: number;
  enter?: { from: IContentPose; at: number };
  leaving?: { node: ReactNode; from: IContentPose; rise: boolean };
}

const RESTING_POSE: IContentPose = { opacity: 1, y: 0 };

function enterDurations(from: IContentPose) {
  return {
    fadeMs: SWAP_ACTION_CONTENT_FADE_MS * (1 - from.opacity),
    riseMs:
      SWAP_ACTION_CONTENT_RISE_MS * (from.y / SWAP_ACTION_CONTENT_RISE_PX),
  };
}

// Where an entrance has got to. A change in the middle of one starts the
// leaving copy there and carries the next entrance on from it, so quick
// successive changes neither flash the old content nor drop the new one back
// to invisible.
function poseAt(enter: IShownContent['enter'], now: number) {
  if (!enter) {
    return { pose: RESTING_POSE, inFlight: false };
  }
  const { from, at } = enter;
  const { fadeMs, riseMs } = enterDurations(from);
  const fade = fadeMs > 0 ? Math.min(1, (now - at) / fadeMs) : 1;
  const rise = riseMs > 0 ? Math.min(1, (now - at) / riseMs) : 1;
  return {
    pose: {
      opacity: from.opacity + (1 - from.opacity) * fadeProgress(fade),
      y: from.y * (1 - riseProgress(rise)),
    },
    inFlight: fade < 1 || rise < 1,
  };
}

// Reduced motion is handled here (no rise, no lift on exit), so the fades keep
// playing with the system setting on.
function enterFrom(from: IContentPose) {
  const { fadeMs, riseMs } = enterDurations(from);
  return () => {
    'worklet';

    return {
      initialValues: {
        opacity: from.opacity,
        transform: [{ translateY: from.y }],
      },
      animations: {
        opacity: withTiming(1, {
          duration: fadeMs,
          easing: FADE_EASING,
          reduceMotion: ReduceMotion.Never,
        }),
        transform: [
          {
            translateY: withTiming(0, {
              duration: riseMs,
              easing: RISE_EASING,
              reduceMotion: ReduceMotion.Never,
            }),
          },
        ],
      },
    };
  };
}

function leaveFrom(from: IContentPose, rise: boolean) {
  const toY = rise ? from.y - SWAP_ACTION_CONTENT_EXIT_PX : from.y;
  return () => {
    'worklet';

    return {
      initialValues: {
        opacity: from.opacity,
        transform: [{ translateY: from.y }],
      },
      animations: {
        opacity: withTiming(0, {
          duration: SWAP_ACTION_CONTENT_EXIT_MS,
          easing: FADE_EASING,
          reduceMotion: ReduceMotion.Never,
        }),
        transform: [
          {
            translateY: withTiming(toY, {
              duration: SWAP_ACTION_CONTENT_EXIT_MS,
              easing: FADE_EASING,
              reduceMotion: ReduceMotion.Never,
            }),
          },
        ],
      },
    };
  };
}

const CONTENT_STYLE: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 1,
  minWidth: 0,
  maxWidth: '100%',
  // The Android label stretches across the button; keep that inside the
  // wrapper.
  ...(platformEnv.isNativeAndroid ? { flex: 1 } : null),
};

const LEAVING_STYLE: ViewStyle = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
};

// The web motion on native. New content fades in and rises into place. When
// the fill stays the same, a copy of the old content leaves upward from an
// overlay; across a fill flip (light fill with dark content to black fill with
// white text, or back) it would sit on the wrong fill, so it just goes. The
// first content shows without motion.
export function SwapActionContentMotion({
  contentKey,
  fillKey,
  children,
}: ISwapActionContentMotionProps) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState<IShownContent>(() => ({
    contentKey,
    fillKey,
    node: children,
    seq: 0,
  }));

  if (shown.contentKey !== contentKey) {
    const now = Date.now();
    const reached = poseAt(shown.enter, now);
    setShown({
      contentKey,
      fillKey,
      node: children,
      seq: shown.seq + 1,
      enter: {
        from: reached.inFlight
          ? reached.pose
          : { opacity: 0, y: reduced ? 0 : SWAP_ACTION_CONTENT_RISE_PX },
        at: now,
      },
      leaving:
        shown.fillKey === fillKey
          ? { node: shown.node, from: reached.pose, rise: !reduced }
          : undefined,
    });
  } else if (shown.node !== children || shown.fillKey !== fillKey) {
    // Keep what is on screen, so a later change leaves with it.
    setShown({ ...shown, node: children, fillKey });
  }

  const { seq, enter, leaving } = shown;
  useEffect(() => {
    if (!leaving) {
      return undefined;
    }
    // A frame after the exit ends.
    const timer = setTimeout(() => {
      setShown((current) =>
        current.seq === seq ? { ...current, leaving: undefined } : current,
      );
    }, SWAP_ACTION_CONTENT_EXIT_MS + 16);
    return () => clearTimeout(timer);
  }, [seq, leaving]);

  const entering = useMemo(
    () => (enter ? enterFrom(enter.from) : undefined),
    [enter],
  );
  const leavingEntering = useMemo(
    () => (leaving ? leaveFrom(leaving.from, leaving.rise) : undefined),
    [leaving],
  );

  return (
    <>
      <Animated.View
        key={`content-${seq}`}
        entering={entering}
        style={CONTENT_STYLE}
      >
        {children}
      </Animated.View>
      {leaving ? (
        <Animated.View
          key={`leaving-${seq}`}
          // The leaving content must not join the button's accessible name.
          aria-hidden
          entering={leavingEntering}
          style={LEAVING_STYLE}
        >
          {leaving.node}
        </Animated.View>
      ) : null}
    </>
  );
}
