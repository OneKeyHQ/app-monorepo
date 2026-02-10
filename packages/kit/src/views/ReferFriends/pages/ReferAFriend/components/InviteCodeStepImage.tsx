import {
  LottieView,
  Stack,
  useMedia,
  usePageWidth,
} from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const DESKTOP_ASPECT_RATIO = 284 / 640;
const DESKTOP_WIDTH = 540;

const LOTTIE_MAP = {
  1: {
    light: require('@onekeyhq/kit/assets/animations/_mov_referHardware.json'),
    dark: require('@onekeyhq/kit/assets/animations/_mov_referHardware_dark.json'),
  },
  2: {
    light: require('@onekeyhq/kit/assets/animations/_mov_refer.json'),
    dark: require('@onekeyhq/kit/assets/animations/_mov_refer_dark.json'),
  },
} as const;

interface IInviteCodeStepImageProps {
  step: 1 | 2;
}

export function InviteCodeStepImage({ step }: IInviteCodeStepImageProps) {
  const { gtSm } = useMedia();
  const themeVariant = useThemeVariant();
  const pageWidth = usePageWidth();
  const isDesktop = gtSm || platformEnv.isExtensionUiPopup;
  const lottieSource =
    LOTTIE_MAP[step][themeVariant === 'dark' ? 'dark' : 'light'];
  const width = gtSm ? DESKTOP_WIDTH : pageWidth;
  const height = isDesktop ? width * DESKTOP_ASPECT_RATIO : pageWidth;
  const shouldLoop = step === 2;

  return (
    <Stack w={width} h={height} alignSelf="center">
      <LottieView
        source={lottieSource}
        width={width}
        height={height}
        autoPlay
        loop={shouldLoop}
        resizeMode="contain"
        renderMode="AUTOMATIC"
      />
    </Stack>
  );
}
