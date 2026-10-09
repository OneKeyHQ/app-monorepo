import { useEffect, useState } from 'react';

import type { ILottieViewProps } from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';

type IReferLottieSource = ILottieViewProps['source'];
// Step 1 is the hardware intro; step 2 is the referral loop.
type IReferLottieStep = 1 | 2;

function resolveLottieModule(module: unknown): IReferLottieSource {
  const lottieModule = module as { default?: IReferLottieSource };
  return lottieModule.default ?? module;
}

async function loadReferLottieSource({
  step,
  themeVariant,
}: {
  step: IReferLottieStep;
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

// Loaded sources stay cached for the session: the referral pages show the
// same compositions in several places, and re-importing and re-parsing a
// ~160 KB composition on every mount left the illustration blank for a
// moment.
const referLottieSourceCache = new Map<string, Promise<IReferLottieSource>>();

export function getReferLottieSource(params: {
  step: IReferLottieStep;
  themeVariant: 'light' | 'dark';
}) {
  const key = `${params.step}-${params.themeVariant}`;
  let pending = referLottieSourceCache.get(key);
  if (!pending) {
    pending = loadReferLottieSource(params);
    referLottieSourceCache.set(key, pending);
    // A failed load should be retried next time, not cached.
    pending.catch(() => referLottieSourceCache.delete(key));
  }
  return pending;
}

// The referral loop (step 2) for the current theme, or null while it loads.
export function useReferLottieSource(): IReferLottieSource | null {
  const themeVariant = useThemeVariant() === 'dark' ? 'dark' : 'light';
  const [source, setSource] = useState<IReferLottieSource | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSource(null);
    void getReferLottieSource({ step: 2, themeVariant }).then((nextSource) => {
      if (!cancelled) {
        setSource(nextSource);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [themeVariant]);

  return source;
}
