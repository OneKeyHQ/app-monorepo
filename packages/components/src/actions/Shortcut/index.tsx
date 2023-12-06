import { Text, XStack } from '../../primitives';

import type { ITextProps } from '../../primitives';
import type { XStackProps } from 'tamagui';

function ShortCutKey(props: ITextProps) {
  const { children, ...rest } = props;

  return (
    <Text
      variant="$headingXs"
      color="$textSubdued"
      px="$0.5"
      borderRadius="$1"
      minWidth="$4"
      justifyContent="center"
      bg="$bgStrong"
      textAlign="center"
      {...rest}
    >
      {children}
    </Text>
  );
}

export type IShortcut = XStackProps;

export function Shortcut(props: IShortcut) {
  const { children, ...rest } = props;

  return (
    <XStack space="$1" {...rest}>
      {children}
    </XStack>
  );
}

Shortcut.Key = ShortCutKey;
