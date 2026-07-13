import { useEffect, useState } from 'react';

import {
  LottieView,
  Stack,
  useMedia,
  usePageWidth,
} from '@onekeyhq/components';
import type { ILottieViewProps } from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const DESKTOP_ASPECT_RATIO = 284 / 640;
const DESKTOP_WIDTH = 640;

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

export function InvitedByFriendImage() {
  const { gtSm } = useMedia();
  const themeVariant = useThemeVariant();
  const pageWidth = usePageWidth();
  const [lottieSource, setLottieSource] = useState<
    ILottieViewProps['source'] | null
  >(null);

  const isDesktop =
    !platformEnv.isNative && (gtSm || platformEnv.isExtensionUiPopup);
  const lottieThemeVariant = themeVariant === 'dark' ? 'dark' : 'light';
  const renderMode =
    platformEnv.isNativeIOS && themeVariant !== 'dark' ? 'HARDWARE' : undefined;
  const width = !platformEnv.isNative && gtSm ? DESKTOP_WIDTH : pageWidth;
  const height = isDesktop ? width * DESKTOP_ASPECT_RATIO : pageWidth;

  useEffect(() => {
    let cancelled = false;
    setLottieSource(null);
    void loadReferLottieSource(lottieThemeVariant).then((source) => {
      if (cancelled) {
        return;
      }
      setLottieSource(source);
    });
    return () => {
      cancelled = true;
    };
  }, [lottieThemeVariant]);

  return (
    <Stack w={width} h={height} alignSelf="center" bg="$bgApp">
      {lottieSource ? (
        <LottieView
          source={lottieSource}
          width={width}
          height={height}
          autoPlay
          loop
          resizeMode="contain"
          renderMode={renderMode}
          backgroundColor="$bgApp"
        />
      ) : null}
    </Stack>
  );
}
