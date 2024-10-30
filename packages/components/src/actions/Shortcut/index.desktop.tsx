import { useMemo } from 'react';

import { shortcutsMap } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { SizableText, Stack, XStack } from '../../primitives';

import type {
  IShortcutContentProps,
  IShortcutKeyProps,
  IShortcutProps,
} from './type';

function ShortcutKey(props: IShortcutKeyProps) {
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

function ShortcutContent({ shortcutKey }: IShortcutContentProps) {
  return useMemo(() => {
    const keys = shortcutsMap[shortcutKey].keys;
    return keys.map((key) => <ShortcutKey key={key}>{key}</ShortcutKey>);
  }, [shortcutKey]);
}

export function Shortcut(props: IShortcutProps) {
  const { children, shortcutKey, ...rest } = props;

  return (
    <XStack gap="$1" {...rest}>
      {shortcutKey ? <ShortcutContent shortcutKey={shortcutKey} /> : children}
    </XStack>
  );
}

Shortcut.Key = ShortcutKey;

export * from './type';
