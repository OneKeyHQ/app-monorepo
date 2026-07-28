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
const DESKTOP_WIDTH = 540;

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

interface IInviteCodeStepImageProps {
  step: 1 | 2;
}

export function InviteCodeStepImage({ step }: IInviteCodeStepImageProps) {
  const { gtSm } = useMedia();
  const themeVariant = useThemeVariant();
  const pageWidth = usePageWidth();
  const [lottieSource, setLottieSource] = useState<
    ILottieViewProps['source'] | null
  >(null);
  const isDesktop = gtSm || platformEnv.isExtensionUiPopup;
  const lottieThemeVariant = themeVariant === 'dark' ? 'dark' : 'light';
  const width = gtSm ? DESKTOP_WIDTH : pageWidth;
  const height = isDesktop ? width * DESKTOP_ASPECT_RATIO : pageWidth;
  const shouldLoop = step === 2;
  const renderMode =
    platformEnv.isNativeIOS && step === 2 && themeVariant !== 'dark'
      ? 'HARDWARE'
      : 'AUTOMATIC';

  useEffect(() => {
    let cancelled = false;
    setLottieSource(null);
    void loadInviteCodeLottieSource({
      step,
      themeVariant: lottieThemeVariant,
    }).then((source) => {
      if (cancelled) {
        return;
      }
      setLottieSource(source);
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
