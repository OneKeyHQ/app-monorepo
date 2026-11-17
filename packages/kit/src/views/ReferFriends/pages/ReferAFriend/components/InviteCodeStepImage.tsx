import { memo, useEffect } from 'react';

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

// The illustration's rendered size at a page width, shared with the invite
// page's still of it and the skeleton that holds its place.
export function getInviteCodeStepImageWidth(pageWidth: number) {
  return Math.min(pageWidth, MAX_WIDTH);
}

export function getInviteCodeStepImageHeight(pageWidth: number) {
  return getInviteCodeStepImageWidth(pageWidth) * LOTTIE_ASPECT_RATIO;
}

interface IInviteCodeStepImageProps {
  step: 1 | 2;
  isActive?: boolean;
  onSourceAvailabilityChange?: (ready: boolean) => void;
}

// Memoized: re-rendering the native LottieView re-serializes its ~160 KB
// source, and every prop here is stable.
export const InviteCodeStepImage = memo(function InviteCodeStepImage({
  step,
  isActive,
  onSourceAvailabilityChange,
}: IInviteCodeStepImageProps) {
  const themeVariant = useThemeVariant();
  const pageWidth = usePageWidth();
  const lottieSource = useReferLottieSource(step);
  const lottieThemeVariant = themeVariant === 'dark' ? 'dark' : 'light';
  const width = getInviteCodeStepImageWidth(pageWidth);
  const height = getInviteCodeStepImageHeight(pageWidth);
  const renderMode =
    platformEnv.isNativeIOS && step === 2 ? 'SOFTWARE' : 'AUTOMATIC';

  // The intro flips between both steps: warm the other one while this one
  // is on screen, so "Next" has its illustration ready.
  useEffect(() => {
    if (isActive !== undefined) return;
    void getReferLottieSource({
      step: step === 1 ? 2 : 1,
      themeVariant: lottieThemeVariant,
    });
  }, [isActive, lottieThemeVariant, step]);

  useEffect(() => {
    if (!lottieSource || !onSourceAvailabilityChange) return;
    onSourceAvailabilityChange(true);
    return () => onSourceAvailabilityChange(false);
  }, [lottieSource, onSourceAvailabilityChange]);

  return (
    <Stack w={width} h={height} alignSelf="center" bg="$bgApp">
      {lottieSource ? (
        <LottieView
          source={lottieSource}
          width={width}
          height={height}
          autoPlay={isActive ?? true}
          // iOS resets native progress to zero before applying autoPlay on entry.
          nativeProgress={isActive === false ? 1 : undefined}
          loop={step === 2}
          resizeMode="contain"
          renderMode={renderMode}
          backgroundColor="$bgApp"
        />
      ) : null}
    </Stack>
  );
});
