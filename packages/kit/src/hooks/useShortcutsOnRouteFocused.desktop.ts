import { useCallback } from 'react';

import { useShortcuts } from '@onekeyhq/components';
import type { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { useRouteIsFocused } from './useRouteIsFocused';

export const useShortcutsOnRouteFocused = (
  shortcutKey: EShortcutEvents,
  onShortcuts: () => void,
) => {
  const isFocus = useRouteIsFocused();
  const handleShortcuts = useCallback(() => {
    if (isFocus) {
      onShortcuts();
    }
  }, [isFocus, onShortcuts]);
  useShortcuts(shortcutKey, handleShortcuts);
};
