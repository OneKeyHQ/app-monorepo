import type { GetProps } from '@onekeyhq/components/src/shared/tamagui';

import { XStack } from '../../../primitives';

export default function HeaderButtonGroup(props: GetProps<typeof XStack>) {
  const { children, ...rest } = props;

  return (
    <XStack
      gap="$5"
      alignItems="center"
      testID="Navigation-HeaderView-ButtonGroup"
      {...rest}
    >
      {children}
    </XStack>
  );
}
