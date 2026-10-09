import {
  memo,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Ref } from 'react';

import { LottieView, Stack, usePageWidth } from '@onekeyhq/components';
import type { ILottieViewHandle, ILottieViewProps } from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { getReferLottieSource } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useReferLottieSource';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Matches the Lottie composition (786x446) so the box has no empty bands.
const LOTTIE_ASPECT_RATIO = 446 / 786;
// Same max width as the intro text and actions, so their edges line up.
const MAX_WIDTH = 480;

// The illustration's rendered height at a page width, for callers that track
// when it scrolls out of view.
export function getInviteCodeStepImageHeight(pageWidth: number) {
  return Math.min(pageWidth, MAX_WIDTH) * LOTTIE_ASPECT_RATIO;
}

type ILottieSource = ILottieViewProps['source'];

// Step 2 is three 2-second rounds, each a friend joining: the left hand
// slides in, coins cross to the right phone, the friend's avatar checks, then
// the hand slides out. A one-shot play ends on round three's settled moment
// (both hands together, coins landed, check shown) instead of the last frame,
// where the left half of the canvas is empty. 240 starts round three; 84 is
// where its coins land.
const STEP_2_REST_FRAME = 240 + 84;

// Lets a caller hold the animation still while it cannot be seen, without
// re-rendering: scroll handlers call it on every crossing.
export interface IInviteCodeStepImageControl {
  setPaused: (paused: boolean) => void;
}

interface IInviteCodeStepImageProps {
  step: 1 | 2;
  controlRef?: Ref<IInviteCodeStepImageControl>;
  // The intro flips between both steps, so it preloads the other one; other
  // callers show a single step and skip that.
  preloadOtherStep?: boolean;
  // Plays step 2 once and holds its settled frame instead of looping.
  playOnce?: boolean;
}

// Memoized: re-rendering the native LottieView re-serializes its ~160 KB
// source, and every prop here is stable.
export const InviteCodeStepImage = memo(function InviteCodeStepImage({
  step,
  controlRef,
  preloadOtherStep = true,
  playOnce = false,
}: IInviteCodeStepImageProps) {
  const lottieRef = useRef<ILottieViewHandle>(null);
  const pausedRef = useRef(false);
  const themeVariant = useThemeVariant();
  const pageWidth = usePageWidth();
  const [lottieSource, setLottieSource] = useState<ILottieSource | null>(null);
  const lottieThemeVariant = themeVariant === 'dark' ? 'dark' : 'light';
  const width = Math.min(pageWidth, MAX_WIDTH);
  const height = getInviteCodeStepImageHeight(pageWidth);
  const isOneShot = playOnce && step === 2;
  const shouldLoop = step === 2 && !playOnce;
  const renderMode =
    platformEnv.isNativeIOS && step === 2 && themeVariant !== 'dark'
      ? 'HARDWARE'
      : 'AUTOMATIC';

  useEffect(() => {
    let cancelled = false;
    setLottieSource(null);
    void getReferLottieSource({
      step,
      themeVariant: lottieThemeVariant,
    }).then((source) => {
      if (!cancelled) {
        setLottieSource(source);
      }
    });
    // Warm the other step while this one is on screen, so "Next" has its
    // illustration ready.
    if (preloadOtherStep) {
      void getReferLottieSource({
        step: step === 1 ? 2 : 1,
        themeVariant: lottieThemeVariant,
      });
    }
    return () => {
      cancelled = true;
    };
  }, [lottieThemeVariant, preloadOtherStep, step]);

  useImperativeHandle(
    controlRef,
    () => ({
      setPaused: (paused) => {
        if (pausedRef.current === paused) {
          return;
        }
        pausedRef.current = paused;
        if (paused) {
          lottieRef.current?.pause();
        } else {
          lottieRef.current?.resume();
        }
      },
    }),
    [],
  );

  // Ending the composition at the rest frame makes the player stop there on
  // every platform. Memoized: a new object re-serializes the source natively.
  const playedSource = useMemo(
    () =>
      isOneShot && lottieSource && typeof lottieSource === 'object'
        ? { ...lottieSource, op: STEP_2_REST_FRAME }
        : lottieSource,
    [isOneShot, lottieSource],
  );

  // A source that loads while the animation is held mounts without
  // autoPlay: a pause() sent right after mount can land before the native
  // view starts playing and be lost. resume() starts it later.
  const shouldAutoPlay = !pausedRef.current;
  // Still mark the view paused, so returning from background does not
  // start an animation that is held.
  useEffect(() => {
    if (lottieSource && pausedRef.current) {
      lottieRef.current?.pause();
    }
  }, [lottieSource]);

  return (
    <Stack w={width} h={height} alignSelf="center" bg="$bgApp">
      {playedSource ? (
        <LottieView
          ref={lottieRef}
          source={playedSource}
          width={width}
          height={height}
          autoPlay={shouldAutoPlay}
          loop={shouldLoop}
          resizeMode="contain"
          renderMode={renderMode}
          backgroundColor="$bgApp"
        />
      ) : null}
    </Stack>
  );
});
