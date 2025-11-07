import { Image, useMedia } from '@onekeyhq/components';
import step1MobileImg from '@onekeyhq/kit/assets/inviteCode/1-1.png';
import step1DesktopImg from '@onekeyhq/kit/assets/inviteCode/1-2.png';
import step2MobileImg from '@onekeyhq/kit/assets/inviteCode/2-1.png';
import step2DesktopImg from '@onekeyhq/kit/assets/inviteCode/2-2.png';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';

interface IInviteCodeStepImageProps {
  /** Step number (1 or 2) */
  step: 1 | 2;
}

/**
 * Responsive component to display invite code step images
 * Automatically switches between mobile and desktop versions based on screen size
 * Mobile: 100% width
 * Desktop: 640x284px
 */
export function InviteCodeStepImage({ step }: IInviteCodeStepImageProps) {
  const { gtMd } = useMedia();
  const themeVariant = useThemeVariant();

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

  if (!selectedImage) {
    console.error(`Invalid step value: ${step}`);
    return null;
  }

  // Mobile: 100% width, Desktop: 640x284px
  return (
    <Image
      source={selectedImage}
      w={gtMd ? 640 : '100%'}
      h={gtMd ? 284 : 'auto'}
      resizeMode="contain"
      opacity={themeVariant === 'dark' ? 0.95 : 1}
    />
  );
}
