import { type KeyboardEvent, useEffect, useId, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function usePerpMarketTabList<T extends string>(
  selected: T,
  items: readonly { key: T }[],
) {
  const id = useId();
  const panelId = (key: T) => `${id}-${key}-panel`;
  const [focused, setFocused] = useState<T>();
  const hasFocusedTab = items.some((item) => item.key === focused);
  useEffect(() => {
    if (focused && !hasFocusedTab) setFocused(undefined);
  }, [focused, hasFocusedTab]);

  const getButtonProps = (key: T) => ({
    id: `${id}-${key}`,
    'aria-controls': panelId(key),
    tabIndex: (hasFocusedTab ? focused : selected) === key ? 0 : -1,
    onFocus: () => setFocused(key),
    onBlur: () => setFocused(undefined),
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
        return;
      const index = items.findIndex((item) => item.key === key);
      let nextIndex: number;
      switch (event.key) {
        case 'ArrowLeft':
          nextIndex = (index + items.length - 1) % items.length;
          break;
        case 'ArrowRight':
          nextIndex = (index + 1) % items.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = items.length - 1;
          break;
        default:
          return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.ownerDocument
        .getElementById(`${id}-${items[nextIndex].key}`)
        ?.focus();
    },
  });

  return {
    getButtonProps,
    getPanelProps: (key: T) =>
      platformEnv.isNative
        ? {}
        : {
            id: panelId(key),
            role: 'tabpanel' as const,
            'aria-labelledby': `${id}-${key}`,
          },
  };
}
