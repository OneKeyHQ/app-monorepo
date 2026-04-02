import {
  LottieView,
  Stack,
  useMedia,
  usePageWidth,
} from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const DESKTOP_ASPECT_RATIO = 284 / 640;
const DESKTOP_WIDTH = 640;

const LOTTIE_SOURCE = {
  light: require('@onekeyhq/kit/assets/animations/_mov_refer.json'),
  dark: require('@onekeyhq/kit/assets/animations/_mov_refer_dark.json'),
};

export function InvitedByFriendImage() {
  const { gtSm } = useMedia();
  const themeVariant = useThemeVariant();
  const pageWidth = usePageWidth();

  const isDesktop =
    !platformEnv.isNative && (gtSm || platformEnv.isExtensionUiPopup);
  const lottieSource =
    LOTTIE_SOURCE[themeVariant === 'dark' ? 'dark' : 'light'];
  const width = !platformEnv.isNative && gtSm ? DESKTOP_WIDTH : pageWidth;
  const height = isDesktop ? width * DESKTOP_ASPECT_RATIO : pageWidth;

  return (
    <Stack w={width} h={height} alignSelf="center">
      <LottieView
        source={lottieSource}
        width={width}
        height={height}
        autoPlay
        loop
        resizeMode="contain"
      />
    </Stack>
  );
}
