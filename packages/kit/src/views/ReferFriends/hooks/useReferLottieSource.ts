import { useEffect, useState } from 'react';

import type { ILottieViewProps } from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';

function resolveLottieModule(module: unknown): ILottieViewProps['source'] {
  const lottieModule = module as { default?: ILottieViewProps['source'] };
  return lottieModule.default ?? module;
}

async function loadReferLottieSource(themeVariant: 'light' | 'dark') {
  return themeVariant === 'dark'
    ? resolveLottieModule(
        await import('@onekeyhq/kit/assets/animations/_mov_refer_dark.json'),
      )
    : resolveLottieModule(
        await import('@onekeyhq/kit/assets/animations/_mov_refer.json'),
      );
}

export function useReferLottieSource(): ILottieViewProps['source'] | null {
  const themeVariant = useThemeVariant();
  const lottieThemeVariant = themeVariant === 'dark' ? 'dark' : 'light';
  const [source, setSource] = useState<ILottieViewProps['source'] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSource(null);
    void loadReferLottieSource(lottieThemeVariant).then((nextSource) => {
      if (!cancelled) {
        setSource(nextSource);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [lottieThemeVariant]);

  return source;
}
