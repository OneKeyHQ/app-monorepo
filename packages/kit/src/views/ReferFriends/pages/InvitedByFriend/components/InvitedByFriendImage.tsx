import { useMemo } from 'react';

import { useWindowDimensions } from 'react-native';

import { Image, useMedia } from '@onekeyhq/components';
import mobileImg from '@onekeyhq/kit/assets/inviteCode/3-1.png';
import desktopImg from '@onekeyhq/kit/assets/inviteCode/3-2.png';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const DESKTOP_IMAGE_ASPECT_RATIO = 284 / 640;

function InvitedByFriendImage() {
  const { gtSm } = useMedia();
  const themeVariant = useThemeVariant();
  const { width: screenWidth } = useWindowDimensions();

  const isDesktopImage =
    !platformEnv.isNative && (gtSm || platformEnv.isExtensionUiPopup);
  const selectedImage = isDesktopImage ? desktopImg : mobileImg;

  const imageWidth = useMemo(() => {
    if (!platformEnv.isNative && gtSm) {
      return 640;
    }
    return screenWidth;
  }, [gtSm, screenWidth]);

  const imageHeight = useMemo(() => {
    if (isDesktopImage) {
      return imageWidth * DESKTOP_IMAGE_ASPECT_RATIO;
    }
    return screenWidth;
  }, [imageWidth, isDesktopImage, screenWidth]);

  return (
    <Image
      source={selectedImage}
      w={imageWidth}
      h={imageHeight}
      resizeMode="contain"
      opacity={themeVariant === 'dark' ? 0.95 : 1}
    />
  );
}

export { InvitedByFriendImage };
