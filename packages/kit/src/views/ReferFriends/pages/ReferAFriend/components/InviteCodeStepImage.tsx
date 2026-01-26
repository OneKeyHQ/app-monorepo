import { useWindowDimensions } from 'react-native';

import { Image, useMedia } from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { REFERRAL_IMAGE_BASE_URL } from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const DESKTOP_IMAGE_ASPECT_RATIO = 284 / 640;
const DESKTOP_IMAGE_WIDTH = 540;

const IMAGE_MAP = {
  1: {
    mobile: `${REFERRAL_IMAGE_BASE_URL}/1-1.png`,
    desktop: `${REFERRAL_IMAGE_BASE_URL}/1-2.png`,
  },
  2: {
    mobile: `${REFERRAL_IMAGE_BASE_URL}/2-1.png`,
    desktop: `${REFERRAL_IMAGE_BASE_URL}/2-2.png`,
  },
} as const;

interface IInviteCodeStepImageProps {
  step: 1 | 2;
}

export function InviteCodeStepImage({ step }: IInviteCodeStepImageProps) {
  const { gtSm } = useMedia();
  const themeVariant = useThemeVariant();
  const { width: screenWidth } = useWindowDimensions();

  const isDesktopImage = gtSm || platformEnv.isExtensionUiPopup;
  const imageUri = IMAGE_MAP[step][isDesktopImage ? 'desktop' : 'mobile'];
  const imageWidth = gtSm ? DESKTOP_IMAGE_WIDTH : screenWidth;
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
