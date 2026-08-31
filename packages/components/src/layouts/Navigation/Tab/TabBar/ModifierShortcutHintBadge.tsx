import { memo, useMemo } from 'react';

import { Shortcut } from '@onekeyhq/components/src/actions';
import { useModifierHintRevealVisible } from '@onekeyhq/components/src/hooks';
import { Stack } from '@onekeyhq/components/src/primitives';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { getTabRouteAriaKeyShortcut } from '@onekeyhq/shared/src/shortcuts/tabRouteShortcuts';

type IModifierShortcutHintBadgeProps = {
  shortcutKey?: EShortcutEvents;
  routeName?: string;
  requiresPopoverOpen?: boolean;
  isPopoverOpen?: boolean;
  placement?: 'overlay' | 'inline';
};

function BasicModifierShortcutHintBadge({
  shortcutKey,
  routeName,
  requiresPopoverOpen = false,
  isPopoverOpen = false,
  placement = 'overlay',
}: IModifierShortcutHintBadgeProps) {
  const modifierHintVisible = useModifierHintRevealVisible();
  const visible = useMemo(() => {
    if (!modifierHintVisible) {
      return false;
    }
    if (requiresPopoverOpen) {
      return isPopoverOpen;
    }
    return true;
  }, [isPopoverOpen, modifierHintVisible, requiresPopoverOpen]);

  const ariaKeyShortcut = useMemo(
    () => (routeName ? getTabRouteAriaKeyShortcut(routeName) : undefined),
    [routeName],
  );

  if (!platformEnv.isDesktop || !shortcutKey) {
    return null;
  }

  const sharedProps = {
    pointerEvents: 'none' as const,
    opacity: visible ? 1 : 0,
    animation: 'quick' as const,
    enterStyle: { opacity: 0, scale: 0.95 },
    exitStyle: { opacity: 0, scale: 0.95 },
    'aria-hidden': !visible,
    'aria-keyshortcuts': ariaKeyShortcut,
  };

  if (placement === 'inline') {
    return (
      <Stack {...sharedProps}>
        <Shortcut shortcutKey={shortcutKey} />
      </Stack>
    );
  }

  return (
    <Stack position="absolute" top={0} right={0} zIndex={1} {...sharedProps}>
      <Shortcut shortcutKey={shortcutKey} />
    </Stack>
  );
}

export const ModifierShortcutHintBadge = memo(BasicModifierShortcutHintBadge);
