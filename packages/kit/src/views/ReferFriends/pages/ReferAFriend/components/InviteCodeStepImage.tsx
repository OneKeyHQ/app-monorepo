import { useMemo } from 'react';

import { useWindowDimensions } from 'react-native';

import { Image, useMedia } from '@onekeyhq/components';
import step1MobileImg from '@onekeyhq/kit/assets/inviteCode/1-1.png';
import step1DesktopImg from '@onekeyhq/kit/assets/inviteCode/1-2.png';
import step2MobileImg from '@onekeyhq/kit/assets/inviteCode/2-1.png';
import step2DesktopImg from '@onekeyhq/kit/assets/inviteCode/2-2.png';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const DESKTOP_IMAGE_ASPECT_RATIO = 284 / 640;

interface IInviteCodeStepImageProps {
  /** Step number (1 or 2) */
  step: 1 | 2;
}

/**
 * Responsive component to display invite code step images
 * Automatically switches between mobile and desktop versions based on screen size
 * - Mobile (Native): (screenWidth - 32)px width with 1:1 aspect ratio
 * - Mobile (Web): 100% width with auto height
 * - Desktop: 640x284px
 */
export function InviteCodeStepImage({ step }: IInviteCodeStepImageProps) {
  const { gtSm } = useMedia();
  const themeVariant = useThemeVariant();
  const { width: screenWidth } = useWindowDimensions();
  const isDesktopImage = gtSm || platformEnv.isExtensionUiPopup;

  // Image mapping for steps and responsive versions
  const imageMap = {
    1: {
      mobile: step1MobileImg,
      desktop: step1DesktopImg,
    },
    2: {
      mobile: step2MobileImg,
      desktop: step2DesktopImg,
    },
  };

  // Select image based on step and screen size
  const selectedImage = imageMap[step]?.[isDesktopImage ? 'desktop' : 'mobile'];

  // Calculate image width based on platform and screen size
  const imageWidth = useMemo(() => {
    if (gtSm) return 540; // Desktop: fixed width
    return screenWidth; // Native / popup: screen width minus padding
  }, [gtSm, screenWidth]);

  // Calculate image height based on platform
  const imageHeight = useMemo(() => {
    if (isDesktopImage) {
      return imageWidth * DESKTOP_IMAGE_ASPECT_RATIO;
    }
    return screenWidth; // Native mobile: keep square
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
