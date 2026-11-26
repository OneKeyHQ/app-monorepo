import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AccessibilityInfo, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

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
import type { LayoutChangeEvent, ViewStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

const FADE_EASING = Easing.bezier(...SWAP_ACTION_CONTENT_FADE_EASING);
const RISE_EASING = Easing.bezier(...SWAP_ACTION_CONTENT_RISE_EASING);
// The same curves as plain functions, to work out where an entrance has got to.
const fadeProgress = Easing.bezierFn(...SWAP_ACTION_CONTENT_FADE_EASING);
const riseProgress = Easing.bezierFn(...SWAP_ACTION_CONTENT_RISE_EASING);

interface IContentPose {
  opacity: number;
  y: number;
}

// Where the shown content's entrance started, and when, on the UI thread.
interface IEntrance extends IContentPose {
  at: number;
}

// The pose the old content had on the frame content `seq` mounted.
interface IHandoff extends IContentPose {
  seq: number;
  inFlight: boolean;
}

interface IMotionState {
  entrance: IEntrance | null;
  handoff: IHandoff | null;
}

interface IShownContent {
  contentKey: string | null;
  fillKey: boolean;
  node: ReactNode;
  // The shown content's laid-out width.
  width?: number;
  // Bumped on every content change, so the new content mounts and enters.
  seq: number;
  leaving?: { node: ReactNode; width?: number };
}

function enterDurations(from: IContentPose) {
  'worklet';

  return {
    fadeMs: SWAP_ACTION_CONTENT_FADE_MS * (1 - from.opacity),
    riseMs:
      SWAP_ACTION_CONTENT_RISE_MS * (from.y / SWAP_ACTION_CONTENT_RISE_PX),
  };
}

function poseAt(entrance: IEntrance | null, now: number) {
  'worklet';

  if (!entrance) {
    return { opacity: 1, y: 0, inFlight: false };
  }
  const { fadeMs, riseMs } = enterDurations(entrance);
  const fade = fadeMs > 0 ? Math.min(1, (now - entrance.at) / fadeMs) : 1;
  const rise = riseMs > 0 ? Math.min(1, (now - entrance.at) / riseMs) : 1;
  return {
    opacity: entrance.opacity + (1 - entrance.opacity) * fadeProgress(fade),
    y: entrance.y * (1 - riseProgress(rise)),
    inFlight: fade < 1 || rise < 1,
  };
}

// The new content and the leaving copy mount in the same frame. Whichever
// animation starts first works out where the old content was, so both start
// from the same pose, timed from when the old entrance really started.
function handoffFor(motion: SharedValue<IMotionState>, seq: number) {
  'worklet';

  const state = motion.value;
  if (state.handoff?.seq === seq) {
    return state.handoff;
  }
  const handoff = { seq, ...poseAt(state.entrance, Date.now()) };
  motion.value = { ...state, handoff };
  return handoff;
}

// A change in the middle of an entrance carries the next entrance on from
// where it got to, so quick successive changes neither flash the old content
// nor drop the new one back to invisible. Reduced motion is handled here (no
// rise, no lift on exit), so the fades keep playing with the setting on.
function enterAfter(
  motion: SharedValue<IMotionState>,
  seq: number,
  reduced: boolean,
) {
  return () => {
    'worklet';

    const reached = handoffFor(motion, seq);
    const from = reached.inFlight
      ? { opacity: reached.opacity, y: reduced ? 0 : reached.y }
      : { opacity: 0, y: reduced ? 0 : SWAP_ACTION_CONTENT_RISE_PX };
    motion.value = { ...motion.value, entrance: { ...from, at: Date.now() } };
    const { fadeMs, riseMs } = enterDurations(from);
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

function leaveAfter(
  motion: SharedValue<IMotionState>,
  seq: number,
  reduced: boolean,
  onDone: (seq: number) => void,
) {
  return () => {
    'worklet';

    const reached = handoffFor(motion, seq);
    const y = reduced ? 0 : reached.y;
    const toY = reduced ? y : y - SWAP_ACTION_CONTENT_EXIT_PX;
    return {
      initialValues: {
        opacity: reached.opacity,
        transform: [{ translateY: y }],
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
      // The copy goes once its fade has played, or was cut short.
      callback: () => {
        'worklet';

        scheduleOnRN(onDone, seq);
      },
    };
  };
}

// Reanimated's useReducedMotion reads the setting once, at startup, so follow
// the system switch while the app runs.
function useLiveReducedMotion() {
  const reducedAtStartup = useReducedMotion();
  const [reduced, setReduced] = useState(reducedAtStartup);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) {
        setReduced(value);
      }
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduced,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduced;
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

// The copy stays centered where the content was (the button's padding is
// symmetric) and keeps its width, so its text wraps as it did.
const LEAVING_LAYER_STYLE: ViewStyle = {
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

const LEAVING_CONTENT_STYLE: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
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
  const reduced = useLiveReducedMotion();
  const motion = useSharedValue<IMotionState>({
    entrance: null,
    handoff: null,
  });
  const [shown, setShown] = useState<IShownContent>(() => ({
    contentKey,
    fillKey,
    node: children,
    seq: 0,
  }));

  if (shown.contentKey !== contentKey) {
    setShown({
      contentKey,
      fillKey,
      node: children,
      seq: shown.seq + 1,
      leaving:
        shown.fillKey === fillKey
          ? { node: shown.node, width: shown.width }
          : undefined,
    });
  } else if (shown.node !== children || shown.fillKey !== fillKey) {
    // Keep what is on screen, so a later change leaves with it. A fill flip
    // takes away a copy still leaving on the old fill.
    setShown({
      ...shown,
      node: children,
      fillKey,
      leaving: shown.fillKey === fillKey ? shown.leaving : undefined,
    });
  }

  const { seq, leaving } = shown;
  const clearLeaving = useCallback((doneSeq: number) => {
    setShown((current) =>
      current.seq === doneSeq && current.leaving
        ? { ...current, leaving: undefined }
        : current,
    );
  }, []);
  const onContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width } = event.nativeEvent.layout;
      setShown((current) =>
        current.seq === seq && current.width !== width
          ? { ...current, width }
          : current,
      );
    },
    [seq],
  );
  const entering = useMemo(
    () => (seq > 0 ? enterAfter(motion, seq, reduced) : undefined),
    [motion, seq, reduced],
  );
  const leavingEntering = useMemo(
    () =>
      leaving ? leaveAfter(motion, seq, reduced, clearLeaving) : undefined,
    [motion, seq, reduced, leaving, clearLeaving],
  );

  return (
    <>
      <Animated.View
        key={`content-${seq}`}
        entering={entering}
        onLayout={onContentLayout}
        style={CONTENT_STYLE}
      >
        {children}
      </Animated.View>
      {leaving ? (
        <View
          key={`leaving-${seq}`}
          // The leaving content must not join the button's accessible name.
          aria-hidden
          style={LEAVING_LAYER_STYLE}
        >
          <Animated.View
            entering={leavingEntering}
            style={
              leaving.width === undefined
                ? CONTENT_STYLE
                : [LEAVING_CONTENT_STYLE, { width: leaving.width }]
            }
          >
            {leaving.node}
          </Animated.View>
        </View>
      ) : null}
    </>
  );
}
