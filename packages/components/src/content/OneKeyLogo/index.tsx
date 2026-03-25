import { Icon } from '../../primitives/Icon';
import { Image } from '../../primitives/Image';
import { Skeleton } from '../../primitives/Skeleton';
import { XStack, YStack } from '../../primitives/Stack';

import type { GetProps } from '@tamagui/core';

type IOneKeyLogoProps = GetProps<typeof XStack>;

const decorativeLogoFallback = (
  <Skeleton borderRadius={13} width={58} height={58} />
);

const decorativeWebStyle = {
  boxShadow:
    '0 8px 12px 0 rgba(4, 31, 0, 0.08), 0 1px 2px 0 rgba(4, 31, 0, 0.10), 0 0 2px 0 rgba(4, 31, 0, 0.10)',
};

const decorativeNativeStyle = {
  elevation: 1,
};

const decorativeAnimateOnly = ['transform'];

const decorativeHoverStyle = {
  scale: 0.95,
};

export function OneKeyLogo({
  px = '$4',
  py = '$3',
  ...rest
}: IOneKeyLogoProps) {
  return (
    <XStack px={px} py={py} {...rest}>
      <Icon name="OnekeyTextIllus" width={101} height={28} color="$text" />
    </XStack>
  );
}

export function DecorativeOneKeyLogo() {
  return (
    <YStack
      $platform-web={decorativeWebStyle}
      $platform-native={decorativeNativeStyle}
      borderRadius={13}
      animation="quick"
      animateOnly={decorativeAnimateOnly}
      hoverStyle={decorativeHoverStyle}
    >
      <Image
        source={require('@onekeyhq/kit/assets/onboarding/logo-decorative.png')}
        width={58}
        height={58}
        zIndex={1}
        fallback={decorativeLogoFallback}
      />
    </YStack>
  );
}
