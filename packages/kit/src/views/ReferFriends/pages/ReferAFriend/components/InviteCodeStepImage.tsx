import { useMemo } from 'react';

import { useWindowDimensions } from 'react-native';

import { Image, useMedia } from '@onekeyhq/components';
import step1MobileImg from '@onekeyhq/kit/assets/inviteCode/1-1.png';
import step1DesktopImg from '@onekeyhq/kit/assets/inviteCode/1-2.png';
import step2MobileImg from '@onekeyhq/kit/assets/inviteCode/2-1.png';
import step2DesktopImg from '@onekeyhq/kit/assets/inviteCode/2-2.png';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
  const { gtMd } = useMedia();
  const themeVariant = useThemeVariant();
  const { width: screenWidth } = useWindowDimensions();

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
  const selectedImage = imageMap[step]?.[gtMd ? 'desktop' : 'mobile'];

  // Calculate image width based on platform and screen size
  const imageWidth = useMemo(() => {
    if (gtMd) return 640; // Desktop: fixed width
    if (platformEnv.isNative) return screenWidth; // Native: screen width minus padding
    return '100%'; // Web mobile: 100% width
  }, [gtMd, screenWidth]);

  // Calculate image height based on platform
  const imageHeight = useMemo(() => {
    if (gtMd) return 284; // Desktop: fixed height
    if (platformEnv.isNative) return screenWidth; // Native: use aspectRatio instead
    return 'auto'; // Web mobile: auto height
  }, [gtMd, screenWidth]);

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
