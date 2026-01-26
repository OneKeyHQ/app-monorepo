import { useWindowDimensions } from 'react-native';

import { Image, useMedia } from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { REFERRAL_IMAGE_BASE_URL } from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const MOBILE_IMAGE_URI = `${REFERRAL_IMAGE_BASE_URL}/2-1.png`;
const DESKTOP_IMAGE_URI = `${REFERRAL_IMAGE_BASE_URL}/2-2.png`;
const DESKTOP_IMAGE_ASPECT_RATIO = 284 / 640;
const DESKTOP_IMAGE_WIDTH = 640;

export function InvitedByFriendImage() {
  const { gtSm } = useMedia();
  const themeVariant = useThemeVariant();
  const { width: screenWidth } = useWindowDimensions();

  const isDesktopImage =
    !platformEnv.isNative && (gtSm || platformEnv.isExtensionUiPopup);
  const imageUri = isDesktopImage ? DESKTOP_IMAGE_URI : MOBILE_IMAGE_URI;
  const imageWidth =
    !platformEnv.isNative && gtSm ? DESKTOP_IMAGE_WIDTH : screenWidth;
  const imageHeight = isDesktopImage
    ? imageWidth * DESKTOP_IMAGE_ASPECT_RATIO
    : screenWidth;

  return (
    <Image
      source={{ uri: imageUri }}
      w={imageWidth}
      h={imageHeight}
      resizeMode="contain"
      opacity={themeVariant === 'dark' ? 0.95 : 1}
    />
  );
}
