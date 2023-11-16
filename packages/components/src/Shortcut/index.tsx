import { XStack } from '../Stack';
import { Text } from '../Text';

import type { ITextProps } from '../Text';
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

export function Shortcut(props: XStackProps) {
  const { children, ...rest } = props;

  return (
    <XStack space="$1" {...rest}>
      {children}
    </XStack>
  );
}

Shortcut.Key = ShortCutKey;
