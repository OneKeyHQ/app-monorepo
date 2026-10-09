import { useEffect, useState } from 'react';

import { LottieView, Stack, usePageWidth } from '@onekeyhq/components';
import type { ILottieViewProps } from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Matches the Lottie composition (786x446) so the box has no empty bands.
const LOTTIE_ASPECT_RATIO = 446 / 786;
// Same max width as the intro text and actions, so their edges line up.
const MAX_WIDTH = 480;

function resolveLottieModule(module: unknown): ILottieViewProps['source'] {
  const lottieModule = module as { default?: ILottieViewProps['source'] };
  return lottieModule.default ?? module;
}

async function loadInviteCodeLottieSource({
  step,
  themeVariant,
}: {
  step: 1 | 2;
  themeVariant: 'light' | 'dark';
}) {
  if (step === 1) {
    return themeVariant === 'dark'
      ? resolveLottieModule(
          await import('@onekeyhq/kit/assets/animations/_mov_referHardware_dark.json'),
        )
      : resolveLottieModule(
          await import('@onekeyhq/kit/assets/animations/_mov_referHardware.json'),
        );
  }
  return themeVariant === 'dark'
    ? resolveLottieModule(
        await import('@onekeyhq/kit/assets/animations/_mov_refer_dark.json'),
      )
    : resolveLottieModule(
        await import('@onekeyhq/kit/assets/animations/_mov_refer.json'),
      );
}

type ILottieSource = ILottieViewProps['source'];

// Loaded sources stay cached for the session: the two steps alternate on
// "Next"/"Back", and re-importing and re-parsing a ~160 KB composition on every
// switch left the illustration blank for a moment.
const lottieSourceCache = new Map<string, Promise<ILottieSource>>();

function getInviteCodeLottieSource(params: {
  step: 1 | 2;
  themeVariant: 'light' | 'dark';
}) {
  const key = `${params.step}-${params.themeVariant}`;
  let pending = lottieSourceCache.get(key);
  if (!pending) {
    pending = loadInviteCodeLottieSource(params);
    lottieSourceCache.set(key, pending);
    // A failed load should be retried next time, not cached.
    pending.catch(() => lottieSourceCache.delete(key));
  }
  return pending;
}

interface IInviteCodeStepImageProps {
  step: 1 | 2;
}

export function InviteCodeStepImage({ step }: IInviteCodeStepImageProps) {
  const themeVariant = useThemeVariant();
  const pageWidth = usePageWidth();
  const [lottieSource, setLottieSource] = useState<ILottieSource | null>(null);
  const lottieThemeVariant = themeVariant === 'dark' ? 'dark' : 'light';
  const width = Math.min(pageWidth, MAX_WIDTH);
  const height = width * LOTTIE_ASPECT_RATIO;
  const shouldLoop = step === 2;
  const renderMode =
    platformEnv.isNativeIOS && step === 2 && themeVariant !== 'dark'
      ? 'HARDWARE'
      : 'AUTOMATIC';

  useEffect(() => {
    let cancelled = false;
    setLottieSource(null);
    void getInviteCodeLottieSource({
      step,
      themeVariant: lottieThemeVariant,
    }).then((source) => {
      if (!cancelled) {
        setLottieSource(source);
      }
    });
    // Warm the other step while this one is on screen, so "Next" has its
    // illustration ready.
    void getInviteCodeLottieSource({
      step: step === 1 ? 2 : 1,
      themeVariant: lottieThemeVariant,
    });
    return () => {
      cancelled = true;
    };
  }, [lottieThemeVariant, step]);

  return (
    <Stack w={width} h={height} alignSelf="center" bg="$bgApp">
      {lottieSource ? (
        <LottieView
          source={lottieSource}
          width={width}
          height={height}
          autoPlay
          loop={shouldLoop}
          resizeMode="contain"
          renderMode={renderMode}
          backgroundColor="$bgApp"
        />
      ) : null}
    </Stack>
  );
}
