import { Icon, XStack } from '../../primitives';

import type { GetProps } from '@tamagui/core';

type IOneKeyLogoProps = GetProps<typeof XStack>;

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
