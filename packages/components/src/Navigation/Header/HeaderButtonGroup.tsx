import { XStack } from '../../Stack';

import type { GetProps } from 'tamagui';

export default function HeaderButtonGroup(props: GetProps<typeof XStack>) {
  const { children, ...rest } = props;

  return (
    <XStack
      space="$2.5"
      alignItems="center"
      testID="Navigation-HeaderView-ButtonGroup"
      {...rest}
    >
      {children}
    </XStack>
  );
}
