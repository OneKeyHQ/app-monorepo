import { memo, useEffect, useMemo } from 'react';

import { LottieView, Stack, usePageWidth } from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import {
  getReferLottieSource,
  useReferLottieSource,
} from '@onekeyhq/kit/src/views/ReferFriends/hooks/useReferLottieSource';
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

// Step 2 is three 2-second rounds, each a friend joining: the left hand
// slides in, coins cross to the right phone, the friend's avatar checks, then
// the hand slides out. The still frame is round three's settled moment (both
// hands together, coins landed, check shown), not the last frame, where the
// left half of the canvas is empty. 240 starts round three; 84 is where its
// coins land.
const STEP_2_REST_FRAME = 240 + 84;

interface IInviteCodeStepImageProps {
  step: 1 | 2;
  // The intro flips between both steps, so it preloads the other one; other
  // callers show a single step and skip that.
  preloadOtherStep?: boolean;
  // Shows step 2's settled frame without playing it.
  still?: boolean;
}

// Memoized: re-rendering the native LottieView re-serializes its ~160 KB
// source, and every prop here is stable.
export const InviteCodeStepImage = memo(function InviteCodeStepImage({
  step,
  preloadOtherStep = true,
  still = false,
}: IInviteCodeStepImageProps) {
  const themeVariant = useThemeVariant();
  const pageWidth = usePageWidth();
  const lottieSource = useReferLottieSource(step);
  const lottieThemeVariant = themeVariant === 'dark' ? 'dark' : 'light';
  const width = Math.min(pageWidth, MAX_WIDTH);
  const height = getInviteCodeStepImageHeight(pageWidth);
  const isStill = still && step === 2;
  const renderMode =
    platformEnv.isNativeIOS && step === 2 && themeVariant !== 'dark'
      ? 'HARDWARE'
      : 'AUTOMATIC';

  // Warm the other step while this one is on screen, so "Next" has its
  // illustration ready.
  useEffect(() => {
    if (preloadOtherStep) {
      void getReferLottieSource({
        step: step === 1 ? 2 : 1,
        themeVariant: lottieThemeVariant,
      });
    }
  }, [lottieThemeVariant, preloadOtherStep, step]);

  // A still image is the composition cut down to its rest frame: the player
  // draws that frame on every platform without playing. Memoized: a new
  // object re-serializes the source natively.
  const shownSource = useMemo(
    () =>
      isStill && lottieSource && typeof lottieSource === 'object'
        ? { ...lottieSource, ip: STEP_2_REST_FRAME, op: STEP_2_REST_FRAME + 1 }
        : lottieSource,
    [isStill, lottieSource],
  );

  return (
    <Stack w={width} h={height} alignSelf="center" bg="$bgApp">
      {shownSource ? (
        <LottieView
          source={shownSource}
          width={width}
          height={height}
          autoPlay={!isStill}
          loop={step === 2 && !isStill}
          resizeMode="contain"
          renderMode={renderMode}
          backgroundColor="$bgApp"
        />
      ) : null}
    </Stack>
  );
});
