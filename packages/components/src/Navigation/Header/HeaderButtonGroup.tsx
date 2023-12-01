import { XStack } from '../../Stack';

import type { GetProps } from 'tamagui';

export default function HeaderButtonGroup(props: GetProps<typeof XStack>) {
  const { children, ...rest } = props;

  return (
    <XStack space="$6" alignItems="center" {...rest}>
      {children}
    </XStack>
  );
}
