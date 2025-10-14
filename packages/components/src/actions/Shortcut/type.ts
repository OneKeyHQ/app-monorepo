import type { XStackProps } from '@onekeyhq/components/src/shared/tamagui';
import type { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import type { ISizableTextProps } from '../../primitives/SizeableText';

export type IShortcutProps = XStackProps & {
  shortcutKey?: EShortcutEvents;
};

export type IShortcutContentProps = {
  shortcutKey: EShortcutEvents;
};

export type IShortcutKeyProps = ISizableTextProps;
