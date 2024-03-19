import { SizableText, Stack, XStack } from '../../primitives';

import type { ISizableTextProps } from '../../primitives';
import type { XStackProps } from 'tamagui';

function ShortCutKey(props: ISizableTextProps) {
  const { children, ...rest } = props;

  return (
    <Stack
      justifyContent="center"
      px="$0.5"
      borderRadius="$1"
      minWidth="$4"
      bg="$bgStrong"
      borderCurve="continuous"
    >
      <SizableText
        size="$headingXs"
        color="$textPlaceholder"
        textAlign="center"
        {...rest}
      >
        {children}
      </SizableText>
    </Stack>
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
