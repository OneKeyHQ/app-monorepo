import { useMemo } from 'react';

import { shortcutsMap } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import type { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

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

export type IShortcut = XStackProps & {
  shortcutKey?: EShortcutEvents;
};

function ShortcutContent({ shortcutKey }: { shortcutKey: EShortcutEvents }) {
  return useMemo(() => {
    const keys = shortcutsMap[shortcutKey].keys;
    return keys.map((key) => <ShortCutKey key={key}>{key}</ShortCutKey>);
  }, [shortcutKey]);
}

export function Shortcut(props: IShortcut) {
  const { children, shortcutKey, ...rest } = props;

  return (
    <XStack gap="$1" {...rest}>
      {shortcutKey ? <ShortcutContent shortcutKey={shortcutKey} /> : children}
    </XStack>
  );
}

Shortcut.Key = ShortCutKey;
