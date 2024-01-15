import { SizableText, XStack } from '../../primitives';

import type { ISizableTextProps } from '../../primitives';
import type { XStackProps } from 'tamagui';

function ShortCutKey(props: ISizableTextProps) {
  const { children, ...rest } = props;

  return (
    <SizableText
      size="$headingXs"
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
    </SizableText>
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
