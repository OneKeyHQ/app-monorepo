import {
  LottieView,
  Stack,
  useMedia,
  usePageWidth,
} from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { useReferLottieSource } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useReferLottieSource';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const DESKTOP_ASPECT_RATIO = 284 / 640;
const DESKTOP_WIDTH = 640;

export function InvitedByFriendImage() {
  const { gtSm } = useMedia();
  const themeVariant = useThemeVariant();
  const pageWidth = usePageWidth();
  const lottieSource = useReferLottieSource();

  const isDesktop =
    !platformEnv.isNative && (gtSm || platformEnv.isExtensionUiPopup);
  const renderMode =
    platformEnv.isNativeIOS && themeVariant !== 'dark' ? 'HARDWARE' : undefined;
  const width = !platformEnv.isNative && gtSm ? DESKTOP_WIDTH : pageWidth;
  const height = isDesktop ? width * DESKTOP_ASPECT_RATIO : pageWidth;

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
